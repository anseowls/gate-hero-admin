import { useState } from 'react';
import { Center, Paper, Title, Text, TextInput, PasswordInput, Button, Stack, SegmentedControl, Alert } from '@mantine/core';
import type { Role } from '@shared';
import { ROLE_LABEL } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { tokenStore } from '../api/client.ts';

export function LoginPage() {
  const api = useApi(), { setMe } = useAuth();
  const [u, setU] = useState(api.demo ? 'demo' : ''), [p, setP] = useState(''), [role, setRole] = useState<Role>('admin');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api.login(u, api.demo ? role : p); tokenStore.set(r.token); setMe(r.me); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" w="100%" maw={400}>
        <form onSubmit={submit}>
          <Stack>
            <div><Title order={3}>게이트히어로 운영툴</Title><Text c="dimmed" size="sm">관리자 계정으로 로그인하세요</Text></div>
            {api.demo && <Alert color="orange" variant="light">데모예요. 데이터는 이 브라우저에만 저장돼요. 권한을 골라 화면 차이를 볼 수 있어요.</Alert>}
            <TextInput label="아이디" value={u} onChange={e => setU(e.currentTarget.value)} autoComplete="username" required />
            {api.demo
              ? <div><Text size="sm" fw={500} mb={4}>권한</Text><SegmentedControl fullWidth value={role} onChange={v => setRole(v as Role)} data={(['viewer', 'editor', 'publisher', 'admin'] as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }))} /></div>
              : <PasswordInput label="비밀번호" value={p} onChange={e => setP(e.currentTarget.value)} autoComplete="current-password" required />}
            {err && <Text c="red" size="sm">{err}</Text>}
            <Button type="submit" loading={busy} size="md">로그인</Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
