// Shared SVG metrics and colors; original survey coordinates remain unchanged.
export function surveyNameBox(name,compact=true){
 const text=String(name||'학생'),characters=Array.from(text),display=characters.length>8?characters.slice(0,7).join('')+'…':text;
 const width=Math.ceil(Array.from(display).reduce((sum,char)=>sum+(/[\x00-\x7f]/.test(char)?(compact?5:5.8):(compact?9:10.5)),0)+(compact?4:6));
 return {text:display,width:Math.max(compact?16:20,width),height:compact?15:20,fontSize:compact?9:10.5};
}
const channel=n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;};
const luminance=rgb=>rgb.map(channel).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export function surveyPointTone(value){
 const y=Math.max(0,Math.min(100,Number(value)||0)),comfortable=y>=50,strength=Math.abs(y-50)/50;
 const from=comfortable?[239,248,241]:[255,239,242],to=comfortable?[45,119,73]:[166,41,61];
 const rgb=from.map((v,i)=>Math.round(v+(to[i]-v)*strength)),dark=comfortable?[20,56,35]:[78,28,38],light=[255,255,255],lum=luminance(rgb);
 const contrast=ink=>(Math.max(lum,luminance(ink))+.05)/(Math.min(lum,luminance(ink))+.05);
 let ink=contrast(dark)>=contrast(light)?dark:light;if(contrast(ink)<4.5)ink=[0,0,0];
 return {background:`rgb(${rgb.join(', ')})`,ink:`rgb(${ink.join(', ')})`,edge:comfortable?'#32724a':'#a23a4d',contrast:contrast(ink),strength};
}
export function surveyQuadrantPosition(point){return {x:52+Math.max(0,Math.min(100,point.x))*3.16,y:368-Math.max(0,Math.min(100,point.y))*3.16};}
export function surveyRelationship(point,reverse){
 if(!point)return reverse?'내 응답 없음':'응답 없음';
 if(!reverse)return '상대방 미응답';
 const near=p=>p.x>=65&&p.y>=50;
 if(point.y<40||reverse.y<40||point.x>=50&&point.y<50||reverse.x>=50&&reverse.y<50)return '갈등·불편 주의';
 if(near(point)&&near(reverse))return '상호 친밀';
 if(near(point)!==near(reverse))return '일방적 호감';
 return '쌍방 응답';
}
export function surveyLabelPositions(points,extraPoints=[]){
 const occupied=[],offsets=[];
 for(let dy=-40;dy<=40;dy++)for(let dx=-40;dx<=40;dx++)offsets.push({x:dx*4,y:dy*4});
 offsets.sort((a,b)=>a.x*a.x+a.y*a.y-(b.x*b.x+b.y*b.y));
 const markers=[...points,...extraPoints].map(surveyQuadrantPosition).map(p=>({left:p.x-5,right:p.x+5,top:p.y-5,bottom:p.y+5}));
 return points.map(point=>{
  const box=surveyNameBox(point.name),position=surveyQuadrantPosition(point),preferredX=position.x+(position.x+box.width+8>368?-1:1)*(box.width/2+8);let best=null;
  const candidates=[...offsets.map(o=>({x:preferredX+o.x,y:position.y+o.y}))];
  for(let y=52+box.height/2+2;y<368-box.height/2;y+=box.height+4)for(let x=52+box.width/2+2;x<368-box.width/2;x+=box.width+4)candidates.push({x,y});
  for(const candidate of candidates){
   const x=Math.max(54+box.width/2,Math.min(366-box.width/2,candidate.x)),y=Math.max(54+box.height/2,Math.min(366-box.height/2,candidate.y)),rect={left:x-box.width/2-1,right:x+box.width/2+1,top:y-box.height/2-1,bottom:y+box.height/2+1};
   const overlap=[...occupied,...markers].reduce((sum,r)=>sum+Math.max(0,Math.min(rect.right,r.right)-Math.max(rect.left,r.left))*Math.max(0,Math.min(rect.bottom,r.bottom)-Math.max(rect.top,r.top)),0);
   const score=overlap*100000+(x-position.x)**2+(y-position.y)**2;
   if(!best||score<best.score)best={x,y,rect,score};
   if(!overlap){best={x,y,rect,score};break;}
  }
  occupied.push(best.rect);return {box,position,x:best.x,y:best.y};
 });
}
