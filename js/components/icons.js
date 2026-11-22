const paths={
 book:'<path d="M12 6C8 3 4 4 3 5v15c3-2 6-1 9 1 3-2 6-3 9-1V5c-3-2-6-1-9 1Zm0 0v15"/>',
 check:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/>',
 heart:'<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5Z"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
 sprout:'<path d="M12 21V11C6 12 3 8 4 4c6-1 9 3 8 7Zm0 4c6 0 9-4 8-8-5-1-8 3-8 8Z"/>',
 crown:'<path d="m3 7 5 4 4-7 4 7 5-4-2 13H5Z M6 16h12"/>',

 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 records:'<path d="M8 3h10a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Zm0 0v18m4-13h4m-4 4h4m-4 4h3"/>',
 assignments:'<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-5"/>',
 routines:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
 economy:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13v3m-1 7h4v5h-4a2.5 2.5 0 0 1 0-5Z"/>',
 statistics:'<path d="M3 3v18h18M7 16v-4m5 4V7m5 9v-6"/>',
 tools:'<path d="M14 4a6 6 0 0 0-7 7l-4 4a3 3 0 0 0 6 6l4-4a6 6 0 0 0 7-7l-4 4-4-4 4-4Z"/>',
 seats:'<path d="M7 13V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8M5 13h14v5H5zm2 5v3m10-3v3"/>',
 settings:'<path d="M12 3h2l1 3 3 1 3-1 1 3-2 2v3l2 2-1 3-3-1-3 1-1 3h-4l-1-3-3-1-3 1-1-3 2-2v-3L2 9l1-3 3 1 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/>',
close:'<path d="m6 6 12 12M18 6 6 18"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5"/>',export:'<path d="M12 15V3m-4 4 4-4 4 4M4 13v7h16v-7"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',sort:'<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>'};
export function icon(name){if(name==='gold-star')return `<svg class="ui-icon gold-star-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.3 3.4Q12 .4 13.7 3.4l1.8 3.8 4.2.6q3.4.5.9 2.9l-3 2.9.7 4.2q.6 3.4-2.4 1.8L12 17.7l-3.9 1.9q-3 1.6-2.4-1.8l.7-4.2-3-2.9q-2.5-2.4.9-2.9l4.2-.6Z" fill="#F6C344" stroke="#DFA52D" stroke-width=".7"/><path d="m10.3 7.4 1.1-2.3q.6-1.3 1.2 0l.7 1.6" fill="none" stroke="#FFF4CA" stroke-width="1.8" stroke-linecap="round"/></svg>`;return `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.close}</svg>`;}
