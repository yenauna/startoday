# AGENTS.md

## 저장소

'오늘의 별(StarToday)' 초등 학급 운영 웹앱. 정적 `index.html` + `css/` + `js/`, GitHub Pages(main 루트) 배포, 클라우드 데이터베이스는 `schema.sql`로 관리한다.

검증 명령: `npm test`(단위), `npm run check`(문법), `npm run build`(체험 HTML), 브라우저 회귀는 `node tests/*.browser.mjs`(Playwright/Chromium 경로는 `CHROMIUM_EXECUTABLE_PATH`, 모듈은 `PLAYWRIGHT_MODULE`).

## UI/CSS 수정 규칙

- UI/CSS 수정 시 320·375·414·768·1024·1280·1440·1920 8개 폭(특히 아이패드 768·1024px)에서 깨짐·가로 스크롤·겹침이 없는지 검증한다.
- 8개 폭 전수 점검은 `node tests/responsive-widths.browser.mjs`로 실행한다. 교사 탭·설정(칭호 관리)·학생 화면(홈·경제·설문·아바타)·교실화면에서 가로 스크롤, 화면 밖으로 나간 버튼, 지나치게 좁은 학생 카드가 없는지 확인한다.
