/** 메모리 저장소: 데모(브라우저)·테스트용. snapshot()/restore()로 localStorage에 저장할 수 있다 */
import type { Store } from './core.ts';
import type { EntryRow, HistoryRow, ReleaseRow } from './types.ts';

export interface MemState { entries: EntryRow[]; history: HistoryRow[]; releases: (ReleaseRow & { content: string })[]; seq: { h: number; r: number } }

export function createMemoryStore(init?: MemState): Store & { state(): MemState } {
  let S: MemState = init ? structuredClone(init) : { entries: [], history: [], releases: [], seq: { h: 0, r: 0 } };
  const idx = (t: string, k: string) => S.entries.findIndex(e => e.table === t && e.key === k);
  return {
    tx(fn) { const backup = structuredClone(S); try { return fn(); } catch (e) { S = backup; throw e; } },
    entries: t => S.entries.filter(e => e.table === t).sort((a, b) => a.sort - b.sort).map(e => ({ ...e })),
    entry: (t, k) => { const i = idx(t, k); return i < 0 ? null : { ...S.entries[i] }; },
    putEntry(row) { const i = idx(row.table, row.key); if (i < 0) S.entries.push({ ...row }); else S.entries[i] = { ...row }; },
    delEntry(t, k) { const i = idx(t, k); if (i >= 0) S.entries.splice(i, 1); },
    addHistory(h) { const id = ++S.seq.h; S.history.push({ id, ...h }); return id; },
    history: q => S.history.filter(h => (!q.table || h.table === q.table) && (!q.key || h.key === q.key)).sort((a, b) => b.id - a.id).slice(q.offset, q.offset + q.limit).map(h => ({ ...h })),
    historyById: id => { const h = S.history.find(x => x.id === id); return h ? { ...h } : null; },
    addRelease(r) { const version = ++S.seq.r; S.releases.push({ version, ...r }); return version; },
    releases: limit => S.releases.slice().sort((a, b) => b.version - a.version).slice(0, limit).map(({ content, ...r }) => r),
    releaseContent: v => { const r = S.releases.find(x => x.version === v); return r ? r.content : null; },
    state: () => structuredClone(S)
  };
}

/** 표 객체들을 메모리 저장소 초기 상태로(데모 시작값) */
export function seedState(tables: Record<string, Record<string, unknown>>, by = 'seed', at = 0): MemState {
  const S: MemState = { entries: [], history: [], releases: [], seq: { h: 0, r: 0 } };
  for (const [t, obj] of Object.entries(tables)) Object.entries(obj).forEach(([k, v], i) => S.entries.push({ table: t, key: k, sort: i, data: JSON.stringify(v), updatedAt: at, updatedBy: by }));
  return S;
}
