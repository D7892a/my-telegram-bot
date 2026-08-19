/**
 * طبقة الربط بقاعدة بيانات Firebase (Firestore + Authentication)
 * ------------------------------------------------------------------
 * الفكرة: DB المحلي يبقى كـ "كاش" سريع ومتزامن، وهذه الطبقة تقوم بـ:
 *   1) سحب البيانات من Firestore عند الإقلاع
 *   2) الاستماع للتغييرات لحظياً (onSnapshot)
 *   3) كتابة أي تعديل محلي إلى Firestore تلقائياً (write-through)
 * إذا تعذّر الاتصال يستمر الموقع بالعمل محلياً (وضع عدم الاتصال).
 */
const Cloud = (() => {
  'use strict';

  const CFG = window.FIREBASE_CONFIG || null;

  const state = {
    enabled: !!(CFG && CFG.projectId && window.firebase),
    online: false,
    seeded: false,
    ready: false,
    error: null,
    project: CFG ? CFG.projectId : null,
    lastSync: null,
    user: null
  };

  let app = null;
  let auth = null;
  let fs = null;
  let readyResolve;
  const readyPromise = new Promise((resolve) => { readyResolve = resolve; });
  const unsubscribers = [];
  const subscribers = new Set();

  /* الربط بين مجموعات Firestore ومصفوفات قاعدة البيانات المحلية */
  const COLLECTIONS = {
    customers: (d) => d.users.customers,
    drivers: (d) => d.users.drivers,
    admins: (d) => d.users.admins,
    rides: (d) => d.rides,
    transactions: (d) => d.transactions,
    notifications: (d) => d.notifications,
    tickets: (d) => d.tickets,
    withdrawals: (d) => d.withdrawals,
    promoCodes: (d) => d.promoCodes,
    pendingRequests: (d) => d.pendingRequests
  };

  const KEY_FIELD = { promoCodes: 'code' };
  const LIVE_COLLECTIONS = ['customers', 'drivers', 'rides', 'pendingRequests', 'notifications', 'tickets', 'withdrawals', 'promoCodes'];
  const CONFIG_DOCS = { settings: 'settings', pricing: 'pricing', support: 'support', stats: 'stats' };

  function log(...args) {
    if (window.CLOUD_DEBUG) console.log('[Cloud]', ...args);
  }

  function keyOf(collection, record) {
    const field = KEY_FIELD[collection] || 'id';
    return String(record?.[field] ?? '');
  }

  /** تنظيف السجل قبل رفعه: بدون كلمات مرور وبدون قيم undefined */
  function sanitize(record) {
    const clean = JSON.parse(JSON.stringify(record ?? {}, (key, value) => {
      if (key === 'password' || key === 'passwordHash') return undefined;
      return value === undefined ? null : value;
    }));
    return clean;
  }

  function notify(reason) {
    state.lastSync = new Date().toISOString();
    subscribers.forEach((fn) => {
      try { fn(reason); } catch (err) { console.warn('Cloud subscriber failed', err); }
    });
  }

  /* ============ الإقلاع ============ */
  function initSdk() {
    if (app) return true;
    if (!CFG || !window.firebase) {
      state.enabled = false;
      state.error = 'firebase-sdk-missing';
      return false;
    }
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG);
    auth = firebase.auth();
    fs = firebase.firestore();
    try {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (_) {}
    try {
      fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch (_) {}
    return true;
  }

  function applyCollection(name, docs, allowEmpty) {
    const data = DB.getData();
    const target = COLLECTIONS[name] ? COLLECTIONS[name](data) : null;
    if (!Array.isArray(target)) return;
    if (!docs.length && !allowEmpty) return;
    target.length = 0;
    docs.forEach((doc) => target.push(doc));
  }

  function applyConfig(name, value) {
    if (!value) return;
    const data = DB.getData();
    if (name === 'settings') data.settings = { ...data.settings, ...value };
    if (name === 'pricing') {
      data.pricing = {
        ...data.pricing,
        ...value,
        perKm: { ...data.pricing.perKm, ...(value.perKm || {}) },
        surgeMultipliers: { ...data.pricing.surgeMultipliers, ...(value.surgeMultipliers || {}) }
      };
    }
    if (name === 'support') data.support = { ...data.support, ...value };
    if (name === 'stats') data.stats = { ...data.stats, ...value };
  }

  async function pullAll() {
    const settingsSnap = await fs.collection('config').doc('settings').get();
    state.seeded = settingsSnap.exists;

    if (!state.seeded) {
      log('القاعدة السحابية غير مهيأة بعد — افتح setup.html');
      return false;
    }

    const configNames = Object.keys(CONFIG_DOCS);
    const configSnaps = await Promise.all(configNames.map((n) => fs.collection('config').doc(n).get()));
    configSnaps.forEach((snap, i) => { if (snap.exists) applyConfig(configNames[i], snap.data()); });

    const names = Object.keys(COLLECTIONS);
    const snaps = await Promise.all(names.map((n) => fs.collection(n).get().catch(() => null)));
    snaps.forEach((snap, i) => {
      if (!snap) return;
      const docs = snap.docs.map((d) => d.data());
      applyCollection(names[i], docs, true);
    });

    DB.persistNow?.();
    notify('pull');
    return true;
  }

  function listen() {
    if (!state.seeded) return;
    unsubscribers.forEach((fn) => { try { fn(); } catch (_) {} });
    unsubscribers.length = 0;

    LIVE_COLLECTIONS.forEach((name) => {
      const un = fs.collection(name).onSnapshot((snap) => {
        if (snap.metadata.hasPendingWrites) return;
        applyCollection(name, snap.docs.map((d) => d.data()), true);
        DB.persistNow?.();
        notify(`live:${name}`);
      }, (err) => console.warn('Cloud listener error', name, err.code || err.message));
      unsubscribers.push(un);
    });

    Object.keys(CONFIG_DOCS).forEach((name) => {
      const un = fs.collection('config').doc(name).onSnapshot((snap) => {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        applyConfig(name, snap.data());
        DB.persistNow?.();
        notify(`live:config.${name}`);
      }, () => {});
      unsubscribers.push(un);
    });
  }

  /* ============ الكتابة ============ */
  function canWrite() {
    return state.online && state.seeded && !!fs;
  }

  function push(collection, record) {
    if (!canWrite() || !record) return Promise.resolve(false);
    const id = keyOf(collection, record);
    if (!id) return Promise.resolve(false);
    return fs.collection(collection).doc(id).set(sanitize(record))
      .then(() => true)
      .catch((err) => { console.warn('Cloud push failed', collection, id, err.code || err.message); return false; });
  }

  function pushMany(collection, records) {
    return Promise.all((records || []).map((r) => push(collection, r)));
  }

  function remove(collection, id) {
    if (!canWrite() || id === undefined || id === null) return Promise.resolve(false);
    return fs.collection(collection).doc(String(id)).delete()
      .then(() => true)
      .catch((err) => { console.warn('Cloud delete failed', collection, id, err.code || err.message); return false; });
  }

  function setConfig(name, value) {
    if (!state.online || !fs) return Promise.resolve(false);
    return fs.collection('config').doc(name).set(sanitize(value), { merge: true })
      .then(() => true)
      .catch((err) => { console.warn('Cloud config failed', name, err.code || err.message); return false; });
  }

  function saveDocumentFile(driverId, kind, fileMeta) {
    if (!canWrite() || !fileMeta?.data) return Promise.resolve(false);
    const size = String(fileMeta.data).length;
    if (size > 900000) {
      console.warn('الملف أكبر من حد مستند Firestore — حُفظ محلياً فقط');
      return Promise.resolve(false);
    }
    return fs.collection('driverDocs').doc(`${driverId}_${kind}`).set({
      driverId,
      kind,
      name: fileMeta.name || '',
      mime: fileMeta.mime || '',
      size: fileMeta.size || size,
      data: fileMeta.data,
      uploadedAt: new Date().toISOString()
    }).then(() => true).catch((err) => {
      console.warn('Cloud doc upload failed', err.code || err.message);
      return false;
    });
  }

  async function fetchDocumentFile(driverId, kind) {
    if (!state.online || !fs) return null;
    try {
      const snap = await fs.collection('driverDocs').doc(`${driverId}_${kind}`).get();
      return snap.exists ? snap.data() : null;
    } catch (_) {
      return null;
    }
  }

  /* ============ ربط دوال DB بالكتابة التلقائية ============ */
  function wrap(name, handler) {
    const original = DB[name];
    if (typeof original !== 'function') return;
    DB[name] = function patched(...args) {
      const result = original.apply(DB, args);
      try {
        if (result && typeof result.then === 'function') {
          return result.then((value) => { try { handler(value, args); } catch (e) { console.warn(e); } return value; });
        }
        handler(result, args);
      } catch (err) {
        console.warn('Cloud write-through failed for', name, err);
      }
      return result;
    };
  }

  function bindWriteThrough() {
    if (DB.__cloudBound) return;
    DB.__cloudBound = true;

    wrap('addCustomer', (r) => push('customers', r));
    wrap('updateCustomer', (r) => push('customers', r));
    wrap('upsertCustomer', (r) => push('customers', r));
    wrap('updateWallet', (r) => push('customers', r));
    wrap('saveAddress', (_r, args) => push('customers', DB.findCustomerById(args[0])));
    wrap('deleteAddress', (_r, args) => push('customers', DB.findCustomerById(args[0])));

    wrap('addDriver', (r) => push('drivers', r));
    wrap('updateDriver', (r) => push('drivers', r));
    wrap('upsertDriver', (r) => push('drivers', r));
    wrap('updateDriverStatus', (r) => push('drivers', r));
    wrap('updateDriverOnline', (r) => push('drivers', r));
    wrap('updateDriverLocation', (r) => push('drivers', r));
    wrap('upsertAdmin', (r) => push('admins', r));

    wrap('addRide', (r) => push('rides', r));
    wrap('updateRide', (r) => push('rides', r));
    wrap('addTransaction', (r) => push('transactions', r));
    wrap('addNotification', (r) => push('notifications', r));
    wrap('markAllNotificationsRead', (r) => pushMany('notifications', r));
    wrap('addTicket', (r) => push('tickets', r));
    wrap('updateTicket', (r) => push('tickets', r));
    wrap('addWithdrawal', (r) => push('withdrawals', r));
    wrap('addPendingRequest', (r) => push('pendingRequests', r));
    wrap('clearPendingRequest', (_r, args) => remove('pendingRequests', args[0]));
    wrap('useCoupon', (_r, args) => {
      const code = String(args[0] || '').toUpperCase();
      const coupon = (DB.getPromoCodes() || []).find((c) => c.code.toUpperCase() === code);
      return push('promoCodes', coupon);
    });

    wrap('updatePricing', (r) => setConfig('pricing', r));
    wrap('updateSettings', (r) => setConfig('settings', r));
    wrap('updateSupport', (r) => setConfig('support', r));

    wrap('saveDriverDocument', (record, args) => {
      const [driverId, kind, fileMeta] = args;
      push('drivers', DB.findDriverById(driverId));
      saveDocumentFile(driverId, kind, fileMeta);
      return record;
    });

    /* عرض المستندات: محلياً أولاً ثم من السحابة */
    const originalGetFile = DB.getDriverDocumentFile;
    DB.getDriverDocumentFile = async (driverId, kind) => {
      const local = await originalGetFile(driverId, kind);
      if (local?.data) return local;
      return fetchDocumentFile(driverId, kind);
    };
  }

  /* ============ حسابات المستخدمين ============ */
  async function getAccount(uid) {
    const snap = await fs.collection('accounts').doc(uid).get();
    return snap.exists ? snap.data() : null;
  }

  async function getProfile(role, refId) {
    const collection = role === 'customer' ? 'customers' : role === 'driver' ? 'drivers' : 'admins';
    const snap = await fs.collection(collection).doc(String(refId)).get();
    return snap.exists ? snap.data() : null;
  }

  async function createAccount(uid, role, refId, extra = {}) {
    await fs.collection('accounts').doc(uid).set({
      uid,
      role,
      refId,
      email: extra.email || '',
      createdAt: new Date().toISOString()
    });
  }

  /* ============ التشغيل ============ */
  async function start(timeoutMs = 12000) {
    if (state.ready) return state;
    if (!initSdk()) {
      state.ready = true;
      readyResolve(state);
      return state;
    }

    try {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        const un = auth.onAuthStateChanged((user) => {
          state.user = user || null;
          clearTimeout(timer);
          un();
          resolve();
        }, () => { clearTimeout(timer); resolve(); });
      });

      auth.onAuthStateChanged((user) => { state.user = user || null; });

      await pullAll();
      state.online = true;
      state.error = null;
      bindWriteThrough();
      listen();
    } catch (err) {
      state.online = false;
      state.error = err?.code || err?.message || 'connection-failed';
      console.warn('[Cloud] تعذر الاتصال بقاعدة البيانات:', state.error);
    }

    state.ready = true;
    readyResolve(state);
    notify('ready');
    return state;
  }

  /** إعادة سحب البيانات بعد تسجيل الدخول (الصلاحيات تتغير) */
  async function refresh() {
    if (!state.enabled || !fs) return false;
    try {
      const ok = await pullAll();
      state.online = true;
      if (ok) {
        bindWriteThrough();
        listen();
      }
      return ok;
    } catch (err) {
      console.warn('[Cloud] refresh failed', err?.code || err?.message);
      return false;
    }
  }

  return {
    get state() { return state; },
    get enabled() { return state.enabled; },
    get online() { return state.online; },
    get seeded() { return state.seeded; },
    auth: () => auth,
    fs: () => fs,
    firebase: () => window.firebase,
    ready: () => readyPromise,
    start,
    refresh,
    push,
    pushMany,
    remove,
    setConfig,
    getAccount,
    getProfile,
    createAccount,
    saveDocumentFile,
    fetchDocumentFile,
    sanitize,
    subscribe: (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); },
    statusText: () => {
      if (!state.enabled) return 'غير مفعّل';
      if (!state.ready) return 'جارِ الاتصال…';
      if (!state.online) return 'غير متصل (وضع محلي)';
      if (!state.seeded) return 'متصل — القاعدة تحتاج تهيئة';
      return 'متصل ومتزامن';
    }
  };
})();

window.Cloud = Cloud;
