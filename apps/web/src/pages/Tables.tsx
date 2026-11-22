import { SimpleGrid, Card, Text, Group, Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../ctx.tsx';
import { PageHead, Loading } from '../components/Common.tsx';

export function TablesPage() {
  const api = useApi(), nav = useNavigate();
  const q = useQuery({ queryKey: ['tables'], queryFn: () => api.tables() });
  return (
    <>
      <PageHead title="밸런스" sub="표를 골라 항목을 고치세요. 저장한 변경은 '배포'해야 게임에 적용돼요." />
      <Loading q={q} />
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 4 }}>
        {q.data?.map(t => (
          <Card key={t.name} withBorder className="gha-row" onClick={() => nav('/balance/' + t.name)}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={800}>{t.label}</Text>
              <Group gap={4}>{t.pending > 0 && <Badge color="yellow" variant="light">변경 {t.pending}</Badge>}<Badge variant="default">{t.count}</Badge></Group>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>{t.desc}</Text>
            <Text size="xs" c="dimmed" className="gha-mono" mt={6}>{t.name}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </>
  );
}
