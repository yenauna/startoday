// 임시 디자인 확인 탭. 앱의 화면·자료·저장 경로와 분리된 정적 시안(design-preview.html)을
// 격리된 프레임에 띄우기만 한다. 여기서 누르는 버튼은 기록이나 저장에 영향을 주지 않는다.
import { $, btn } from '../shared/ui.js';

const frameId = 'design-preview-frame';
const defaultWidth = { teacher: 'wide', student: 'phone' };
let previewView = 'teacher';
let previewWidth = defaultWidth.teacher;
let previewTheme = 'blue-hour';

const frameSrc = () => `design-preview.html?view=${previewView}&theme=${previewTheme}`;

export function designView() {
  const view = (name, label) => btn(label, () => setView(name), 'dp-chip', `data-dp-view="${name}" aria-pressed="${previewView === name}"`);
  const width = (name, label) => btn(label, () => setWidth(name), 'dp-chip', `data-dp-width="${name}" aria-pressed="${previewWidth === name}"`);
  const theme = (name, label) => btn(label, () => setTheme(name), 'dp-chip', `data-dp-theme="${name}" aria-pressed="${previewTheme === name}"`);
  return `<style>
.design-preview{display:grid;gap:12px}
.design-preview .dp-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:var(--st-radius-card);background:var(--st-surface);box-shadow:var(--st-surface-light),var(--st-shadow-1)}
.design-preview .dp-groups{display:flex;gap:14px;flex-wrap:wrap;align-items:center;min-width:0}
.design-preview .dp-group{display:flex;gap:6px;flex-wrap:wrap}
.design-preview .dp-group-label{align-self:center;color:var(--st-text-muted);font-size:12px;font-weight:600}
.design-preview .dp-chip{min-height:38px;padding:7px 14px;border:0;border-radius:var(--st-radius-pill);background:var(--st-gray-bg);color:var(--st-gray-text);font-weight:650;font-size:14px}
.design-preview .dp-chip[aria-pressed="true"]{background:var(--st-lavender-bg);color:var(--st-lavender-text);box-shadow:inset 0 0 0 1px currentColor}
.design-preview .dp-link{display:inline-flex;align-items:center;min-height:38px;padding:7px 14px;border-radius:var(--st-radius-pill);background:var(--st-blue-bg);color:var(--st-blue-text);font-weight:650;font-size:14px;text-decoration:none}
.design-preview .dp-note{margin:0;color:var(--st-text-muted);font-size:13px;line-height:1.65}
.design-preview .dp-note b{color:var(--st-blue-text);font-weight:700}
.design-preview .dp-stage{display:flex;justify-content:center;padding:12px;border-radius:var(--st-radius-card);background:var(--st-gray-bg);box-shadow:inset 0 0 0 1px var(--st-line)}
.design-preview .dp-frame{display:block;width:100%;height:min(78vh,940px);min-height:560px;border:0;border-radius:14px;background:#1B283B;box-shadow:0 10px 26px rgba(40,50,71,.18)}
.design-preview .dp-stage[data-width="phone"] .dp-frame{width:min(412px,100%)}
@media(max-width:640px){.design-preview .dp-frame{height:72vh;min-height:480px}.design-preview .dp-bar{padding:9px 10px}.design-preview .dp-chip,.design-preview .dp-link{font-size:13px;padding:6px 11px}}
</style><div class="design-preview"><div class="dp-bar"><div class="dp-groups"><div class="dp-group" role="group" aria-label="화면 선택">${view('teacher', '교사 메인화면')}${view('student', '학생 메인화면')}</div><div class="dp-group" role="group" aria-label="화면 너비"><span class="dp-group-label">너비</span>${width('wide', '넓게')}${width('phone', '휴대폰')}</div><div class="dp-group" role="group" aria-label="시안 테마">${theme('blue-hour', '1안: Blue hour')}${theme('night-sky', '2안: Night sky')}${theme('hybrid', '3안: 밤하늘 헤더 + 밝은 본문')}${theme('dark-glass', '4안: 다크 밤하늘 + 불투명 카드')}</div></div><a class="dp-link" href="${frameSrc()}" target="_blank" rel="noopener">새 창으로 보기</a></div><p class="dp-note">임시 시안입니다. 이 화면에서는 기록·저장·설정이 바뀌지 않습니다. 상단에서 테마를 바꿔 비교할 수 있습니다.</p><div class="dp-stage" data-width="${previewWidth}"><iframe id="${frameId}" class="dp-frame" title="메인화면 디자인 시안" src="${frameSrc()}"></iframe></div></div>`;
}

function setView(name) {
  previewView = name === 'student' ? 'student' : 'teacher';
  document.querySelectorAll('.design-preview [data-dp-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.dpView === previewView)));
  syncFrame();
  setWidth(defaultWidth[previewView]);
}

function setTheme(name) {
  if (name === previewTheme) return;
  previewTheme = name;
  document.querySelectorAll('.design-preview [data-dp-theme]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.dpTheme === previewTheme)));
  syncFrame();
}

function syncFrame() {
  const frame = $('#' + frameId);
  if (frame) frame.src = frameSrc();
  const link = $('.design-preview .dp-link');
  if (link) link.href = frameSrc();
}

function setWidth(name) {
  previewWidth = name === 'phone' ? 'phone' : 'wide';
  const stage = $('.design-preview .dp-stage');
  if (stage) stage.dataset.width = previewWidth;
  document.querySelectorAll('.design-preview [data-dp-width]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.dpWidth === previewWidth)));
}
