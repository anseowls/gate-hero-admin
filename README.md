# 게이트히어로 운영툴

게임 저장소(`gate-hero`)와 분리된 운영툴입니다. 밸런스 수치를 DB에서 고치고, 기록을 남기고, 버전으로 배포·되돌리기 합니다.

```
packages/shared   공용 로직(데이터 표 정의 · 비교 · 검증 · 핵심 동작). 서버와 화면 데모가 같은 코드를 씀
apps/api          관리 API — Node 22 + Fastify + TypeScript. 게임 DB(SQLite)의 밸런스 테이블을 읽고 씀
apps/web          관리 화면 — React + TypeScript + Mantine. PC(왼쪽 메뉴·표)와 모바일(아래 탭·카드) 반응형
scripts/          게임 저장소에서 데모·테스트용 시작값 복사
```

## 게임과의 관계

```
운영툴 화면 ──► 관리 API ──► 게임 DB: game_data · game_data_history · game_data_releases
                               │  (게임 저장소 server/migrations/012_game_data)
                               └─ 배포하면 게임 서버에 POST /v1/admin/data/reload (x-admin-token)
게임 서버: 최신 릴리스로 계산 · 게임 빌드: tools/gamedata.mjs export → JSON → 클라이언트
```

- 처음 한 번 게임 저장소에서 `npm run data:import` → `npm run data:release`로 DB에 넣어 둡니다.
- 운영툴은 같은 DB 파일(`GAME_DB`)을 씁니다. Postgres로 옮기면 `apps/api/src/sqlite-store.ts`와 같은 모양의 `pg-store.ts`만 추가하면 됩니다.
- 게임 서버에는 `ADMIN_TOKEN`, 운영툴에는 같은 값을 `GAME_ADMIN_TOKEN`으로 넣습니다.

## 권한

| 권한 | 할 수 있는 것 |
|---|---|
| 보기(viewer) | 모든 화면 조회 |
| 수정(editor) | 밸런스 저장 · 삭제 · 기록 되돌리기 |
| 배포(publisher) | 배포 · 이전 버전으로 되돌리기 |
| 관리자(admin) | 계정 추가 · 권한 변경 · 정지 · 감사 기록 |

## 실행

```bash
npm install
cp apps/api/.env.example apps/api/.env      # 값 채우기
npm -w apps/api run user -- add boss '긴비밀번호123' admin   # 첫 관리자
npm run dev:api        # http://127.0.0.1:8090
npm run dev:web        # http://localhost:5173 (/api는 위 서버로 연결)
```

운영: `npm run build`(화면) → `npm -w apps/api start` — API가 `apps/web/dist`를 같은 주소로 내보냅니다. 사내 IP 제한 + HTTPS 뒤에 두세요.

## 데모

`npm run seed`(게임 저장소의 JSON 복사) → `npm run build:demo` → `apps/web/dist-demo`. 서버 없이 브라우저 안에서 같은 핵심 로직으로 돌고, 데이터는 그 브라우저에만 저장됩니다.

## 저장 규칙

- 다른 사람이 먼저 고쳤으면 저장 거절(409) → 새로 불러와서 다시.
- 숫자 칸에 글자처럼 **형식이 바뀌면 저장 불가**, 칸 빠짐·새 칸·음수 전환은 **확인 후 저장**.
- 모든 변경은 이전·새 값, 사람, 시각, 이유와 함께 기록. 기록 한 줄 단위로 되돌릴 수 있음.
- 배포 = 지금 DB 전체 스냅샷에 버전 번호. 바뀐 게 없으면 버전을 만들지 않음. 해시는 게임 저장소 `gamedata.ts`와 같은 방식(sha256 앞 16자).

## 테스트

`npm test` — 로그인·권한·수정·충돌·검증·이력·되돌리기·배포·롤백·계정·감사.
