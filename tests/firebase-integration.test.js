/**
 * اختبار تكامل محلي: يحاكي Firebase (Auth + Firestore) في الذاكرة
 * ويشغّل ملفات الموقع الحقيقية للتأكد من صحة الربط.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('/tmp/node_modules/jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:8000/' });
const { window } = dom;

/* ---------- تخزين محلي بسيط ---------- */
const store = new Map();
window.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
window.indexedDB = undefined;
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });

/* ---------- Firebase وهمي في الذاكرة ---------- */
const db = new Map();          // "collection/doc" -> data
const users = new Map();       // email -> { uid, password }
let uidSeq = 0;
let currentUser = null;
const authListeners = [];

const clone = (v) => JSON.parse(JSON.stringify(v));
const err = (code) => Object.assign(new Error(code), { code });

function docRef(col, id) {
  const key = `${col}/${id}`;
  return {
    id,
    get: async () => ({ exists: db.has(key), data: () => clone(db.get(key)), id, metadata: {} }),
    set: async (value, options) => {
      const merged = options?.merge && db.has(key) ? { ...db.get(key), ...clone(value) } : clone(value);
      db.set(key, merged);
    },
    delete: async () => { db.delete(key); },
    onSnapshot: (cb) => { cb({ exists: db.has(key), data: () => clone(db.get(key)), metadata: { hasPendingWrites: false } }); return () => {}; }
  };
}

