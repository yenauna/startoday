import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture(channel = true) {
  const data = new Map(),
    messages = [],
    channels = new Set(),
    window = new EventTarget();
  let modal = false;
  class Channel {
    constructor() {
      channels.add(this);
    }
    postMessage(message) {
      messages.push(structuredClone(message));
      for (const peer of channels) if (peer !== this) setTimeout(() => peer.onmessage?.({
        data: structuredClone(message)
      }), 0);
    }
    close() {
      channels.delete(this);
    }
  }
  const localStorage = {
    getItem: key => data.get(key) || null,
    setItem: (key, value) => data.set(key, value)
  };
  const context = {
    TABLES: C.TABLES,
    normalizeDB: C.normalizeDB,
    initialDB: C.initialDB,
    applyOps: C.applyOps,
    uid: C.uid,
    now: C.now,
    window,
    localStorage,
    document: {
      querySelector: () => modal ? {} : null
    },
    BroadcastChannel: channel ? Channel : undefined,
    Event,
    CustomEvent: class extends Event {
      constructor(type, options) {
        super(type);
        this.detail = options.detail;
      }
    },
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class Store', 'class Store') + '\nglobalThis.TestStore=Store;', context);
  const stores = [];
  const create = () => {
    const store = new context.TestStore();
    store.mode = 'demo';
    store.classId = 'demo';
    store.db = C.initialDB();
    stores.push(store);
    return store;
  };
  return {
    create,
    data,
    messages,
    window,
    modal: value => modal = value,
    storage(key, value) {
      const event = new Event('storage');
      Object.assign(event, {
        key,
        newValue: value
      });
      window.dispatchEvent(event);
    },
    close() {
      for (const store of stores) {
        store.syncChannel?.close();
        clearTimeout(store.syncTimer);
      }
    }
  };
}
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise(r => setTimeout(r, 5));
  }
  assert(check(), 'sync timeout');
}
test('BroadcastChannel은 저장 완료 후 로컬 창을 갱신하고 기록 원문은 전송하지 않음', async () => {
  const f = fixture();
  try {
    const source = f.create(),
      peer = f.create();
    await source.commit([{
      table: 'students',
      id: 's',
      data: {
        id: 's',
        no: 1,
        name: 'PRIVATE_SOURCE'
      }
    }]);
    await until(() => peer.db.students.length === 1);
    assert.equal(peer.db.students[0].name, 'PRIVATE_SOURCE');
    assert(!JSON.stringify(f.messages).includes('PRIVATE_SOURCE'));
    assert(!JSON.stringify(f.messages).includes('students'));
  } finally {
    f.close();
  }
});
test('BroadcastChannel 미지원 환경도 storage 이벤트로 갱신', async () => {
  const f = fixture(false);
  try {
    const source = f.create(),
      peer = f.create();
    await source.commit([{
      table: 'students',
      id: 's',
      data: {
        id: 's',
        no: 1,
        name: '학생'
      }
    }]);
    f.storage('startoday-demo-v1', f.data.get('startoday-demo-v1'));
    await until(() => peer.db.students.length === 1);
    assert.equal(peer.db.students[0].no, 1);
  } finally {
    f.close();
  }
});
test('클라우드 갱신은 같은 학급 인증 창만 수행하며 중복 알림은 한 번 처리', async () => {
  const f = fixture();
  try {
    const peer = f.create();
    peer.mode = 'cloud';
    peer.classId = 'class-a';
    peer.user = {
      id: 'teacher'
    };
    let calls = 0;
    peer.client = {
      rpc: async () => {
        calls++;
        return {
          data: {
            class_id: 'class-a',
            revision: 1,
            data: C.initialDB()
          }
        };
      }
    };
    const message = {
      kind: 'changed',
      id: 'update',
      source: 'other',
      mode: 'cloud',
      classId: 'class-a',
      revision: 1
    };
    peer.receiveSync({
      ...message,
      id: 'wrong',
      classId: 'class-b'
    });
    peer.receiveSync(message);
    peer.receiveSync(message);
    await until(() => peer.revision === 1);
    assert.equal(calls, 1);
    peer.mode = 'none';
    peer.db = null;
    peer.receiveSync({
      ...message,
      id: 'after-logout',
      revision: 2
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(calls, 1);
    assert.equal(peer.db, null);
  } finally {
    f.close();
  }
});
test('열린 편집 모달에서는 동기화를 보류하고 닫힌 후 갱신', async () => {
  const f = fixture(false);
  try {
    const peer = f.create(),
      next = C.initialDB();
    next.students = [{
      id: 's',
      no: 1,
      name: '학생'
    }];
    f.data.set('startoday-demo-v1', JSON.stringify(next));
    f.modal(true);
    peer.queueSync();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(peer.db.students.length, 0);
    f.modal(false);
    await until(() => peer.db.students.length === 1);
  } finally {
    f.close();
  }
});
test('스냅샷 수신 도중 로그아웃해도 교사 데이터가 다시 채워지지 않음', async () => {
  const f = fixture();
  try {
    const peer = f.create();
    peer.mode = 'cloud';
    peer.classId = 'class-a';
    peer.user = {
      id: 'teacher'
    };
    let resolve,
      started = false;
    peer.client = {
      rpc: () => {
        started = true;
        return new Promise(done => resolve = done);
      }
    };
    peer.receiveSync({
      kind: 'changed',
      id: 'logout-race',
      source: 'other',
      mode: 'cloud',
      classId: 'class-a',
      revision: 1
    });
    await until(() => started);
    peer.mode = 'none';
    peer.user = null;
    peer.db = null;
    resolve({
      data: {
        class_id: 'class-a',
        revision: 1,
        data: C.initialDB()
      }
    });
    await until(() => peer.syncLoading === null);
    assert.equal(peer.db, null);
  } finally {
    f.close();
  }
});
