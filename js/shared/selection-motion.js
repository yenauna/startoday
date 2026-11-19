import { selectionFrame, selectionSpring } from './selection-spring.js';

let origin=null;
const cleanups=new Set();
const remember=event=>{
  if (event.type==='keydown' && !['Enter',' '].includes(event.key)) return;
  const source=event.target.closest?.('.student[data-student-id],.quick-student-result,#quick-student-query,.quick-student-search button');
  if(source) origin={rect:source.getBoundingClientRect(),at:performance.now()};
};
document.addEventListener('click',remember,true);
document.addEventListener('keydown',remember,true);
export function clearSelectionMotion() {
  origin=null;
  cleanups.forEach(cancel=>cancel());cleanups.clear();
  document.querySelectorAll('.selection-flight,.selection-count-old').forEach(el=>el.remove());
}
export function captureSelectionMotion() {
  const nodes=[...document.querySelectorAll('[data-selected-id]')], active=document.activeElement;
  const snapshot={
    chips:new Map(nodes.map(el=>[el.dataset.selectedId,{rect:el.getBoundingClientRect(),name:el.dataset.selectedName}])),
    more:document.querySelector('#quick-selection-more')?.getBoundingClientRect(),
    count:Number(document.querySelector('[data-selection-count]')?.dataset.selectionCount || 0),
    origin:origin && performance.now()-origin.at<700?origin.rect:null,
    focusId:active?.closest?.('[data-selected-id]')?.dataset.selectedId,
    focusCard:active?.matches?.('.student[data-student-id]')?active.dataset.studentId:null
  };
  origin=null;clearSelectionMotion();
  return snapshot;
}
function spring(options, persistent=false) {
  let cleanup;
  const motion=selectionSpring({...options,complete:()=>{if(!persistent)cleanups.delete(cleanup);options.complete?.();}});
  cleanup=()=>{motion.cancel();cleanups.delete(cleanup);};cleanups.add(cleanup);
  return {set:next=>motion.set(next),cancel:cleanup};
}
function rollText(el,text,reduced,fromText=el.textContent) {
  if(fromText===text)return;
  el._roll?.cancel();el.parentElement.querySelector('.selection-count-old')?.remove();
  const direction=el.hasAttribute('data-selection-count') && Number.parseInt(text)<Number.parseInt(fromText)?-1:1;
  const old=document.createElement('span');old.className='selection-count-old';old.textContent=fromText;old.setAttribute('aria-hidden','true');
  el.textContent=text;el.parentElement.append(old);
  el._roll=spring({from:{u:0},to:{u:1},profile:'fade',reduced,update:({u})=>{
    if(!el.isConnected)return false;
    const p=Math.max(0,Math.min(1,u)),travel=reduced?4:20;
    el.style.transform=`translateY(${direction*(1-p)*travel}px)`;
    el.style.opacity=String(p);el.style.filter=`blur(${(1-p)*(reduced?0:2)}px)`;
    old.style.transform=`translateY(${-direction*p*travel}px)`;old.style.opacity=String(1-p);old.style.filter=`blur(${p*(reduced?0:2)}px)`;
  },complete:()=>{old.remove();el.style.transform='';el.style.opacity='';el.style.filter='';}});
}
function ghost(name,rect,extra='') {
  const el=document.createElement('span');el.className='selection-flight '+extra;el.textContent=name;el.setAttribute('aria-hidden','true');
  el.style.left=`${Math.max(8,Math.min(innerWidth-120,rect.left))}px`;el.style.top=`${Math.max(8,Math.min(innerHeight-36,rect.top))}px`;
  document.body.append(el);return el;
}
export function animateSelectionMotion(before) {
  const nodes=[...document.querySelectorAll('[data-selected-id]')], visible=nodes.filter(el=>el.getClientRects().length);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count=document.querySelector('[data-selection-count]');
  if(before.focusId) {
    const same=nodes.find(el=>el.dataset.selectedId===before.focusId);
    (same?.querySelector('button') || visible[0]?.querySelector('button') || document.querySelector('#quick-student-query'))?.focus({preventScroll:true});
  } else if(before.focusCard) {
    [...document.querySelectorAll('.student[data-student-id]')].find(el=>el.dataset.studentId===before.focusCard)?.focus({preventScroll:true});
  }
  for(const el of visible) {
    const old=before.chips.get(el.dataset.selectedId)?.rect, rect=el.getBoundingClientRect();
    if(old?.width) spring({from:{x:reduced?Math.max(-4,Math.min(4,old.left-rect.left)):old.left-rect.left,y:reduced?Math.max(-2,Math.min(2,old.top-rect.top)):old.top-rect.top},to:{x:0,y:0},profile:'soft',reduced,
      update:({x,y})=>{if(!el.isConnected)return false;el.style.setProperty('--chip-slide-x',`${x}px`);el.style.setProperty('--chip-slide-y',`${y}px`);}});
  }
  const more=document.querySelector('#quick-selection-more');
  if(more && before.more?.width) {
    const rect=more.getBoundingClientRect();
    spring({from:{x:reduced?0:before.more.left-rect.left,y:reduced?0:before.more.top-rect.top},to:{x:0,y:0},profile:'soft',reduced,update:({x,y})=>{
      if(!more.isConnected)return false;more.style.setProperty('--chip-slide-x',`${x}px`);more.style.setProperty('--chip-slide-y',`${y}px`);
    }});
  }
  const added=nodes.filter(el=>!before.chips.has(el.dataset.selectedId));
  for(const el of added.filter(el=>el.getClientRects().length)) {
    const pop=()=>spring({from:{s:reduced?.98:.82},to:{s:1},profile:'pop',reduced,update:({s})=>{if(!el.isConnected)return false;el.style.setProperty('--chip-pop',s);}});
    if(!before.origin || reduced || added.length>3) {pop();continue;}
    const rect=el.getBoundingClientRect(),start=before.origin,flight=ghost(el.dataset.selectedName,{left:start.left+start.width/2-45,top:start.top+start.height/2-16});
    const from=flight.getBoundingClientRect(),dx=rect.left-from.left,dy=rect.top-from.top;
    el.style.opacity='0';
    const started=performance.now();
    let stop;
    stop=selectionFrame(now=>{
      if(!el.isConnected){flight.remove();cleanups.delete(stop);return false;}
      const u=Math.min(1,(now-started)/650),arc=Math.sin(u*Math.PI)*38;
      flight.style.transform=`translate(${dx*u}px,${dy*u-arc}px) scale(.82)`;
      flight.style.opacity=String(u>.9?(1-u)*10:1);
      if(u===1){flight.remove();el.style.opacity='';pop();cleanups.delete(stop);return false;}
    });
    cleanups.add(stop);
  }
  // Removed pills shrink independently; the selected IDs change immediately as before.
  for(const [id,old] of before.chips) if(old.rect.width && !nodes.some(el=>el.dataset.selectedId===id)) {
    const exit=ghost(old.name,old.rect,'selection-flight-exit');
    spring({from:{u:0},to:{u:1},profile:'pop',reduced,update:({u})=>{exit.style.opacity=String(Math.max(0,1-u));exit.style.transform=`scale(${1-(reduced?.02:.18)*u})`;},complete:()=>exit.remove()});
  }
  if(count)rollText(count,count.textContent,reduced,`${before.count}명 선택`);
  const hint=document.querySelector('[data-selection-hint]');
  const pills=[...document.querySelectorAll('.selected-students > .quick-student-chip,.selected-students > .selection-more')].filter(el=>el.getClientRects().length);
  const controllers=pills.map(el=>spring({from:{x:0,y:0,s:1},to:{x:0,y:0,s:1},profile:'settle',reduced,update:({x,y,s})=>{
    if(!el.isConnected)return false;el.style.setProperty('--chip-hover-x',`${x}px`);el.style.setProperty('--chip-hover-y',`${y}px`);el.style.setProperty('--chip-hover-scale',s);
  }},true));
  let hovered=-1,focused=-1;
  const settle=()=>{
    const active=hovered>=0?hovered:focused;
    controllers.forEach((motion,i)=>{
      const distance=Math.abs(i-active),away=active>=0 && distance>0 && distance<=3?[0,6,4,2][distance]*Math.sign(i-active):0;
      motion.set({x:away,y:i===active?-5:0,s:i===active?1.03:1});
    });
    if(hint)rollText(hint,active>=0?(pills[active].dataset.selectedName || '선택한 학생 더 보기'):'×로 선택 해제',reduced);
  };
  pills.forEach((el,i)=>{
    el.onpointerenter=e=>{if(e.pointerType==='mouse'){hovered=i;settle();}};
    el.onpointerleave=()=>{hovered=-1;settle();};
    el.onfocusin=()=>{focused=i;settle();};
    el.onfocusout=e=>{if(!el.contains(e.relatedTarget)){focused=-1;settle();}};
    if(el.contains(document.activeElement))focused=i;
  });
  if(focused>=0)settle();
}
