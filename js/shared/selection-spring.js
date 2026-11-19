// Unit mass, semi-implicit Euler, four substeps per rendered frame.
export const SELECTION_SPRINGS = Object.freeze({
  pop: Object.freeze({k:520,c:16}),
  soft: Object.freeze({k:260,c:24}),
  settle: Object.freeze({k:280,c:22}),
  fade: Object.freeze({k:420,c:32})
});
export function stepSelectionSpring(state, target, dt, profile, reduced = false) {
  const {k} = profile, c = reduced ? 2*Math.sqrt(k) : profile.c;
  const h = Math.min(Math.max(dt,0),1/30)/4;
  for (let i=0;i<4;i++) {
    state.velocity += (-k*(state.value-target)-c*state.velocity)*h;
    state.value += state.velocity*h;
  }
  return state;
}
const jobs = new Set();
let frame = 0, previous = 0, ticking = false;
function tick(now) {
  frame = 0;ticking = true;
  const dt = previous ? (now-previous)/1000 : 1/60;
  previous = now;
  for (const job of [...jobs]) if (jobs.has(job) && job(now,dt) === false) jobs.delete(job);
  ticking = false;
  if (jobs.size) frame = requestAnimationFrame(tick);else previous = 0;
}
export function selectionFrame(job) {
  jobs.add(job);
  if (!frame && !ticking) frame = requestAnimationFrame(tick);
  return () => {
    jobs.delete(job);
    if (!jobs.size) { cancelAnimationFrame(frame);frame=0;previous=0; }
  };
}
export function selectionSpring({from,to,profile='soft',reduced=false,update,complete=()=>{}}) {
  const states = Object.fromEntries(Object.entries(from).map(([key,value])=>[key,{value,velocity:0}]));
  let target={...to}, stop=null;
  const values=()=>Object.fromEntries(Object.entries(states).map(([key,s])=>[key,s.value]));
  const run = () => {
    if (stop) return;
    stop=selectionFrame((now,dt)=>{
      let settled=true;
      for (const [key,s] of Object.entries(states)) {
        stepSelectionSpring(s,target[key],dt,SELECTION_SPRINGS[profile],reduced);
        if (Math.abs(s.value-target[key])>.001 || Math.abs(s.velocity)>.01) settled=false;
      }
      if (settled) for (const [key,s] of Object.entries(states)) {s.value=target[key];s.velocity=0;}
      if (update(values())===false || settled) {stop=null;complete();return false;}
    });
  };
  update(values());
  run();
  return {
    set(next) {target={...target,...next};run();},
    cancel() {stop?.();stop=null;}
  };
}
