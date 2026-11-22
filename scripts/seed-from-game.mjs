// 게임 저장소의 밸런스 JSON을 데모·테스트용 시작값으로 복사한다(실운영은 게임 DB를 직접 읽으므로 필요 없음)
//   node scripts/seed-from-game.mjs [게임 저장소 경로]   기본: ../gate-hero
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const game = process.argv[2] || path.resolve('../gate-hero');
const tables = ['classes', 'skills', 'monsters', 'dungeon', 'economy', 'skilltrees', 'skillbranch', 'shards', 'advancements', 'missions', 'cosmetics', 'combat', 'content'];
const out = {};
for (const t of tables) out[t] = JSON.parse(readFileSync(path.join(game, 'shared/data', t + '.json'), 'utf8'));
writeFileSync('apps/web/src/demo/seed.json', JSON.stringify(out));
console.log('seed.json 갱신:', tables.length, '표');
