import { useState } from 'react';
import { Card, Text, Group, Stack, Badge, Select, TextInput, PasswordInput, Button, Table, Switch, Tabs } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABEL, type Role } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { PageHead, Loading } from '../components/Common.tsx';
import { fmtTime, ok, fail } from '../util.ts';

const ROLES = (['viewer', 'editor', 'publisher', 'admin'] as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }));
const ACTION: Record<string, string> = { login: '로그인', 'entry.save': '수정', 'entry.delete': '삭제', 'history.revert': '되돌림', release: '배포', rollback: '버전 되돌림', 'user.add': '계정 추가', 'user.update': '계정 변경' };

export function AdminPage() {
  const api = useApi(), { me } = useAuth(), qc = useQueryClient(), mobile = useMediaQuery('(max-width: 48em)');
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.users() });
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api.audit() });
  const [u, setU] = useState(''), [p, setP] = useState(''), [r, setR] = useState<Role>('editor');
  const add = async () => { try { await api.addUser({ username: u, password: p, role: r }); ok(`${u} 추가`); setU(''); setP(''); qc.invalidateQueries({ queryKey: ['users'] }); } catch (e) { fail(e); } };
  const patch = async (id: number, x: { role?: Role; disabled?: boolean }) => { try { await api.patchUser(id, x); qc.invalidateQueries({ queryKey: ['users'] }); } catch (e) { fail(e); } };
  return (
    <>
      <PageHead title="계정 · 감사" sub="운영툴 계정과 권한, 누가 무엇을 했는지" />
      <Tabs defaultValue="users">
        <Tabs.List mb="sm"><Tabs.Tab value="users">계정</Tabs.Tab><Tabs.Tab value="audit">감사 기록</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="users">
          <Card withBorder mb="md">
            <Text fw={700} mb="xs">계정 추가</Text>
            <Group gap="sm" wrap="wrap" align="flex-end">
              <TextInput label="아이디" value={u} onChange={e => setU(e.currentTarget.value)} w={mobile ? '100%' : 160} />
              <PasswordInput label="비밀번호(8자 이상)" value={p} onChange={e => setP(e.currentTarget.value)} w={mobile ? '100%' : 180} />
              <Select label="권한" data={ROLES} value={r} onChange={v => setR((v || 'viewer') as Role)} w={mobile ? '100%' : 130} allowDeselect={false} />
              <Button onClick={add} disabled={u.length < 3 || p.length < 8} fullWidth={mobile}>추가</Button>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">보기: 조회만 · 수정: 밸런스 저장 · 배포: 게임에 적용 · 관리자: 계정 관리</Text>
          </Card>
          <Loading q={users} />
          <Stack gap="xs">
            {users.data?.map(x => (
              <Card key={x.id} withBorder padding="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Group gap="xs"><Text fw={700}>{x.username}</Text>{x.username === me!.username && <Badge size="xs">나</Badge>}{x.disabled && <Badge size="xs" color="red">정지</Badge>}<Text size="xs" c="dimmed">{fmtTime(x.createdAt)}</Text></Group>
                  <Group gap="sm">
                    <Select size="xs" data={ROLES} value={x.role} onChange={v => v && patch(x.id, { role: v as Role })} w={110} allowDeselect={false} disabled={x.username === me!.username} />
                    <Switch size="sm" label="사용" checked={!x.disabled} onChange={e => patch(x.id, { disabled: !e.currentTarget.checked })} disabled={x.username === me!.username} />
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="audit">
          <Loading q={audit} />
          <Card withBorder p={0}>
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="xs">
                <Table.Thead><Table.Tr><Table.Th>시각</Table.Th><Table.Th>계정</Table.Th><Table.Th>한 일</Table.Th><Table.Th>대상</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{audit.data?.map(a => <Table.Tr key={a.id}><Table.Td><Text size="xs">{fmtTime(a.at)}</Text></Table.Td><Table.Td>{a.username}</Table.Td><Table.Td>{ACTION[a.action] || a.action}</Table.Td><Table.Td className="gha-mono">{a.target}</Table.Td></Table.Tr>)}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
