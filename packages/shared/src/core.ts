/**
 * 운영툴 핵심 로직 — 저장소(Store)만 바꿔 끼우면 실서버(SQLite·Postgres)와 데모(브라우저 메모리)가 똑같이 동작한다.
 * 게임 저장소의 server/gamedata.ts와 같은 테이블·같은 규칙(game_data · game_data_history · game_data_releases).
 */
import type { EntryRow, HistoryRow, ReleaseRow, Json, TableInfo, EntrySummary, EntryDetail, PendingItem, Issue } from './types.ts';
import { TABLES, TABLE_NAMES, tableDef, getPath } from './tables.ts';
import { diff, validateEntry, show } from './diff.ts';

/** 게임 서버 gamedata.ts BALANCE_TABLES 순서 — 릴리스 해시가 게임 쪽과 같아지려면 이 순서로 직렬화해야 한다 */
export const RELEASE_ORDER = ['classes', 'skills', 'monsters', 'dungeon', 'economy', 'skilltrees', 'skillbranch', 'shards', 'advancements', 'missions', 'cosmetics', 'combat'];

export interface Store {
  tx<T>(fn: () => T): T;
  entries(table: string): EntryRow[];
  entry(table: string, key: string): EntryRow | null;
  putEntry(row: EntryRow): void;
  delEntry(table: string, key: string): void;
  addHistory(h: Omit<HistoryRow, 'id'>): number;
  history(q: { table?: string; key?: string; limit: number; offset: number }): HistoryRow[];
  historyById(id: number): HistoryRow | null;
  addRelease(r: Omit<ReleaseRow, 'version'> & { content: string }): number;
  releases(limit: number): ReleaseRow[];
  releaseContent(version: number): string | null;
}

export class AdminError extends Error {
  status: number; code: string; detail?: unknown;
  constructor(status: number, code: string, message: string, detail?: unknown) { super(message); this.status = status; this.code = code; this.detail = detail; }
}

export interface CoreOpts { store: Store; now?: () => number; hash: (s: string) => string }

