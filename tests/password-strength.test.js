import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentPasswordStrength} from '../js/shared/student-auth.js';
test('학생 암호 강도는 완성된 한글·길이·숫자 혼합과 초기/이전값 재사용을 판정',()=>{
 for(const p of ['', 'abc1234','1234567','한글!123','ㄱㄴ123','별빛12','바람123','기존암호7','가가가가가','가1가1가1'])assert.equal(studentPasswordStrength(p,'바람123','기존암호7').usable,false,p);
 for(const p of ['별빛123','고운마음12','친구들과행복'])assert.equal(studentPasswordStrength(p,'바람123').level,'medium',p);
 for(const p of ['고운마음123','친구와함께77'])assert.equal(studentPasswordStrength(p,'바람123').level,'strong',p);
});
