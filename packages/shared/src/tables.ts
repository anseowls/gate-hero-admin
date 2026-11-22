/**
 * 밸런스 표(게임 저장소 server/gamedata.ts BALANCE_TABLES와 같아야 한다).
 * summary: 목록에서 보여 줄 값(점으로 경로, 앞에서부터 있는 것만)
 */
export interface TableDef { name: string; label: string; desc: string; title: string[]; summary: [string, string][] }

export const TABLES: TableDef[] = [
  { name: 'classes', label: '직업', desc: '기본 스탯 · 평타 · 차지 · 필살기', title: ['name'], summary: [['체력', 'stats.hp'], ['공격', 'stats.atk'], ['역할', 'role']] },
  { name: 'advancements', label: '전직', desc: '전직 스탯 · 스킬 · 필살기', title: ['name'], summary: [['직업', 'cls'], ['역할', 'role']] },
  { name: 'skills', label: '스킬', desc: '피해 · MP · 쿨타임 · 범위', title: ['name'], summary: [['MP', 'mp'], ['쿨', 'cd']] },
  { name: 'skillbranch', label: '스킬 성장', desc: '레벨 · 분기 · SP · TP', title: ['name'], summary: [] },
  { name: 'skilltrees', label: '스킬 트리', desc: '스킬별 트리 노드', title: ['name'], summary: [] },
  { name: 'monsters', label: '몬스터', desc: '체력 · 공격 · 속도 · 패턴', title: ['name'], summary: [['체력', 'hp'], ['공격', 'atk'], ['속도', 'speed']] },
  { name: 'dungeon', label: '던전', desc: '웨이브 · 정예 · 보스 구성', title: ['name'], summary: [['테마', 'theme'], ['보스', 'boss']] },
  { name: 'economy', label: '경제', desc: '경험치 · 피로도 · 드롭 · 장비 · 강화 · 판매', title: [], summary: [] },
  { name: 'shards', label: '게이트 파편', desc: '판 중에 고르는 강화 효과', title: ['name'], summary: [['등급', 'rarity']] },
  { name: 'missions', label: '미션', desc: '일간 · 주간 목표와 보상', title: [], summary: [] },
  { name: 'cosmetics', label: '꾸미기', desc: '재화 · 가격 · 상품', title: [], summary: [] },
  { name: 'combat', label: '전투 감각', desc: '받아치기 판정 · 반격 · 필살기 게이지 · 이동', title: [], summary: [] }
];
export const TABLE_NAMES = TABLES.map(t => t.name);
export const tableDef = (n: string) => TABLES.find(t => t.name === n);

/** 'a.b.c' 경로 값 */
export function getPath(obj: any, p: string): any {
  let v = obj;
  for (const k of p.split('.')) { if (v == null || typeof v !== 'object') return undefined; v = v[k]; }
  return v;
}
