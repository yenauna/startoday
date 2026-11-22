import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.STARTODAY_CONFIG={};');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const trace=JSON.parse(readFileSync(path.join(root,'tests/fixtures/logo-star-trace.json'),'utf8'));
assert.equal(createHash('sha256').update(readFileSync(path.join(root,'assets/logo-icon.jpg'))).digest('hex'),trace.source_sha256,'Logo changed: rerun scripts/trace-logo-star.py');
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:800,height:600}});await page.goto(`http://127.0.0.1:${server.address().port}`);
 const result=await page.evaluate(async trace=>{
  const {icon}=await import('/js/components/icons.js');
  const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
  const logo=await load('/assets/logo-icon.jpg'),svg=await load('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(icon('gold-star').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')));
  const size=512,canvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};const a=canvas(),b=canvas(),[lo,hi]=trace.source_bbox,w=hi[0]-lo[0],h=hi[1]-lo[1],scale=size*.92/Math.max(w,h);
  a.getContext('2d').drawImage(logo,lo[0],lo[1],w,h,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);b.getContext('2d').drawImage(svg,0,0,size,size);
  const original=a.getContext('2d').getImageData(0,0,size,size).data,traced=b.getContext('2d').getImageData(0,0,size,size).data;let intersection=0,union=0;
  for(let i=0;i<original.length;i+=4){const x=original[i]>170&&original[i+1]>130&&original[i+2]<170&&original[i]-original[i+2]>80&&original[i+3]>127,y=traced[i+3]>127;if(x||y)union++;if(x&&y)intersection++;}
  document.querySelector('#app').innerHTML='<div style="display:flex;gap:20px;padding:32px;background:#f5f3fa"><img src="/assets/logo-icon.jpg" width="256" height="256" alt="원본 로고"><div style="width:256px;height:256px;background:#213252;display:grid;place-items:center">'+icon('gold-star').replace('width="22" height="22"','width="220" height="220" style="width:220px;height:220px"')+'</div></div>';
  return {iou:intersection/union,markup:icon('gold-star')};
 },trace);
 assert(result.iou>.985,JSON.stringify(result));assert(!result.markup.includes('<image'));assert.match(result.markup,/fill="#F6C344"/);await page.screenshot({path:'/tmp/logo-star-trace-comparison.png'});console.log(`PASS: source JPEG hash, original asymmetric silhouette versus rendered SVG IoU ${(100*result.iou).toFixed(3)}%, vector path/no embedded raster`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
