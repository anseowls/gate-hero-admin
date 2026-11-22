import type { ReactNode } from 'react';
import { Group, Title, Text, Stack, Center, Loader, Alert, Badge, Code } from '@mantine/core';
import { show, type Change } from '@shared';

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" wrap="wrap" gap="sm">
      <Stack gap={2}><Title order={3}>{title}</Title>{sub && <Text c="dimmed" size="sm">{sub}</Text>}</Stack>
      {right}
    </Group>
  );
}
export function Loading({ q }: { q: { isLoading: boolean; error: unknown } }) {
  if (q.isLoading) return <Center py="xl"><Loader /></Center>;
  if (q.error) return <Alert color="red" title="불러오기 실패">{(q.error as any).message}</Alert>;
  return null;
}
export const KIND: Record<string, [string, string]> = { add: ['추가', 'teal'], mod: ['수정', 'yellow'], del: ['삭제', 'red'] };
export const KindBadge = ({ kind }: { kind: string }) => <Badge size="sm" variant="light" color={KIND[kind]?.[1]}>{KIND[kind]?.[0] || kind}</Badge>;

/** 바뀐 곳 목록: 경로 · 이전 → 새 값 */
export function ChangeList({ changes, max = 8 }: { changes: Change[]; max?: number }) {
  return (
    <Stack gap={2}>
      {changes.slice(0, max).map((c, i) => (
        <Text key={i} size="xs" className="gha-mono" style={{ wordBreak: 'break-all' }}>
          <Code>{c.path}</Code> <Text span c="red.4">{show(c.before)}</Text> → <Text span c="teal.4">{show(c.after)}</Text>
        </Text>
      ))}
      {changes.length > max && <Text size="xs" c="dimmed">…외 {changes.length - max}곳</Text>}
    </Stack>
  );
}

/** 확인 창(브라우저 confirm 대신 — 미리보기 틀에서는 confirm이 막힘) */
import { Modal, Button } from '@mantine/core';
import { useState as useS } from 'react';
export function useConfirm() {
  const [st, setSt] = useS<{ title: string; body: string; ok: string; color?: string; run: () => void } | null>(null);
  const ask = (title: string, body: string, run: () => void, ok = '확인', color?: string) => setSt({ title, body, ok, color, run });
  const node = (
    <Modal opened={!!st} onClose={() => setSt(null)} title={st?.title} centered>
      <Text size="sm" mb="md">{st?.body}</Text>
      <Group justify="flex-end"><Button variant="default" onClick={() => setSt(null)}>취소</Button><Button color={st?.color} onClick={() => { const r = st!.run; setSt(null); r(); }}>{st?.ok}</Button></Group>
    </Modal>
  );
  return { ask, node };
}
