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
 if(!reverse)return '상대방 미응답';
 const near=p=>p.x>=65&&p.y>=65;
 if(point.y<40&&reverse.y<40||near(point)&&reverse.y<40||near(reverse)&&point.y<40)return '갈등·불편 주의';
 if(near(point)&&near(reverse))return '상호 친밀';
 if(near(point)!==near(reverse))return '일방적 호감';
 return '쌍방 응답';
}
export function surveyLabelPositions(points){
 const occupied=[],offsets=[];
 // Start exactly at the response. Only nearly covered names get a small nudge.
 for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)if(Math.hypot(dx*4,dy*4)<=16)offsets.push({x:dx*4,y:dy*4});
 offsets.sort((a,b)=>a.x*a.x+a.y*a.y-(b.x*b.x+b.y*b.y));
 return points.map(point=>{
  const box=surveyNameBox(point.name),position=surveyQuadrantPosition(point);let best=null;
  for(const offset of offsets){
   const x=Math.max(box.width/2+2,Math.min(418-box.width/2,position.x+offset.x)),y=position.y+offset.y,rect={left:x-box.width/2,right:x+box.width/2,top:y-box.height/2,bottom:y+box.height/2};
   const coverage=occupied.reduce((max,r)=>Math.max(max,Math.max(0,Math.min(rect.right,r.right)-Math.max(rect.left,r.left))*Math.max(0,Math.min(rect.bottom,r.bottom)-Math.max(rect.top,r.top))/Math.min(box.width*box.height,(r.right-r.left)*(r.bottom-r.top))),0);
   const score=coverage*10000+offset.x**2+offset.y**2;
   if(!best||score<best.score)best={x,y,rect,score};
   if(coverage<.92){best={x,y,rect,score};break;}
  }
  occupied.push(best.rect);return {box,position,x:best.x,y:best.y};
 });
}
