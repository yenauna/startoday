import { TABLES, normalizeDB, initialDB, applyOps, uid, now, assignmentPolicyOps, areaMigrationOps } from './core.js';
export class Store {
  constructor() {
    this.db = null;
    this.client = null;
    this.user = null;
    this.classId = null;
    this.revision = 0;
    this.mode = 'none';
    this.busy = false;
    this.initSync();
  }
  // Only invalidations cross windows. Never broadcast teacher operations or snapshots.
  initSync() {
    this.syncSource = uid();
    this.syncSeen = new Set();
    this.syncDirty = false;
    if (typeof window === 'undefined') return;
    try {
      if (typeof BroadcastChannel === 'function') {
        this.syncChannel = new BroadcastChannel('startoday_sync');
        this.syncChannel.onmessage = event => this.receiveSync(event.data);
      }
    } catch {}
    window.addEventListener('storage', event => {
      if (event.key === 'startoday-sync') {
        try {
          this.receiveSync(JSON.parse(event.newValue));
        } catch {}
      }
      if (event.key === 'startoday-demo-v1' && ['demo', 'local'].includes(this.mode) && this.db) this.queueSync();
    });
  }
  publishSync() {
    if (!this.db || !['cloud', 'demo', 'local'].includes(this.mode)) return;
    this.signalChange(this.mode, this.classId, this.revision);
  }
  signalChange(mode, classId, revision) {
    const message = {
      kind: 'changed',
      id: uid(),
      source: this.syncSource,
      mode,
      classId,
      revision: Number(revision)
    };
    try {
      this.syncChannel?.postMessage(message);
    } catch {}
    try {
      localStorage.setItem('startoday-sync', JSON.stringify(message));
    } catch {}
  }
  receiveSync(message) {
    if (!message || message.kind !== 'changed' || message.source === this.syncSource || typeof message.id !== 'string' || message.id.length > 128 || this.syncSeen.has(message.id)) return;
    const local = ['demo', 'local'].includes(this.mode);
    if (!this.db || !(local && ['demo', 'local'].includes(message.mode) || this.mode === 'cloud' && message.mode === 'cloud' && this.user?.id && this.classId === message.classId && Number.isFinite(message.revision) && message.revision > Number(this.revision))) return;
    this.syncSeen.add(message.id);
    if (this.syncSeen.size > 100) this.syncSeen.delete(this.syncSeen.values().next().value);
    this.queueSync();
  }
  queueSync() {
    this.syncDirty = true;
    if (!this.syncTimer && !this.syncLoading) this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.flushSync();
    }, 0);
  }
  async flushSync() {
    if (!this.syncDirty || this.syncLoading) return;
    if (!this.db || !['cloud', 'demo', 'local'].includes(this.mode)) {
      this.syncDirty = false;
      return;
    }
    // Do not silently advance a modal editor's revision while it holds old form data.
    if (this.busy || typeof document !== 'undefined' && document.querySelector?.('dialog[open]')) {
      this.syncTimer = setTimeout(() => {
        this.syncTimer = null;
        this.flushSync();
      }, 100);
      return;
    }
    this.syncDirty = false;
    const scope = `${this.mode}:${this.classId}:${this.user?.id || ''}`;
    if (['demo', 'local'].includes(this.mode)) {
      try {
        const raw = localStorage.getItem('startoday-demo-v1');
        if (!raw) return;
        const next = normalizeDB(JSON.parse(raw));
        if (JSON.stringify(next) === JSON.stringify(this.db)) return;
        this.db = next;
        window.dispatchEvent(new Event('startoday-sync'));
      } catch {}
      return;
    }
    if (this.mode !== 'cloud' || !this.user?.id || !this.client) return;
    this.syncLoading = (async () => {
      try {
        const {
          data,
          error
        } = await this.client.rpc('startoday_snapshot');
        if (error) throw error;
        if (scope !== `${this.mode}:${this.classId}:${this.user?.id || ''}` || data.class_id !== this.classId || Number(data.revision) < Number(this.revision)) return;
        this.db = normalizeDB(data.data);
        this.revision = data.revision;
        window.dispatchEvent(new Event('startoday-sync'));
      } catch (error) {
        window.dispatchEvent(new CustomEvent('startoday-error', {
          detail: '다른 창의 변경을 불러오지 못했습니다. ' + error.message
        }));
      }
    })();
    await this.syncLoading;
    this.syncLoading = null;
    if (this.syncDirty) this.queueSync();
  }
  async connect() {
    const c = window.STARTODAY_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseKey) return false;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl)) throw Error('config.js의 Supabase 프로젝트 주소를 확인하세요.');
    await new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.min.js';
      el.onload = resolve;
      el.onerror = () => reject(Error('Supabase SDK를 불러오지 못했습니다. 네트워크를 확인하세요.'));
      document.head.append(el);
    });
    this.client = window.supabase.createClient(c.supabaseUrl, c.supabaseKey);
    const {
      data,
      error
    } = await this.client.auth.getSession();
    if (error) throw error;
    this.user = data.session?.user || null;
    if (this.user) {
      this.mode = 'cloud';
      await this.load();
    }
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.user = null;
        this.db = null;
        this.mode = 'none';
        window.dispatchEvent(new Event('startoday-auth'));
      }
      if (event === 'SIGNED_IN' && session?.user.id !== this.user?.id) {
        this.user = session.user;
        setTimeout(async () => {
          try {
            this.mode = 'cloud';
            await this.load();
            window.dispatchEvent(new Event('startoday-auth'));
          } catch (e) {
            window.dispatchEvent(new CustomEvent('startoday-error', {
              detail: e.message
            }));
          }
        }, 0);
      }
    });
    return true;
  }
  async login() {
    const {
      error
    } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname
      }
    });
    if (error) throw error;
  }
  async logout() {
    if (this.busy) throw Error('저장 완료 후 로그아웃하세요.');
    if (this.mode === 'cloud') {
      const {
        error
      } = await this.client.auth.signOut();
      if (error) throw error;
    }
    this.db = null;
    this.user = null;
    this.mode = 'none';
  }
  demo() {
    this.mode = 'demo';
    this.classId = 'demo';
    try {
      this.db = JSON.parse(localStorage.getItem('startoday-demo-v1'));
    } catch {}
    const created = !this.db;
    if (!this.db) {
      this.db = initialDB();
      this.db.students = Array.from({
        length: 20
      }, (_, i) => ({
        id: uid(),
        no: i + 1,
        name: ['가온', '나래', '다온', '라온', '마루', '바다', '새봄', '아람', '여름', '지우'][i % 10] + (i < 10 ? '' : '별'),
        group: String(i % 5 + 1),
        seat: {
          row: Math.floor(i / 5),
          col: i % 5
        },
        academicYear: 2026,
        createdAt: now()
      }));
    }
    const config = this.db.settings[0];
    if (config) Object.assign(config, {
      schoolName: config.schoolName || '체험초등학교',
      grade: config.grade || 5,
      classGroup: config.classGroup || '1',
      defaultStudentPassword: config.defaultStudentPassword || '바람123'
    });
    const areaMigration = areaMigrationOps(this.db);
    normalizeDB(this.db);
    const policy = assignmentPolicyOps(this.db);
    if (policy.length) this.db = applyOps(this.db, policy);
    if (created || policy.length || areaMigration.length) {
      try {
        localStorage.setItem('startoday-demo-v1', JSON.stringify(this.db));
        this.publishSync();
      } catch {}
    }
    return this.db;
  }
  async load() {
    const {
      data,
      error
    } = await this.client.rpc('startoday_snapshot');
    if (error) throw error;
    this.classId = data.class_id;
    this.revision = data.revision;
    const seedAreas = Array.isArray(data.data.areas) && data.data.areas.length === 0;
    const areaMigration = areaMigrationOps(data.data);
    this.db = normalizeDB(data.data);
    if (!this.db.settings.length) {
      const seed = initialDB();
      await this.commit(TABLES.flatMap(t => seed[t].map(row => ({
        table: t,
        id: row.id,
        data: row
      }))));
    } else if (seedAreas) {
      await this.commit(this.db.areas.map(row => ({
        table: 'areas',
        id: row.id,
        data: row
      })));
    }
    if (areaMigration.length && !this.busy) await this.commit(areaMigration);
    const policy = assignmentPolicyOps(this.db);
    if (policy.length && !this.busy) await this.commit(policy);
    return this.db;
  }
  async commit(ops) {
    if (this.syncLoading) await this.syncLoading;
    if (this.busy) throw Error('저장 중입니다. 잠시 후 다시 시도하세요.');
    this.busy = true;
    try {
      const next = applyOps(this.db, ops);
      if (this.mode === 'demo' || this.mode === 'local') {
        localStorage.setItem('startoday-demo-v1', JSON.stringify(next));
        this.db = next;
        this.publishSync();
        return;
      }
      if (this.mode !== 'cloud') throw Error('로그인이 필요합니다.');
      const {
        data,
        error
      } = await this.client.rpc('startoday_commit', {
        p_class_id: this.classId,
        p_revision: this.revision,
        p_ops: ops
      });
      if (error) {
        if (ops.some(op => op.table === 'areas') && error.message.includes('INVALID_TABLE_OR_ID')) {
          throw Error('경험치 종류를 저장하려면 Supabase SQL Editor에서 최신 schema.sql을 먼저 실행하세요.');
        }
        if (error.message.includes('REVISION_CONFLICT')) {
          await this.load();
          throw Error('다른 기기에서 변경했습니다. 최신 자료를 불러왔습니다. 내용을 확인한 뒤 다시 저장하세요.');
        }
        throw error;
      }
      this.revision = data;
      this.db = next;
      this.publishSync();
    } catch (e) {
      throw Error(e.message || '저장에 실패했습니다.');
    } finally {
      this.busy = false;
    }
  }
  async cloudBackup() {
    if (this.mode !== 'cloud') throw Error('구글 로그인 후 사용할 수 있습니다.');
    const {
      error
    } = await this.client.rpc('startoday_backup', {
      p_class_id: this.classId
    });
    if (error) throw error;
  }
}
