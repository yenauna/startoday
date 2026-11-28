import * as C from './core.js';
export const MEETING_TABLES=['meeting_officers','meeting_topics','meeting_ballots','meeting_minutes'];
export const MEETING_REVIEW_NOTICE='투표를 열기 전에 잠깐 확인해요! 이 안건이 장난이나 상처 주는 말 없이, 우리 반 모두를 위해 꼭 필요한 내용인지 회장·부회장이 함께 살펴봐 주세요. (찬성·반대를 미리 정하는 게 아니라, 투표를 올려도 될지만 확인하는 거예요! 임원 중 절반보다 많은 사람(예: 3명 중 2명 이상)이 동의하면 열 수 있어요.)';
const meetingUp=(table,data)=>({table,id:data.id,data}),meetingUuid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const meetingActive=d=>(d.students||[]).filter(s=>!s.deletedAt),meetingStudentIds=d=>meetingActive(d).map(s=>s.id);
export function meetingOfficers(d){const ids=meetingStudentIds(d),raw=d.meeting_officers?.[0]||{chairIds:[],viceChairIds:[]};return{id:'main',chairIds:[...new Set(raw.chairIds||[])].filter(id=>ids.includes(id)),viceChairIds:[...new Set(raw.viceChairIds||[])].filter(id=>ids.includes(id))};}
export function meetingParticipation(total,absent,notAttending){
 if(![total,absent,notAttending].every(n=>Number.isInteger(n)&&n>=0&&n<=10000)||absent+notAttending>total)throw Error('전체·결석·불참 인원을 확인하세요.');
 const participants=total-absent-notAttending;return{participants,rate:total?Math.round(participants/total*10000)/100:0,quorum:total>0&&participants*4>=total*3};
}
export function meetingAutoCloseOps(d,stamp=C.now()){
 return(d.meeting_topics||[]).filter(t=>t.status==='open'&&(t.closesAt&&Date.parse(t.closesAt)<=Date.parse(stamp)||t.electorate.length>0&&t.electorate.every(id=>(d.meeting_ballots||[]).some(b=>b.topicId===t.id&&b.studentId===id)))).map(t=>meetingUp('meeting_topics',{...t,status:'closed',closedAt:stamp}));
}
function meetingTopicCard(d,t,studentId,teacher){
 const ballots=(d.meeting_ballots||[]).filter(b=>b.topicId===t.id),members=[...new Set([...meetingOfficers(d).chairIds,...meetingOfficers(d).viceChairIds])];
 const result={id:t.id,title:t.title,description:t.description||'',kind:t.kind,options:t.options,maxChoices:t.maxChoices,status:t.status,proposerId:t.proposerId,createdAt:t.createdAt,closesAt:t.closesAt,closedAt:t.closedAt,participated:ballots.length,total:t.electorate.length||meetingActive(d).length,hasVoted:ballots.some(b=>b.studentId===studentId),reviewCount:(t.approvals||[]).filter(id=>members.includes(id)).length,reviewTotal:members.length,reviewed:(t.approvals||[]).includes(studentId)};
 if(teacher||t.status==='closed')result.results=t.options.map(o=>({id:o.id,label:o.label,count:ballots.filter(b=>b.choices.includes(o.id)).length,...(teacher?{voters:ballots.filter(b=>b.choices.includes(o.id)).map(b=>d.students.find(s=>s.id===b.studentId)).filter(Boolean).map(({id,no,name})=>({id,no,name})).sort((a,b)=>a.no-b.no||a.id.localeCompare(b.id))}:{})}));return result;
}
export function meetingProjection(source,studentId=null,teacher=false){
 const result=structuredClone(source);result.isTeacher=teacher;result.studentId=studentId;result.isChair=result.officers.chairIds.includes(studentId);result.isVice=result.officers.viceChairIds.includes(studentId);
 const clean=t=>{if(!teacher){if(t.status!=='closed')delete t.results;else if(t.results)t.results=t.results.map(({voters,...r})=>r);}return t;};result.topics=result.topics.map(clean);for(const m of result.minutes)m.voteCards=(m.voteCards||[]).map(clean);return result;
}
export function meetingSnapshot(d,studentId=null,teacher=false){
 if(d.meeting?.authoritative)return meetingProjection(d.meeting,studentId,teacher);
 const topics=(d.meeting_topics||[]).filter(t=>t.status!=='deleted').map(t=>meetingTopicCard(d,t,studentId,teacher));
 return meetingProjection({officers:meetingOfficers(d),roster:meetingActive(d).map(({id,no,name})=>({id,no,name})),studentId,isTeacher:teacher,isChair:meetingOfficers(d).chairIds.includes(studentId),isVice:meetingOfficers(d).viceChairIds.includes(studentId),topics,minutes:(d.meeting_minutes||[]).map(m=>({...m,...meetingParticipation(m.total,m.absent,m.notAttending),voteCards:(m.voteCards||[]).map(card=>topics.find(t=>t.id===card.id)||{...card,...(!teacher&&card.status!=='closed'?{results:undefined}:{})})}))},studentId,teacher);
}
export function meetingVoteConfig(payload){
 const kind=payload.kind,options=kind==='yesno'?[{id:'yes',label:'찬성'},{id:'no',label:'반대'}]:payload.options,maxChoices=kind==='yesno'?1:payload.maxChoices;
 if(!['yesno','custom'].includes(kind)||!Array.isArray(options)||options.length<2||options.some(o=>!o||typeof o.id!=='string'||!o.id||o.id.length>100||typeof o.label!=='string'||!o.label.trim()||o.label.length>200)||new Set(options.map(o=>o.id)).size!==options.length||new Set(options.map(o=>o.label.trim())).size!==options.length||!Number.isInteger(maxChoices)||maxChoices<1||maxChoices>options.length||JSON.stringify(payload).length>1000000)throw Error('선택지와 복수 선택 개수를 확인하세요.');
 return{kind,options:options.map(o=>({id:o.id,label:o.label.trim()})),maxChoices};
}
export function meetingOps(database,studentId,action,payload={},teacher=false,stamp=C.now()){
 const start=meetingAutoCloseOps(database,stamp),d=C.applyOps(database,start),ops=[...start],officers=meetingOfficers(d),chair=officers.chairIds.includes(studentId),vice=officers.viceChairIds.includes(studentId),members=[...new Set([...officers.chairIds,...officers.viceChairIds])];
 if(!teacher&&!meetingStudentIds(d).includes(studentId))throw Error('학급회의에 참여할 학생을 확인하세요.');
 if(action==='refresh')return ops;
 if(action==='officers'){
  if(!teacher)throw Error('선생님만 임원을 지정할 수 있습니다.');
  for(const key of ['chairIds','viceChairIds'])if(!Array.isArray(payload[key])||new Set(payload[key]).size!==payload[key].length||payload[key].some(id=>!meetingStudentIds(d).includes(id)))throw Error('임원 명단을 확인하세요.');
  ops.push(meetingUp('meeting_officers',{id:'main',chairIds:payload.chairIds,viceChairIds:payload.viceChairIds}),...(d.meeting_topics||[]).filter(t=>t.status==='pending').map(t=>meetingUp('meeting_topics',{...t,approvals:[]})));return ops;
 }
 if(action==='propose'){
  const id=payload.id||C.uid();if(!meetingUuid(id))throw Error('안건 ID를 확인하세요.');if((d.meeting_topics||[]).some(t=>t.id===id))throw Error('이미 등록한 안건입니다.');
  const title=String(payload.title||'').trim(),description=String(payload.description||'');if(!title||title.length>200||description.length>5000)throw Error('안건 제목과 내용을 확인하세요.');
  const {kind,options,maxChoices}=meetingVoteConfig(payload);
  const closesAt=payload.closesAt||null;if(closesAt&&(!Number.isFinite(Date.parse(closesAt))||Date.parse(closesAt)<=Date.parse(stamp)))throw Error('마감 시각은 현재보다 뒤로 지정하세요.');
  const open=teacher&&payload.openNow===true;ops.push(meetingUp('meeting_topics',{id,title,description,kind,options:options.map(o=>({id:o.id,label:o.label.trim()})),maxChoices,proposerId:teacher?null:studentId,status:open?'open':'pending',electorate:open?meetingStudentIds(d):[],approvals:[],createdAt:stamp,openedAt:open?stamp:null,closesAt}));return ops;
 }
 if(action==='minutes'){
  if(!teacher&&!vice)throw Error('선생님과 부회장만 회의록을 작성할 수 있습니다.');
  const id=payload.id||C.uid(),old=(d.meeting_minutes||[]).find(m=>m.id===id);if(!meetingUuid(id)||old&&payload.version!==old.version)throw Error('회의록이 변경되었습니다. 새로고침 후 다시 확인하세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)||new Date(payload.date+'T12:00Z').toISOString().slice(0,10)!==payload.date)throw Error('회의 날짜를 확인하세요.');
  meetingParticipation(payload.total,payload.absent,payload.notAttending);
  for(const key of ['moderators','recorders'])if(!Array.isArray(payload[key])||payload[key].some(n=>typeof n!=='string'||!n.trim()||n.length>100))throw Error('진행자와 기록자를 확인하세요.');
  if(typeof payload.content!=='string'||payload.content.length>100000||!Array.isArray(payload.voteIds)||new Set(payload.voteIds).size!==payload.voteIds.length)throw Error('회의 내용과 연결할 투표를 확인하세요.');
  const cards=payload.voteIds.map(id=>{const t=(d.meeting_topics||[]).find(t=>t.id===id&&['open','closed'].includes(t.status));if(!t)throw Error('진행 중이거나 마감된 투표를 선택하세요.');return meetingTopicCard(d,t,null,true);});
  ops.push(meetingUp('meeting_minutes',{id,date:payload.date,moderators:payload.moderators,recorders:payload.recorders,total:payload.total,absent:payload.absent,notAttending:payload.notAttending,content:payload.content,voteCards:cards,version:(old?.version||0)+1,createdAt:old?.createdAt||stamp,updatedAt:stamp}));return ops;
 }
 const topic=(d.meeting_topics||[]).find(t=>t.id===payload.id);if(!topic||topic.status==='deleted')throw Error('안건을 확인하세요.');
 if(action==='vote'){
  if(teacher||topic.status!=='open'||!topic.electorate.includes(studentId))throw Error('진행 중인 투표의 재적 학생만 참여할 수 있습니다.');
  if((d.meeting_ballots||[]).some(b=>b.topicId===topic.id&&b.studentId===studentId))throw Error('이미 투표에 참여했습니다.');
  if(!Array.isArray(payload.choices)||payload.choices.length<1||payload.choices.length>topic.maxChoices||new Set(payload.choices).size!==payload.choices.length||payload.choices.some(id=>!topic.options.some(o=>o.id===id)))throw Error('선택할 수 있는 항목 개수를 확인하세요.');
  ops.push(meetingUp('meeting_ballots',{id:topic.id+':'+studentId,topicId:topic.id,studentId,choices:payload.choices,createdAt:stamp}));return [...ops,...meetingAutoCloseOps(C.applyOps(database,ops),stamp)];
 }
 if(action==='close'){
  if(!teacher||!['open','closed'].includes(topic.status))throw Error('선생님만 진행 중 투표를 마감할 수 있습니다.');ops.push(meetingUp('meeting_topics',{...topic,status:'closed',closedAt:stamp}));return ops;
 }
 if(topic.status!=='pending')throw Error('대기 중 안건만 검토할 수 있습니다.');
 if(action==='configure_topic'){if(!teacher&&!chair)throw Error('선생님과 회장만 투표 설정을 바꿀 수 있습니다.');ops.push(meetingUp('meeting_topics',{...topic,...meetingVoteConfig(payload),approvals:[]}));return ops;}
 if(action==='delete_topic'||action==='defer'){
  if(!teacher&&!chair)throw Error('선생님과 회장만 안건을 관리할 수 있습니다.');ops.push(meetingUp('meeting_topics',{...topic,status:action==='delete_topic'?'deleted':'pending',approvals:[]}));return ops;
 }
 if(action==='approve'||action==='endorse'){
  if(!teacher&&(!members.includes(studentId)||action==='approve'&&!chair||chair&&payload.acknowledged!==true))throw Error('임원의 검토 확인이 필요합니다.');
  const approvals=[...new Set([...(topic.approvals||[]).filter(id=>members.includes(id)),...(teacher?[]:[studentId])])];
  const open=teacher||approvals.length>members.length/2&&approvals.some(id=>officers.chairIds.includes(id));
  if(open&&topic.closesAt&&Date.parse(topic.closesAt)<=Date.parse(stamp))throw Error('마감 시각이 지났습니다. 새 안건을 제안하세요.');
  ops.push(meetingUp('meeting_topics',{...topic,approvals,status:open?'open':'pending',electorate:open?meetingStudentIds(d):[],openedAt:open?stamp:null}));return ops;
 }
 throw Error('학급회의 작업을 확인하세요.');
}
