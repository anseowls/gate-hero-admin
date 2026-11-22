/**
 * 관리 API 클라이언트. 실서버(httpApi)와 데모(demoApi — 브라우저 안에서 같은 핵심 로직을 돌림)가 같은 모양.
 */
import type { TableInfo, EntrySummary, EntryDetail, Issue, PendingItem, ReleaseRow, Me, UserRow, AuditRow, Role, Json, Change, ReleaseResult, HistoryRow } from '@shared';
import { createCore, createMemoryStore, seedState, AdminError, canDo, type MemState } from '@shared';

export type HistoryItem = HistoryRow & { changes: Change[] };
export interface SaveResult { changed: boolean; updatedAt: number; issues: Issue[] }

export interface Api {
  demo: boolean;
  login(username: string, password: string): Promise<{ token: string; me: Me }>;
  me(): Promise<Me>;
  tables(): Promise<TableInfo[]>;
  entries(t: string): Promise<EntrySummary[]>;
  entry(t: string, k: string): Promise<EntryDetail>;
  check(t: string, k: string, data: Json): Promise<Issue[]>;
  save(t: string, k: string, body: { data: Json; note?: string; baseUpdatedAt: number | null; force?: boolean }): Promise<SaveResult>;
  remove(t: string, k: string, note?: string): Promise<{ ok: boolean }>;
  history(q: { table?: string; key?: string; limit?: number; offset?: number }): Promise<HistoryItem[]>;
  revert(id: number, note?: string): Promise<{ changed: boolean }>;
  pending(): Promise<PendingItem[]>;
  releases(): Promise<ReleaseRow[]>;
  release(note: string): Promise<ReleaseResult>;
  rollback(v: number, note?: string): Promise<ReleaseResult>;
  users(): Promise<UserRow[]>;
  addUser(u: { username: string; password: string; role: Role }): Promise<{ id: number }>;
  patchUser(id: number, p: { role?: Role; disabled?: boolean; password?: string }): Promise<{ ok: boolean }>;
  audit(): Promise<AuditRow[]>;
}

export class ApiError extends Error {
  status: number; code: string; detail: any;
  constructor(status: number, code: string, message: string, detail?: any) { super(message); this.status = status; this.code = code; this.detail = detail; }
}

/* ---------------- 실서버 ---------------- */
const TOKEN_KEY = 'gha_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* 저장 불가 환경 */ } }
};

function httpApi(base = ''): Api {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const tok = tokenStore.get();
    const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, j.code || 'ERROR', j.message || `오류 ${res.status}`, j.detail);
    return j as T;
  }
  const e = encodeURIComponent;
  return {
    demo: false,
    login: (username, password) => call('POST', '/api/auth/login', { username, password }),
    me: () => call('GET', '/api/auth/me'),
    tables: () => call('GET', '/api/tables'),
    entries: t => call('GET', `/api/tables/${e(t)}`),
    entry: (t, k) => call('GET', `/api/tables/${e(t)}/${e(k)}`),
    check: (t, k, data) => call('POST', `/api/tables/${e(t)}/${e(k)}/check`, { data }),
    save: (t, k, body) => call('PUT', `/api/tables/${e(t)}/${e(k)}`, body),
    remove: (t, k, note) => call('DELETE', `/api/tables/${e(t)}/${e(k)}?note=${e(note || '')}`),
    history: q => call('GET', '/api/history?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString()),
    revert: (id, note) => call('POST', `/api/history/${id}/revert`, { note }),
    pending: () => call('GET', '/api/releases/pending'),
    releases: () => call('GET', '/api/releases'),
    release: note => call('POST', '/api/releases', { note }),
    rollback: (v, note) => call('POST', `/api/releases/${v}/rollback`, { note }),
    users: () => call('GET', '/api/users'),
    addUser: u => call('POST', '/api/users', u),
    patchUser: (id, p) => call('PATCH', `/api/users/${id}`, p),
    audit: () => call('GET', '/api/audit')
  };
}

/* ---------------- 데모(브라우저 안) ---------------- */
const DEMO_KEY = 'gha_demo_state_v1';
function fnv(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return ('0000000' + (h >>> 0).toString(16)).slice(-8) + s.length.toString(16).padStart(8, '0'); }

