// Shared, side-effect-free rules for local login and password changes.
// The class initial password is whatever the teacher saved; there is no built-in default,
// so a class without one cannot log in until the teacher sets it.
export function studentPasswordInfo(student, config) {
  const initial = String(config?.defaultStudentPassword || '');
  const inherited = student.passwordResetRequired === true || student.passwordChanged === false || student.passwordChanged !== true && (student.password == null || String(student.password) === '12345');
  const password = inherited ? initial : String(student.password ?? initial);
  return {
    initial,
    password,
    mustChangePassword: student.passwordChanged !== true || student.passwordResetRequired === true || password === initial || !isKoreanPassword(password)
  };
}
export function studentIdentityMatches(student, config, identity) {
  return !student.deletedAt && Number(student.no) === Number(identity.no) && [config.schoolName, config.schoolCode].filter(Boolean).includes(identity.school) && String(config.grade || '') === String(identity.grade) && String(config.classGroup || '').trim() === String(identity.classGroup).trim();
}
export function isKoreanPassword(password) {
  return typeof password === 'string' && Array.from(password).length >= 5 && password.length <= 200 && /^[가-힣0-9]+$/.test(password) && /[가-힣]/.test(password);
}
export function validateKoreanPassword(password) {
  if (!isKoreanPassword(password)) throw Error('비밀번호는 완성된 한글을 포함해 5자 이상, 한글과 숫자로만 입력하세요.');
}
export function validateStudentPassword(password, initial, previous = initial) {
  validateKoreanPassword(password);
  if (password === initial || password === previous) throw Error('초기 비밀번호나 이전 비밀번호를 재사용할 수 없습니다.');
}

// Guidance only: submission continues to use the same server-compatible password rules.
export function studentPasswordStrength(password,initial,previous=initial){
 const repeated=typeof password==='string' && /^(.+?)\1+$/u.test(password);
 let valid=true;try{validateStudentPassword(password,initial,previous);}catch{valid=false;}
 if(!valid||repeated)return {level:'weak',label:'약함(사용 불가)',usable:false};
 if(Array.from(password).length>=7&&/[가-힣]/.test(password)&&/[0-9]/.test(password))return {level:'strong',label:'강함(사용 가능)',usable:true};
 return {level:'medium',label:'보통(사용 가능)',usable:true};
}
