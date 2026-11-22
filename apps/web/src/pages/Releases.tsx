import { useState } from 'react';
import { Card, Text, Group, Stack, Button, TextInput, Badge, Anchor, Modal, Alert, Accordion } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconRocket, IconArrowBackUp } from '@tabler/icons-react';
import { canDo, tableDef, type ReleaseResult } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { PageHead, Loading, ChangeList, KindBadge } from '../components/Common.tsx';
import { fmtTime, ok, fail } from '../util.ts';

export function ReleasesPage() {
  const api = useApi(), { me } = useAuth(), qc = useQueryClient(), nav = useNavigate();
  const pub = canDo(me!.role, 'publisher');
  const pending = useQuery({ queryKey: ['pending'], queryFn: () => api.pending() });
  const rel = useQuery({ queryKey: ['releases'], queryFn: () => api.releases() });
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [ask, setAsk] = useState<'release' | number | null>(null), [res, setRes] = useState<ReleaseResult | null>(null);
  const refresh = () => qc.invalidateQueries();
  const doIt = async () => {
    const a = ask; setAsk(null); setBusy(true);
    try {
      const r = a === 'release' ? await api.release(note) : await api.rollback(a as number, note || undefined);
      setRes(r); setNote(''); refresh();
      ok(r.created ? `v${r.version} 배포 완료` : r.reload.message);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const groups = new Map<string, typeof pending.data>();
  for (const p of pending.data || []) { const g = groups.get(p.table) || []; g.push(p); groups.set(p.table, g); }
  return (
    <>
      <PageHead title="배포" sub="저장된 변경을 묶어 새 버전으로 게임에 적용해요. 문제가 생기면 이전 버전으로 되돌릴 수 있어요." />
      {res && <Alert mb="md" color={res.reload.ok ? 'teal' : 'orange'} withCloseButton onClose={() => setRes(null)} title={res.created ? `v${res.version} 저장됨` : '새 버전 없음'}>{res.reload.message}</Alert>}

      <Card withBorder mb="md">
        <Group justify="space-between" mb="sm"><Text fw={800}>배포 대기 {pending.data?.length ?? ''}건</Text></Group>
        <Loading q={pending} />
        {pending.data && !pending.data.length && <Text c="dimmed" size="sm">마지막 배포 이후 바뀐 게 없어요</Text>}
        <Accordion multiple variant="separated" defaultValue={[...groups.keys()]}>
          {[...groups.entries()].map(([t, items]) => (
            <Accordion.Item key={t} value={t}>
              <Accordion.Control><Group gap="xs"><Text fw={700}>{tableDef(t)?.label || t}</Text><Badge size="sm" variant="default">{items!.length}</Badge></Group></Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {items!.map(p => (
                    <div key={p.key}>
                      <Group gap="xs" mb={2}><KindBadge kind={p.kind} />{p.kind === 'del' ? <Text size="sm" className="gha-mono">{p.key}</Text> : <Anchor size="sm" className="gha-mono" onClick={() => nav(`/balance/${t}/${encodeURIComponent(p.key)}`)}>{p.key}</Anchor>}</Group>
                      {p.kind === 'mod' && <ChangeList changes={p.changes} />}
                    </div>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        {pub && (
          <Group mt="md" gap="sm" wrap="wrap">
            <TextInput placeholder="배포 메모 (예: 1.0.3 레일 필살기 수정)" value={note} onChange={e => setNote(e.currentTarget.value)} style={{ flex: 1, minWidth: 220 }} />
            <Button leftSection={<IconRocket size={16} />} disabled={!pending.data?.length} loading={busy} onClick={() => setAsk('release')}>배포하기</Button>
          </Group>
        )}
        {!pub && <Text size="xs" c="dimmed" mt="sm">배포는 '배포' 권한 이상만 할 수 있어요</Text>}
      </Card>

      <Text fw={800} mb="xs">배포 기록</Text>
      <Loading q={rel} />
      <Stack gap="xs">
        {rel.data?.map((r, i) => (
          <Card key={r.version} withBorder padding="sm">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Group gap="xs"><Text fw={900}>v{r.version}</Text>{i === 0 && <Badge color="teal">게임 적용 중</Badge>}<Text size="sm">{r.note || ''}</Text></Group>
              <Group gap="xs"><Text size="xs" c="dimmed">{r.createdBy} · {fmtTime(r.createdAt)} · <span className="gha-mono">{r.hash.slice(0, 8)}</span></Text>
                {pub && i > 0 && <Button size="xs" variant="light" color="orange" leftSection={<IconArrowBackUp size={14} />} onClick={() => setAsk(r.version)}>이 버전으로</Button>}</Group>
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal opened={ask !== null} onClose={() => setAsk(null)} centered title={ask === 'release' ? '배포할까요?' : `v${ask}로 되돌릴까요?`}>
        <Text size="sm" mb="md">{ask === 'release' ? `대기 중인 ${pending.data?.length}건을 새 버전으로 저장하고 게임 서버에 바로 적용해요.` : `DB 밸런스 데이터 전체를 v${ask} 내용으로 바꾸고, 새 버전으로 게임 서버에 적용해요. 지금 배포 안 된 변경도 사라져요.`}</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setAsk(null)}>취소</Button><Button color={ask === 'release' ? undefined : 'orange'} onClick={doIt}>{ask === 'release' ? '배포' : '되돌리기'}</Button></Group>
      </Modal>
    </>
  );
}
