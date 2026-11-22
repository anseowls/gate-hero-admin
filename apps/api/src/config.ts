/** 환경변수(.env.example 참고) */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const config = {
  port: Number(process.env.PORT || 8090),
  host: process.env.HOST || '127.0.0.1',
  gameDb: process.env.GAME_DB || path.join(here, '../../../../gate-hero/rift.db'),
  adminDb: process.env.ADMIN_DB || path.join(here, '../admin.db'),
  secret: process.env.ADMIN_SECRET || '',
  gameServerUrl: process.env.GAME_SERVER_URL || undefined,
  gameAdminToken: process.env.GAME_ADMIN_TOKEN || undefined,
  webDir: process.env.WEB_DIR || path.join(here, '../../web/dist'),
  production: process.env.NODE_ENV === 'production'
};
