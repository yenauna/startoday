import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('15개 기본 과목은 지정한 11개 배경/포인트 조합을 정확히 공유', () => {
  const expected = {
    국어: ['#EDF5FB', '#397FAE'],
    수학: ['#FBF7E8', '#997710'],
    사회: ['#F7F0EA', '#946B46'],
    과학: ['#EFF6EC', '#527F4A'],
    영어: ['#F0F1FC', '#6269B0'],
    음악: ['#FCEDF3', '#B6537D'],
    미술: ['#F7EFFB', '#9161AD'],
    체육: ['#EAF7F3', '#287E73'],
    실과: ['#FCEFE9', '#BA6044'],
    도덕: ['#F5F7E8', '#7B8527'],
    창체: ['#EDE9FA', '#7256A5']
  };
  for (const [code, [background, accent]] of Object.entries(expected)) assert.deepEqual(C.subjectColors(code), {
    background,
    accent
  });
  const db = C.initialDB();
  assert.equal(db.subject_rules.length, 15);
  assert.equal(new Set(db.subject_rules.map(rule => JSON.stringify(C.subjectColors(rule)))).size, 11);
  for (const code of ['자율자치', '동아리', '진로', '학자시']) assert.deepEqual(C.subjectColors(code), C.subjectColors('창체'));
});
test('출처 없는 과거 기본색/직접 설정색은 추측하여 덮어쓰지 않음', () => {
  for (const color of ['#E0F2FE', '#123456']) {
    const rule = {
        id: 'existing',
        code: '국어',
        color
      },
      before = structuredClone(rule);
    assert.equal(C.subjectColors(rule).background, color);
    assert.deepEqual(rule, before);
    assert.equal(C.usesDefaultSubjectColors(rule), false);
  }
  const changedByOldClient = {
    code: '국어',
    color: '#123456',
    colorSource: 'default',
    defaultColorValue: '#EDF5FB'
  };
  assert.equal(C.subjectColors(changedByOldClient).background, '#123456');
});
test('기본값 출처가 확실한 과목만 새 정의를 따르고 사용자 포인트는 보존', () => {
  assert.deepEqual(C.subjectColors({
    code: '국어',
    color: '#E0F2FE',
    colorSource: 'default',
    defaultColorValue: '#E0F2FE'
  }), C.subjectColors('국어'));
  assert.deepEqual(C.subjectColors({
    code: '국어',
    color: '#ABCDEF',
    accentColor: '#123456',
    colorSource: 'custom'
  }), {
    background: '#ABCDEF',
    accent: '#123456'
  });
  assert.deepEqual(C.subjectColors({
    code: '사회'
  }), C.subjectColors('사회'));
  assert(!C.subjectColorStyle({
    code: '국어',
    color: 'red;position:fixed'
  }).includes('position'));
});

test('학년별 과목 프리셋, 사용 토글과 특별 과목은 원본 자료를 삭제하지 않고 선택 목록에 반영',()=>{
 const db=C.initialDB();assert.deepEqual(C.gradeSubjectCodes(''),[]);assert.equal(C.gradeSubjectCodes(1).length,7);assert(C.gradeSubjectCodes(2).includes('통합교과'));assert(!C.gradeSubjectCodes(4).includes('실과'));assert(C.gradeSubjectCodes(6).includes('실과'));
 db.settings[0].grade=1;const before=structuredClone(db.subject_rules);let catalog=C.subjectCatalog(db);assert(catalog.regular.some(s=>s.code==='통합교과'));assert(!catalog.regular.some(s=>s.code==='과학'));assert.deepEqual(db.subject_rules,before);
 db.subject_rules.push({id:'project',code:'코딩',enabled:true,isProject:true,sortOrder:99});db.subject_rules.find(s=>s.code==='국어').enabled=false;
 catalog=C.subjectCatalog(db);assert.equal(catalog.regular.find(s=>s.code==='국어').enabled,false);assert.equal(catalog.special[0].code,'코딩');
});
