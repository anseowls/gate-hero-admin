import { useState } from 'react';
import { Table, TextInput, Card, Text, Group, Badge, Stack, Anchor, SegmentedControl } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { IconSearch } from '@tabler/icons-react';
import { tableDef } from '@shared';
import { useApi } from '../ctx.tsx';
import { PageHead, Loading, KindBadge } from '../components/Common.tsx';
import { ago } from '../util.ts';

export function EntriesPage() {
  const { table = '' } = useParams(), api = useApi(), nav = useNavigate();
  const mobile = useMediaQuery('(max-width: 48em)');
  const [s, setS] = useState(''), [only, setOnly] = useState('all');
  const q = useQuery({ queryKey: ['entries', table], queryFn: () => api.entries(table) });
  const d = tableDef(table);
  const rows = (q.data || []).filter(e => (only === 'all' || e.pending) && (!s || (e.key + ' ' + e.title).toLowerCase().includes(s.toLowerCase())));
  const open = (k: string) => nav(`/balance/${table}/${encodeURIComponent(k)}`);
  const cols = d?.summary.map(x => x[0]) || [];
  return (
    <>
      <PageHead title={<><Anchor onClick={() => nav('/balance')} c="dimmed" fw={500}>밸런스</Anchor> / {d?.label || table}</>} sub={d?.desc} />
      <Group mb="sm" gap="sm" wrap="wrap">
        <TextInput leftSection={<IconSearch size={16} />} placeholder="키나 이름으로 찾기" value={s} onChange={e => setS(e.currentTarget.value)} style={{ flex: 1, minWidth: 200 }} />
        <SegmentedControl value={only} onChange={setOnly} data={[{ value: 'all', label: `전체 ${q.data?.length ?? ''}` }, { value: 'pend', label: `변경됨 ${q.data?.filter(e => e.pending).length ?? ''}` }]} />
      </Group>
      <Loading q={q} />
      {mobile ? (
        <Stack gap="xs">
          {rows.map(e => (
            <Card key={e.key} withBorder padding="sm" className="gha-row" onClick={() => open(e.key)}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <div style={{ minWidth: 0 }}><Text fw={700} truncate>{e.title}</Text>{e.title !== e.key && <Text size="xs" c="dimmed" className="gha-mono" truncate>{e.key}</Text>}</div>
                {e.pending && <KindBadge kind={e.pending} />}
              </Group>
              {e.fields.length > 0 && <Group gap="xs" mt={6}>{e.fields.map(([l, v]) => <Badge key={l} variant="default" tt="none">{l} {v}</Badge>)}</Group>}
            </Card>
          ))}
        </Stack>
      ) : (
        <Card withBorder p={0}>
          <Table.ScrollContainer minWidth={600}>
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead><Table.Tr><Table.Th>키</Table.Th><Table.Th>이름</Table.Th>{cols.map(c => <Table.Th key={c}>{c}</Table.Th>)}<Table.Th>마지막 수정</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>
                {rows.map(e => (
                  <Table.Tr key={e.key} className="gha-row" onClick={() => open(e.key)}>
                    <Table.Td className="gha-mono">{e.key}</Table.Td>
                    <Table.Td fw={600}>{e.title !== e.key ? e.title : ''}</Table.Td>
                    {cols.map(c => <Table.Td key={c}>{e.fields.find(f => f[0] === c)?.[1] ?? ''}</Table.Td>)}
                    <Table.Td><Text size="xs" c="dimmed">{e.updatedBy} · {ago(e.updatedAt)}</Text></Table.Td>
                    <Table.Td>{e.pending && <KindBadge kind={e.pending} />}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {q.data && !rows.length && <Text c="dimmed" ta="center" py="lg">해당하는 항목이 없어요</Text>}
    </>
  );
}
