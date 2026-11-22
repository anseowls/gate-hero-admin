import { SimpleGrid, Card, Text, Group, Stack, Button, Badge, Anchor } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApi, useAuth } from '../ctx.tsx';
import { PageHead, Loading, ChangeList } from '../components/Common.tsx';
import { fmtTime, ago } from '../util.ts';
import { canDo, ROLE_LABEL } from '@shared';

export function DashboardPage() {
  const api = useApi(), { me } = useAuth(), nav = useNavigate();
  const pending = useQuery({ queryKey: ['pending'], queryFn: () => api.pending() });
  const rel = useQuery({ queryKey: ['releases'], queryFn: () => api.releases() });
  const hist = useQuery({ queryKey: ['history', '', ''], queryFn: () => api.history({ limit: 6 }) });
  const last = rel.data?.[0];
  return (
    <>
      <PageHead title={`안녕하세요, ${me!.username}님`} sub={`권한: ${ROLE_LABEL[me!.role]}`} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
        <Card withBorder>
          <Text c="dimmed" size="sm">배포 안 된 변경</Text>
          <Text fz={34} fw={900} c={pending.data?.length ? 'yellow' : undefined}>{pending.data?.length ?? '…'}</Text>
          <Button mt="xs" variant="light" onClick={() => nav('/releases')} disabled={!pending.data?.length}>{canDo(me!.role, 'publisher') ? '확인하고 배포' : '변경 보기'}</Button>
        </Card>
        <Card withBorder>
          <Text c="dimmed" size="sm">게임에 적용된 최신 버전</Text>
          <Text fz={34} fw={900}>{last ? `v${last.version}` : '-'}</Text>
          <Text size="sm" c="dimmed">{last ? `${fmtTime(last.createdAt)} · ${last.createdBy}${last.note ? ' · ' + last.note : ''}` : '릴리스 없음'}</Text>
        </Card>
        <Card withBorder>
          <Text c="dimmed" size="sm">바로 가기</Text>
          <Group gap="xs" mt="xs">
            {[['combat', '전투 감각'], ['skills', '스킬'], ['monsters', '몬스터'], ['economy', '경제']].map(([t, l]) => <Button key={t} size="xs" variant="default" onClick={() => nav('/balance/' + t)}>{l}</Button>)}
          </Group>
        </Card>
      </SimpleGrid>
      <Card withBorder>
        <Group justify="space-between" mb="xs"><Text fw={700}>최근 변경</Text><Anchor size="sm" onClick={() => nav('/history')}>전체 보기</Anchor></Group>
        <Loading q={hist} />
        <Stack gap="sm">
          {hist.data?.map(h => (
            <div key={h.id}>
              <Group gap="xs" wrap="wrap">
                <Anchor fw={700} size="sm" onClick={() => nav(`/balance/${h.table}/${encodeURIComponent(h.key)}`)}>{h.table}.{h.key}</Anchor>
                <Badge size="xs" variant="outline">{h.changedBy}</Badge><Text size="xs" c="dimmed">{ago(h.changedAt)}</Text>
                {h.note && <Text size="xs" c="dimmed">— {h.note}</Text>}
              </Group>
              <ChangeList changes={h.changes} max={3} />
            </div>
          ))}
          {hist.data && !hist.data.length && <Text c="dimmed" size="sm">아직 변경이 없어요</Text>}
        </Stack>
      </Card>
    </>
  );
}
