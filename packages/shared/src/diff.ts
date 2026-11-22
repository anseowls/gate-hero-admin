import type { Change, Issue, Json } from './types.ts';

const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const kindOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** 두 값의 바뀐 곳(잎 단위). 배열은 길이가 같으면 칸별, 다르면 통째로 */
export function diff(a: Json | undefined, b: Json | undefined, base = ''): Change[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (isObj(a) && isObj(b)) {
    const out: Change[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diff(a[k], b[k], base ? `${base}.${k}` : k));
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    const out: Change[] = [];
    a.forEach((v, i) => out.push(...diff(v, b[i], `${base}[${i}]`)));
    return out;
  }
  return [{ path: base || '(전체)', before: a, after: b }];
}

/**
 * 새 값 검사: 원래 있던 칸의 형식이 바뀌면 오류(숫자 칸에 글자 등), 칸이 빠지거나 새로 생기면 경고,
 * 숫자는 유한해야 하고, 원래 0 이상이던 값이 음수가 되면 경고.
 */
export function validateEntry(before: Json | undefined, after: Json, base = ''): Issue[] {
  const out: Issue[] = [];
  const at = (p: string) => p || '(전체)';
  if (typeof after === 'number' && !Number.isFinite(after)) out.push({ level: 'error', path: at(base), msg: '숫자가 아님(무한대·NaN)' });
  if (before === undefined) return out;
  const ka = kindOf(before), kb = kindOf(after);
  if (ka !== kb && !(ka === 'null' || kb === 'null')) { out.push({ level: 'error', path: at(base), msg: `형식이 바뀜: ${ka} → ${kb}` }); return out; }
  if (typeof before === 'number' && typeof after === 'number' && before >= 0 && after < 0) out.push({ level: 'warn', path: at(base), msg: `음수가 됨 (${before} → ${after})` });
  if (isObj(before) && isObj(after)) {
    for (const k of Object.keys(before)) if (!(k in after)) out.push({ level: 'warn', path: at(base ? `${base}.${k}` : k), msg: '칸이 빠짐' });
    for (const k of Object.keys(after)) {
      const p = base ? `${base}.${k}` : k;
      if (!(k in before)) { out.push({ level: 'warn', path: p, msg: '새 칸' }); continue; }
      out.push(...validateEntry(before[k], after[k], p));
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    const tmpl = before[0];
    after.forEach((v, i) => out.push(...validateEntry(i < before.length ? before[i] : tmpl, v, `${base}[${i}]`)));
  }
  return out;
}

/** 값 한 줄 표시 */
export function show(v: Json | undefined): string {
  if (v === undefined) return '(없음)';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}
