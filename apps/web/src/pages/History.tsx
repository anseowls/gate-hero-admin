import { useState } from 'react';
import { Card, Text, Group, Stack, Badge, Select, TextInput, Button, Anchor } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconArrowBackUp } from '@tabler/icons-react';
import { TABLES, canDo } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { PageHead, Loading, ChangeList } from '../components/Common.tsx';
import { fmtTime, ago, ok, fail } from '../util.ts';

export function HistoryPage() {
  const api = useApi(), { me } = useAuth(), qc = useQueryClient(), nav = useNavigate();
  const [table, setTable] = useState<string | null>(null), [key, setKey] = useState(''), [limit, setLimit] = useState(50);
  const q = useQuery({ queryKey: ['history', table || '', key, limit], queryFn: () => api.history({ table: table || undefined, key: key || undefined, limit }) });
  const revert = async (id: number) => { if (!confirm(`#${id} 변경을 되돌릴까요? (그 변경 이전 값으로 다시 저장 — 새 기록이 남아요)`)) return; try { await api.revert(id); ok('되돌렸어요 — 배포하면 게임에 적용돼요'); qc.invalidateQueries(); } catch (e) { fail(e); } };
  return (
    <>
      <PageHead title="변경 이력" sub="누가 언제 무엇을 왜 바꿨는지" />
      <Group mb="sm" gap="sm" wrap="wrap">
        <Select placeholder="모든 표" clearable data={TABLES.map(t => ({ value: t.name, label: t.label }))} value={table} onChange={setTable} w={180} />
        <TextInput placeholder="키(정확히)" value={key} onChange={e => setKey(e.currentTarget.value.trim())} w={200} />
      </Group>
      <Loading q={q} />
      <Stack gap="sm">
        {q.data?.map(h => (
          <Card key={h.id} withBorder padding="sm">
            <Group justify="space-between" wrap="wrap" gap="xs" mb={4}>
              <Group gap="xs" wrap="wrap">
                <Text size="xs" c="dimmed">#{h.id}</Text>
                <Anchor fw={700} size="sm" className="gha-mono" onClick={() => nav(`/balance/${h.table}/${encodeURIComponent(h.key)}`)}>{h.table}.{h.key}</Anchor>
                {h.oldData === null && <Badge size="xs" color="teal">추가</Badge>}{h.newData === null && <Badge size="xs" color="red">삭제</Badge>}
                <Badge size="xs" variant="outline">{h.changedBy}</Badge>
                <Text size="xs" c="dimmed" title={fmtTime(h.changedAt)}>{ago(h.changedAt)}</Text>
              </Group>
              {canDo(me!.role, 'editor') && <Button size="compact-xs" variant="subtle" color="orange" leftSection={<IconArrowBackUp size={12} />} onClick={() => revert(h.id)}>되돌리기</Button>}
            </Group>
            {h.note && <Text size="sm" mb={4}>{h.note}</Text>}
            {h.oldData !== null && h.newData !== null && <ChangeList changes={h.changes} />}
          </Card>
        ))}
        {q.data && q.data.length >= limit && <Button variant="default" onClick={() => setLimit(l => l + 50)}>더 보기</Button>}
        {q.data && !q.data.length && <Text c="dimmed">기록이 없어요</Text>}
      </Stack>
    </>
  );
}
