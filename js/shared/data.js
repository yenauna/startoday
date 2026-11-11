import { render } from '../app.js';
import * as C from '../core.js';
import { state, store } from './state.js';
import { toast } from './ui.js';
export const db = () => store.db;
export const settings = () => db().settings[0];
export const students = () => C.activeStudents(db());
export const kindLabel = k => C.recordLabel({
  kind: k
});
export const name = id => {
  const s = db().students.find(x => x.id === id);
  return s ? (s.deletedAt ? '(나간 학생) ' : '') + s.no + '. ' + C.studentLabel(s) : '(나간 학생)';
};
export async function commit(ops, message = '저장했습니다.') {
  await store.commit(ops);
  state.saveNotice = `저장 ${new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  render();
  if (message) toast(message);
}
export const up = (table, data) => ({
  table,
  id: data.id,
  data
});
