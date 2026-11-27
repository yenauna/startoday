// Finance uses dedicated state and RPCs; the existing points ledger remains the sole cash balance.
import * as C from './core.js';
export const FINANCE_TABLES = ['bank_deposits','stock_quotes','stock_holdings','stock_orders'];
export const STOCK_PRESETS = [
 ['005930.KS','삼성전자'],['000660.KS','SK하이닉스'],['035420.KS','NAVER'],['035720.KS','카카오'],['005380.KS','현대차'],['051910.KS','LG화학'],['068270.KS','셀트리온'],['005490.KS','POSCO홀딩스']
].map(([symbol,name])=>({symbol,name}));
export const DEFAULT_BANK_CONFIG = {tiers:[{minStars:0,ratePercent:2},{minStars:10,ratePercent:3},{minStars:30,ratePercent:4},{minStars:50,ratePercent:5}]};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function financeConfig(settings={}) {
 const bank=structuredClone(settings.bankConfig??DEFAULT_BANK_CONFIG),stock={open:'09:00',close:'14:30',krwPerPoint:100,settlementMinutes:80,symbols:STOCK_PRESETS.slice(0,3),...settings.stockConfig};
 if(!Array.isArray(bank.tiers)||bank.tiers.length<1||bank.tiers.length>20||bank.tiers.some(t=>!integer(t.minStars,0,1000000)||!Number.isFinite(t.ratePercent)||t.ratePercent<0||t.ratePercent>100||Number(t.ratePercent.toFixed(2))!==t.ratePercent)||new Set(bank.tiers.map(t=>t.minStars)).size!==bank.tiers.length||!bank.tiers.some(t=>t.minStars===0))throw Error('별 구간은 0부터, 이율은 0~100%(소수 둘째 자리)로 입력하세요.');
 bank.tiers.sort((a,b)=>a.minStars-b.minStars);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(stock.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(stock.close)||stock.open>=stock.close||!integer(stock.krwPerPoint,1,1000000)||!integer(stock.settlementMinutes,0,10080)||!Array.isArray(stock.symbols)||stock.symbols.length>40||stock.symbols.some(s=>!validSymbol(s.symbol)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80)||new Set(stock.symbols.map(s=>s.symbol)).size!==stock.symbols.length)throw Error('주식 거래 시간·환산비율·정산 시간·종목을 확인하세요.');
 return {bank:{tiers:bank.tiers.map(({minStars,ratePercent})=>({minStars,ratePercent}))},stock:{open:stock.open,close:stock.close,krwPerPoint:stock.krwPerPoint,settlementMinutes:stock.settlementMinutes,symbols:stock.symbols.map(({symbol,name})=>({symbol,name}))}};
}
export const validSymbol=s=>typeof s==='string'&&/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(s);
export function bankPreview(database,studentId,principal,weeks) {
 return bankEstimate(C.scores(database,studentId,'',C.today()).total,financeConfig(database.settings?.[0]).bank,principal,weeks);
}
export function bankEstimate(stars,config,principal,weeks) {
 const tier=config.tiers.filter(t=>t.minStars<=stars).at(-1)||config.tiers[0];
 if(!integer(principal,1,100000000)||!integer(weeks,2,52)||weeks%2)throw Error('원금은 1~1억 정수 포인트, 기간은 2~52주(2주 단위)로 입력하세요.');
 const interest=Number(BigInt(principal)*BigInt(Math.round(tier.ratePercent*100))*BigInt(weeks/2)/10000n);
 if(principal+interest>1000000000)throw Error('만기 수령액 한도를 초과합니다.');
 return {principal,weeks,stars,ratePercent:tier.ratePercent,interest,total:principal+interest};
}
export function marketOpen(stock,stamp=C.now()) {
 const date=new Date(stamp);if(!Number.isFinite(+date))return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),get=k=>parts.find(p=>p.type===k)?.value,time=get('hour')+':'+get('minute');
 return !['Sat','Sun'].includes(get('weekday'))&&time>=stock.open&&time<=stock.close;
}
const units=n=>{if(!Number.isFinite(Number(n))||Number(n)<=0||Number(n)>9999999999.9999||Number(Number(n).toFixed(4))!==Number(n))throw Error('주식 수량은 소수 넷째 자리까지 입력하세요.');return BigInt(Math.round(Number(n)*10000));};
export function stockCalculation(side,quote,stock,value) {
 const price=Number(quote?.priceKrw),priceUnits=BigInt(Math.round((price||0)*10000)),fx=BigInt(stock.krwPerPoint);
 if(!Number.isFinite(price)||price<=0||price>1000000000||priceUnits<=0)throw Error('유효한 시세가 없습니다. 선생님께 갱신을 요청하세요.');
 let count,amount;
 if(side==='buy') {if(!integer(value,1,1000000000))throw Error('매수 포인트는 양의 정수로 입력하세요.');count=BigInt(value)*fx*100000000n/priceUnits;amount=(count*priceUnits+fx*100000000n-1n)/(fx*100000000n);}
 else if(side==='sell'){count=units(value);amount=count*priceUnits/(fx*100000000n);}else throw Error('주문 종류를 확인하세요.');
 if(count<=0n||count>99999999999999n||amount<1n||amount>1000000000n)throw Error('주문 가능 수량·금액 범위를 확인하세요.');
 return {shares:Number(count)/10000,amountPoints:Number(amount),priceKrw:price};
}
const up=(table,data)=>({table,id:data.id,data});
const tx=(studentId,type,amount,ref,memo,stamp)=>up('economy_tx',{id:C.uid(),studentId,type,amount,originalTxId:ref,memo,createdAt:stamp});
export function financeSettleOps(database,stamp=C.now()) {
 const ops=[];
 for(const d of database.bank_deposits||[])if(d.status==='active'&&Date.parse(d.maturesAt)<=Date.parse(stamp)){
  ops.push(up('bank_deposits',{...d,status:'matured',paidInterest:d.interest,settledAt:stamp}),tx(d.studentId,'예금만기',d.principal+d.interest,d.id,'정기예금 만기',stamp));
 }
 const holdings=structuredClone(database.stock_holdings||[]);
 for(const o of [...(database.stock_orders||[])].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))if(o.status==='pending'&&Date.parse(o.settleAt)<=Date.parse(stamp)){
  if(o.side==='buy'){
   let h=holdings.find(h=>h.studentId===o.studentId&&h.symbol===o.symbol);if(!h){h={id:o.studentId+':'+o.symbol,studentId:o.studentId,symbol:o.symbol,shares:0,avgPriceKrw:0,totalBuyPoints:0};holdings.push(h);}
   const total=Math.round(h.shares*10000)+Math.round(o.shares*10000);
   if(total>99999999999999)throw Error('보유 주식 수량 한도를 초과합니다.');
   const numerator=BigInt(Math.round(h.avgPriceKrw*10000))*BigInt(Math.round(h.shares*10000))+BigInt(Math.round(o.priceKrw*10000))*BigInt(Math.round(o.shares*10000));h.avgPriceKrw=Number((numerator+BigInt(total)/2n)/BigInt(total))/10000;h.shares=total/10000;h.totalBuyPoints+=o.amountPoints;
   ops.push(up('stock_holdings',structuredClone(h)));
  }
  ops.push(up('stock_orders',{...o,status:'settled',settledAt:stamp}),tx(o.studentId,'주식정산',o.side==='sell'?o.amountPoints:0,o.id,o.symbol+' '+(o.side==='buy'?'매수 입고':'매도 입금'),stamp));
 }
 return ops;
}
export function financeOrderOps(database,studentId,action,payload={},stamp=C.now()) {
 if(!(database.students||[]).some(s=>s.id===studentId&&!s.deletedAt))throw Error('학생을 확인하세요.');
 const config=financeConfig(database.settings[0]),settled=financeSettleOps(database,stamp),d=C.applyOps(database,settled),ops=[...settled],id=payload.requestId||C.uid();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('주문 ID를 확인하세요.');
 const existing=[...(d.bank_deposits||[]),...(d.stock_orders||[])].find(o=>o.id===id);if(existing){if(existing.studentId!==studentId||(action==='deposit'?(existing.principal!==payload.principal||existing.weeks!==payload.weeks):(existing.side!==action||existing.symbol!==payload.symbol||(action==='buy'?existing.requestedPoints!==payload.amountPoints:existing.shares!==payload.shares))))throw Error('중복 주문 ID의 내용이 다릅니다.');return settled;}
 if(action==='deposit'){
  const preview=bankPreview(d,studentId,payload.principal,payload.weeks);if(C.studentBalance(d,studentId)<preview.principal)throw Error('잔액이 부족합니다.');
  ops.push(up('bank_deposits',{id,studentId,...preview,createdAt:stamp,maturesAt:new Date(Date.parse(stamp)+preview.weeks*7*86400000).toISOString(),status:'active',paidInterest:0}),tx(studentId,'예금가입',-preview.principal,id,'정기예금 '+preview.weeks+'주',stamp));
 }else if(['buy','sell'].includes(action)){
  if(!marketOpen(config.stock,stamp))throw Error('거래 가능 시간: '+config.stock.open+'~'+config.stock.close+' (평일 KST)');
  if(action==='buy'&&!config.stock.symbols.some(s=>s.symbol===payload.symbol))throw Error('거래할 수 없는 종목입니다.');
  const quote=(d.stock_quotes||[]).find(q=>q.symbol===payload.symbol);
  if(!quote||!Number.isFinite(Date.parse(quote.updatedAt))||Date.parse(stamp)-Date.parse(quote.updatedAt)>1800000||Date.parse(quote.updatedAt)>Date.parse(stamp)+60000)throw Error('시세가 30분 이상 지났습니다. 갱신 후 주문하세요.');
  const calc=stockCalculation(action,quote,config.stock,action==='buy'?payload.amountPoints:payload.shares);
  if(action==='buy'){
   if(C.studentBalance(d,studentId)<calc.amountPoints)throw Error('잔액이 부족합니다.');
   const reserved=(d.stock_orders||[]).filter(o=>o.studentId===studentId&&o.symbol===payload.symbol&&o.side==='buy'&&o.status==='pending').reduce((n,o)=>n+Math.round(o.shares*10000),0),held=(d.stock_holdings||[]).find(h=>h.studentId===studentId&&h.symbol===payload.symbol);
   if(reserved+Math.round((held?.shares||0)*10000)+Math.round(calc.shares*10000)>99999999999999)throw Error('보유 주식 수량 한도를 초과합니다.');
  }else{
   const held=(d.stock_holdings||[]).find(h=>h.studentId===studentId&&h.symbol===payload.symbol);
   if(!held||Math.round(held.shares*10000)<Math.round(calc.shares*10000))throw Error('매도 가능한 보유 수량이 부족합니다.');
   const remaining=(Math.round(held.shares*10000)-Math.round(calc.shares*10000))/10000;
   ops.push(up('stock_holdings',{...held,shares:remaining,totalBuyPoints:remaining?held.totalBuyPoints-Number(BigInt(held.totalBuyPoints)*BigInt(Math.round(calc.shares*10000))/BigInt(Math.round(held.shares*10000))):0,avgPriceKrw:remaining?held.avgPriceKrw:0}));
  }
  ops.push(up('stock_orders',{id,studentId,side:action,symbol:payload.symbol,...calc,...(action==='buy'?{requestedPoints:payload.amountPoints}:{}),krwPerPoint:config.stock.krwPerPoint,createdAt:stamp,settleAt:new Date(Date.parse(stamp)+config.stock.settlementMinutes*60000).toISOString(),status:'pending'}),tx(studentId,action==='buy'?'주식매수':'주식매도',action==='buy'?-calc.amountPoints:0,id,payload.symbol+' 시장가 주문',stamp));
 }else if(action!=='refresh')throw Error('거래 종류를 확인하세요.');
 const after=C.applyOps(database,ops);return [...ops,...financeSettleOps(after,stamp)];
}
export function financeSnapshot(database,studentId) {
 const {bank,stock}=financeConfig(database.settings?.[0]);
 return {bankConfig:bank,stockConfig:stock,stars:C.scores(database,studentId,'',C.today()).total,deposits:(database.bank_deposits||[]).filter(d=>d.studentId===studentId),holdings:(database.stock_holdings||[]).filter(h=>h.studentId===studentId),orders:(database.stock_orders||[]).filter(o=>o.studentId===studentId),quotes:database.stock_quotes||[]};
}
export function validateFinanceState(database){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,student=id=>(database.students||[]).some(s=>s.id===id),date=d=>typeof d==='string'&&Number.isFinite(Date.parse(d)),quantity=n=>Number.isFinite(n)&&n>=0&&n<=9999999999.9999&&Number(n.toFixed(4))===n,price=n=>Number.isFinite(n)&&n>0&&n<=1000000000&&Number(n.toFixed(4))===n;
 for(const table of FINANCE_TABLES){if(database[table]!==undefined&&!Array.isArray(database[table]))throw Error('은행·주식 목록 형식 오류');const ids=new Set();for(const r of database[table]||[]){if(!r||typeof r.id!=='string'||ids.has(r.id))throw Error('은행·주식 ID 오류');ids.add(r.id);}}
 for(const d of database.bank_deposits||[])if(!uuid.test(d.id)||!student(d.studentId)||!integer(d.principal,1,100000000)||!integer(d.weeks,2,52)||d.weeks%2||!Number.isFinite(d.ratePercent)||d.ratePercent<0||d.ratePercent>100||!integer(d.interest,0,1000000000-d.principal)||!['active','matured'].includes(d.status)||d.paidInterest!==(d.status==='matured'?d.interest:0)||!date(d.createdAt)||!date(d.maturesAt))throw Error('정기예금 데이터 형식 오류');
 for(const h of database.stock_holdings||[])if(!student(h.studentId)||!validSymbol(h.symbol)||h.id!==h.studentId+':'+h.symbol||!quantity(h.shares)||!Number.isFinite(h.avgPriceKrw)||h.avgPriceKrw<0||!integer(h.totalBuyPoints,0,Number.MAX_SAFE_INTEGER))throw Error('보유 주식 데이터 형식 오류');
 for(const o of database.stock_orders||[])if(!uuid.test(o.id)||!student(o.studentId)||!validSymbol(o.symbol)||!quantity(o.shares)||o.shares===0||!price(o.priceKrw)||!integer(o.amountPoints,1,1000000000)||!integer(o.krwPerPoint,1,1000000)||!['buy','sell'].includes(o.side)||!['pending','settled'].includes(o.status)||!date(o.createdAt)||!date(o.settleAt))throw Error('주식 주문 데이터 형식 오류');
 for(const q of database.stock_quotes||[])if(!validSymbol(q.symbol)||q.id!==q.symbol||typeof q.name!=='string'||!q.name.trim()||!price(q.priceKrw)||!date(q.updatedAt))throw Error('주식 시세 데이터 형식 오류');
}
