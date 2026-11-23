import * as C from '../core.js';

// Only the authenticated student's existing snapshot is inspected; no new RPC.
export function snapshotNotifications(snapshot){
 if(!snapshot?.student?.id)return [];
 const notices=[];
 for(const task of snapshot.tasks||[]){
  if(task.status==='면제'||!(task.date===snapshot.date||task.status==='진행중'))continue;
  notices.push({id:`task:${task.id}:${task.date||''}`,kind:'과제',text:task.title,date:task.date||''});
 }
 const titles=[...C.kingdomCatalog(snapshot.titleCounts||{},snapshot.titleConfig||{}).flatMap(domain=>domain.unlocked),...C.studentRewardTitles(snapshot.student)];
 for(const title of titles)notices.push({id:`title:${title.id}`,kind:'새 칭호',text:title.name,date:''});
 for(const tx of snapshot.economy?.transactions||[]){
  if(!tx.id||!(tx.type==='선물'||tx.type==='지급'&&Number(tx.amount)>0))continue;
  notices.push({id:`economy:${tx.id}`,kind:tx.type==='선물'?'물건 선물':'포인트 지급',text:tx.type==='선물'?tx.itemName||'물건':`${tx.amount}포인트`,date:tx.createdAt||''});
 }
 return [...new Map(notices.map(notice=>[notice.id,notice])).values()];
}
const notificationMemory=new Map();
export function notificationStorageKey(mode,classId,studentId){return `startoday-notifications:${JSON.stringify([mode,classId,studentId])}`;}
export function readNotificationIds(key,storage){
 try{const parsed=JSON.parse((storage||globalThis.localStorage)?.getItem(key)||'[]');if(Array.isArray(parsed))return new Set([...parsed.filter(id=>typeof id==='string'),...(notificationMemory.get(key)||[])]);}catch{}
 return new Set(notificationMemory.get(key)||[]);
}
export function acknowledgeNotification(key,id,storage){
 const read=readNotificationIds(key,storage);read.add(id);notificationMemory.set(key,read);
 try{(storage||globalThis.localStorage)?.setItem(key,JSON.stringify([...read]));}catch{}
}
export function unreadNotifications(snapshot,key,storage){const read=readNotificationIds(key,storage);return snapshotNotifications(snapshot).filter(notice=>!read.has(notice.id));}
