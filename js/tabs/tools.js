import { createFormatCards } from '../components/format-cards.js';
import { formatToolRange } from '../shared/tool-rich.js';
import { requestPwaInstall } from '../shared/pwa.js';
import { state, store } from '../shared/state.js';
import { toolCandidates, parseToolList, shuffledTools, remainingTools, toolClockValue, formatToolTime, clampToolWindow, defaultToolRect, restoreToolRect, makeToolPegs, createToolRaceBalls, stepToolRace } from '../shared/tools-core.js';
import { toolQrMatrix } from '../shared/tools-qr.js';
// This board never calls Store.commit. Only explicitly saved phrases/custom lists
// are written to its own local key. Roster names are read fresh from memory.
const TOOL_TYPES = {
  timer: '⏱️ 타이머',
  stopwatch: '⏱️ 스톱워치',
  board: '📝 타이핑 판서',
  speech: '🗣️ 음성 안내',
  random: '🎲 랜덤뽑기',
  qr: '📱 QR코드'
};
const TOOL_PHRASES = ['자리에 앉아 바른 자세로 준비하세요.', '자리 정리하고 줄 서세요.', '선생님을 보세요. 주목!', '이야기를 멈추고 조용히 해 주세요.', '활동을 마무리하고 제자리로 돌아가세요.'];
let toolRoot = null,
  toolCanvas = null,
  toolScope = '',
  toolOverlay = false,
  toolZ = 1,
  toolSerial = 0,
  toolFrame = 0,
  toolAudio = null;
const toolWindows = new Map();
let toolBoardObserver = null;
let toolSpeechOwner = null,
  toolSpeechGeneration = 0,
  toolSpeechDelay = 0;
