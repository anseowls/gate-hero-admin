/** 실행: npm -w apps/api start  (환경변수: .env.example) */
import { randomBytes } from 'node:crypto';
import { config } from './config.ts';
import { buildApp } from './app.ts';
import { createSqliteStore } from './sqlite-store.ts';
import { createAdminDb } from './admin-db.ts';

if (!config.secret && config.production) { console.error('ADMIN_SECRET 환경변수가 필요해요'); process.exit(1); }
const adminDb = createAdminDb(config.adminDb);
if (!adminDb.userCount()) console.warn('관리자 계정이 없어요 → npm -w apps/api run user -- add <아이디> <비밀번호> admin');
const app = buildApp({
  store: createSqliteStore(config.gameDb), adminDb,
  secret: config.secret || randomBytes(32).toString('hex'),
  gameServerUrl: config.gameServerUrl, gameAdminToken: config.gameAdminToken, webDir: config.webDir, logger: true
});
await app.listen({ port: config.port, host: config.host });
console.log(`관리 API: http://${config.host}:${config.port}  (게임 DB ${config.gameDb})`);