function colRef(col) {
  return {
    doc: (id) => docRef(col, id),
    get: async () => {
      const docs = [...db.entries()].filter(([k]) => k.startsWith(col + '/'))
        .map(([k, v]) => ({ id: k.split('/')[1], data: () => clone(v) }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
    onSnapshot: (cb) => {
      const docs = [...db.entries()].filter(([k]) => k.startsWith(col + '/'))
        .map(([k, v]) => ({ id: k.split('/')[1], data: () => clone(v) }));
      cb({ docs, metadata: { hasPendingWrites: false } });
      return () => {};
    }
  };
}

const firestore = () => ({
  collection: colRef,
  enablePersistence: async () => {},
  batch: () => {
    const ops = [];
    return {
      set: (ref, value, options) => ops.push(() => ref.set(value, options)),
      commit: async () => { for (const op of ops) await op(); }
    };
  }
});

function fireAuthChange() {
  authListeners.forEach((fn) => fn(currentUser));
}

const auth = () => ({
  get currentUser() { return currentUser; },
  setPersistence: async () => {},
  onAuthStateChanged: (cb) => { authListeners.push(cb); setTimeout(() => cb(currentUser), 0); return () => {}; },
  createUserWithEmailAndPassword: async (email, password) => {
    if (users.has(email)) throw err('auth/email-already-in-use');
    if (String(password).length < 6) throw err('auth/weak-password');
    const uid = 'uid_' + (++uidSeq);
    users.set(email, { uid, password });
    currentUser = { uid, email, delete: async () => { users.delete(email); currentUser = null; } };
    fireAuthChange();
    return { user: currentUser };
  },
  signInWithEmailAndPassword: async (email, password) => {
    const rec = users.get(email);
    if (!rec) throw err('auth/user-not-found');
    if (rec.password !== password) throw err('auth/wrong-password');
    currentUser = { uid: rec.uid, email };
    fireAuthChange();
    return { user: currentUser };
  },
  signOut: async () => { currentUser = null; fireAuthChange(); },
  sendPasswordResetEmail: async () => {}
});

window.firebase = {
  apps: [],
  initializeApp(config, name) { const app = { name: name || '[DEFAULT]', options: config }; this.apps.push(app); return app; },
  app() { return this.apps[0]; },
  auth: Object.assign(auth, { Auth: { Persistence: { LOCAL: 'local' } }, EmailAuthProvider: { credential: (e, p) => ({ e, p }) } }),
  firestore
};

/* ---------- تحميل ملفات الموقع ---------- */
const load = (file) => {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, dom.getInternalVMContext(), { filename: file });
};

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

(async () => {
  load('js/firebase-config.js');
  load('js/db.js');
  load('js/cloud.js');
  load('js/auth.js');
  load('js/maps.js');
  load('js/app.js');
  load('js/main.js');

  const { DB, Cloud, Auth } = window;

  /* 1) قاعدة فارغة: الموقع يعمل ولا يوجد أدمن وهمي */
  await new Promise((r) => setTimeout(r, 200));
  await Cloud.ready();
  check('يعمل بدون تهيئة (وضع محلي)', Cloud.enabled && !Cloud.seeded, Cloud.statusText());
  check('لا يوجد أدمن بكلمة سر وهمية', DB.getData().users.admins.length === 0);

  const fake = await Auth.login('admin@dijla.iq', 'admin', 'admin');
  check('رفض دخول admin/admin القديم', fake.success === false, fake.message);

  /* 2) تهيئة القاعدة كما تفعل setup.html */
  const snap = DB.snapshot();
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'password' ? undefined : v)));
  db.set('config/settings', strip(snap.settings));
  db.set('config/pricing', strip(snap.pricing));
  db.set('config/support', strip(snap.support));
  db.set('config/stats', strip(snap.stats));
  snap.users.customers.forEach((c) => db.set('customers/' + c.id, strip(c)));
  snap.users.drivers.forEach((d) => db.set('drivers/' + d.id, strip(d)));
  snap.rides.forEach((r) => db.set('rides/' + r.id, strip(r)));
  snap.promoCodes.forEach((p) => db.set('promoCodes/' + p.code, strip(p)));

  // إنشاء أدمن حقيقي
  const adminEmail = 'boss@dijla.iq';
  const cred = await window.firebase.auth().createUserWithEmailAndPassword(adminEmail, 'StrongPass#2026');
  db.set('admins/' + cred.user.uid, { id: cred.user.uid, uid: cred.user.uid, name: 'مدير النظام', email: adminEmail, role: 'super_admin' });
  db.set('accounts/' + cred.user.uid, { uid: cred.user.uid, role: 'admin', refId: cred.user.uid, email: adminEmail });
  db.set('config/bootstrap', { done: true });
  await window.firebase.auth().signOut();

  const ok = await Cloud.refresh();
  check('سحب البيانات من Firestore بعد التهيئة', ok === true && Cloud.seeded, `عدد الرحلات: ${DB.getRides().length}`);

  /* 3) دخول الأدمن بكلمة السر الحقيقية */
  const bad = await Auth.login(adminEmail, 'wrong-pass');
  check('رفض كلمة مرور خاطئة للأدمن', bad.success === false, bad.message);

  const good = await Auth.login(adminEmail, 'StrongPass#2026');
  check('دخول الأدمن بكلمة سر حقيقية', good.success === true && good.role === 'admin', good.message || '');
  check('الجلسة تعرف الأدمن', Auth.getSession()?.role === 'admin' && !!DB.findAdminById(Auth.getSession().userId));

  /* 4) تعديل معلومات الدعم من الإدارة → تُكتب في Firestore */
  DB.updateSupport({ phone: '+964 781 555 0000', email: 'help@dijla.iq', whatsapp: '+964 781 555 0000' });
  await new Promise((r) => setTimeout(r, 60));
  const supportDoc = db.get('config/support');
  check('حفظ رقم/إيميل الدعم في قاعدة البيانات', supportDoc.phone === '+964 781 555 0000' && supportDoc.email === 'help@dijla.iq', JSON.stringify({ phone: supportDoc.phone, email: supportDoc.email }));

  window.App.applySupportInfo();
  const footerPhone = window.document.querySelector('[data-support="phone"][data-support-as="tel"]');
  check('ظهور رقم الدعم في الموقع تلقائياً', footerPhone?.textContent === '+964 781 555 0000' && footerPhone?.getAttribute('href') === 'tel:+9647815550000', footerPhone?.getAttribute('href') || '');

  /* 5) تسجيل زبون جديد حقيقي */
  await Auth.logout();
  const reg = await Auth.register({
    firstName: 'زينب', lastName: 'كريم', email: 'zainab@test.iq',
    phone: '0771 000 1111', password: 'Zainab#2026'
  }, 'customer');
  check('تسجيل زبون جديد في Firebase', reg.success === true, reg.message || '');
  const newDoc = [...db.entries()].find(([k, v]) => k.startsWith('customers/') && v.email === 'zainab@test.iq');
  check('ملف الزبون محفوظ في Firestore', !!newDoc);
  check('لا تُخزَّن كلمة المرور في قاعدة البيانات', newDoc && !('password' in newDoc[1]));
  const accountDoc = [...db.entries()].find(([k, v]) => k.startsWith('accounts/') && v.email === 'zainab@test.iq');
  check('ربط الحساب بالدور (accounts)', !!accountDoc && accountDoc[1].role === 'customer');

  const login2 = await Auth.login('zainab@test.iq', 'Zainab#2026');
  check('الزبون الجديد يدخل بكلمة مروره', login2.success === true, login2.message || '');

  /* 6) تذكرة دعم من زائر + رحلة */
  DB.addTicket({ name: 'زائر', email: 'v@x.iq', subject: 'استفسار', message: 'وين وصلت رحلتي؟' });
  await new Promise((r) => setTimeout(r, 60));
  check('حفظ تذاكر الدعم في Firestore', [...db.keys()].some((k) => k.startsWith('tickets/')));

  DB.addRide({ customerId: 1, driverId: 101, customer: 'أحمد', driver: 'كريم', from: 'الحبوبي', to: 'الصالحية', fare: 6500, status: 'active', type: 'economy', distance: 3.2 });
  await new Promise((r) => setTimeout(r, 60));
  check('حفظ الرحلات الجديدة في Firestore', [...db.keys()].filter((k) => k.startsWith('rides/')).length === snap.rides.length + 1);

  /* 7) اعتماد سائق من الإدارة */
  const pendingDriver = DB.getDrivers().find((d) => d.status !== 'approved');
  if (pendingDriver) {
    DB.updateDriverStatus(pendingDriver.id, 'approved');
    await new Promise((r) => setTimeout(r, 60));
    check('اعتماد السائق ينعكس على القاعدة', db.get('drivers/' + pendingDriver.id).status === 'approved');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nنتيجة: ${results.length - failed.length}/${results.length} ناجحة`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('حدث خطأ:', e); process.exit(1); });
