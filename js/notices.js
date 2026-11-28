import * as C from './core.js';
import {NOTICE_PHRASES,NOTICE_ANNIVERSARIES,NOTICE_PHRASE_CATALOG} from './data/notice-phrases.js';
export * from './data/notice-phrases.js';
export function noticeDateValid(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00Z'))&&new Date(date+'T12:00Z').toISOString().slice(0,10)===date;}
export function noticePhrase(date,variant=0){
 if(!noticeDateValid(date)||!Number.isSafeInteger(variant)||variant<0)throw Error('알림장 날짜를 확인하세요.');
 const occasion=NOTICE_ANNIVERSARIES.find(([md])=>{const day=date.slice(0,4)+'-'+md;if(day===date)return true;for(let n=1;n<=2;n++){const before=C.addDays(day,-n);if(![0,6].includes(C.weekday(before)))return before===date;}return false;});
 if(occasion&&variant===0)return occasion[1];
 const month=Number(date.slice(5,7)),season=month>=6&&month<=8?'summer':[12,1,2].includes(month)?'winter':null,pool=[...NOTICE_PHRASES.general,...(season?NOTICE_PHRASES[season]:[])];
 const day=Math.floor(Date.parse(date+'T12:00Z')/86400000);return pool[(day+variant)%pool.length];
}
const noticePhraseKey=text=>String(text??'').normalize('NFC').trim().replace(/\s+/g,' ');
export function noticePhraseUsage(database,date){
 if(!noticeDateValid(date))throw Error('알림장 날짜를 확인하세요.');
 const from=C.addDays(date,-365),usage=new Map();
 for(const notice of database.notices||[]){if(notice.deletedAt||!noticeDateValid(notice.date)||notice.date<from||notice.date>date||typeof notice.lifeText!=='string')continue;const key=noticePhraseKey(notice.lifeText);if(key&&(!usage.has(key)||usage.get(key)<notice.date))usage.set(key,notice.date);}
 return usage;
}
export function noticePhraseChoices(database,date,{category='all',query='',unusedOnly=false}={}){
 const usage=noticePhraseUsage(database,date),search=noticePhraseKey(query).toLocaleLowerCase('ko-KR');
 return NOTICE_PHRASE_CATALOG.map(item=>({...item,usedOn:usage.get(noticePhraseKey(item.text))||null})).filter(item=>(category==='all'||item.category===category)&&(!search||noticePhraseKey(item.text+' '+item.category).toLocaleLowerCase('ko-KR').includes(search))&&(!unusedOnly||!item.usedOn));
}
export function noticeRandomPool(date){
 if(!noticeDateValid(date))throw Error('알림장 날짜를 확인하세요.');
 const month=Number(date.slice(5,7)),season=month>=6&&month<=8?'summer':[12,1,2].includes(month)?'winter':null;
 const occasion=NOTICE_ANNIVERSARIES.find(([md])=>{const day=date.slice(0,4)+'-'+md;if(day===date)return true;for(let n=1;n<=2;n++){const before=C.addDays(day,-n);if(![0,6].includes(C.weekday(before)))return before===date;}return false;});
 return NOTICE_PHRASE_CATALOG.filter(item=>item.season==='general'||item.season===season||item.season==='occasion'&&item.monthDay===occasion?.[0]);
}
export function noticeRandomPhrase(database,date,current='',random=Math.random){
 const usage=noticePhraseUsage(database,date),pool=noticeRandomPool(date).filter(item=>noticePhraseKey(item.text)!==noticePhraseKey(current)),unused=pool.filter(item=>!usage.has(noticePhraseKey(item.text))),eligible=unused.length?unused:pool;
 if(!eligible.length)throw Error('다른 문구를 찾을 수 없습니다.');const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('문구를 다시 골라 주세요.');
 return {text:eligible[Math.floor(value*eligible.length)].text,exhausted:!unused.length};
}
export function noticeFuturePrefix(date){if(!noticeDateValid(date))throw Error('일정 날짜를 확인하세요.');return `[${Number(date.slice(5,7))}.${Number(date.slice(8,10))}.${'일월화수목금토'[C.weekday(date)]}]`;}
export function noticeDraft(database,date=C.today()){
 if(!noticeDateValid(date))throw Error('알림장 날짜를 확인하세요.');
 const saved=(database.notices||[]).find(n=>n.date===date&&!n.deletedAt);return saved?structuredClone(saved):{id:'notice:'+date,date,lifeText:noticePhrase(date),todayItems:[],futureItems:[],extraMemo:'',renderedText:'',updatedAt:null,deletedAt:null};
}
export function noticeDayItems(database,date){
 const events=C.calendarEvents(database).filter(e=>e.date===date&&!e.deletedAt).map(e=>({key:`event:${e.id}:${date}`,kind:'event',sourceId:e.id,date,text:e.title,detail:e.description||''}));
 const tasks=database.assignments.filter(a=>!a.isQuest&&C.occurs(a,date)).map(a=>({key:`task:${a.id}:${date}`,kind:'task',sourceId:a.id,date,text:a.title,detail:a.memo||'',includeMissing:false}));
 const lessons=database.timetables.filter(t=>t.date===date&&!t.deletedAt&&((t.publicMemo??t.memo)||t.privateMemo)).sort((a,b)=>a.period-b.period).map(t=>({key:`lesson:${t.id}:${date}`,kind:'lesson',sourceId:t.id,date,text:`${t.period}교시 ${t.subjectCode}: ${[(t.publicMemo??t.memo)||'',t.privateMemo||''].filter(Boolean).join(' / ')}`,detail:''}));
 return [...events,...tasks,...lessons];
}
export function noticeMissingStudents(database,item){
 const assignment=database.assignments.find(a=>a.id===item.sourceId&&!a.deletedAt&&!a.isQuest);if(!assignment||!C.occurs(assignment,item.date))return [];
 return C.activeStudents(database).filter(s=>C.targeted(assignment,s.id)&&!C.excluded(database,s.id,item.date)&&['진행중','안함'].includes(C.assignmentStatus(database,assignment.id,item.date,s.id))).map(s=>s.name);
}
export function noticeItemText(database,item){const missing=item.kind==='task'&&item.includeMissing?noticeMissingStudents(database,item):[];return item.text+(item.kind==='task'&&item.includeMissing?` (미제출: ${missing.join(', ')||'없음'})`:'');}
export function noticeText(database,notice){
 const sections=[C.formatDate(notice.date)+' 알림장','[생활]\n'+notice.lifeText];
 if(notice.todayItems.length)sections.push('[오늘 한 일]\n'+notice.todayItems.map(i=>'• '+noticeItemText(database,i)).join('\n'));
 if(notice.futureItems.length)sections.push('[앞으로의 일정]\n'+[...notice.futureItems].sort((a,b)=>a.date.localeCompare(b.date)).map(i=>noticeFuturePrefix(i.date)+' '+noticeItemText(database,i)).join('\n'));
 if(notice.extraMemo.trim())sections.push('[추가 전달사항]\n'+notice.extraMemo);return sections.join('\n\n');
}
export function validateNotice(n){
 if(!n||!noticeDateValid(n.date)||n.id!=='notice:'+n.date||['lifeText','extraMemo','renderedText'].some(k=>typeof n[k]!=='string'||n[k].length>100000)||typeof n.updatedAt!=='string'||!n.updatedAt||!Number.isFinite(Date.parse(n.updatedAt))||n.deletedAt!==null&&n.deletedAt!==undefined&&!Number.isFinite(Date.parse(n.deletedAt)))throw Error('알림장 형식을 확인하세요.');
 const keys=new Set();for(const [field,future] of [['todayItems',false],['futureItems',true]]){
  if(!Array.isArray(n[field])||n[field].length>500)throw Error('알림장 항목을 확인하세요.');
  for(const i of n[field]){if(!i||typeof i.key!=='string'||!i.key||i.key.length>300||keys.has(i.key)||!['event','task','lesson'].includes(i.kind)||typeof i.sourceId!=='string'||!i.sourceId||!noticeDateValid(i.date)||(future?i.date<=n.date:i.date!==n.date)||typeof i.text!=='string'||i.text.length>5000||i.includeMissing!==undefined&&typeof i.includeMissing!=='boolean')throw Error('알림장 항목을 확인하세요.');keys.add(i.key);}
 }
 return n;
}
export function noticeSaveOps(database,draft,stamp=C.now()){
 const data={...structuredClone(draft),id:'notice:'+draft.date,renderedText:noticeText(database,draft),futureItems:[...draft.futureItems].sort((a,b)=>a.date.localeCompare(b.date)),updatedAt:stamp,deletedAt:null};validateNotice(data);return[{table:'notices',id:data.id,data}];
}
