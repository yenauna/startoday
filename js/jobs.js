import * as C from './core.js';
export const JOB_METHODS=['가위바위보','선착순','추첨','직접 입력'];
export function jobDefault(date=C.today()){return{id:C.uid(),kind:'gig',title:'',description:'',capacity:1,recruitFrom:date,recruitTo:date,wage:0,method:'가위바위보',methodText:'',areaMin:{},minStars:null,conditionText:'',status:'open',selectedIds:[],drawIds:[],version:0};}
export function jobMethodLabel(p){return p.method==='직접 입력'?p.methodText||'직접 입력':p.method;}
export function validateJob(p){
 if(!p||typeof p.id!=='string'||!p.id||typeof p.title!=='string'||p.title.length>100||typeof p.description!=='string'||p.description.length>5000||!Number.isInteger(p.capacity)||p.capacity<1||p.capacity>999||!JOB_METHODS.includes(p.method)||typeof p.methodText!=='string'||p.methodText.length>100||p.method==='직접 입력'&&!p.methodText.trim()||!C.noticeDateValid(p.recruitFrom)||!C.noticeDateValid(p.recruitTo)||p.recruitFrom>p.recruitTo||typeof p.conditionText!=='string'||p.conditionText.length>2000||!p.areaMin||Array.isArray(p.areaMin)||typeof p.areaMin!=='object'||Object.entries(p.areaMin).some(([k,v])=>!C.DEFAULT_AREAS.includes(k)||!Number.isSafeInteger(v)||v<0||v>1000000)||p.minStars!==null&&(!Number.isSafeInteger(p.minStars)||p.minStars<0||p.minStars>1000000))throw Error('공고 설명·마감·인원·선발 방법·조건을 확인하세요.');return p;
}
export function jobEligibility(d,post,sid,date=C.today()){const score=C.scores(d,sid,'',date),missing=Object.entries(post.areaMin||{}).filter(([area,n])=>(score.areas[area]||0)<n).map(([area,n])=>`${area} ${n}점 이상 (현재 ${score.areas[area]||0}점)`);if(post.minStars!==null&&post.minStars!==undefined&&score.total<post.minStars)missing.push(`보유 별 ${post.minStars}개 이상 (현재 ${score.total}개)`);return missing;}
export function jobsSnapshot(d,sid=null,teacher=false,date=C.today()){
 const posts=(d.job_posts||[]).filter(p=>p.status!=='deleted'&&(teacher||p.status==='open'||p.selectedIds?.includes(sid))).map(p=>({...p,...(!teacher?{drawIds:[],selectedIds:(p.selectedIds||[]).filter(id=>id===sid)}:{}),missing:teacher?[]:jobEligibility(d,p,sid,date),application:(d.job_applications||[]).find(a=>a.postId===p.id&&a.studentId===sid)||null}));
 return{isTeacher:teacher,studentId:sid,posts,applications:teacher?(d.job_applications||[]):[],roster:teacher?C.activeStudents(d).map(({id,no,name})=>({id,no,name})):[]};
}
export function jobSalaryCounts(d,sid,window,basis,from){
 const counts=C.salaryRecordCount(d,sid,window.from,window.to,basis),last=(d.economy_tx||[]).filter(t=>t.studentId===sid&&C.isSalaryEntry(t)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
 if(last){const extra=(d.records||[]).filter(r=>r.jobPostId&&r.kind==='칭찬'&&r.studentIds?.includes(sid)&&r.date>=from&&r.date<=window.to&&(!window.from||r.date<window.from)&&Date.parse(r.createdAt)>Date.parse(last.createdAt)&&!C.excluded(d,sid,r.date)).length;counts.praise+=extra;counts.count=basis==='praise-advice'?Math.max(0,counts.praise-counts.advice):counts.praise;}return counts;
}
export function jobsOps(database,sid,action,p={},teacher=false,stamp=C.now(),random=Math.random){
 const d=structuredClone(database),date=C.seoulDay(stamp),up=(table,data)=>({table,id:data.id,data}),active=C.activeStudents(d).map(s=>s.id);if(!teacher&&!active.includes(sid))throw Error('학생 인증을 확인하세요.');if(action==='refresh')return[];
 let post=d.job_posts.find(x=>x.id===(p.id||p.postId));if(action==='save'){
  if(!teacher)throw Error('교사만 공고를 관리할 수 있습니다.');if(post&&post.status!=='open'&&post.status!=='closed')throw Error('선발된 공고는 수정할 수 없습니다.');if(post&&p.version!==post.version)throw Error('공고가 변경되었습니다. 새로고침하세요.');
  const data=validateJob({...jobDefault(date),...p,kind:'gig',wage:0,recruitFrom:[C.seoulDay(post?.createdAt||stamp),p.recruitTo].sort()[0],id:p.id||C.uid(),status:post?.status||'open',selectedIds:[],drawIds:[],version:(post?.version||0)+1,createdAt:post?.createdAt||stamp,updatedAt:stamp});delete data.activityFrom;delete data.activityTo;data.title=data.title.trim();return[up('job_posts',data)];
 }
 if(!post||post.status==='deleted')throw Error('공고를 확인하세요.');
 if(action==='apply'||action==='cancel'){
  if(teacher||post.status!=='open'||date<post.recruitFrom||date>post.recruitTo)throw Error('모집 중에만 지원·취소할 수 있습니다.');const id=post.id+':'+sid,old=d.job_applications.find(a=>a.id===id);if(action==='apply'){const missing=jobEligibility(d,post,sid,date);if(missing.length)throw Error('지원 조건 부족: '+missing.join(' / '));if(old?.status==='applied')return[];}else if(old?.status!=='applied')throw Error('취소할 지원을 확인하세요.');return[up('job_applications',{id,postId:post.id,studentId:sid,status:action==='apply'?'applied':'cancelled',submittedAt:action==='apply'?stamp:old.submittedAt,updatedAt:stamp}),up('job_posts',{...post,drawIds:[],version:post.version+1,updatedAt:stamp})];
 }
 if(!teacher)throw Error('교사만 선발·완료 처리할 수 있습니다.');if(p.version!==post.version)throw Error('공고가 변경되었습니다. 새로고침하세요.');
 const applicants=d.job_applications.filter(a=>a.postId===post.id&&a.status==='applied'&&active.includes(a.studentId)).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)||a.studentId.localeCompare(b.studentId));
 if(action==='close'){if(post.status!=='open')throw Error('모집 중 공고만 마감할 수 있습니다.');return[up('job_posts',{...post,status:'closed',version:post.version+1,updatedAt:stamp})];}
 if(action==='delete'){if(!['open','closed'].includes(post.status))throw Error('선발된 공고는 삭제할 수 없습니다.');return[up('job_posts',{...post,status:'deleted',version:post.version+1,updatedAt:stamp})];}
 if(action==='draw'){if(!['open','closed'].includes(post.status)||post.method!=='추첨')throw Error('추첨 공고를 확인하세요.');const ids=applicants.map(a=>a.studentId);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return[up('job_posts',{...post,drawIds:ids.slice(0,post.capacity),version:post.version+1,updatedAt:stamp})];}
 if(action==='select'){
  const ids=p.studentIds;if(!['open','closed'].includes(post.status)||!Array.isArray(ids)||!ids.length||ids.length>post.capacity||new Set(ids).size!==ids.length||ids.some(id=>!applicants.some(a=>a.studentId===id)))throw Error('지원자 중 모집 인원 이내로 선택하세요.');
  if(post.method==='선착순'&&ids.some((id,i)=>id!==applicants[i]?.studentId))throw Error('선착순 지원 순서를 확인하세요.');if(post.method==='추첨'&&(ids.length!==post.drawIds.length||ids.some(id=>!post.drawIds.includes(id))))throw Error('먼저 추첨한 뒤 결과를 확정하세요.');
  post={...post,status:'selected',selectedIds:ids,version:post.version+1,updatedAt:stamp};const ops=[up('job_posts',post),...applicants.map(a=>up('job_applications',{...a,status:ids.includes(a.studentId)?'selected':'notSelected',updatedAt:stamp}))];return ops;
 }
 if(action==='complete'){
  if(post.status==='completed')return[];if(post.status!=='selected')throw Error('선정된 알바만 완료할 수 있습니다.');
  const ops=[up('job_posts',{...post,status:'completed',completedAt:stamp,version:post.version+1,updatedAt:stamp})];for(const id of post.selectedIds){const rid='job:'+post.id+':'+id;if(!d.records.some(r=>r.id===rid))ops.push(up('records',{id:rid,studentIds:[id],date,kind:'칭찬',areas:['알바'],text:post.title?`${post.title} 알바 완료`:'알바 참여 완료',guidance:'',createdAt:stamp,updatedAt:stamp,printIncluded:true,jobPostId:post.id}));const a=d.job_applications.find(a=>a.postId===post.id&&a.studentId===id);if(a)ops.push(up('job_applications',{...a,status:'completed',updatedAt:stamp}));}return ops;
 }
 if(action==='terminate'){if(post.status==='terminated')return[];if(post.status!=='selected')throw Error('선정된 알바만 해지할 수 있습니다.');return[up('job_posts',{...post,status:'terminated',terminatedAt:stamp,version:post.version+1,updatedAt:stamp}),...d.job_applications.filter(a=>a.postId===post.id&&a.status==='selected').map(a=>up('job_applications',{...a,status:'terminated',updatedAt:stamp}))];}
 throw Error('알바 작업을 확인하세요.');
}
