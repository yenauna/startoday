import { store } from './state.js';

// 교실화면 잠금은 교실 공용 PC에서 새로고침(F5)해도 풀리지 않아야 하므로
// 브라우저에 남긴다. 잠금은 같은 학급 범위에서만 되살린다.
const LOCK_KEY = 'startoday-classroom-lock-v1';
const lockScope = () => `${store.mode}:${store.classId || ''}:${store.user?.id || ''}`;
export function lockClassroom() {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: true, scope: lockScope(), time: Date.now() }));
  } catch {}
}
export function releaseClassroomLock() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {}
}
// 잠금을 건 뒤에 새로 열린 화면(새로고침·새 탭)에서만 되살린다.
// 이미 열려 있던 탭의 작업 화면을 도중에 가로채지 않기 위해서다.
export function classroomLocked() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
    if (saved?.locked !== true || saved.scope !== lockScope()) return false;
    return Number.isFinite(saved.time) ? performance.timeOrigin > saved.time : true;
  } catch {
    return false;
  }
}
