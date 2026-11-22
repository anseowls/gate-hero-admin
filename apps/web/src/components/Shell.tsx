/** 화면 틀: PC = 왼쪽 메뉴, 모바일 = 위 햄버거 + 아래 탭 바 */
import type { ReactNode } from 'react';
import { AppShell, Burger, Group, NavLink, Text, Badge, Menu, ActionIcon, UnstyledButton, Stack, Box } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconLayoutDashboard, IconAdjustments, IconRocket, IconHistory, IconUsers, IconUserCircle, IconLogout, IconRefresh } from '@tabler/icons-react';
import { ROLE_LABEL, canDo } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { resetDemo } from '../api/client.ts';

const NAV = [
  { to: '/', label: '대시보드', short: '홈', icon: IconLayoutDashboard, exact: true },
  { to: '/balance', label: '밸런스', short: '밸런스', icon: IconAdjustments },
  { to: '/releases', label: '배포', short: '배포', icon: IconRocket },
  { to: '/history', label: '변경 이력', short: '이력', icon: IconHistory },
  { to: '/admin', label: '계정 · 감사', short: '계정', icon: IconUsers, need: 'admin' as const }
];

export function Shell({ children }: { children: ReactNode }) {
  const api = useApi(), { me, logout } = useAuth();
  const [open, { toggle, close }] = useDisclosure(false);
  const mobile = useMediaQuery('(max-width: 48em)');
  const loc = useLocation(), nav = useNavigate();
  const pending = useQuery({ queryKey: ['pending'], queryFn: () => api.pending() });
  const items = NAV.filter(n => !n.need || canDo(me!.role, n.need));
  const active = (n: typeof NAV[number]) => n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
  const go = (to: string) => { nav(to); close(); };
  const pendN = pending.data?.length || 0;

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: !open } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={open} onClick={toggle} hiddenFrom="sm" size="sm" />
            <UnstyledButton onClick={() => go('/')}><Text fw={900} size="lg">게이트히어로 <Text span c="dimmed" fw={600} size="sm">운영툴</Text></Text></UnstyledButton>
            {api.demo && <Badge color="orange" variant="light">데모</Badge>}
          </Group>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="내 계정"><IconUserCircle /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{me!.username} · {ROLE_LABEL[me!.role]}</Menu.Label>
              {api.demo && <Menu.Item leftSection={<IconRefresh size={16} />} onClick={resetDemo}>데모 데이터 처음으로</Menu.Item>}
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>로그아웃</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          {items.map(n => (
            <NavLink key={n.to} active={active(n)} label={n.label} leftSection={<n.icon size={18} />} onClick={() => go(n.to)}
              rightSection={n.to === '/releases' && pendN ? <Badge size="sm" color="yellow">{pendN}</Badge> : null} />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="gha-main">{children}</AppShell.Main>

      {mobile && (   // 모바일 아래 탭 바(주요 4개)
        <Box style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 64, zIndex: 150, background: 'var(--mantine-color-dark-7)', borderTop: '1px solid var(--mantine-color-dark-4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Group grow h="100%" gap={0}>
            {items.slice(0, 4).map(n => (
              <UnstyledButton key={n.to} onClick={() => go(n.to)} style={{ height: '100%' }}>
                <Stack gap={2} align="center" c={active(n) ? 'indigo.4' : 'dimmed'}>
                  <Box pos="relative"><n.icon size={22} />{n.to === '/releases' && pendN > 0 && <Badge size="xs" color="yellow" circle style={{ position: 'absolute', top: -6, right: -12 }}>{pendN}</Badge>}</Box>
                  <Text size="xs" fw={active(n) ? 800 : 500}>{n.short}</Text>
                </Stack>
              </UnstyledButton>
            ))}
          </Group>
        </Box>
      )}
    </AppShell>
  );
}
