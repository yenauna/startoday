import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('간접 시세 워커는 KST 세션·KRW 검증, 서비스 키 격리, 원래 기준시각과 DB upsert를 지킨다',()=>{
 const script=String.raw`
import importlib.util,datetime as dt,io,contextlib
spec=importlib.util.spec_from_file_location('stocks','scripts/sync-stocks.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.in_session(dt.datetime(2026,11,27,0,0,tzinfo=dt.timezone.utc))
assert not m.in_session(dt.datetime(2026,11,28,1,0,tzinfo=dt.timezone.utc))
assert not m.in_session(dt.datetime(2026,11,27,5,31,tzinfo=dt.timezone.utc))
stamp=dt.datetime.now(dt.timezone.utc).timestamp()-20
market={'chart':{'result':[{'meta':{'regularMarketPrice':70000,'chartPreviousClose':69000,'regularMarketTime':stamp,'currency':'KRW'}}]}}
calls=[]
def fetch(url,headers,data=None):
 calls.append((url,headers,data))
 if 'finance.yahoo.com' in url:
  assert 'Authorization' not in headers and 'apikey' not in headers
  return market
 if 'startoday_settings' in url:return [{'data':{'stockConfig':{'symbols':[{'symbol':'005930.KS','name':'삼성전자'}]}}}]
 if 'startoday_stock_holdings' in url:return []
 if 'select=updated_at' in url:return []
 return None
out=io.StringIO()
with contextlib.redirect_stdout(out):m.sync({'GITHUB_EVENT_NAME':'workflow_dispatch','SUPABASE_URL':'https://db.example','SUPABASE_SERVICE_ROLE_KEY':'TOPSECRET'},fetch)
writes=[x for x in calls if x[2] is not None];assert len(writes)==1
q=writes[0][2][0];assert q['id']=='market:005930.KS' and q['class_id'] is None and q['price_krw']==70000
assert abs(dt.datetime.fromisoformat(q['updated_at']).timestamp()-stamp)<.01
assert 'TOPSECRET' not in out.getvalue()
market['chart']['result'][0]['meta']['currency']='USD'
try:m.parse_quote('005930.KS','주식',market);raise AssertionError('USD accepted')
except ValueError:pass
print('PASS')
`;
 assert.match(execFileSync('python3',['-c',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}),/PASS/);
 const workflow=readFileSync(new URL('../.github/workflows/sync-stocks.yml',import.meta.url),'utf8');assert.match(workflow,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(workflow,/workflow_dispatch/);
 for(const file of ['../js/finance.js','../js/components/finance-view.js'])assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),/finance\.yahoo|SERVICE_ROLE_KEY|query1\./);
});
