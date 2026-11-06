import * as C from '../core.js';
import { Store } from '../store.js';

// One live state object shared by every tab and component.
export const state = {
  tab: '대시보드',
  date: C.today(),
  selected: [],
  dashMode: 'normal',
  checks: new Set(),
  compact: false,
  calendarMode: 'month',
  calendarDate: C.today(),
  calendarFilters: {
    events: true,
    time: true,
    tasks: true,
    detail: true
  },
  recordFilters: {
    from: C.today(),
    to: C.today(),
    student: '',
    kind: '',
    area: '',
    q: ''
  },
  actions: new Map(),
  actionNo: 0,
  saveNotice: '',
  locked: false,
  dragSlot: null,
  clockTimer: undefined
};
export const store = new Store();

