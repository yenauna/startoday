import * as C from '../core.js';
import {LOGO_STAR_PATH} from './icons.js';
export function constellationHero(title,done,total,unit='명',options={}){
 const n=Math.max(0,Math.trunc(total)),complete=Math.max(0,Math.min(n,Math.trunc(done))),student=unit==='개',allDone=student&&n>0&&complete>=n;
 const progress=student?(n?`${Math.round(complete/n*100)}% 완료`:'오늘 등록된 과제가 없어요'):`${complete}명 완료`;
 const points=Array.from({length:n},(_,i)=>{const angle=i*2.399963,r=22+Math.sqrt((i+.5)/Math.max(1,n))*54;return{x:142+Math.cos(angle)*r*1.4,y:90+Math.sin(angle)*r*.95};});
 return `<section class="constellation-hero ${options.className||''} ${allDone?'is-all-complete':''}" aria-label="${C.esc(title)}" data-progress-done="${complete}" data-progress-total="${n}"><div class="constellation-copy">${options.content||''}<div class="constellation-heading"><h2>${C.esc(title)}</h2><strong class="constellation-progress ${student&&!n?'is-empty':''}">${progress}</strong></div>${options.controls||''}</div><svg class="constellation-map" viewBox="0 0 284 180" role="img" aria-label="${C.esc(progress)}"><path d="M24 90H260M142 12V168" class="orbit-axis"/>${[32,55,78].map(r=>`<ellipse cx="142" cy="90" rx="${r*1.4}" ry="${r*.9}" class="orbit"/>`).join('')}${points.map((p,i)=>i<complete?`<g class="constellation-lit" transform="translate(${p.x-6} ${p.y-6}) scale(.12)"><path d="${LOGO_STAR_PATH}" fill="#F6D58C"/></g>`:`<circle class="constellation-dim" cx="${p.x}" cy="${p.y}" r="2.8" fill="#7A9187"/>`).join('')}</svg></section>`;
}
