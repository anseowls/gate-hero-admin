/**
 * 게임 DB(SQLite)의 밸런스 테이블을 쓰는 Store.
 * 테이블은 게임 저장소 마이그레이션 012_game_data가 만든다(없으면 같은 모양으로 만들어 둔다 — 개발용).
 * Postgres로 옮길 때는 같은 Store 인터페이스로 pg-store.ts를 하나 더 만들면 된다.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Store } from '../../../packages/shared/src/core.ts';
import type { EntryRow, HistoryRow, ReleaseRow } from '../../../packages/shared/src/types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_data (table_name TEXT NOT NULL, entry_key TEXT NOT NULL, sort_order INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY (table_name, entry_key));
CREATE TABLE IF NOT EXISTS game_data_history (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, entry_key TEXT NOT NULL, old_data TEXT, new_data TEXT, changed_at INTEGER NOT NULL, changed_by TEXT NOT NULL, note TEXT);
CREATE TABLE IF NOT EXISTS game_data_releases (version INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, created_by TEXT NOT NULL, note TEXT, hash TEXT NOT NULL, content TEXT NOT NULL);`;

const E = (r: any): EntryRow => ({ table: r.table_name, key: r.entry_key, sort: r.sort_order, data: r.data, updatedAt: r.updated_at, updatedBy: r.updated_by });
const H = (r: any): HistoryRow => ({ id: r.id, table: r.table_name, key: r.entry_key, oldData: r.old_data, newData: r.new_data, changedAt: r.changed_at, changedBy: r.changed_by, note: r.note });
const R = (r: any): ReleaseRow => ({ version: r.version, createdAt: r.created_at, createdBy: r.created_by, note: r.note, hash: r.hash });

export function createSqliteStore(file: string): Store & { db: DatabaseSync } {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  let depth = 0;
  const q = (sql: string) => db.prepare(sql);
  return {
    db,
    tx(fn) {
      if (depth) return fn();
      db.exec('BEGIN IMMEDIATE'); depth++;
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } finally { depth--; }
    },
    entries: t => q('SELECT * FROM game_data WHERE table_name = ? ORDER BY sort_order').all(t).map(E),
    entry: (t, k) => { const r = q('SELECT * FROM game_data WHERE table_name = ? AND entry_key = ?').get(t, k); return r ? E(r) : null; },
    putEntry: r => { q(`INSERT INTO game_data (table_name, entry_key, sort_order, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(table_name, entry_key) DO UPDATE SET sort_order = excluded.sort_order, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).run(r.table, r.key, r.sort, r.data, r.updatedAt, r.updatedBy); },
    delEntry: (t, k) => { q('DELETE FROM game_data WHERE table_name = ? AND entry_key = ?').run(t, k); },
    addHistory: h => Number(q('INSERT INTO game_data_history (table_name, entry_key, old_data, new_data, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(h.table, h.key, h.oldData, h.newData, h.changedAt, h.changedBy, h.note).lastInsertRowid),
    history: f => {
      const w: string[] = [], a: any[] = [];
      if (f.table) { w.push('table_name = ?'); a.push(f.table); }
      if (f.key) { w.push('entry_key = ?'); a.push(f.key); }
      return q(`SELECT * FROM game_data_history ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...a, f.limit, f.offset).map(H);
    },
    historyById: id => { const r = q('SELECT * FROM game_data_history WHERE id = ?').get(id); return r ? H(r) : null; },
    addRelease: r => Number(q('INSERT INTO game_data_releases (created_at, created_by, note, hash, content) VALUES (?, ?, ?, ?, ?)').run(r.createdAt, r.createdBy, r.note, r.hash, r.content).lastInsertRowid),
    releases: limit => q('SELECT version, created_at, created_by, note, hash FROM game_data_releases ORDER BY version DESC LIMIT ?').all(limit).map(R),
    releaseContent: v => { const r: any = q('SELECT content FROM game_data_releases WHERE version = ?').get(v); return r ? r.content : null; }
  };
}
