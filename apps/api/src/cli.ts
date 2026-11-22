/**
 * 관리자 계정 도구
 *   add <아이디> <비밀번호> <viewer|editor|publisher|admin>
 *   list · role <아이디> <권한> · disable <아이디> · enable <아이디> · passwd <아이디> <새 비밀번호>
 */
import { config } from './config.ts';
import { createAdminDb } from './admin-db.ts';
import type { Role } from '../../../packages/shared/src/types.ts';

const db = createAdminDb(config.adminDb), [cmd, a, b, c] = process.argv.slice(2);
const find = (u: string) => { const x = db.user(u); if (!x) { console.error('없는 아이디: ' + u); process.exit(1); } return x; };
switch (cmd) {
  case 'add': db.addUser(a, b, (c || 'viewer') as Role); console.log(`추가: ${a} (${c || 'viewer'})`); break;
  case 'list': for (const u of db.users()) console.log(`${u.id}\t${u.username}\t${u.role}${u.disabled ? '\t(정지)' : ''}`); break;
  case 'role': db.setRole(find(a).id, b as Role); console.log('바꿈'); break;
  case 'disable': db.setDisabled(find(a).id, true); console.log('정지'); break;
  case 'enable': db.setDisabled(find(a).id, false); console.log('해제'); break;
  case 'passwd': db.setPassword(find(a).id, b); console.log('바꿈'); break;
  default: console.log('명령: add · list · role · disable · enable · passwd');
}
