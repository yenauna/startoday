import * as C from '../core.js';
import {btn,esc} from '../shared/ui.js';
import {icon} from './icons.js';
let closeActive;
export function dismissDateRange(){closeActive?.(false);}
export function normalizeDateRange(first,second=first){return first<=second?{from:first,to:second}:{from:second,to:first};}
export function dateRangeField(from,to,onChange,label='조회 기간'){
 const text=from===to?C.formatDate(from):`${C.formatDate(from)} ~ ${C.formatDate(to)}`;
 return btn(`${icon('calendar')}<span>${esc(text||'날짜 선택')}</span>`,e=>openDateRange(e?.target?.closest('button')||document.activeElement,from,to,onChange),'date-range-trigger',`aria-label="${esc(label)}: ${esc(text)}" aria-haspopup="dialog"`);
}
export function openDateRange(anchor,from,to,onChange){
 closeActive?.();
 let month=(from||C.today()).slice(0,7),first='',selection={from,to},changed=false,finished=false;
 const previous=document.activeElement,el=document.createElement('div'),events=new AbortController();
 el.className='date-range-popover';el.setAttribute('popover','manual');el.setAttribute('role','dialog');el.setAttribute('aria-label','조회 기간 달력');document.body.append(el);
 const close=(apply=true)=>{if(finished)return;finished=true;events.abort();el.hidePopover();el.remove();closeActive=null;previous?.isConnected&&previous.focus({preventScroll:true});if(apply&&changed)onChange(selection);};
 closeActive=close;
 const draw=()=>{
  const start=month+'-01',offset=new Date(start+'T12:00:00').getDay(),count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  // A single click selects one day; a second click completes an inclusive range.
  el.innerHTML=`<div class="range-heading">${btn('‹',()=>move(-1),'','aria-label="이전 달"')}<strong>${esc(month.replace('-','년 '))}월</strong>${btn('›',()=>move(1),'','aria-label="다음 달"')}</div><p class="muted range-hint">하루 선택 후 닫기 · 두 날짜 선택 시 기간 조회</p><div class="range-weekdays" aria-hidden="true">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="range-days">${'<span></span>'.repeat(offset)}${Array.from({length:count},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),selected=date>=selection.from&&date<=selection.to;return btn(String(i+1),()=>{if(!first){first=date;selection={from:date,to:date};changed=true;draw();el.querySelector(`[data-range-day="${date}"]`)?.focus({preventScroll:true});}else{selection=normalizeDateRange(first,date);changed=true;close();}},'range-day'+(selected?' is-selected':''),`data-range-day="${date}" aria-label="${esc(C.formatDate(date))}" aria-pressed="${selected}"`);}).join('')}</div><div class="range-footer">${btn('초기화',()=>{first='';selection={from,to};changed=false;draw();})}${btn('오늘',()=>{selection={from:C.today(),to:C.today()};changed=true;close();})}${btn('닫기',()=>close())}</div>`;
 };
 const move=delta=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);month=d.toISOString().slice(0,7);draw();};
 draw();el.showPopover();const rect=anchor?.getBoundingClientRect()||{left:16,bottom:80};el.style.left=Math.max(8,Math.min(rect.left,innerWidth-344))+'px';el.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-el.offsetHeight-8))+'px';
 el.querySelector(`[data-range-day="${from}"]`)?.focus({preventScroll:true});
 document.addEventListener('pointerdown',e=>{if(!el.contains(e.target)&&!anchor?.contains(e.target))close();},{signal:events.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const items=[...el.querySelectorAll('button')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},{capture:true,signal:events.signal});
 window.addEventListener('resize',()=>close(),{once:true,signal:events.signal});
}
