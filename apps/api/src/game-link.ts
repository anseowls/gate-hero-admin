/** 게임 서버에 "새 릴리스를 읽어라" 알리기(게임 서버 POST /v1/admin/data/reload, 헤더 x-admin-token) */
export async function reloadGameServer(url: string | undefined, token: string | undefined): Promise<{ ok: boolean; message: string }> {
  if (!url) return { ok: false, message: '게임 서버 주소(GAME_SERVER_URL)가 없어 알리지 않았어요 — 게임 서버를 재시작하면 새 릴리스를 읽어요' };
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/v1/admin/data/reload', { method: 'POST', headers: { 'x-admin-token': token || '' }, signal: AbortSignal.timeout(8000) });
    const body: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, message: `게임 서버가 v${body.version}로 바꿨어요` } : { ok: false, message: `게임 서버 응답 ${res.status}: ${body.message || ''}` };
  } catch (e: any) { return { ok: false, message: '게임 서버에 연결 못 함: ' + e.message }; }
}