export function createCore({ store, now = () => Date.now(), hash }: CoreOpts) {
  const need = (t: string) => { if (!tableDef(t)) throw new AdminError(404, 'NO_TABLE', `없는 표: ${t}`); };
  const parse = (s: string | null | undefined): Json | undefined => (s == null ? undefined : JSON.parse(s));

  /** DB 전체를 릴리스 모양으로 */
  function snapshot(): Record<string, Record<string, Json>> {
    const out: Record<string, Record<string, Json>> = {};
    for (const t of RELEASE_ORDER) {
      const rows = store.entries(t);
      if (!rows.length) continue;
      const o: Record<string, Json> = {};
      for (const r of rows) o[r.key] = JSON.parse(r.data);
      out[t] = o;
    }
    return out;
  }
  function latest(): ReleaseRow | null { return store.releases(1)[0] || null; }
  function latestData(): Record<string, Record<string, Json>> | null {
    const l = latest(); if (!l) return null;
    const c = store.releaseContent(l.version); return c ? JSON.parse(c) : null;
  }

  /** 마지막 릴리스 이후 바뀐 항목 */
  function pending(table?: string): PendingItem[] {
    const rel = latestData() || {}, out: PendingItem[] = [];
    for (const t of table ? [table] : TABLE_NAMES) {
      const cur = new Map(store.entries(t).map(r => [r.key, r])), old = rel[t] || {};
      for (const [k, r] of cur) {
        if (!(k in old)) { out.push({ table: t, key: k, kind: 'add', changes: [{ path: '(전체)', before: undefined, after: JSON.parse(r.data) }] }); continue; }
        if (JSON.stringify(old[k]) !== r.data) out.push({ table: t, key: k, kind: 'mod', changes: diff(old[k], JSON.parse(r.data)) });
      }
      for (const k of Object.keys(old)) if (!cur.has(k)) out.push({ table: t, key: k, kind: 'del', changes: [{ path: '(전체)', before: old[k], after: undefined }] });
    }
    return out;
  }

  function title(t: string, key: string, v: any): string {
    const d = tableDef(t)!;
    for (const p of d.title) { const s = getPath(v, p); if (typeof s === 'string') return s; }
    return key;
  }

  /** 한 항목을 쓰고 기록을 남긴다(트랜잭션 안에서 부른다) */
  function write(user: string, t: string, key: string, data: Json | undefined, note: string | null) {
    const cur = store.entry(t, key), s = data === undefined ? null : JSON.stringify(data);
    if ((cur ? cur.data : null) === s) return false;
    if (s === null) store.delEntry(t, key);
    else {
      const sort = cur ? cur.sort : Math.max(-1, ...store.entries(t).map(r => r.sort)) + 1;
      store.putEntry({ table: t, key, sort, data: s, updatedAt: now(), updatedBy: user });
    }
    store.addHistory({ table: t, key, oldData: cur ? cur.data : null, newData: s, changedAt: now(), changedBy: user, note });
    return true;
  }

  return {
    tables(): TableInfo[] {
      const p = pending();
      return TABLES.map(d => ({ name: d.name, label: d.label, desc: d.desc, count: store.entries(d.name).length, pending: p.filter(x => x.table === d.name).length }));
    },
    entries(t: string): EntrySummary[] {
      need(t);
      const d = tableDef(t)!, p = new Map(pending(t).map(x => [x.key, x.kind]));
      return store.entries(t).map(r => {
        const v = JSON.parse(r.data);
        const fields = d.summary.map(([lab, path]) => [lab, getPath(v, path)] as [string, unknown]).filter(([, x]) => x !== undefined).map(([lab, x]) => [lab, show(x as Json)] as [string, string]);
        const pk = p.get(r.key);
        return { key: r.key, title: title(t, r.key, v), fields, updatedAt: r.updatedAt, updatedBy: r.updatedBy, pending: pk === 'add' || pk === 'mod' ? pk : null };
      });
    },
    entry(t: string, key: string): EntryDetail {
      need(t);
      const r = store.entry(t, key);
      if (!r) throw new AdminError(404, 'NO_ENTRY', `없는 항목: ${t}.${key}`);
      const rel = latestData();
      return { table: t, key, data: JSON.parse(r.data), updatedAt: r.updatedAt, updatedBy: r.updatedBy, released: rel && rel[t] ? rel[t][key] : undefined };
    },
    /** 미리 검사만(저장 안 함) */
    check(t: string, key: string, data: Json): Issue[] {
      need(t);
      const cur = store.entry(t, key);
      return validateEntry(cur ? JSON.parse(cur.data) : undefined, data);
    },
    /**
     * 저장. baseUpdatedAt이 지금 DB 값과 다르면 다른 사람이 먼저 고친 것 → 409.
     * 형식 오류가 있으면 422. 경고는 force가 있어야 저장.
     */
    save(user: string, t: string, key: string, data: Json, note: string | null, baseUpdatedAt: number | null, force = false) {
      need(t);
      if (!key || !/^[\w.#:-]{1,64}$/.test(key)) throw new AdminError(400, 'BAD_KEY', '키는 영문·숫자·_.#:- 64자 이내');
      return store.tx(() => {
        const cur = store.entry(t, key);
        if (cur && baseUpdatedAt != null && cur.updatedAt !== baseUpdatedAt) throw new AdminError(409, 'CONFLICT', `${cur.updatedBy}님이 먼저 고쳤어요. 새로 불러온 뒤 다시 저장하세요.`);
        if (!cur && baseUpdatedAt != null) throw new AdminError(409, 'CONFLICT', '그 사이 항목이 삭제됐어요.');
        const issues = validateEntry(cur ? JSON.parse(cur.data) : undefined, data);
        if (issues.some(i => i.level === 'error')) throw new AdminError(422, 'INVALID', '형식 오류가 있어요', issues);
        if (issues.length && !force) throw new AdminError(422, 'NEEDS_CONFIRM', '확인이 필요한 변경이 있어요', issues);
        const changed = write(user, t, key, data, note);
        return { changed, updatedAt: store.entry(t, key)!.updatedAt, issues };
      });
    },
    remove(user: string, t: string, key: string, note: string | null) {
      need(t);
      return store.tx(() => { if (!store.entry(t, key)) throw new AdminError(404, 'NO_ENTRY', '없는 항목'); write(user, t, key, undefined, note); return { ok: true }; });
    },
    history(q: { table?: string; key?: string; limit?: number; offset?: number }) {
      return store.history({ table: q.table, key: q.key, limit: Math.min(200, q.limit || 50), offset: q.offset || 0 }).map(h => ({ ...h, changes: diff(parse(h.oldData), parse(h.newData)) }));
    },
    /** 기록 한 줄을 되돌리기 = 그 변경 이전 값으로 다시 쓰기(새 기록이 남는다) */
    revert(user: string, id: number, note: string | null) {
      const h = store.historyById(id);
      if (!h) throw new AdminError(404, 'NO_HISTORY', '없는 기록');
      return store.tx(() => ({ changed: write(user, h.table, h.key, parse(h.oldData), note || `되돌림 #${id}`) }));
    },
    pending,
    releases(limit = 50) { return store.releases(limit); },
    releaseData(version: number) {
      const c = store.releaseContent(version);
      if (!c) throw new AdminError(404, 'NO_RELEASE', `없는 릴리스 v${version}`);
      return JSON.parse(c);
    },
    /** 지금 DB를 새 릴리스로. 바뀐 게 없으면 만들지 않는다 */
    release(user: string, note: string | null) {
      return store.tx(() => {
        const data = snapshot();
        if (!Object.keys(data).length) throw new AdminError(409, 'EMPTY', 'DB에 데이터가 없어요');
        const text = JSON.stringify(data), h = hash(text), l = latest();
        if (l && l.hash === h) return { version: l.version, hash: h, created: false };
        const version = store.addRelease({ createdAt: now(), createdBy: user, note, hash: h, content: text });
        return { version, hash: h, created: true };
      });
    },
    /** 그 릴리스 내용으로 DB를 되돌리고 새 릴리스로 저장 */
    rollback(user: string, version: number, note: string | null) {
      const c = store.releaseContent(version);
      if (!c) throw new AdminError(404, 'NO_RELEASE', `없는 릴리스 v${version}`);
      const data = JSON.parse(c) as Record<string, Record<string, Json>>, why = note || `v${version}로 되돌림`;
      store.tx(() => {
        for (const t of TABLE_NAMES) {
          const want = data[t] || {}, cur = store.entries(t);
          for (const r of cur) if (!(r.key in want)) write(user, t, r.key, undefined, why);
          for (const [k, v] of Object.entries(want)) write(user, t, k, v, why);
        }
      });
      return this.release(user, why);
    }
  };
}
export type Core = ReturnType<typeof createCore>;
