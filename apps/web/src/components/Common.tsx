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
