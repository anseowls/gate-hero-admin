/**
 * 항목 편집: 폼 / JSON / 배포본과 비교 / 이 항목 이력.
 * 저장 규칙: 다른 사람이 먼저 고쳤으면 충돌(409), 형식 오류면 저장 불가, 경고(칸 빠짐·음수 등)는 확인 후 저장.
 */
import { useEffect, useMemo, useState } from 'react';
import { Tabs, Card, Group, Button, TextInput, Text, Badge, Stack, Textarea, Alert, Modal, Anchor, List, Code } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { IconDeviceFloppy, IconCopy, IconTrash, IconRefresh } from '@tabler/icons-react';
import { canDo, diff, tableDef, type Json, type Issue } from '@shared';
import { useApi, useAuth } from '../ctx.tsx';
import { PageHead, Loading, ChangeList, useConfirm } from '../components/Common.tsx';
import { JsonForm, countChanged } from '../components/JsonForm.tsx';
import { fmtTime, ok, fail, setIn, same, ago } from '../util.ts';
import { ApiError } from '../api/client.ts';

export function EditorPage() {
  const { table = '', key: rawKey = '' } = useParams(), key = decodeURIComponent(rawKey);
  const api = useApi(), { me } = useAuth(), qc = useQueryClient(), nav = useNavigate();
  const mobile = useMediaQuery('(max-width: 48em)');
  const canEdit = canDo(me!.role, 'editor');
  const q = useQuery({ queryKey: ['entry', table, key], queryFn: () => api.entry(table, key) });
  const hist = useQuery({ queryKey: ['history', table, key], queryFn: () => api.history({ table, key, limit: 30 }) });
  const [draft, setDraft] = useState<Json | null>(null), [note, setNote] = useState('');
  const [json, setJson] = useState(''), [jsonErr, setJsonErr] = useState('');
  const [issues, setIssues] = useState<Issue[] | null>(null), [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<string | null>(null);
  const cf = useConfirm();

  useEffect(() => { if (q.data) { setDraft(q.data.data); setJson(JSON.stringify(q.data.data, null, 2)); } }, [q.data]);
  const dirty = !!q.data && draft !== null && !same(draft, q.data.data);
  const vsSaved = useMemo(() => (q.data && draft !== null ? diff(q.data.data, draft) : []), [q.data, draft]);
  const vsRel = q.data && draft !== null ? countChanged(q.data.released, draft) : 0;

  const refresh = () => { qc.invalidateQueries({ queryKey: ['entry', table, key] }); qc.invalidateQueries({ queryKey: ['entries', table] }); qc.invalidateQueries({ queryKey: ['pending'] }); qc.invalidateQueries({ queryKey: ['history'] }); qc.invalidateQueries({ queryKey: ['tables'] }); };
  const save = async (force = false, data = draft, k = key, base: number | null = q.data!.updatedAt) => {
    setBusy(true);
    try {
      const r = await api.save(table, k, { data: data as Json, note: note || undefined, baseUpdatedAt: base, force });
      setIssues(null); setNote('');
      ok(r.changed ? '저장했어요 — 배포하면 게임에 적용돼요' : '바뀐 게 없어요');
      if (k !== key) nav(`/balance/${table}/${encodeURIComponent(k)}`);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'NEEDS_CONFIRM' || e.code === 'INVALID')) setIssues(e.detail as Issue[]);
      else if (e instanceof ApiError && e.code === 'CONFLICT') { fail(e); refresh(); }
      else fail(e);
    } finally { setBusy(false); }
  };
  const onPath = (p: (string | number)[], v: Json | undefined) => setDraft(d => { const n = setIn(d, p, v); setJson(JSON.stringify(n, null, 2)); return n; });
  const onJson = (s: string) => { setJson(s); try { setDraft(JSON.parse(s)); setJsonErr(''); } catch (e: any) { setJsonErr(e.message); } };
  const remove = () => cf.ask('항목 삭제', `${table}.${key} 항목을 지울까요? 배포 전까지는 게임에 영향이 없어요.`, async () => { try { await api.remove(table, key, note); ok('지웠어요'); refresh(); nav('/balance/' + table); } catch (e) { fail(e); } }, '삭제', 'red');

  const d = tableDef(table), title = q.data && typeof (q.data.data as any)?.name === 'string' ? (q.data.data as any).name : key;
  return (
    <>
      <PageHead
        title={<><Anchor onClick={() => nav('/balance/' + table)} c="dimmed" fw={500}>{d?.label || table}</Anchor> / {title}</>}
        sub={q.data && <>키 <Code>{key}</Code> · 마지막 수정 {q.data.updatedBy} {fmtTime(q.data.updatedAt)}{q.data.released === undefined ? ' · 아직 배포 안 된 새 항목' : vsRel ? ` · 배포본과 ${vsRel}곳 다름` : ' · 배포본과 같음'}</>}
        right={canEdit && q.data && (
          <Group gap="xs">
            <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={() => { setDraft(q.data!.data); setJson(JSON.stringify(q.data!.data, null, 2)); }} disabled={!dirty}>되돌리기</Button>
            <Button size="xs" variant="default" leftSection={<IconCopy size={14} />} onClick={() => setDup(key + '_copy')}>복제</Button>
            <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={remove}>삭제</Button>
          </Group>
        )} />
      <Loading q={q} />
      {q.data && draft !== null && (
        <>
          <Tabs defaultValue="form" keepMounted={false}>
            <Tabs.List mb="sm">
              <Tabs.Tab value="form">폼</Tabs.Tab>
              <Tabs.Tab value="json">JSON</Tabs.Tab>
              <Tabs.Tab value="diff" rightSection={vsRel ? <Badge size="xs" color="yellow">{vsRel}</Badge> : null}>배포본 비교</Tabs.Tab>
              <Tabs.Tab value="hist">이력</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="form"><Card withBorder><JsonForm value={draft} original={q.data.released ?? q.data.data} onChange={onPath} readOnly={!canEdit} /></Card></Tabs.Panel>
            <Tabs.Panel value="json">
              <Textarea value={json} onChange={e => onJson(e.currentTarget.value)} autosize minRows={12} maxRows={mobile ? 20 : 40} readOnly={!canEdit} styles={{ input: { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }} error={jsonErr || undefined} />
            </Tabs.Panel>
            <Tabs.Panel value="diff">
              <Card withBorder>{q.data.released === undefined ? <Text c="dimmed">배포본에 없는 새 항목이에요</Text> : vsRel ? <ChangeList changes={diff(q.data.released, draft)} max={200} /> : <Text c="dimmed">배포본과 같아요</Text>}</Card>
            </Tabs.Panel>
            <Tabs.Panel value="hist">
              <Loading q={hist} />
              <Stack gap="sm">
                {hist.data?.map(h => (
                  <Card key={h.id} withBorder padding="sm">
                    <Group gap="xs" mb={4} wrap="wrap"><Badge variant="outline" size="sm">{h.changedBy}</Badge><Text size="xs" c="dimmed">{fmtTime(h.changedAt)} ({ago(h.changedAt)})</Text>{h.note && <Text size="xs">— {h.note}</Text>}</Group>
                    <ChangeList changes={h.changes} />
                  </Card>
                ))}
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {canEdit && dirty && (   // 저장 막대: 화면 아래 고정
            <Card withBorder className="gha-sticky" mt="md" shadow="lg" padding="sm">
              <Group gap="sm" wrap={mobile ? 'wrap' : 'nowrap'}>
                <Text size="sm" fw={700} c="yellow" style={{ flexShrink: 0 }}>{vsSaved.length}곳 수정</Text>
                <TextInput placeholder="변경 이유(기록에 남아요)" value={note} onChange={e => setNote(e.currentTarget.value)} style={{ flex: 1, minWidth: 160 }} size="sm" />
                <Button leftSection={<IconDeviceFloppy size={16} />} loading={busy} onClick={() => save()} disabled={!!jsonErr} fullWidth={mobile}>저장</Button>
              </Group>
            </Card>
          )}
        </>
      )}

      <Modal opened={!!issues} onClose={() => setIssues(null)} title={issues?.some(i => i.level === 'error') ? '저장할 수 없어요' : '이대로 저장할까요?'} centered>
        <List size="sm" spacing={4} mb="md">
          {issues?.map((i, n) => <List.Item key={n}><Badge size="xs" color={i.level === 'error' ? 'red' : 'yellow'} mr={6}>{i.level === 'error' ? '오류' : '확인'}</Badge><Code>{i.path}</Code> {i.msg}</List.Item>)}
        </List>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setIssues(null)}>돌아가기</Button>
          {!issues?.some(i => i.level === 'error') && <Button color="yellow" onClick={() => save(true)} loading={busy}>확인하고 저장</Button>}
        </Group>
      </Modal>

      {cf.node}
      <Modal opened={dup !== null} onClose={() => setDup(null)} title="복제해서 새 항목 만들기" centered>
        <Stack>
          <TextInput label="새 키" value={dup || ''} onChange={e => setDup(e.currentTarget.value)} description="영문·숫자·_.#:- 64자 이내" />
          <Alert variant="light">지금 편집 중인 내용을 그대로 새 항목으로 저장해요. 게임 코드가 이 키를 쓰도록 연결돼 있어야 실제로 나와요.</Alert>
          <Button onClick={() => { const k = dup!; setDup(null); save(false, draft, k, null); }}>만들기</Button>
        </Stack>
      </Modal>
    </>
  );
}
