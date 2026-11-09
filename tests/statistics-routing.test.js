import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('통계 탭은 URL과 라우팅에 반영되고 이전 학생 주소도 통계로 이어짐', () => {
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
    renderShell: fn => fn(),
    bindQuickInput() {},
    bindTimetableDrag() {},
    installGlobalEvents() {}
  };
  for (const name of ['dashboard', 'recordsView', 'calendarView', 'assignmentsView', 'routinesView', 'studentsView', 'seatsView', 'settingsView']) context[name] = () => name;
  const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', '').replace(/^boot\(\);$/m, '');
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(state.tab, '통계');
  assert.equal(decodeURIComponent(location.hash), '#통계');
  context.navigate('통계');
  assert.equal(app.innerHTML, 'studentsView');
  assert.equal(context.document.title,'통계 · 오늘의 별');
  assert.equal(decodeURIComponent(location.hash), '#통계');
});
