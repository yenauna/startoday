// The supplied hold springs; only actively moving buttons own an rAF callback.
const active = new Set();
// A completed hold can remove its touch target before pointerup. Swallow only
// that sequence's synthetic click, so it cannot hit the undo button underneath.
const completedPointers = new Set();
let suppressClickUntil=0;
document.addEventListener('pointerdown',e=>{suppressClickUntil=0;completedPointers.delete(e.pointerId);},true);
document.addEventListener('pointerup',e=>{
  if(completedPointers.delete(e.pointerId)){suppressClickUntil=performance.now()+500;e.preventDefault();}
},true);
document.addEventListener('click',e=>{
  if(e.detail && performance.now()<suppressClickUntil){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation();}
},true);
const stopActive = () => active.forEach(control => control.stop());
window.addEventListener('blur', stopActive);
document.addEventListener('visibilitychange', () => { if(document.hidden)stopActive(); });
export function attachHoldDelete(btn, onConfirm) {
  if(btn._holdDelete)return;
  btn._holdDelete=true;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S=(x,k=400,c=30)=>({x,v:0,t:x,k,c:reduce?2*Math.sqrt(k):c});
  const tune=(s,k,c)=>{s.k=k;s.c=reduce?2*Math.sqrt(k):c;};
  const step=(s,dt)=>{const a=-s.k*(s.x-s.t)-s.c*s.v;s.v+=a*dt;s.x+=s.v*dt;};
  const fill=btn.querySelector('.fill'),top=btn.querySelector('.label.top');
  const holdSec=1.2,p=S(0,260,14),sc=S(1,520,20),shake=S(0,700,9);
  let mode='idle',holding=false,raf=0,last=0,pointer=null,key=null;
  const control={stop};
  function resetPaint(){btn.style.transform='';fill.style.width='0px';top.style.clipPath='inset(0 100% 0 0)';}
  function tick(now){
    if(!btn.isConnected || btn.disabled && mode!=='done'){holding=false;raf=0;active.delete(control);resetPaint();mode='idle';p.x=p.v=p.t=0;return;}
    const dt=Math.min((now-last)/1000,1/30);last=now;
    for(let k=0;k<4;k++){
      const sub=dt/4;
      if(holding){p.x=Math.min(1,p.x+sub/holdSec);p.v=0;p.t=p.x;if(p.x>=1){complete();break;}}
      else step(p,sub);
      step(sc,sub);step(shake,sub);
    }
    const w=btn.offsetWidth,fw=Math.max(0,p.x)*w;
    btn.style.transform=`translateX(${shake.x}px) scale(${sc.x})`;
    fill.style.width=fw+'px';top.style.clipPath=`inset(0 ${Math.max(0,w-fw)}px 0 0)`;
    if(mode==='done'){raf=0;active.delete(control);btn.style.transform='';return;}
    const settled=!holding && Math.abs(p.x)<.001 && Math.abs(p.v)<.001 && Math.abs(sc.x-1)<.001 && Math.abs(sc.v)<.001 && Math.abs(shake.x)<.05 && Math.abs(shake.v)<.05;
    if(settled){raf=0;active.delete(control);resetPaint();return;}
    raf=requestAnimationFrame(tick);
  }
  function ensureLoop(){if(!raf){active.add(control);last=performance.now();raf=requestAnimationFrame(tick);}}
  function start(){if(mode!=='idle'||btn.disabled)return;holding=true;mode='holding';sc.t=.96;ensureLoop();}
  function stop(){
    if(mode!=='holding')return;
    holding=false;mode='idle';sc.t=1;pointer=null;key=null;
    if(p.x<1){tune(p,260,14);p.t=0;shake.v+=260*Math.min(1,p.x*2+.3);}
    ensureLoop();
  }
  function complete(){
    holding=false;mode='done';sc.t=1;sc.v+=2.5;
    if(pointer!==null)completedPointers.add(pointer);
    // No circle morph or extra delay: persistence begins on the full frame.
    Promise.resolve().then(onConfirm).catch(error=>{console.error(error);}).finally(()=>{
      if(btn.isConnected){mode='idle';p.x=p.v=p.t=0;sc.x=sc.t=1;sc.v=shake.x=shake.v=shake.t=0;resetPaint();}
    });
  }
  btn.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;pointer=e.pointerId;start();try{btn.setPointerCapture(e.pointerId);}catch{}});
  btn.addEventListener('pointerup',e=>{if(e.pointerId===pointer)stop();});
  btn.addEventListener('pointercancel',stop);
  btn.addEventListener('lostpointercapture',stop);
  btn.addEventListener('blur',stop);
  btn.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();key=e.key;start();}});
  btn.addEventListener('keyup',e=>{if(e.key===key){e.preventDefault();stop();}});
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  btn.addEventListener('contextmenu',e=>e.preventDefault());
}
