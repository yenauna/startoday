import { esc } from '../shared/ui.js';
export function recentStudentSchool() {
  try {
    return JSON.parse(localStorage.getItem('startoday-recent-school')) || {};
  } catch {
    return {};
  }
}
export function rememberStudentSchool(name, code = '') {
  try {
    localStorage.setItem('startoday-recent-school', JSON.stringify({
      name,
      code
    }));
  } catch {}
}
export function schoolPickerFields(name = '', code = '') {
  return `<div class="school-picker"><label>학교명<input name="schoolName" type="search" required autocomplete="off" value="${esc(name)}" placeholder="초등학교 이름 검색"></label><input name="schoolCode" type="hidden" value="${esc(code)}"><button type="button" data-school-search>학교 검색</button><div class="school-search-status" role="status">검색 후 선택하거나 학교명을 직접 입력하세요.</div><div class="school-search-results" aria-label="학교 검색 결과"></div></div>`;
}
export function bindSchoolPicker(root) {
  const picker = root?.querySelector('.school-picker');
  if (!picker) return;
  const name = picker.querySelector('[name=schoolName]'),
    code = picker.querySelector('[name=schoolCode]'),
    status = picker.querySelector('.school-search-status'),
    results = picker.querySelector('.school-search-results');
  let timer,
    controller,
    sequence = 0;
  const search = async () => {
    clearTimeout(timer);
    controller?.abort();
    const seq = ++sequence,
      query = name.value.trim();
    results.innerHTML = '';
    if (query.length < 2) {
      status.textContent = '학교 이름을 두 글자 이상 입력하세요. 직접 입력도 가능합니다.';
      return;
    }
    controller = new AbortController();
    const abort = controller,
      timeout = setTimeout(() => abort.abort(), 8000);
    status.textContent = '전국 초등학교를 검색하고 있습니다…';
    try {
      const params = new URLSearchParams({
        Type: 'json',
        pSize: '10',
        SCHUL_KND_SC_NM: '초등학교',
        SCHUL_NM: query
      });
      const response = await fetch('https://open.neis.go.kr/hub/schoolInfo?' + params, {
        signal: abort.signal
      });
      if (!response.ok) throw Error('search');
      const data = await response.json(),
        schools = data.schoolInfo?.find(part => Array.isArray(part.row))?.row || [];
      if (!picker.isConnected || seq !== sequence || name.value.trim() !== query) return;
      status.textContent = schools.length ? '학교를 선택하세요. 같은 이름은 주소로 구분할 수 있습니다.' : '검색 결과가 없습니다. 정확한 학교명을 직접 입력할 수 있습니다.';
      for (const school of schools) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${school.SCHUL_NM} · ${school.ORG_RDNMA || school.LCTN_SC_NM || ''}`;
        button.onclick = () => {
          name.value = school.SCHUL_NM;
          code.value = school.SD_SCHUL_CODE || '';
          results.innerHTML = '';
          status.textContent = '학교가 선택되었습니다.';
          rememberStudentSchool(name.value, code.value);
        };
        results.append(button);
      }
    } catch {
      if (picker.isConnected && seq === sequence && name.value.trim() === query) status.textContent = '학교 검색에 연결하지 못했습니다. 학교명을 직접 입력해 계속할 수 있습니다.';
    } finally {
      clearTimeout(timeout);
    }
  };
  name.oninput = () => {
    code.value = '';
    results.innerHTML = '';
    controller?.abort();
    ++sequence;
    clearTimeout(timer);
    timer = setTimeout(search, 400);
  };
  picker.querySelector('[data-school-search]').onclick = search;
}
