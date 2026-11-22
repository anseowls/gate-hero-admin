/**
 * 관리 API (Fastify). 모든 경로는 /api 아래. 게임 API와 따로 돈다.
 *   인증: POST /api/auth/login → Bearer 토큰(12시간). 권한: viewer < editor < publisher < admin
 */
import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createCore, AdminError, type Store } from '../../../packages/shared/src/core.ts';
import { canDo, ROLE_RANK, type Role } from '../../../packages/shared/src/types.ts';
import { createTokens, type TokenBody } from './auth.ts';
import type { AdminDb } from './admin-db.ts';
import { reloadGameServer } from './game-link.ts';

export interface AppOpts {
  store: Store; adminDb: AdminDb; secret: string; now?: () => number;
  gameServerUrl?: string; gameAdminToken?: string;
  webDir?: string;            // 빌드된 관리 화면(apps/web/dist)을 같은 주소에서 내보낼 때
  reload?: typeof reloadGameServer;
  logger?: boolean;
}

declare module 'fastify' { interface FastifyRequest { admin?: TokenBody } }

export function buildApp(o: AppOpts) {
  const now = o.now || (() => Date.now());
  const core = createCore({ store: o.store, now, hash: s => createHash('sha256').update(s).digest('hex').slice(0, 16) });
  const tokens = createTokens(o.secret, now);
  const reload = o.reload || reloadGameServer;
  const app = Fastify({ logger: o.logger ?? false, bodyLimit: 2 * 1024 * 1024 });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof AdminError) return reply.status(err.status).send({ code: err.code, message: err.message, detail: err.detail });
    if (err.validation) return reply.status(400).send({ code: 'BAD_REQUEST', message: err.message });
    app.log.error(err);
    return reply.status(500).send({ code: 'INTERNAL', message: '서버 오류' });
  });

  /** 권한 확인 → 사용자 이름 */
  const guard = (need: Role) => async (req: FastifyRequest) => {
    const h = req.headers.authorization || '', t = tokens.verify(h.startsWith('Bearer ') ? h.slice(7) : undefined);
    if (!t) throw new AdminError(401, 'UNAUTHORIZED', '로그인이 필요해요');
    const u = o.adminDb.user(t.u);
    if (!u || u.disabled) throw new AdminError(401, 'UNAUTHORIZED', '계정을 쓸 수 없어요');
    if (!canDo(u.role, need)) throw new AdminError(403, 'FORBIDDEN', `권한이 부족해요(${need} 이상)`);
    req.admin = { u: u.username, r: u.role, exp: t.exp };
  };
  const who = (req: FastifyRequest) => req.admin!.u;
  const audit = (req: FastifyRequest, action: string, target: string | null, detail?: unknown) => o.adminDb.audit(who(req), action, target, detail);
  const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : null);

  /* ---------- 인증 ---------- */
  app.post('/api/auth/login', async (req, reply) => {
    const b: any = req.body || {};
    const u = o.adminDb.login(String(b.username || ''), String(b.password || ''));
    if (!u) { await new Promise(r => setTimeout(r, 300)); return reply.status(401).send({ code: 'BAD_LOGIN', message: '아이디나 비밀번호가 맞지 않아요' }); }
    o.adminDb.audit(u.username, 'login', null, null);
    return { token: tokens.issue(u.username, u.role), me: { username: u.username, role: u.role } };
  });
  app.get('/api/auth/me', { preHandler: guard('viewer') }, async req => ({ username: req.admin!.u, role: req.admin!.r }));

  /* ---------- 밸런스 ---------- */
  app.get('/api/tables', { preHandler: guard('viewer') }, async () => core.tables());
  app.get<{ Params: { t: string } }>('/api/tables/:t', { preHandler: guard('viewer') }, async req => core.entries(req.params.t));
  app.get<{ Params: { t: string; k: string } }>('/api/tables/:t/:k', { preHandler: guard('viewer') }, async req => core.entry(req.params.t, req.params.k));
  app.post<{ Params: { t: string; k: string } }>('/api/tables/:t/:k/check', { preHandler: guard('editor') }, async req => core.check(req.params.t, req.params.k, (req.body as any)?.data));
  app.put<{ Params: { t: string; k: string } }>('/api/tables/:t/:k', { preHandler: guard('editor') }, async req => {
    const b: any = req.body || {};
    if (b.data === undefined) throw new AdminError(400, 'BAD_REQUEST', 'data가 필요해요');
    const r = core.save(who(req), req.params.t, req.params.k, b.data, str(b.note), typeof b.baseUpdatedAt === 'number' ? b.baseUpdatedAt : null, !!b.force);
    if (r.changed) audit(req, 'entry.save', `${req.params.t}.${req.params.k}`, { note: str(b.note) });
    return r;
  });
  app.delete<{ Params: { t: string; k: string } }>('/api/tables/:t/:k', { preHandler: guard('editor') }, async req => {
    const r = core.remove(who(req), req.params.t, req.params.k, str((req.query as any)?.note));
    audit(req, 'entry.delete', `${req.params.t}.${req.params.k}`); return r;
  });

  /* ---------- 이력 ---------- */
  app.get('/api/history', { preHandler: guard('viewer') }, async req => {
    const q: any = req.query || {};
    return core.history({ table: q.table || undefined, key: q.key || undefined, limit: Number(q.limit) || 50, offset: Number(q.offset) || 0 });
  });
  app.post<{ Params: { id: string } }>('/api/history/:id/revert', { preHandler: guard('editor') }, async req => {
    const r = core.revert(who(req), Number(req.params.id), str((req.body as any)?.note));
    audit(req, 'history.revert', '#' + req.params.id); return r;
  });

  /* ---------- 릴리스 ---------- */
  app.get('/api/releases', { preHandler: guard('viewer') }, async () => core.releases(100));
  app.get('/api/releases/pending', { preHandler: guard('viewer') }, async () => core.pending());
  app.get<{ Params: { v: string } }>('/api/releases/:v', { preHandler: guard('viewer') }, async req => core.releaseData(Number(req.params.v)));
  app.post('/api/releases', { preHandler: guard('publisher') }, async req => {
    const r = core.release(who(req), str((req.body as any)?.note));
    const rl = r.created ? await reload(o.gameServerUrl, o.gameAdminToken) : { ok: true, message: '바뀐 게 없어 새 버전을 만들지 않았어요' };
    audit(req, 'release', 'v' + r.version, { created: r.created, reload: rl });
    return { ...r, reload: rl };
  });
  app.post<{ Params: { v: string } }>('/api/releases/:v/rollback', { preHandler: guard('publisher') }, async req => {
    const r = core.rollback(who(req), Number(req.params.v), str((req.body as any)?.note));
    const rl = r.created ? await reload(o.gameServerUrl, o.gameAdminToken) : { ok: true, message: '이미 그 내용이에요' };
    audit(req, 'rollback', 'v' + req.params.v, { to: r.version, reload: rl });
    return { ...r, reload: rl };
  });

  /* ---------- 관리자 계정 · 감사 ---------- */
  app.get('/api/users', { preHandler: guard('admin') }, async () => o.adminDb.users());
  app.post('/api/users', { preHandler: guard('admin') }, async req => {
    const b: any = req.body || {};
    if (!(b.role in ROLE_RANK)) throw new AdminError(400, 'BAD_ROLE', '없는 권한');
    try { const id = o.adminDb.addUser(String(b.username || ''), String(b.password || ''), b.role); audit(req, 'user.add', b.username, { role: b.role }); return { id }; }
    catch (e: any) { throw new AdminError(400, 'BAD_USER', /UNIQUE/.test(e.message) ? '이미 있는 아이디' : e.message); }
  });
  app.patch<{ Params: { id: string } }>('/api/users/:id', { preHandler: guard('admin') }, async req => {
    const b: any = req.body || {}, id = Number(req.params.id), me = o.adminDb.user(who(req))!;
    if (id === me.id && (b.disabled || (b.role && b.role !== 'admin'))) throw new AdminError(400, 'SELF', '자기 계정의 관리자 권한은 못 바꿔요');
    if (b.role) { if (!(b.role in ROLE_RANK)) throw new AdminError(400, 'BAD_ROLE', '없는 권한'); o.adminDb.setRole(id, b.role); }
    if (typeof b.disabled === 'boolean') o.adminDb.setDisabled(id, b.disabled);
    if (typeof b.password === 'string') { try { o.adminDb.setPassword(id, b.password); } catch (e: any) { throw new AdminError(400, 'BAD_PW', e.message); } }
    audit(req, 'user.update', '#' + id, { role: b.role, disabled: b.disabled, password: b.password ? '변경' : undefined });
    return { ok: true };
  });
  app.get('/api/audit', { preHandler: guard('admin') }, async req => { const q: any = req.query || {}; return o.adminDb.audits(Math.min(200, Number(q.limit) || 100), Number(q.offset) || 0); });

  app.get('/api/health', async () => ({ ok: true }));

  /* ---------- 관리 화면(빌드 결과) ---------- */
  if (o.webDir && existsSync(o.webDir)) {
    app.register(fastifyStatic, { root: o.webDir, prefix: '/' });
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.status(404).send({ code: 'NOT_FOUND', message: '없는 경로' }) : reply.sendFile('index.html'));
  }
  return app;
}
