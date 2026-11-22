/** 관리자 토큰: base64url(payload).HMAC-SHA256 — 기본 12시간 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '../../../packages/shared/src/types.ts';

export interface TokenBody { u: string; r: Role; exp: number }
export function createTokens(secret: string, now = () => Date.now(), ttlMs = 12 * 3600_000) {
  const sign = (s: string) => createHmac('sha256', secret).update(s).digest('base64url');
  return {
    issue(u: string, r: Role) { const body = Buffer.from(JSON.stringify({ u, r, exp: now() + ttlMs })).toString('base64url'); return `${body}.${sign(body)}`; },
    verify(tok: string | undefined): TokenBody | null {
      if (!tok) return null;
      const [body, sig] = tok.split('.'); if (!body || !sig) return null;
      const want = sign(body);
      if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
      try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenBody; return p.exp > now() ? p : null; } catch { return null; }
    }
  };
}