async function demoApi(): Promise<Api> {
  const seed = (await import('../demo/seed.json')).default as Record<string, Record<string, unknown>>;
  let init: MemState | null = null;
  try { const s = localStorage.getItem(DEMO_KEY); if (s) init = JSON.parse(s); } catch { /* 저장 불가 */ }
  const store = createMemoryStore(init || seedState(seed, 'import', Date.now() - 86400_000));
  const core = createCore({ store, hash: fnv });
  if (!init) core.release('import', '처음 가져온 데이터');
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(store.state())); } catch { /* 저장 불가 */ } };
  let me: Me = { username: 'demo', role: 'admin' };
  const users: UserRow[] = [{ id: 1, username: 'demo', role: 'admin', disabled: false, createdAt: Date.now() }];
  const audits: AuditRow[] = [];
  const log = (action: string, target: string | null, detail?: unknown) => audits.unshift({ id: audits.length + 1, username: me.username, action, target, detail: detail ? JSON.stringify(detail) : null, at: Date.now() });
  const run = async <T,>(need: Role, fn: () => T, persist = false): Promise<T> => {
    await new Promise(r => setTimeout(r, 120));   // 실제 통신처럼 살짝 기다림
    if (!canDo(me.role, need)) throw new ApiError(403, 'FORBIDDEN', `권한이 부족해요(${need} 이상)`);
    try { const r = fn(); if (persist) save(); return r; }
    catch (e) { if (e instanceof AdminError) throw new ApiError(e.status, e.code, e.message, e.detail); throw e; }
  };
  const reload = { ok: true, message: '데모: 게임 서버 알림은 건너뜀' };
  return {
    demo: true,
    login: async (username, password) => { me = { username: username || 'demo', role: (['viewer', 'editor', 'publisher', 'admin'].includes(password) ? password : 'admin') as Role }; users[0] = { ...users[0], username: me.username, role: me.role }; return { token: 'demo', me }; },
    me: async () => me,
    tables: () => run('viewer', () => core.tables()),
    entries: t => run('viewer', () => core.entries(t)),
    entry: (t, k) => run('viewer', () => core.entry(t, k)),
    check: (t, k, d) => run('editor', () => core.check(t, k, d)),
    save: (t, k, b) => run('editor', () => { const r = core.save(me.username, t, k, b.data, b.note || null, b.baseUpdatedAt, !!b.force); if (r.changed) log('entry.save', `${t}.${k}`); return r; }, true),
    remove: (t, k, note) => run('editor', () => core.remove(me.username, t, k, note || null), true),
    history: q => run('viewer', () => core.history(q)),
    revert: (id, note) => run('editor', () => core.revert(me.username, id, note || null), true),
    pending: () => run('viewer', () => core.pending()),
    releases: () => run('viewer', () => core.releases(100)),
    release: note => run('publisher', () => { const r = core.release(me.username, note || null); log('release', 'v' + r.version); return { ...r, reload }; }, true),
    rollback: (v, note) => run('publisher', () => { const r = core.rollback(me.username, v, note || null); log('rollback', 'v' + v); return { ...r, reload }; }, true),
    users: () => run('admin', () => users.slice()),
    addUser: u => run('admin', () => { const id = users.length + 1; users.push({ id, username: u.username, role: u.role, disabled: false, createdAt: Date.now() }); log('user.add', u.username); return { id }; }),
    patchUser: (id, p) => run('admin', () => { const u = users.find(x => x.id === id); if (u) Object.assign(u, p.role ? { role: p.role } : {}, typeof p.disabled === 'boolean' ? { disabled: p.disabled } : {}); return { ok: true }; }),
    audit: () => run('admin', () => audits.slice())
  };
}
export const resetDemo = () => { try { localStorage.removeItem(DEMO_KEY); } catch { /* */ } location.reload(); };

export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
export const apiPromise: Promise<Api> = IS_DEMO ? demoApi() : Promise.resolve(httpApi(import.meta.env.VITE_API_BASE || ''));
