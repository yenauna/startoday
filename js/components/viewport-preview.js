// Temporary teacher-only layout inspection. The preference is session-local.
export const MOBILE_VIEWPORT='width=device-width,initial-scale=1';
export function previewViewportContent(active,original=MOBILE_VIEWPORT){return active?'width=1280':original;}
let requested=false,teacherAllowed=false,originalViewport=null;
try{requested=sessionStorage.getItem('startoday-pc-preview')==='true';}catch{}
export function pcPreviewActive(){return requested&&teacherAllowed;}
export function syncViewportPreview(allowed){
 teacherAllowed=!!allowed;
 const meta=document.querySelector('meta[name="viewport"]');if(!meta)return;
 originalViewport??=meta.getAttribute('content')||MOBILE_VIEWPORT;
 const content=previewViewportContent(pcPreviewActive(),originalViewport);
 if(meta.getAttribute('content')!==content)meta.setAttribute('content',content);
 document.documentElement.classList.toggle('pc-viewport-preview',pcPreviewActive());
}
export function togglePcPreview(){
 requested=!requested;try{sessionStorage.setItem('startoday-pc-preview',String(requested));}catch{}
 syncViewportPreview(teacherAllowed);
}
