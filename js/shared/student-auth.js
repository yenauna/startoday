// Shared, side-effect-free rules for local login and password changes.
export function studentPasswordInfo(student, config) {
  const initial = String(config.defaultStudentPassword || '12345');
  const inherited = student.passwordResetRequired === true || student.passwordChanged === false || student.passwordChanged !== true && (student.password == null || String(student.password) === '12345');
  const password = inherited ? initial : String(student.password ?? initial);
  return {
    initial,
    password,
    mustChangePassword: student.passwordChanged !== true || student.passwordResetRequired === true || password === initial
  };
}
export function studentIdentityMatches(student, config, identity) {
  return !student.deletedAt && Number(student.no) === Number(identity.no) && [config.schoolName, config.schoolCode].filter(Boolean).includes(identity.school) && String(config.grade || '') === String(identity.grade) && String(config.classGroup || '').trim() === String(identity.classGroup).trim();
}
export function validateStudentPassword(password, initial, previous = initial) {
  if (Array.from(password).length < 4 || password.length > 200 || !/\p{L}/u.test(password) || password === initial || password === previous) throw Error('새 비밀번호는 문자(영문·한글 등)를 포함해 4자 이상이어야 하며 초기 비밀번호나 이전 비밀번호를 재사용할 수 없습니다.');
}
