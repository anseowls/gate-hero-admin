/** 관리자 권한: 보기 → 밸런스 수정 → 배포 → 사용자 관리 */
export type Role = 'viewer' | 'editor' | 'publisher' | 'admin';
export const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, publisher: 2, admin: 3 };
export const ROLE_LABEL: Record<Role, string> = { viewer: '보기', editor: '수정', publisher: '배포', admin: '관리자' };
export const canDo = (have: Role, need: Role) => ROLE_RANK[have] >= ROLE_RANK[need];

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** game_data 한 줄 */
export interface EntryRow { table: string; key: string; sort: number; data: string; updatedAt: number; updatedBy: string }
/** game_data_history 한 줄 */
export interface HistoryRow { id: number; table: string; key: string; oldData: string | null; newData: string | null; changedAt: number; changedBy: string; note: string | null }
/** game_data_releases 한 줄(content는 따로 읽는다) */
export interface ReleaseRow { version: number; createdAt: number; createdBy: string; note: string | null; hash: string }

/* ---------- API 응답 ---------- */
export interface TableInfo { name: string; label: string; desc: string; count: number; pending: number }
export interface EntrySummary { key: string; title: string; fields: [string, string][]; updatedAt: number; updatedBy: string; pending: 'add' | 'mod' | null }
export interface EntryDetail { table: string; key: string; data: Json; updatedAt: number; updatedBy: string; released: Json | undefined }
export interface Change { path: string; before: Json | undefined; after: Json | undefined }
export interface PendingItem { table: string; key: string; kind: 'add' | 'mod' | 'del'; changes: Change[] }
export interface Issue { level: 'error' | 'warn'; path: string; msg: string }
export interface Me { username: string; role: Role }
export interface UserRow { id: number; username: string; role: Role; disabled: boolean; createdAt: number }
export interface AuditRow { id: number; username: string; action: string; target: string | null; detail: string | null; at: number }
export interface ReleaseResult { version: number; hash: string; created: boolean; reload: { ok: boolean; message: string } }
