/** 운영툴 자체 DB(게임 DB와 분리): 관리자 계정 · 감사 기록 */
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Role, UserRow, AuditRow } from '../../../packages/shared/src/types.ts';
import { ROLE_RANK } from '../../../packages/shared/src/types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, pw_hash TEXT NOT NULL, role TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_audit_at ON admin_audit(at DESC);`;

/** scrypt(N=16384) — 비밀번호 해시 "salt:hash" */
export function hashPw(pw: string): string { const salt = randomBytes(16); return salt.toString('hex') + ':' + scryptSync(pw, salt, 32).toString('hex'); }
export function checkPw(pw: string, stored: string): boolean {
  const [s, h] = stored.split(':'); if (!s || !h) return false;
  const want = Buffer.from(h, 'hex'), got = scryptSync(pw, Buffer.from(s, 'hex'), 32);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function createAdminDb(file: string, now = () => Date.now()) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  const U = (r: any): UserRow => ({ id: r.id, username: r.username, role: r.role, disabled: !!r.disabled, createdAt: r.created_at });
  return {
    db,
    userCount: () => (db.prepare('SELECT COUNT(*) n FROM admin_users').get() as any).n as number,
    addUser(username: string, pw: string, role: Role) {
      if (!(role in ROLE_RANK)) throw new Error('없는 권한: ' + role);
      if (!/^[\w.-]{3,32}$/.test(username)) throw new Error('아이디는 영문·숫자·_.- 3~32자');
      if (pw.length < 8) throw new Error('비밀번호는 8자 이상');
      return Number(db.prepare('INSERT INTO admin_users (username, pw_hash, role, created_at) VALUES (?, ?, ?, ?)').run(username, hashPw(pw), role, now()).lastInsertRowid);
    },
    /** 로그인 확인: 맞으면 사용자, 아니면 null */
    login(username: string, pw: string): UserRow | null {
      const r: any = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
      if (!r || r.disabled || !checkPw(pw, r.pw_hash)) return null;
      return U(r);
    },
    user: (username: string): UserRow | null => { const r = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username); return r ? U(r) : null; },
    users: (): UserRow[] => db.prepare('SELECT * FROM admin_users ORDER BY id').all().map(U),
    setRole(id: number, role: Role) { db.prepare('UPDATE admin_users SET role = ? WHERE id = ?').run(role, id); },
    setDisabled(id: number, off: boolean) { db.prepare('UPDATE admin_users SET disabled = ? WHERE id = ?').run(off ? 1 : 0, id); },
    setPassword(id: number, pw: string) { if (pw.length < 8) throw new Error('비밀번호는 8자 이상'); db.prepare('UPDATE admin_users SET pw_hash = ? WHERE id = ?').run(hashPw(pw), id); },
    audit(username: string, action: string, target: string | null, detail: unknown) {
      db.prepare('INSERT INTO admin_audit (username, action, target, detail, at) VALUES (?, ?, ?, ?, ?)').run(username, action, target, detail == null ? null : JSON.stringify(detail), now());
    },
    audits: (limit = 100, offset = 0): AuditRow[] => db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset) as any
  };
}
export type AdminDb = ReturnType<typeof createAdminDb>;
