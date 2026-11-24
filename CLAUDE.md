# CLAUDE.md

@AGENTS.md

이 저장소는 코덱스(`AGENTS.md`)와 클로드(Claude Code)를 함께 쓴다. 이 파일은 클로드가 코덱스와 같은 규칙으로 움직이게 하는 안내이고, 규칙의 원본은 `AGENTS.md`다.

## 먼저 읽을 것

- 작업을 시작하면 저장소 루트의 `AGENTS.md`를 먼저 읽고 설계·용어·테스트·PR 규칙을 모두 그대로 따른다.
- 위 `@AGENTS.md` 가져오기가 동작하지 않는 환경(웹·클라우드 Claude Code 포함)에서도 `AGENTS.md`를 직접 열어 읽는다.
- 이 파일과 `AGENTS.md`의 내용이 다르면 `AGENTS.md`를 따른다. 이 파일을 고칠 때는 `AGENTS.md`와 어긋나지 않게 함께 맞춘다.
- `.agents/skills/`는 코덱스 쪽 스킬 모음이라 클로드가 자동으로 읽지 않는다. 디자인·보안 작업에 필요한 스킬이 있으면 해당 `SKILL.md`를 직접 읽고 따른다.

## 저장소

'오늘의 별(StarToday)' 초등 학급 운영 웹앱. 정적 `index.html` + `css/` + `js/`, GitHub Pages(main 루트) 배포, 클라우드 데이터베이스는 `schema.sql`로 관리한다.

## 검증 명령

- `npm test` — 단위 테스트
- `npm run check` — 문법 검사
- `npm run build` — 체험 HTML(`build-demo.py`) 생성
- `npm run test:sql` — PostgreSQL(PGlite) SQL 통합 테스트
- `node tests/*.browser.mjs` — 브라우저 회귀. Playwright 모듈은 `PLAYWRIGHT_MODULE`, Chromium 실행 파일은 `CHROMIUM_EXECUTABLE_PATH`로 지정한다.

## UI/CSS 수정 규칙

- UI/CSS를 고치면 320·375·414·768·1024·1280·1440·1920 8개 폭(특히 아이패드 768·1024px)에서 깨짐·가로 스크롤·겹침이 없는지 확인한다.
- 8개 폭 전수 점검은 `node tests/responsive-widths.browser.mjs`, 추가 기능·모달·달력 상세까지 넓힌 점검은 `npm run test:responsive`로 실행한다.
- 실제 기기에서 확인하지 않은 결과를 실제 아이패드 검증으로 보고하지 않는다.

## 데이터베이스

- DB·RPC·`schema.sql` 변경은 명시적으로 요청받은 경우에만 수행한다.
- 저장소에 `schema.sql`을 반영해도 운영 DB에는 자동으로 실행되지 않는다. 실행이 필요한 변경이면 무엇을 실행해야 하는지 함께 알린다.

## 용어

- 화면에 나오는 말은 기존 UI 관례(별·포인트·물건·분야 등)를 따르고, 새 영어 용어를 만들지 않는다.
- 데이터 키·영역 ID·집계 규칙은 이름을 바꿔도 그대로 유지한다.

## 작업과 PR

- `main`에서 새 브랜치를 따서 작업하고, 검증을 마친 뒤 PR로 올려 머지한다.
- 커밋·PR 제목은 최근 이력처럼 한국어 평서문 한 줄로 무엇을 바꿨는지 적는다.
- `schema.sql` 변경이 있으면 커밋·PR에 SQL 변경이 있음을 밝힌다.
