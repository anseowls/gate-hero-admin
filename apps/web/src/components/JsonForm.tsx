/**
 * 데이터 모양 그대로 고치는 폼: 숫자 → 숫자 칸, 글자 → 글자 칸, 참/거짓 → 스위치,
 * 묶음(객체·배열) → 접었다 펴는 상자. 배포본(original)과 다른 칸은 노란 테두리.
 */
import { useState, memo } from 'react';
import { NumberInput, TextInput, Switch, Stack, Group, Text, Box, UnstyledButton, ActionIcon, Badge, Tooltip } from '@mantine/core';
import { IconChevronRight, IconChevronDown, IconPlus, IconTrash, IconArrowBackUp } from '@tabler/icons-react';
import type { Json } from '@shared';
import { getIn, same, type Path } from '../util.ts';

interface Props { value: Json; original: Json | undefined; onChange: (path: Path, v: Json | undefined) => void; readOnly?: boolean }

const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const prim = (v: unknown) => v === null || typeof v !== 'object';
const label = (k: string | number) => (typeof k === 'number' ? `[${k}]` : k);

export function JsonForm(p: Props) {
  return <Node {...p} path={[]} depth={0} />;
}

const Node = memo(function Node({ value, original, onChange, readOnly, path, depth }: Props & { path: Path; depth: number }) {
  if (isObj(value)) return (
    <Stack gap={6}>
      {Object.keys(value).map(k => <Field key={k} k={k} v={value[k]} o={isObj(original) ? original[k] : undefined} {...{ onChange, readOnly, path, depth }} />)}
    </Stack>
  );
  if (Array.isArray(value)) {
    const o = Array.isArray(original) ? original : undefined;
    const allPrim = value.every(prim);
    return (
      <Stack gap={6}>
        {allPrim
          ? <Group gap={6} wrap="wrap">{value.map((v, i) => <Box key={i} w={value.length > 4 ? 96 : 140}><Leaf v={v} o={o?.[i]} onSet={nv => onChange([...path, i], nv)} readOnly={readOnly} compact /></Box>)}</Group>
          : value.map((v, i) => <Field key={i} k={i} v={v} o={o?.[i]} {...{ onChange, readOnly, path, depth }} removable={!readOnly} />)}
        {!readOnly && value.length > 0 && (
          <Group gap={6}>
            <Tooltip label="마지막 칸을 복사해 하나 더"><ActionIcon size="sm" variant="light" onClick={() => onChange([...path, value.length], structuredClone(value[value.length - 1]))}><IconPlus size={14} /></ActionIcon></Tooltip>
            {allPrim && <Tooltip label="마지막 칸 빼기"><ActionIcon size="sm" variant="light" color="red" onClick={() => onChange([...path, value.length - 1], undefined)}><IconTrash size={14} /></ActionIcon></Tooltip>}
          </Group>
        )}
      </Stack>
    );
  }
  return <Leaf v={value} o={original} onSet={nv => onChange(path, nv)} readOnly={readOnly} />;
});

function Field({ k, v, o, onChange, readOnly, path, depth, removable }: { k: string | number; v: Json; o: Json | undefined; onChange: Props['onChange']; readOnly?: boolean; path: Path; depth: number; removable?: boolean }) {
  const p = [...path, k], changed = o !== undefined && !same(v, o), added = o === undefined;
  const [open, setOpen] = useState(depth < 1 && JSON.stringify(v).length < 1500);
  if (prim(v)) return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Text size="sm" w={{ base: 110, sm: 170 }} style={{ flexShrink: 0, wordBreak: 'break-all' }} c={changed ? 'yellow' : added ? 'teal' : undefined} className="gha-mono">{label(k)}</Text>
      <Box style={{ flex: 1, minWidth: 0 }}><Leaf v={v} o={o} onSet={nv => onChange(p, nv)} readOnly={readOnly} /></Box>
      {changed && !readOnly && <Tooltip label={`배포본 값으로 (${JSON.stringify(o)})`}><ActionIcon size="sm" variant="subtle" onClick={() => onChange(p, o as Json)}><IconArrowBackUp size={14} /></ActionIcon></Tooltip>}
    </Group>
  );
  const n = Array.isArray(v) ? v.length : Object.keys(v as object).length;
  return (
    <Box pl={depth ? 'xs' : 0} style={{ borderLeft: depth ? '1px solid var(--mantine-color-dark-4)' : undefined }}>
      <Group gap={4} wrap="nowrap">
        <UnstyledButton onClick={() => setOpen(x => !x)} style={{ flex: 1 }}>
          <Group gap={4} wrap="nowrap">
            {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <Text size="sm" fw={700} className="gha-mono" c={changed ? 'yellow' : undefined}>{label(k)}</Text>
            <Badge size="xs" variant="default">{Array.isArray(v) ? `${n}칸` : `${n}개`}</Badge>
            {changed && <Badge size="xs" color="yellow" variant="light">변경</Badge>}
          </Group>
        </UnstyledButton>
        {removable && <ActionIcon size="sm" variant="subtle" color="red" onClick={() => onChange(p, undefined)} aria-label="빼기"><IconTrash size={14} /></ActionIcon>}
      </Group>
      {open && <Box mt={6} ml={6}><Node value={v} original={o} onChange={onChange} readOnly={readOnly} path={p} depth={depth + 1} /></Box>}
    </Box>
  );
}

function Leaf({ v, o, onSet, readOnly, compact }: { v: Json; o: Json | undefined; onSet: (v: Json) => void; readOnly?: boolean; compact?: boolean }) {
  const changed = o !== undefined && !same(v, o), cls = changed ? 'gha-changed' : undefined, size = compact ? 'xs' : 'sm';
  if (typeof v === 'boolean') return <Switch checked={v} onChange={e => onSet(e.currentTarget.checked)} disabled={readOnly} className={cls} />;
  if (typeof v === 'number') return (
    <NumberInput size={size} value={v} className={cls} readOnly={readOnly} hideControls={compact} decimalScale={6} allowDecimal
      onChange={x => { const n = typeof x === 'number' ? x : parseFloat(x); if (Number.isFinite(n)) onSet(n); }}
      description={!compact && changed ? `배포본 ${o}` : undefined} />
  );
  if (v === null) return <Text size="sm" c="dimmed">null</Text>;
  return <TextInput size={size} value={String(v)} className={cls} readOnly={readOnly} onChange={e => onSet(e.currentTarget.value)} description={!compact && changed ? `배포본: ${String(o)}` : undefined} />;
}

/** 배포본과 다른 잎 개수 */
export function countChanged(a: Json | undefined, b: Json | undefined): number {
  if (same(a, b)) return 0;
  if (isObj(a) && isObj(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].reduce((n, k) => n + countChanged(a[k], b[k]), 0);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.reduce((n: number, x, i) => n + countChanged(x, b[i]), 0);
  return 1;
}
export { getIn };
