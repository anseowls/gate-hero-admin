/* 관리 API 통합 테스트: 로그인·권한·수정·충돌·검증·이력·되돌리기·릴리스·롤백·게임 서버 알림 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from '../src/app.ts';
import { createSqliteStore } from '../src/sqlite-store.ts';
import { createAdminDb } from '../src/admin-db.ts';

const seed = JSON.parse(readFileSync(new URL('../../web/src/demo/seed.json', import.meta.url), 'utf8'));

describe('관리 API', () => {
  let t = 1_000_000;
  const store = createSqliteStore(':memory:'), adminDb = createAdminDb(':memory:', () => t);
  const reloads: string[] = [];
  const app = buildApp({ store, adminDb, secret: 'test', now: () => t++, reload: async () => { reloads.push('x'); return { ok: true, message: 'ok' }; } });
  const tok: Record<string, string> = {};
  const call = async (who: string | null, method: string, url: string, payload?: unknown) => {
    const r = await app.inject({ method: method as any, url, payload: payload as any, headers: who ? { authorization: 'Bearer ' + tok[who] } : {} });
    return { status: r.statusCode, body: r.json() };
  };

  before(async () => {
    // 게임 DB에 import된 상태를 흉내 낸다
    store.tx(() => { for (const [tb, obj] of Object.entries(seed)) Object.entries(obj as object).forEach(([k, v], i) => store.putEntry({ table: tb, key: k, sort: i, data: JSON.stringify(v), updatedAt: 1, updatedBy: 'import' })); });
    for (const [u, r] of [['boss', 'admin'], ['editor1', 'editor'], ['view', 'viewer'], ['pub', 'publisher']] as const) adminDb.addUser(u, 'password123', r);
    for (const u of ['boss', 'editor1', 'view', 'pub']) tok[u] = (await call(null, 'POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  });

  it('로그인 실패 · 토큰 없음 · 권한 부족', async () => {
    assert.equal((await call(null, 'POST', '/api/auth/login', { username: 'boss', password: 'nope' })).status, 401);
    assert.equal((await call(null, 'GET', '/api/tables')).status, 401);
    assert.equal((await call('view', 'PUT', '/api/tables/combat/parry', { data: {} })).status, 403);
    assert.equal((await call('editor1', 'POST', '/api/releases', {})).status, 403);
  });
  it('표 목록 · 항목 목록 · 항목', async () => {
    const tables = (await call('view', 'GET', '/api/tables')).body;
    assert.equal(tables.find((x: any) => x.name === 'skills').count, Object.keys(seed.skills).length);
    const sk = (await call('view', 'GET', '/api/tables/skills')).body;
    assert.equal(sk[0].key, Object.keys(seed.skills)[0]); assert.ok(sk[0].title);
    assert.deepEqual((await call('view', 'GET', '/api/tables/combat/parry')).body.data, seed.combat.parry);
  });
  it('첫 릴리스 → 수정(검증·확인·충돌) → 대기 목록 → 릴리스 → 게임 서버 알림', async () => {
    const r1 = (await call('pub', 'POST', '/api/releases', { note: '초기' })).body;
    assert.equal(r1.created, true); assert.equal(reloads.length, 1);
    assert.equal((await call('pub', 'POST', '/api/releases', {})).body.created, false);   // 바뀐 것 없음
    const cur = (await call('editor1', 'GET', '/api/tables/combat/parry')).body;
    // 형식 오류(숫자 → 글자)
    const bad = await call('editor1', 'PUT', '/api/tables/combat/parry', { data: { ...cur.data, win: 'fast' }, baseUpdatedAt: cur.updatedAt });
    assert.equal(bad.status, 422); assert.equal(bad.body.code, 'INVALID');
    // 정상
    const ok = await call('editor1', 'PUT', '/api/tables/combat/parry', { data: { ...cur.data, win: 0.26 }, note: '판정 완화', baseUpdatedAt: cur.updatedAt });
    assert.equal(ok.status, 200); assert.equal(ok.body.changed, true);
    // 옛 기준으로 다시 저장 → 충돌
    assert.equal((await call('editor1', 'PUT', '/api/tables/combat/parry', { data: { ...cur.data, win: 0.3 }, baseUpdatedAt: cur.updatedAt })).status, 409);
    // 칸 빼기 = 경고 → force 없으면 확인 필요
    const { flashLead, ...noLead } = { ...cur.data, win: 0.26 };
    const warn = await call('editor1', 'PUT', '/api/tables/combat/parry', { data: noLead, baseUpdatedAt: ok.body.updatedAt });
    assert.equal(warn.body.code, 'NEEDS_CONFIRM');
    const pend = (await call('view', 'GET', '/api/releases/pending')).body;
    assert.equal(pend.length, 1); assert.equal(pend[0].changes[0].path, 'win'); assert.equal(pend[0].changes[0].after, 0.26);
    const r2 = (await call('pub', 'POST', '/api/releases', { note: '1.0.1' })).body;
    assert.ok(r2.created && r2.version > r1.version); assert.equal(reloads.length, 2);
    assert.equal((await call('view', 'GET', '/api/releases/pending')).body.length, 0);
  });
  it('이력 · 되돌리기 · 롤백', async () => {
    const h = (await call('view', 'GET', '/api/history?table=combat&key=parry')).body;
    assert.equal(h[0].changedBy, 'editor1'); assert.equal(h[0].note, '판정 완화'); assert.equal(h[0].changes[0].path, 'win');
    await call('editor1', 'POST', `/api/history/${h[0].id}/revert`, { note: '원복' });
    assert.equal((await call('view', 'GET', '/api/tables/combat/parry')).body.data.win, 0.24);
    const rel = (await call('view', 'GET', '/api/releases')).body;
    const rb = (await call('pub', 'POST', `/api/releases/${rel[0].version}/rollback`, {})).body;   // 최신 릴리스(0.26)로 되돌리기
    assert.equal((await call('view', 'GET', '/api/tables/combat/parry')).body.data.win, 0.26);
    assert.equal(rb.created, false);   // 내용이 최신 릴리스와 같아 새 버전은 없음
  });
  it('관리자: 계정 추가 · 정지 · 감사 기록', async () => {
    assert.equal((await call('editor1', 'GET', '/api/users')).status, 403);
    const add = await call('boss', 'POST', '/api/users', { username: 'newbie', password: 'password123', role: 'viewer' });
    assert.equal(add.status, 200);
    await call('boss', 'PATCH', `/api/users/${add.body.id}`, { disabled: true });
    assert.equal((await call(null, 'POST', '/api/auth/login', { username: 'newbie', password: 'password123' })).status, 401);
    const au = (await call('boss', 'GET', '/api/audit')).body;
    assert.ok(au.some((a: any) => a.action === 'release') && au.some((a: any) => a.action === 'entry.save'));
  });
});
