import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('통계·수업도구 탭 라우팅을 지원하고 이전 학생 주소는 통계로 이어짐', () => {
  const location = {
      hash: '#' + encodeURIComponent('학생')
    },
    state = {
      tab: '대시보드',
      actions: new Map()
    },
    app = {
      innerHTML: ''
    };
  const context = {
    state,
    setupPwa:()=>{},
    dismissDateRange:()=>{},
    initNebulaParallax() {},
    syncToolsVisibility:()=>{},
    syncGroupBuyDialog:()=>{},
    clearTitleUnlock:()=>{},
    captureSelectionMotion:()=>({}),
    animateSelectionMotion:()=>{},
    clearSelectionMotion:()=>{},
    location,
    history: {
      replaceState(_, title, url) {
        location.hash = url;
      },
      pushState(_, title, url) {
        location.hash = url;
      }
    },
    window: {
      addEventListener() {}
    },
    document: {
      querySelector: () => null,
      body: {
        classList: {
          remove() {}
        }
      }
    },
    $: () => app,
    db: () => ({}),
    store: {},
    classroomLocked: () => false,
    renderShell: fn => fn(),
    bindQuickInput() {},
    stopMobileRecordBar() {},
    syncViewportPreview() {},
    bindTimetableDrag() {},
    installGlobalEvents() {}
  };
  for (const name of ['incidentsView', 'economyView', 'dashboard', 'recordsView', 'calendarView', 'assignmentsView', 'routinesView', 'studentsView', 'seatsView', 'settingsView', 'toolsView', 'designView']) context[name] = () => name;
  const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', '').replace(/^boot\(\);$/m, '');
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(state.tab, '통계');
  assert.equal(decodeURIComponent(location.hash), '#통계');
  context.navigate('통계');
  assert.equal(app.innerHTML, 'studentsView');
  assert.equal(context.document.title,'통계 · 오늘의 별');
  assert.equal(decodeURIComponent(location.hash), '#통계');
  context.navigate('없는탭');assert.equal(state.tab,'대시보드');assert.equal(app.innerHTML,'dashboard');
  context.navigate('디자인');assert.equal(state.tab,'디자인');assert.equal(app.innerHTML,'designView');assert.equal(decodeURIComponent(location.hash),'#디자인');
  context.navigate('수업도구');
  assert.equal(app.innerHTML,'toolsView');
  assert.equal(decodeURIComponent(location.hash),'#수업도구');
});
