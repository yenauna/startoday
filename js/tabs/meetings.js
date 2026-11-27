import * as C from '../core.js';
import {render} from '../app.js';
import {store} from '../shared/state.js';
import {meetingView,meetingMessage} from '../components/meeting-view.js';
export function meetingsView(){const data=store.mode==='cloud'?store.db.meeting:C.meetingSnapshot(store.db,null,true);return meetingView(data,async(action,payload,background=false)=>{try{await store.meetingAction(action,payload);if(!background||!document.querySelector('#modal[open]'))render();}catch(error){throw Error(meetingMessage(error));}},render,store.mode+':'+store.classId);}
