// Shared, side-effect-free rules for local login and password changes.
export function studentPasswordInfo(student, config) {
  const initial = String(config.defaultStudentPassword || '바람123');
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
