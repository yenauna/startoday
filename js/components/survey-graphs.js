import * as C from '../core.js';
import {state} from '../shared/state.js';
import {surveyNameBox,surveyPointTone,surveyRelationship,surveyLabelPositions} from './survey-map-data.js';
export function surveyGraphs(database,surveyId,focusId,onSelect){
 const graph=C.surveyGraph(database,surveyId,focusId),node=id=>graph.nodes.find(n=>n.id===id),esc=C.esc;
 const register=handler=>{const id=String(++state.actionNo);state.actions.set(id,handler);return id;};
 const focusAction=register(e=>onSelect(e.target.value));
 const responses=(database.survey_responses||[]).filter(r=>r.surveyId===surveyId);
 const layouts=surveyLabelPositions(graph.placements);
 const pointMarkup=(point,index)=>{
  const box=layouts[index].box,tone=surveyPointTone(point.y),reverse=responses.find(r=>r.studentId===point.targetId)?.placements.find(p=>p.targetId===graph.focus?.id),relation=surveyRelationship(point,reverse),tags=C.surveyPlacementTags(point);
  const description=`${point.name} · ${relation}${tags.length?' · '+tags.join(' · '):''}${point.reason?' · '+point.reason:''}`;
  const detail=`<strong>${esc(point.name)} · ${esc(relation)}</strong>${tags.length?`<p class="survey-reason-tags">${tags.map(tag=>`<span class="survey-reason-tag">${esc(tag)}</span>`).join('')}</p>`:''}<p>${esc(point.reason||'직접 쓴 이유가 없습니다.')}</p>`;
  const action=register(()=>{const panel=document.querySelector('.survey-map-detail');if(panel){panel.innerHTML=detail;panel.dataset.peer=point.targetId;}});
  // Names sit on the response itself; only fully overlapping cards move slightly.
  const labelX=layouts[index].x,labelY=layouts[index].y;
  return `<g class="survey-map-point ${point.y>=50?'comfortable':'uncomfortable'}" role="button" tabindex="0" data-map-peer="${esc(point.targetId)}" data-map-x="${point.x}" data-map-y="${point.y}" data-action="${action}" aria-label="${esc(description)}" style="--survey-point-bg:${tone.background};--survey-point-ink:${tone.ink};--survey-point-edge:${tone.edge}"><title>${esc(description)}</title><rect x="${labelX-box.width/2}" y="${labelY-box.height/2}" width="${box.width}" height="${box.height}" rx="5"/><text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central">${esc(box.text)}</text></g>`;
 };
 return `<section class="survey-visualizations"><div><h3>전체 관계망</h3><p class="muted">실선: 서로 가까움 · 점선: 한쪽만 가까움. 이름을 눌러 개인 지도를 확인하세요.</p><div class="survey-graph-viewport" tabindex="0" aria-label="전체 관계망 그림, 좁은 화면에서는 좌우로 이동"><svg viewBox="0 0 660 420" class="survey-network" role="group" aria-label="전체 관계망">${graph.links.map(l=>`<line x1="${node(l.a).x}" y1="${node(l.a).y}" x2="${node(l.b).x}" y2="${node(l.b).y}" class="${l.mutual?'mutual':'one-way'}"/>`).join('')}${graph.nodes.map(s=>{const box=surveyNameBox(s.name),x=Math.max(box.width/2+8,Math.min(652-box.width/2,s.x));return `<g role="button" tabindex="0" aria-label="${esc(s.name)} 거리 지도" data-graph-student="${esc(s.id)}" data-action="${register(()=>onSelect(s.id))}" transform="translate(${x} ${s.y})"><title>${esc(s.name)}</title><rect x="${-box.width/2}" y="${-box.height/2}" width="${box.width}" height="${box.height}" rx="5"/><text text-anchor="middle" dominant-baseline="central">${esc(box.text)}</text></g>`;}).join('')}</svg></div></div><div><label class="survey-focus-label">개인 지도 학생 <select data-graph-focus="${focusAction}" aria-label="개인 지도 학생">${graph.nodes.map(s=>`<option value="${esc(s.id)}" ${s.id===graph.focus?.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><h3>${esc(graph.focus?.name||'학생')} · 개인별 마음 지도</h3><p class="muted">오른쪽은 가까움, 위쪽은 편안함입니다. 초록은 편안함, 분홍은 불편함이며 진할수록 강한 응답입니다. 이름 카드는 응답한 위치에 놓입니다. 이름을 눌러 이유를 확인하세요.</p><div class="survey-personal-viewport" tabindex="0" aria-label="개인 마음 지도, 좁은 화면에서는 좌우로 이동"><svg viewBox="0 0 420 420" class="survey-distance survey-quadrant-map" role="group" aria-label="${esc(graph.focus?.name||'학생')} 친구 마음 지도"><g class="survey-map-fields" aria-hidden="true"><rect x="52" y="52" width="158" height="158" fill="#edf5ee"/><rect x="210" y="52" width="158" height="158" fill="#e2f1e6"/><rect x="52" y="210" width="158" height="158" fill="#fff0f2"/><rect x="210" y="210" width="158" height="158" fill="#fbe4e9"/></g><g class="survey-map-axes"><path d="M52 52V368H368M52 210H368M210 52V368"/><text x="210" y="22" text-anchor="middle">편안함 ↑</text><text x="210" y="408" text-anchor="middle">↓ 불편함</text><text x="52" y="390">멀리</text><text x="368" y="390" text-anchor="end">가까움 →</text><text x="58" y="68">멀고 편안함</text><text x="362" y="68" text-anchor="end">가깝고 편안함</text><text x="58" y="360">멀고 불편함</text><text x="362" y="360" text-anchor="end">가깝고 불편함</text></g>${graph.placements.map(pointMarkup).join('')}</svg></div><p class="survey-map-pan-hint muted">작은 화면에서는 지도를 좌우로 밀어 볼 수 있어요.</p><div class="survey-map-detail" aria-live="polite">${graph.placements.length?'이름을 선택하면 쌍방 응답·이유 태그·메모가 여기에 표시됩니다.':'이 학생의 제출된 응답이 없습니다.'}</div></div></section>`;
}
document.addEventListener('keydown',e=>{if(e.target.matches?.('[data-graph-student],[data-map-peer]')&&['Enter',' '].includes(e.key)){e.preventDefault();state.actions.get(e.target.dataset.action)?.();}});
document.addEventListener('change',e=>{if(e.target.matches?.('[data-graph-focus]'))state.actions.get(e.target.dataset.graphFocus)?.(e);});
// Keep overlapping, near-original names usable without moving their coordinates.
function raiseSurveyPeer(event){
 const peer=event.target.closest?.('[data-map-peer]');
 if(!peer||peer.parentElement.lastElementChild===peer)return;
 const focused=document.activeElement===peer;
 peer.parentElement.append(peer);
 if(focused&&document.activeElement!==peer)peer.focus({preventScroll:true});
}
document.addEventListener('pointerover',raiseSurveyPeer);
document.addEventListener('focusin',raiseSurveyPeer);
