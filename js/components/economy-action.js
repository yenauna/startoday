import {btn,esc} from '../shared/ui.js';
const ACTIONS={
 edit:{label:'수정',path:'M16 3a2.8 2.8 0 0 1 4 4L7 20l-4 1 1-4L16 3z M14 5l4 4'},
 gift:{label:'선물',path:'M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8.5A3.5 3.5 0 1 1 12 4.5V8Zm0 0h3.5A3.5 3.5 0 1 0 12 4.5'},
 reclaim:{label:'회수',path:'M8 4 3 9l5 5 M3 9h11a6 6 0 0 1 0 12h-3'},
 delete:{label:'삭제',path:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7'}
};
// One icon source for every round management action: the shop and the record cards
// share the same 19px stroked glyph at the same optical weight.
export function actionIcon(type){
 const {path}=ACTIONS[type];
 return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
export function economyAction(type,fn,cls='',attrs=''){
 const {label}=ACTIONS[type];
 const icon=actionIcon(type);
 const accessible=(/aria-label=/.test(attrs)?attrs:`aria-label="${esc(label)}" ${attrs}`)+(/title=/.test(attrs)?'':` title="${esc(label)}"`);
 return `<span class="economy-action economy-action-${type}">${btn(icon+`<span class="tooltip" aria-hidden="true">${label}</span><span class="economy-action-label" aria-hidden="true">${label}</span>`,fn,'economy-icon-button '+cls,accessible)}</span>`;
}
