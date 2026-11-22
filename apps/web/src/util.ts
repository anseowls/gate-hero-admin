import { notifications } from '@mantine/notifications';
import type { Json } from '@shared';
export const fmtTime = (t: number) => { if (!t) return '-'; const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
export const ago = (t: number) => { const s = (Date.now() - t) / 1000; return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
export const ok = (message: string) => notifications.show({ color: 'teal', message });
export const fail = (e: any) => notifications.show({ color: 'red', title: '실패', message: e?.message || String(e) });
export type Path = (string | number)[];
export function getIn(v: any, p: Path): any { for (const k of p) { if (v == null) return undefined; v = v[k]; } return v; }
export function setIn(v: any, p: Path, val: Json | undefined): any {
  if (!p.length) return val;
  const [k, ...rest] = p;
  const copy: any = Array.isArray(v) ? v.slice() : { ...(v || {}) };
  if (rest.length === 0 && val === undefined) { if (Array.isArray(copy)) copy.splice(k as number, 1); else delete copy[k]; return copy; }
  copy[k] = setIn(copy[k], rest, val);
  return copy;
}
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