function readToolLayouts() {
  try {
    const value = JSON.parse(localStorage.getItem('startoday-tool-layouts-v1'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function saveToolLayout(w) {
  try {
    const layouts = readToolLayouts();
    layouts[w.type] = {
      ...w.rect
    };
    localStorage.setItem('startoday-tool-layouts-v1', JSON.stringify(layouts));
  } catch {
    toolNotice(w, '창 배치를 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.');
  }
}
function setToolDrawer(collapsed) {
  toolRoot.classList.toggle('tools-drawer-collapsed', collapsed);
  const b = toolRoot.querySelector('.tools-drawer-toggle');
  b.textContent = collapsed ? '도구 메뉴 펼치기 ▾' : '도구 메뉴 접기 ▴';
  b.setAttribute('aria-expanded', String(!collapsed));
}
async function toggleToolBoardScreen() {
  if (document.fullscreenElement === toolRoot) {
    await document.exitFullscreen();
    return;
  }
  if (toolRoot.classList.contains('tools-board-screen')) {
    toolRoot.classList.remove('tools-board-screen');
    return;
  }
  toolRoot.classList.add('tools-board-screen');
  try {
    if (!toolRoot.requestFullscreen) throw Error('unsupported');
    await toolRoot.requestFullscreen();
  } catch {
    toolRoot.querySelector('.tools-board-status').textContent = '이 브라우저는 전체화면을 제한합니다. 앱 설치 또는 브라우저 전체화면을 이용하세요.';
  }
}
document.addEventListener('fullscreenchange', () => {
  if (toolRoot && document.fullscreenElement !== toolRoot) toolRoot.classList.remove('tools-board-screen');
});
function toolTeacher() {
  return !!store.db && state.viewMode !== 'student' && !state.studentUser && !state.studentPasswordPending;
}
function currentToolScope() {
  return `${store.mode}:${store.classId}:${store.user?.id || ''}`;
}
function toolElement(tag, cls = '', text = '') {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}
function toolButton(label, handler, cls = '') {
  const b = toolElement('button', cls, label);
  b.type = 'button';
  b.onclick = handler;
  return b;
}
function toolNotice(widget, message) {
  widget.status.textContent = message;
}
function toolSafe(handler, widget) {
  return async () => {
    try {
      await handler();
    } catch (error) {
      toolNotice(widget, error.message || '도구를 실행하지 못했습니다.');
    }
  };
}
function toolSaved() {
  try {
    const value = JSON.parse(localStorage.getItem('startoday-tools-v1'));
    return {
      phrases: Array.isArray(value?.phrases) ? value.phrases.filter(x => typeof x === 'string').slice(0, 30) : [],
      lists: Array.isArray(value?.lists) ? value.lists.filter(x => typeof x.name === 'string' && typeof x.text === 'string').slice(0, 30) : []
    };
  } catch {
    return {
      phrases: [],
      lists: []
    };
  }
}
function writeToolSaved(data) {
  localStorage.setItem('startoday-tools-v1', JSON.stringify(data));
}
export function toolsView() {
  setTimeout(() => {
    const host = document.getElementById('tools-tab-host');
    if (host && toolTeacher() && state.tab === '수업도구') mountToolBoard(host, false);
  }, 0);
  return '<div id="tools-tab-host"></div>';
}
export function openToolsOverlay() {
  if (!toolTeacher()) return;
  if (toolOverlay && toolRoot?.isConnected) {
    hideToolBoard();
    return;
  }
  mountToolBoard(document.body, true);
}
export function syncToolsVisibility() {
  if (!toolRoot) return;
  if (!toolTeacher() || toolScope !== currentToolScope()) {
    destroyToolBoard();
    return;
  }
  if (toolOverlay && !state.locked || !toolOverlay && (state.locked || state.tab !== '수업도구')) hideToolBoard();
}
function mountToolBoard(host, overlay) {
  if (toolScope && toolScope !== currentToolScope()) destroyToolBoard();
  toolScope = currentToolScope();
  toolOverlay = overlay;
  if (!toolRoot) {
    toolRoot = toolElement('section', 'tools-board');
    toolRoot.setAttribute('aria-label', '교실 수업도구 캔버스');
    const heading = toolElement('div', 'tools-heading'),
      title = toolElement('div');
    title.append(toolElement('h2', '', '수업도구'), toolElement('small', '', '창 제목을 끌어 이동하고 모서리로 크기를 바꾸세요. 보드를 닫으면 시간 측정과 음성 안내가 멈춥니다.'));
    const actions = toolElement('div', 'tool-controls');
    actions.append(toolButton('전체화면', toggleToolBoardScreen, 'tools-board-fullscreen'), toolButton('앱 설치', async () => {
      if (!(await requestPwaInstall())) toolRoot.querySelector('.tools-board-status').textContent = '브라우저 메뉴의 앱 설치 / 홈 화면에 추가를 이용하세요.';
    }), toolButton('닫기', hideToolBoard, 'tools-overlay-close'));
    heading.append(title, actions);
    const drawer = toolButton('도구 메뉴 접기 ▴', () => setToolDrawer(!toolRoot.classList.contains('tools-drawer-collapsed')), 'tools-drawer-toggle');
    drawer.setAttribute('aria-expanded', 'true');
    const boardStatus = toolElement('small', 'tools-board-status');
    boardStatus.setAttribute('role', 'status');
    const toolbar = toolElement('div', 'tools-toolbar');
    for (const [type, label] of Object.entries(TOOL_TYPES)) toolbar.append(toolButton(label, () => createToolWindow(type), 'tools-add'));
    toolCanvas = toolElement('div', 'tools-canvas');
    toolCanvas.append(toolElement('p', 'tools-empty', '위에서 도구를 골라 함께 배치해 보세요.'));
    toolRoot.append(heading, toolbar, drawer, boardStatus, toolCanvas);
    toolBoardObserver = new ResizeObserver(() => {
      if (!toolRoot?.isConnected || !toolCanvas.clientWidth) return;
      for (const w of toolWindows.values()) {
        if (!w.maximized) w.rect = clampToolWindow(w.rect, toolCanvas.clientWidth, toolCanvas.clientHeight);
        applyToolRect(w);
      }
    });
    toolBoardObserver.observe(toolCanvas);
  }
  toolRoot.classList.toggle('tools-overlay', overlay);
  host.append(toolRoot);
  for (const w of toolWindows.values()) {
    if (!w.maximized) w.rect = clampToolWindow(w.rect, toolCanvas.clientWidth, toolCanvas.clientHeight);
    applyToolRect(w);
  }
  if (!toolFrame) toolFrame = requestAnimationFrame(tickToolBoard);
}
function hideToolBoard() {
  if (document.fullscreenElement === toolRoot) document.exitFullscreen?.().catch(() => {});
  toolRoot?.classList.remove('tools-board-screen');
  stopToolSpeech();
  for (const w of toolWindows.values()) {
    saveToolLayout(w);
    if (w.clock?.started != null) {
      w.clock.elapsed = toolClockValue(w.clock, performance.now());
      w.clock.started = null;
    }
    w.cancelAnimation?.();
  }
  toolRoot?.remove();
  toolOverlay = false;
  cancelAnimationFrame(toolFrame);
  toolFrame = 0;
}
function destroyToolBoard() {
  hideToolBoard();
  for (const w of toolWindows.values()) {
    w.cleanup?.();
    w.observer?.disconnect();
  }
  toolWindows.clear();
  toolBoardObserver?.disconnect();
  toolBoardObserver = null;
  toolRoot = null;
  toolCanvas = null;
  toolScope = '';
}
function applyToolRect(w) {
  if (w.maximized) {
    Object.assign(w.el.style, {
      left: '0px',
      top: '0px',
      width: '100%',
      height: '100%'
    });
    return;
  }
  Object.assign(w.el.style, {
    left: w.rect.left + 'px',
    top: w.rect.top + 'px',
    width: w.rect.width + 'px',
    height: w.rect.height + 'px'
  });
}
function createToolWindow(type) {
  if (!toolTeacher() || !toolCanvas) return;
  const index = toolWindows.size,
    id = 'tool-' + ++toolSerial,
    w = {
      id,
      type,
      rect: restoreToolRect(readToolLayouts()[type], index, toolCanvas.clientWidth, toolCanvas.clientHeight),
      maximized: false
    };
  w.el = toolElement('article', 'tools-widget');
  w.el.dataset.toolId = id;
  w.el.dataset.toolType = type;
  w.el.setAttribute('aria-label', TOOL_TYPES[type]);
  const head = toolElement('div', 'tools-window-head');
  head.append(toolElement('strong', '', TOOL_TYPES[type]));
  const maximize = toolButton('⛶', () => toggleToolMaximize(w), 'tools-maximize');
  maximize.setAttribute('aria-label', '캔버스 꽉 채우기/복원');
  maximize.title = '캔버스 꽉 채우기/복원';
  maximize.setAttribute('aria-pressed', 'false');
  const close = toolButton('✕', () => closeToolWindow(w), 'tools-window-close');
  close.setAttribute('aria-label', '도구 닫기');
  head.append(maximize, close);
  w.body = toolElement('div', 'tools-window-body');
  w.status = toolElement('div', 'tools-status');
  w.status.setAttribute('role', 'status');
  const handle = toolElement('div', 'tools-resize');
  handle.setAttribute('aria-label', '크기 조절');
  handle.setAttribute('role', 'separator');
  handle.tabIndex = 0;
  w.el.append(head, w.body, w.status, handle);
  toolCanvas.querySelector('.tools-empty')?.remove();
  toolCanvas.append(w.el);
  toolWindows.set(id, w);
  w.rect = clampToolWindow(w.rect, toolCanvas.clientWidth, Math.max(600, toolCanvas.clientHeight));
  applyToolRect(w);
  w.el.onpointerdown = () => w.el.style.zIndex = String(++toolZ);
  bindToolDrag(w, head, false);
  bindToolDrag(w, handle, true);
  handle.onkeydown = e => {
    if (!e.key.startsWith('Arrow')) return;
    e.preventDefault();
    w.rect.width = Math.max(260, w.rect.width + (e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0));
    w.rect.height = Math.max(220, w.rect.height + (e.key === 'ArrowDown' ? 20 : e.key === 'ArrowUp' ? -20 : 0));
    applyToolRect(w);
    saveToolLayout(w);
  };
  if (type === 'timer' || type === 'stopwatch') buildToolClock(w);
  if (type === 'board') buildToolWriting(w);
  if (type === 'speech') buildToolSpeech(w);
  if (type === 'random') buildToolRandom(w);
  if (type === 'qr') buildToolQr(w);
  w.el.style.zIndex = String(++toolZ);
}
function bindToolDrag(w, handle, resizing) {
  handle.onpointerdown = e => {
    if (e.target.closest('button,input,select') || w.maximized) return;
    e.preventDefault();
    const x = e.clientX,
      y = e.clientY,
      before = {
        ...w.rect
      };
    handle.setPointerCapture(e.pointerId);
    const move = event => {
      const dx = event.clientX - x,
        dy = event.clientY - y;
      w.rect = clampToolWindow(resizing ? {
        ...before,
        width: before.width + dx,
        height: before.height + dy
      } : {
        ...before,
        left: before.left + dx,
        top: before.top + dy
      }, toolCanvas.clientWidth, Math.max(600, toolCanvas.scrollHeight));
      applyToolRect(w);
    };
    const end = () => {
      saveToolLayout(w);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
}
function toggleToolMaximize(w) {
  w.maximized = !w.maximized;
  w.el.classList.toggle('tools-maximized', w.maximized);
  w.el.querySelector('.tools-maximize').setAttribute('aria-pressed', String(w.maximized));
  w.el.style.zIndex = String(++toolZ);
  if (w.maximized) {
    toolCanvas.scrollTop = 0;
    toolCanvas.scrollLeft = 0;
  } else w.rect = clampToolWindow(w.rect, toolCanvas.clientWidth, toolCanvas.clientHeight);
  applyToolRect(w);
}
function closeToolWindow(w) {
  saveToolLayout(w);
  w.cleanup?.();
  w.cancelAnimation?.();
  if (toolSpeechOwner === w) stopToolSpeech();
  w.observer?.disconnect();
  w.el.remove();
  toolWindows.delete(w.id);
  if (!toolWindows.size) toolCanvas.append(toolElement('p', 'tools-empty', '위에서 도구를 골라 함께 배치해 보세요.'));
}
function tickToolBoard(now) {
  toolFrame = 0;
  if (!toolRoot?.isConnected) return;
  for (const w of toolWindows.values()) {
    if (w.clock) updateToolClock(w, now);
  }
  toolFrame = requestAnimationFrame(tickToolBoard);
}
function primeToolAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    toolAudio ||= new Audio();
    if (toolAudio.state === 'suspended') toolAudio.resume().catch(() => {});
    return toolAudio;
  } catch {
    return null;
  }
}
function ringToolChime(w) {
  const audio = primeToolAudio();
  if (!audio) {
    toolNotice(w, '시간이 끝났습니다. 이 브라우저에서는 알림음을 사용할 수 없습니다.');
    return;
  }
  for (const [index, frequency] of [784, 988, 1175].entries()) {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain(),
      t = audio.currentTime + index * .22;
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(.15, t + .02);
    gain.gain.exponentialRampToValueAtTime(.001, t + .5);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(t);
    oscillator.stop(t + .52);
  }
}
function buildToolClock(w) {
  w.clock = {
    elapsed: 0,
    started: null
  };
  w.duration = 180000;
  w.notified = false;
  const display = toolElement('div', 'tool-clock-display');
  w.time = toolElement('output', 'tool-clock-number', '00:00');
  if (w.type === 'timer') {
    display.innerHTML = '<svg class="tool-clock-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-track"/><circle cx="60" cy="60" r="52" class="ring-progress"/></svg>';
    w.progress = display.querySelector('.ring-progress');
  }
  display.append(w.time);
  w.body.append(display);
  const controls = toolElement('div', 'tool-controls');
  if (w.type === 'timer') {
    const minutes = document.createElement('input'),
      seconds = document.createElement('input');
    minutes.type = seconds.type = 'number';
    minutes.min = seconds.min = '0';
    minutes.max = '999';
    seconds.max = '59';
    minutes.value = '3';
    seconds.value = '0';
    minutes.setAttribute('aria-label', '타이머 분');
    seconds.setAttribute('aria-label', '타이머 초');
    const set = () => {
      const m = Number(minutes.value),
        s = Number(seconds.value);
      if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || m > 999 || s < 0 || s > 59) {
        toolNotice(w, '분 0~999, 초 0~59를 입력하세요.');
        return;
      }
      w.duration = (m * 60 + s) * 1000;
      resetClock();
    };
    minutes.onchange = seconds.onchange = set;
    controls.append(minutes, toolElement('span', '', '분'), seconds, toolElement('span', '', '초'));
    for (const n of [1, 3, 5, 10]) controls.append(toolButton('+' + n + '분', () => {
      w.duration = Math.min(59999000, w.duration + n * 60000);
      minutes.value = String(Math.floor(w.duration / 60000));
      seconds.value = String(Math.floor(w.duration / 1000) % 60);
      w.notified = false;
    }));
  }
  const start = toolButton('시작', () => {
    if (w.clock.started == null) {
      if (w.type === 'timer' && toolClockValue(w.clock, performance.now()) >= w.duration) resetClock();
      w.clock.started = performance.now();
      w.notified = false;
      primeToolAudio();
      toolNotice(w, '실행 중');
    }
  });
  controls.append(start, toolButton('일시정지', () => {
    w.clock.elapsed = toolClockValue(w.clock, performance.now());
    w.clock.started = null;
    updateToolClock(w, performance.now());
    toolNotice(w, '일시정지');
  }), toolButton('리셋', () => resetClock()));
  const resetClock = () => {
    w.clock.elapsed = 0;
    w.clock.started = null;
    w.notified = false;
    if (w.laps) {
      w.laps.replaceChildren();
      w.lapCount = 0;
    }
    toolNotice(w, '준비');
    updateToolClock(w, performance.now());
  };
  if (w.type === 'stopwatch') {
    w.laps = toolElement('ol', 'tool-laps');
    w.lapCount = 0;
    controls.append(toolButton('랩타임', () => {
      if (w.clock.started == null) return;
      if (w.lapCount >= 10) {
        toolNotice(w, '랩타임은 최대 10개까지 기록합니다.');
        return;
      }
      w.lapCount++;
      w.laps.append(toolElement('li', '', formatToolTime(toolClockValue(w.clock, performance.now()), true)));
    }));
  }
  w.body.append(controls);
  if (w.laps) w.body.append(w.laps);
  updateToolClock(w, performance.now());
}
function updateToolClock(w, now) {
  const elapsed = toolClockValue(w.clock, now),
    timer = w.type === 'timer';
  if (timer && w.clock.started != null && elapsed >= w.duration && !w.notified) {
    w.clock.started = null;
    w.clock.elapsed = w.duration;
    w.notified = true;
    toolNotice(w, '시간이 끝났습니다!');
    ringToolChime(w);
  }
  w.time.textContent = formatToolTime(timer ? Math.ceil(Math.max(0, w.duration - elapsed) / 1000) * 1000 : elapsed, !timer);
  if (w.progress) {
    const ratio = w.duration ? Math.max(0, 1 - elapsed / w.duration) : 0;
    w.progress.style.strokeDasharray = '326.73';
    w.progress.style.strokeDashoffset = String(326.73 * (1 - ratio));
  }
}
function buildToolWriting(w) {
  const controls = toolElement('div', 'tool-controls tool-rich-controls'),
    editor = toolElement('div', 'tool-writing-preview tool-rich-editor theme-chalk');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', '판서 내용');
  editor.setAttribute('aria-multiline', 'true');
  editor.dataset.placeholder = '여기를 클릭해 안내를 바로 입력하세요.';
  editor.spellcheck = false;
  let remembered = null;
  const remember = () => {
    const selection = getSelection();
    if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) remembered = selection.getRangeAt(0).cloneRange();
  };
  document.addEventListener('selectionchange', remember);
  w.cleanup = () => document.removeEventListener('selectionchange', remember);
  const format = styles => {
    remembered = formatToolRange(editor, remembered, styles);
    if (!remembered) toolNotice(w, '서식을 바꿀 글자를 먼저 선택하세요.');
  };
  controls.append(createFormatCards({
    beforeOpen: remember,
    onSize: size => format({
      fontSize: size + 'pt'
    }),
    onColor: color => format({
      color
    })
  }));
  controls.append(toolButton('형광펜', () => format({
    backgroundColor: '#FFE066',
    color: '#172033'
  })), toolButton('B', () => {
    const node = remembered?.startContainer,
      element = node?.nodeType === 1 ? node : node?.parentElement;
    format({
      fontWeight: element && Number(getComputedStyle(element).fontWeight) >= 700 ? '400' : '800'
    });
  }, 'tool-rich-bold'));
  controls.onpointerdown = event => {
    if (event.target.closest('button')) event.preventDefault();
  };
  const theme = document.createElement('select');
  theme.setAttribute('aria-label', '칠판 테마');
  theme.innerHTML = '<option value="chalk">초록 칠판</option><option value="white">화이트보드</option><option value="dark">다크모드</option>';
  theme.onchange = () => editor.className = 'tool-writing-preview tool-rich-editor theme-' + theme.value;
  controls.append(theme);
  const plain = event => {
    event.preventDefault();
    const text = (event.clipboardData || event.dataTransfer)?.getData('text/plain');
    if (text) {
      editor.focus();
      const selection = getSelection(),
        range = selection.rangeCount && editor.contains(selection.anchorNode) ? selection.getRangeAt(0) : document.createRange();
      if (!editor.contains(range.startContainer)) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      remember();
    }
  };
  editor.onpaste = editor.ondrop = plain;
  w.body.append(controls, editor);
}
function stopToolSpeech() {
  toolSpeechGeneration++;
  clearTimeout(toolSpeechDelay);
  toolSpeechDelay = 0;
  window.speechSynthesis?.cancel();
  if (toolSpeechOwner) toolNotice(toolSpeechOwner, '정지');
  toolSpeechOwner = null;
}
function speakToolText(w, text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    toolNotice(w, '이 브라우저는 음성 안내를 지원하지 않습니다.');
    return;
  }
  if (!text.trim()) {
    toolNotice(w, '읽을 문장을 입력하세요.');
    return;
  }
  stopToolSpeech();
  toolSpeechOwner = w;
  const generation = toolSpeechGeneration;
  const speak = () => {
    if (generation !== toolSpeechGeneration || toolSpeechOwner !== w || !w.el.isConnected) return;
    const utterance = new SpeechSynthesisUtterance(w.speechText.value.trim() || text);
    utterance.lang = 'ko-KR';
    utterance.rate = Number(w.voiceRate?.value || 1);
    utterance.pitch = Number(w.voicePitch?.value || 1);
    const voices = window.speechSynthesis.getVoices().filter(v => /^ko(?:-|_)/i.test(v.lang));
    const voice = voices.find(v => (v.voiceURI || v.name) === w.voiceSelect?.value) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (generation !== toolSpeechGeneration) return;
      if (w.repeat.checked) toolSpeechDelay = setTimeout(speak, 2500);else {
        toolNotice(w, '낭독 완료');
        toolSpeechOwner = null;
      }
    };
    utterance.onerror = () => {
      if (generation === toolSpeechGeneration) {
        toolNotice(w, '음성을 재생하지 못했습니다. 브라우저 음성 설정을 확인하세요.');
        toolSpeechOwner = null;
      }
    };
    toolNotice(w, '음성 안내 중');
    window.speechSynthesis.speak(utterance);
  };
  speak();
}
function buildToolSpeech(w) {
  const voiceControls = toolElement('div', 'tool-controls tool-voice-controls');
  w.voiceSelect = document.createElement('select');
  w.voiceSelect.setAttribute('aria-label', '목소리 선택');
  const refreshVoices = () => {
    const previous = w.voiceSelect.value;
    w.voiceSelect.replaceChildren();
    const automatic = toolElement('option', '', '기기 기본 한국어 음성');
    automatic.value = '';
    w.voiceSelect.append(automatic);
    for (const voice of window.speechSynthesis?.getVoices() || []) if (/^ko(?:-|_)/i.test(voice.lang)) {
      const option = toolElement('option', '', voice.name || voice.voiceURI || '한국어');
      option.value = voice.voiceURI || voice.name;
      w.voiceSelect.append(option);
    }
    w.voiceSelect.value = previous;
  };
  refreshVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices);
  w.cleanup = () => window.speechSynthesis?.removeEventListener?.('voiceschanged', refreshVoices);
  w.voiceRate = document.createElement('select');
  w.voiceRate.setAttribute('aria-label', '낭독 속도');
  for (const speed of [.8, 1, 1.2]) {
    const option = toolElement('option', '', speed.toFixed(1) + 'x');
    option.value = String(speed);
    w.voiceRate.append(option);
  }
  w.voiceRate.value = '1';
  w.voicePitch = document.createElement('input');
  w.voicePitch.type = 'range';
  w.voicePitch.min = '0.5';
  w.voicePitch.max = '1.5';
  w.voicePitch.step = '0.1';
  w.voicePitch.value = '1';
  w.voicePitch.setAttribute('aria-label', '음조');
  voiceControls.append(w.voiceSelect, w.voiceRate, toolElement('span', '', '음조'), w.voicePitch);
  w.body.append(voiceControls);
  w.speechText = document.createElement('textarea');
  w.speechText.placeholder = '읽어 줄 문장을 입력하세요.';
  w.speechText.setAttribute('aria-label', '음성 안내 문장');
  const label = toolElement('label', 'tool-repeat'),
    repeat = document.createElement('input');
  repeat.type = 'checkbox';
  repeat.onchange = () => {
    if (!repeat.checked) {
      clearTimeout(toolSpeechDelay);
      toolSpeechDelay = 0;
    }
  };
  w.repeat = repeat;
  label.append(repeat, document.createTextNode('무한 반복 · 낭독 후 2.5초 간격'));
  const controls = toolElement('div', 'tool-controls');
  controls.append(toolButton('즉시 읽기', () => speakToolText(w, w.speechText.value)), toolButton('정지', stopToolSpeech), toolButton('내 문장으로 저장', toolSafe(() => {
    const value = w.speechText.value.trim();
    if (!value) throw Error('저장할 문장을 입력하세요.');
    const saved = toolSaved();
    if (!saved.phrases.includes(value) && saved.phrases.length >= 30) throw Error('내 문장은 최대 30개입니다. 기존 문장을 삭제하세요.');
    if (!saved.phrases.includes(value)) saved.phrases.push(value.slice(0, 1000));
    writeToolSaved(saved);
    refresh();
  }, w)));
  const presets = toolElement('div', 'tool-speech-presets');
  const refresh = () => {
    presets.replaceChildren();
    for (const [index, text] of [...TOOL_PHRASES, ...toolSaved().phrases].entries()) {
      const row = toolElement('div', 'tool-speech-row');
      row.append(toolButton(text, () => {
        w.speechText.value = text;
        speakToolText(w, text);
      }));
      if (index >= TOOL_PHRASES.length) row.append(toolButton('삭제', toolSafe(() => {
        const saved = toolSaved();
        saved.phrases = saved.phrases.filter(p => p !== text);
        writeToolSaved(saved);
        refresh();
      }, w)));
      presets.append(row);
    }
  };
  w.body.append(w.speechText, label, controls, presets);
  refresh();
}
function buildToolQr(w) {
  const input = document.createElement('textarea');
  input.placeholder = 'URL 또는 공지 텍스트를 입력하세요.';
  input.setAttribute('aria-label', 'QR 내용');
  const canvas = document.createElement('canvas');
  canvas.className = 'tool-qr-canvas';
  canvas.setAttribute('aria-label', '생성된 QR코드');
  w.body.append(input, canvas);
  const draw = () => {
    if (!input.value) {
      canvas.hidden = true;
      toolNotice(w, '내용을 입력하면 QR코드가 나타납니다.');
      return;
    }
    try {
      const matrix = toolQrMatrix(input.value),
        scale = 8,
        size = matrix.length + 8;
      canvas.width = canvas.height = size * scale;
      const c = canvas.getContext('2d');
      c.fillStyle = '#fff';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#000';
      matrix.forEach((row, y) => row.forEach((dark, x) => {
        if (dark) c.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
      }));
      canvas.hidden = false;
      toolNotice(w, '기기 카메라로 스캔하세요. ⛶ 버튼으로 캔버스에 꽉 채워 볼 수 있어요.');
    } catch (error) {
      canvas.hidden = true;
      toolNotice(w, error.message);
    }
  };
  input.oninput = draw;
  draw();
}
function buildToolRandom(w) {
  w.drawn = new Set();
  w.randomItems = [];
  w.randomMode = 'boxes';
  w.randomBusy = false;
  const sourceRow = toolElement('div', 'tool-random-source'),
    methodRow = toolElement('div', 'tool-random-method');
  const source = document.createElement('select');
  source.setAttribute('aria-label', '뽑기 대상');
  source.innerHTML = '<option value="students">우리반 학생</option><option value="custom">새로 만들기</option><option value="saved">저장된 목록</option>';
  const privacy = toolButton('이름', () => {
    w.privateNames = !w.privateNames;
    privacy.textContent = w.privateNames ? '별명/번호' : '이름';
    refresh(false);
  });
  const replacement = toolButton('뽑힌 사람 제외', () => {
    w.replacement = !w.replacement;
    replacement.textContent = w.replacement ? '계속 리셋 · 중복 허용' : '뽑힌 사람 제외';
    refresh(false);
  });
  const count = toolElement('small', 'tool-remaining');
  sourceRow.append(source, privacy, replacement, count, toolButton('목록 리셋', () => refresh(true)));
  const method = document.createElement('select');
  method.setAttribute('aria-label', '뽑기 연출');
  method.innerHTML = '<option value="boxes">📦 상자 열기</option><option value="wheel">🎡 돌림판(룰렛)</option><option value="race">🎳 장애물 낙하 레이스</option>';
  methodRow.append(method);
  const custom = toolElement('div', 'tool-custom-list'),
    input = document.createElement('textarea'),
    listName = document.createElement('input'),
    saved = document.createElement('select');
  input.placeholder = '후보를 쉼표 또는 줄바꿈으로 입력하세요.';
  input.setAttribute('aria-label', '뽑기 후보');
  listName.placeholder = '저장할 목록 이름';
  listName.setAttribute('aria-label', '목록 이름');
  saved.setAttribute('aria-label', '저장된 뽑기 목록');
  const loadSaved = () => {
    const selected = saved.value;
    saved.replaceChildren();
    toolSaved().lists.forEach((list, index) => {
      const option = toolElement('option', '', list.name);
      option.value = String(index);
      saved.append(option);
    });
    if ([...saved.options].some(o => o.value === selected)) saved.value = selected;
  };
  const saveList = toolButton('목록 저장', toolSafe(() => {
    if (!parseToolList(input.value).length || !listName.value.trim()) throw Error('목록 이름과 후보를 입력하세요.');
    const data = toolSaved(),
      name = listName.value.trim().slice(0, 60),
      old = data.lists.find(l => l.name === name);
    if (!old && data.lists.length >= 30) throw Error('저장 목록은 최대 30개입니다. 기존 목록을 삭제하세요.');
    if (old) old.text = input.value.slice(0, 20000);else data.lists.push({
      name,
      text: input.value.slice(0, 20000)
    });
    writeToolSaved(data);
    loadSaved();
    toolNotice(w, '이 브라우저에 목록을 저장했습니다.');
  }, w));
  const savedRow = toolElement('div', 'tool-controls');
  savedRow.append(saved, toolButton('불러오기', () => refresh(true)), toolButton('저장 목록 삭제', toolSafe(() => {
    const data = toolSaved();
    data.lists.splice(Number(saved.value), 1);
    writeToolSaved(data);
    loadSaved();
    refresh(true);
  }, w)));
  custom.append(input, listName, saveList);
  const stage = toolElement('div', 'tool-random-stage'),
    action = toolButton('전체 열기', () => startToolDraw(w)),
    result = toolElement('div', 'tool-random-result');
  result.setAttribute('role', 'status');
  methodRow.append(action);
  w.body.append(sourceRow, methodRow, custom, savedRow, stage, result);
  w.randomStage = stage;
  w.randomResult = result;
  const refresh = reset => {
    w.cancelAnimation?.();
    if (reset) w.drawn.clear();
    custom.hidden = source.value !== 'custom';
    savedRow.hidden = source.value !== 'saved';
    privacy.hidden = source.value !== 'students';
    w.randomItems = source.value === 'students' ? toolCandidates(store.db.students, w.privateNames) : parseToolList(source.value === 'saved' ? toolSaved().lists[Number(saved.value)]?.text || '' : input.value);
    w.randomMode = method.value;
    action.textContent = method.value === 'boxes' ? '전체 열기' : method.value === 'wheel' ? '돌리기' : '레이스 시작';
    result.replaceChildren();
    w.el.querySelector('.tool-wheel-popup')?.remove();
    toolNotice(w, '');
    w.remainingUpdate = () => count.textContent = `남은 ${remainingTools(w.randomItems, w.drawn, w.replacement).length} / ${w.randomItems.length}개`;
    w.remainingUpdate();
    renderToolDraw(w);
  };
  input.oninput = () => refresh(true);
  source.onchange = () => {
    loadSaved();
    refresh(true);
  };
  saved.onchange = () => refresh(true);
  method.onchange = () => refresh(false);
  loadSaved();
  refresh(true);
}
function renderToolDraw(w) {
  const items = remainingTools(w.randomItems, w.drawn, w.replacement);
  w.randomStage.replaceChildren();
  if (!items.length) {
    w.randomStage.append(toolElement('p', '', '후보가 없거나 모두 뽑았습니다. 목록을 입력하거나 리셋하세요.'));
    return;
  }
  if (w.randomMode === 'boxes') {
    const grid = toolElement('div', 'tool-box-grid');
    for (const item of shuffledTools(items)) {
      const button = toolButton('?', () => revealToolBox(w, button, item), 'tool-mystery-box');
      button.setAttribute('aria-label', '물음표 상자 열기');
      button.dataset.candidateId = item.id;
      grid.append(button);
    }
    w.randomStage.append(grid);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = w.randomMode === 'wheel' ? 640 : 480;
    canvas.className = 'tool-random-canvas';
    canvas.setAttribute('aria-label', w.randomMode === 'wheel' ? '돌림판' : '핀볼 낙하 레이스');
    w.randomStage.append(canvas);
    w.randomCanvas = canvas;
    if (w.randomMode === 'wheel') paintToolWheel(canvas, items, 0);else paintToolRace(canvas, [], makeToolPegs());
  }
}
function finishToolResult(w, items) {
  for (const item of items) if (!w.replacement) w.drawn.add(item.id);
  w.remainingUpdate();
  w.randomResult.replaceChildren();
  items.forEach((item, index) => w.randomResult.append(toolElement('div', '', `${items.length > 1 ? index + 1 + '위 · ' : '🎉 '}${item.label}`)));
  if (w.randomMode === 'wheel' && items.length === 1) {
    w.el.querySelector('.tool-wheel-popup')?.remove();
    const popup = toolElement('div', 'tool-wheel-popup'),
      card = toolElement('div', 'tool-wheel-card');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', '뽑기 결과');
    const close = toolButton('확인', () => {
      popup.remove();
      w.el.querySelector('.tool-random-method button')?.focus();
    });
    card.append(toolElement('strong', '', '🎉 ' + items[0].label), close);
    popup.append(card);
    w.el.append(popup);
    close.focus();
  }
}
function revealToolBox(w, button, item) {
  if (w.randomBusy || button.disabled) return;
  w.randomBusy = true;
  button.classList.add('tool-box-shake');
  let timeout;
  const cancel = () => {
    clearTimeout(timeout);
    button.classList.remove('tool-box-shake');
    w.randomBusy = false;
  };
  w.cancelAnimation = cancel;
  timeout = setTimeout(() => {
    if (!w.el.isConnected) {
      cancel();
      return;
    }
    button.textContent = item.label;
    button.classList.remove('tool-box-shake');
    button.classList.add('is-revealed');
    button.disabled = !w.replacement;
    w.randomBusy = false;
    finishToolResult(w, [item]);
    w.cancelAnimation = null;
  }, 550);
}
function startToolDraw(w) {
  if (w.randomBusy) return;
  const items = remainingTools(w.randomItems, w.drawn, w.replacement);
  if (!items.length) return toolNotice(w, '남은 후보가 없습니다. 목록을 리셋하세요.');
  if (w.randomMode === 'boxes') {
    w.randomBusy = true;
    const buttons = [...w.randomStage.querySelectorAll('button:not(:disabled)')];
    buttons.forEach(b => b.classList.add('tool-box-shake'));
    let timeout;
    w.cancelAnimation = () => {
      clearTimeout(timeout);
      buttons.forEach(b => b.classList.remove('tool-box-shake'));
      w.randomBusy = false;
    };
    timeout = setTimeout(() => {
      if (!w.el.isConnected) {
        w.cancelAnimation?.();
        return;
      }
      const revealed = [];
      for (const b of buttons) {
        const item = items.find(i => i.id === b.dataset.candidateId);
        if (item) {
          b.textContent = item.label;
          b.classList.add('is-revealed');
          b.classList.remove('tool-box-shake');
          b.disabled = !w.replacement;
          revealed.push(item);
        }
      }
      w.randomBusy = false;
      finishToolResult(w, revealed);
      w.cancelAnimation = null;
    }, 550);
    return;
  }
  if (w.randomMode === 'wheel') runToolWheel(w, items);else runToolRace(w, items);
}
function paintToolWheel(canvas, items, rotation) {
  const c = canvas.getContext('2d'),
    center = 320,
    radius = 285,
    step = Math.PI * 2 / items.length;
  c.clearRect(0, 0, 640, 640);
  for (let i = 0; i < items.length; i++) {
    const angle = rotation + i * step;
    c.beginPath();
    c.moveTo(center, center);
    c.arc(center, center, radius, angle, angle + step);
    c.closePath();
    c.fillStyle = `hsl(${i * 137.5 % 360} 58% 86%)`;
    c.fill();
    c.strokeStyle = '#fff';
    c.stroke();
    c.save();
    c.translate(center, center);
    c.rotate(angle + step / 2);
    c.textAlign = 'right';
    c.fillStyle = '#172033';
    c.font = 'bold 18px sans-serif';
    c.fillText(items[i].label.length > 14 ? items[i].label.slice(0, 13) + '…' : items[i].label, radius - 18, 6);
    c.restore();
  }
  c.beginPath();
  c.moveTo(302, 4);
  c.lineTo(338, 4);
  c.lineTo(320, 38);
  c.fillStyle = '#D99B21';
  c.fill();
  c.beginPath();
  c.arc(center, center, 30, 0, Math.PI * 2);
  c.fillStyle = '#F5CB6C';
  c.fill();
  c.strokeStyle = '#fff5cf';
  c.lineWidth = 4;
  c.stroke();
}
function runToolWheel(w, items) {
  w.randomBusy = true;
  const winner = Math.floor(Math.random() * items.length),
    step = Math.PI * 2 / items.length,
    target = Math.PI * 2 * 7 - Math.PI / 2 - (winner + .5) * step,
    start = performance.now();
  let frame;
  const cancel = () => {
    cancelAnimationFrame(frame);
    w.randomBusy = false;
  };
  w.cancelAnimation = cancel;
  const tick = now => {
    const t = Math.min(1, (now - start) / 3600),
      ease = t < .2 ? Math.pow(t / .2, 2) * .08 : .08 + .92 * (1 - Math.pow(1 - (t - .2) / .8, 3));
    paintToolWheel(w.randomCanvas, items, target * ease);
    if (t < 1) frame = requestAnimationFrame(tick);else {
      w.randomBusy = false;
      finishToolResult(w, [items[winner]]);
      w.cancelAnimation = null;
    }
  };
  frame = requestAnimationFrame(tick);
}
function paintToolRace(canvas, balls, pegs) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 640, 480);
  c.fillStyle = '#f6f7fa';
  c.fillRect(0, 0, 640, 480);
  c.fillStyle = '#94a3b8';
  for (const p of pegs) {
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#e5effb';
  c.fillRect(0, 440, 640, 40);
  c.fillStyle = '#365c85';
  c.font = '18px sans-serif';
  c.fillText('🏁 결승 바구니', 245, 469);
  for (const [i, b] of balls.entries()) {
    c.beginPath();
    c.fillStyle = `hsl(${i * 137.5 % 360} 65% 76%)`;
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0f172a';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.fillText(b.label.match(/^\d+/)?.[0] || String(i + 1), b.x, b.y + 4);
    c.font = '12px sans-serif';
    c.fillText(b.label.slice(0, 10), b.x, b.y - b.r - 4);
  }
  c.textAlign = 'left';
}
function runToolRace(w, items) {
  w.randomBusy = true;
  const pegs = makeToolPegs(),
    balls = createToolRaceBalls(items, pegs),
    start = performance.now();
  let last = start,
    frame;
  w.cancelAnimation = () => {
    cancelAnimationFrame(frame);
    w.randomBusy = false;
  };
  const tick = now => {
    const dt = Math.min(.04, (now - last) / 1000);
    last = now;
    for (let i = 0; i < 4; i++) stepToolRace(balls, pegs, dt / 4, 640, 440, {
      left: 40,
      right: 600
    });
    paintToolRace(w.randomCanvas, balls, pegs);
    if (balls.every(b => b.rank)) {
      const ranked = balls.slice().sort((a, b) => a.rank - b.rank);
      w.randomBusy = false;
      finishToolResult(w, ranked);
      w.cancelAnimation = null;
    } else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
