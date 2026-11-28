import * as C from '../core.js';
import {modal} from './modal.js';
import {esc} from '../shared/ui.js';
export function openNoticeBoard(database,date=C.today(),draft=null){
 const notice=draft||C.noticeDraft(database,date),text=draft?C.noticeText(database,notice):notice.renderedText||C.noticeText(database,notice);
 const dialog=modal('알림장 크게 보기',`<div class="notice-board-text">${esc(text)}</div>`);
 dialog.classList.add('notice-board-modal');document.body.classList.add('notice-board-open');
 dialog.addEventListener('close',()=>{dialog.classList.remove('notice-board-modal');document.body.classList.remove('notice-board-open');},{once:true});
}
