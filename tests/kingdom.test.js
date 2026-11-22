import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture(n = 0) {
  const db = C.initialDB();
  db.students = [{
    id: 's',
    no: 1,
    name: '가온'
  }];
  db.records = Array.from({
    length: n
  }, (_, i) => ({
    id: 'r' + i,
    date: C.today(),
    kind: '칭찬',
    studentIds: ['s'],
    text: '내용은 집계와 무관',
    areas: ['학습', '학습태도']
  }));
  return db;
}
test('6대 경험치·18종 칭호는 15/30/45회로 해금되고 키워드와 무관', () => {
  assert.deepEqual(C.KINGDOM_THRESHOLDS, [15, 30, 45]);
  assert.deepEqual(C.titleThresholds(), [15, 30, 45]);
  assert.equal(C.KINGDOM_DOMAINS.length, 6);
  assert.equal(C.KINGDOM_DOMAINS.flatMap(d => d.titles).length, 18);
  assert.equal(C.kingdomMatches, undefined);
  for (const [n, stage] of [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [44, 2], [45, 3]]) assert.equal(C.kingdomCatalog(C.kingdomCounts(fixture(n), 's'))[0].stage, stage);
  const db = fixture();
  db.records = [{
    id: 'r',
    date: C.today(),
    kind: '칭찬',
    studentIds: ['s'],
    text: '독서 청소 체육 준비물'
  }];
  assert.equal(Object.values(C.kingdomCounts(db, 's')).reduce((a, b) => a + b, 0), 0);
});
test('영역 중복은 한 번만, 다른 경험치 영역은 각각 집계하고 조언은 제외', () => {
  const db = fixture(1);
  db.records[0].areas.push('과제', '생활');
  db.records.push({
    ...db.records[0],
    id: 'advice',
    kind: '지도'
  });
  const counts = C.kingdomCounts(db, 's');
  assert.equal(counts.learning, 1);
  assert.equal(counts.tasks, 1);
  assert.equal(counts.life, 1);
  assert.equal(counts.jobs, 0);
});
test('경험치 이름을 바꿔도 안정적인 영역 ID로 칭호를 연동', () => {
  let db = fixture();
  db = C.applyOps(db, C.areaEditOps(db, 'area-6', '1인1역'));
  db.records = [{
    id: 'r',
    date: C.today(),
    kind: '칭찬',
    studentIds: ['s'],
    text: '지원함',
    areas: ['1인1역']
  }];
  assert.equal(C.kingdomCounts(db, 's').jobs, 1);
  assert.equal(C.kingdomCatalog({}, C.kingdomConfig(db))[5].label, '1인1역');
});
test('교사 목표를 30회로 바꾸면 30/60/90 단계, 잘못된 목표는 거부', () => {
  assert.deepEqual(C.titleThresholds({
    goal: 30
  }), [30, 60, 90]);
  assert.equal(C.kingdomCatalog({
    learning: 30
  }, {
    goal: 30
  })[0].stage, 1);
  for (const goal of [0, 2, 3.5, NaN, 10000]) assert.throws(() => C.titleThresholds({
    goal
  }));
});
test('미래·타인·출결제외·관찰·추가기록은 칭호 횟수에서 제외', () => {
  const db = fixture(1),
    r = db.records[0];
  db.records.push({
    ...r,
    id: 'o',
    studentIds: ['other']
  }, {
    ...r,
    id: 'f',
    date: C.addDays(C.today(), 1)
  }, {
    ...r,
    id: 'obs',
    kind: '관찰'
  }, {
    ...r,
    id: 'extra',
    kind: '추가기록'
  });
  assert.equal(C.kingdomCounts(db, 's').learning, 1);
  db.attendance = [{
    id: 'ex',
    date: C.today(),
    studentId: 's',
    excluded: true
  }];
  assert.equal(C.kingdomCounts(db, 's').learning, 0);
});
test('대표 칭호는 획득 단계만 장착, 기록 삭제 시 기본 칭호로 표시', () => {
  let db = fixture(45);
  for (const id of ['learning:1', 'learning:2', 'learning:3']) {
    db = C.applyOps(db, C.studentTitleOps(db, 's', id));
    assert.equal(C.kingdomEquipped(db.students[0], C.kingdomCounts(db, 's')).id, id);
  }
  assert.throws(() => C.studentTitleOps(db, 's', 'reading:1'));
  db.records = [];
  assert.equal(C.kingdomEquipped(db.students[0], C.kingdomCounts(db, 's')).name, '별의 주민');
});
test('자동 과제 칭찬도 실제 영역으로만 완료 1회 집계, 메모·늦게완료는 제외', () => {
  let db = fixture(),
    a = {
      id: 'a',
      title: '독서',
      target: 'all',
      statArea: '과제'
    };
  db.assignments = [a];
  for (const status of C.STATUSES) {
    db = C.applyOps(db, C.taskStateOps(db, a, C.today(), 's', status, '청소'));
    assert.equal(C.kingdomCounts(db, 's').tasks, status === '완료' ? 1 : 0);
    assert.equal(C.kingdomCounts(db, 's').life, 0);
  }
});
test('클라우드와 브라우저는 동일한 6대 경험치 칭호 모델 사용', async () => {
  const {
    readFile
  } = await import('node:fs/promises');
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8'),
    match = sql.match(/jsonb_array_elements\('(\[\{"id":"learning".*?\])'::jsonb\)/s);
  assert(match);
  const identity=rows=>rows.map(({icon,...d})=>d);assert.deepEqual(identity(JSON.parse(match[1])),identity(C.KINGDOM_DOMAINS));
  assert(C.KINGDOM_DOMAINS.every(d=>d.icon.startsWith('<svg')));
});
test('경험치 이름을 서로 교환해도 칭호가 두 영역에 중복 반영되지 않음', () => {
  let db = fixture(1);
  const draft = structuredClone(db.areas);
  [draft[0].name, draft[1].name] = [draft[1].name, draft[0].name];
  db = C.applyOps(db, C.areaBatchOps(db, draft));
  const counts = C.kingdomCounts(db, 's');
  assert.equal(counts.learning, 1);
  assert.equal(counts.tasks, 0);
});

test('커스텀 칭호 이름은 ID/해금/장착을 보존하며 기본값 복원 및 HTML 이스케이프',()=>{
 let d=fixture(45);d.students[0].equippedTitle='learning:3';d=C.applyOps(d,C.customTitleOps(d,{'learning:3':'<반짝 탐구왕>','resident':'우리 반 주민'}));const config=C.kingdomConfig(d),counts=C.kingdomCounts(d,'s'),t=C.kingdomEquipped(d.students[0],counts,config);assert.equal(t.id,'learning:3');assert.equal(t.stage,3);assert.equal(t.name,'<반짝 탐구왕>');assert.equal(C.kingdomCatalog(counts,config)[0].current,t.name);assert.equal(C.kingdomCatalog(counts,config)[0].titles[2],t.name);assert.match(C.kingdomBadge(d.students[0],counts,config),/&lt;반짝 탐구왕&gt;/);assert.match(C.kingdomBadge(d.students[0],counts,config),/data-title-stage="3"/);assert.equal(C.kingdomEquipped({},counts,config).name,'우리 반 주민');assert.equal(C.titleDefinitions().length,19);assert.throws(()=>C.customTitleOps(d,{resident:''}));assert.throws(()=>C.customTitleOps(d,{resident:'가'.repeat(41)}));d=C.applyOps(d,C.customTitleOps(d,{}));assert.equal(d.students[0].equippedTitle,'learning:3');assert.equal(C.kingdomEquipped(d.students[0],counts,C.kingdomConfig(d)).name,'통찰의 현자');
});
test('칭호별 SVG 아이콘은 허용 풀에서 선택하며 장착 ID·이름과 독립적으로 저장·복원',()=>{
 let d=fixture(45);d.students[0].equippedTitle='learning:3';assert(C.TITLE_ICONS.length>=10);assert.equal(new Set(C.TITLE_ICONS.map(([id])=>id)).size,C.TITLE_ICONS.length);
 d=C.applyOps(d,C.customTitleOps(d,{'learning:3':'최고 탐구왕'},{'learning:3':'trophy',resident:'gold-star'}));let config=C.kingdomConfig(d),counts=C.kingdomCounts(d,'s');assert.equal(config.customTitleIcons['learning:3'],'trophy');assert.equal(C.kingdomEquipped(d.students[0],counts,config).id,'learning:3');assert.equal(C.kingdomEquipped(d.students[0],counts,config).icon,C.customTitleIcon('learning:3',config));assert.match(C.kingdomBadge({},counts,config),/gold-star-icon/);
 for(const [key] of C.TITLE_ICONS){assert.match(C.customTitleIcon('learning:3',{customTitleIcons:{'learning:3':key}}),/<svg/);}
 assert.throws(()=>C.customTitleOps(d,{}, {'learning:3':'<script>'}),/아이콘/);assert.deepEqual(C.normalizeCustomTitleIcons({'learning:3':'bad',unknown:'trophy'}),{});
 d=C.applyOps(d,C.customTitleOps(d,{'learning:3':'새 이름'}));assert.equal(d.settings[0].customTitleIcons['learning:3'],'trophy');d=C.applyOps(d,C.customTitleOps(d,{},{}) );assert.deepEqual(d.settings[0].customTitleIcons,{});assert.equal(d.students[0].equippedTitle,'learning:3');assert.equal(C.kingdomEquipped(d.students[0],counts,C.kingdomConfig(d)).icon,C.KINGDOM_DOMAINS[0].icon);
});
