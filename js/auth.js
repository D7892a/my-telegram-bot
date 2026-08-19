/**
 * نظام المصادقة — Firebase Authentication (كلمات مرور حقيقية مشفّرة عند Google)
 * ------------------------------------------------------------------------
 * • الدخول/التسجيل يمر عبر Firebase Auth ولا تُخزَّن أي كلمة مرور في المتصفح.
 * • هوية الحساب ودوره يُقرأان من مجموعة accounts/{uid} في Firestore.
 * • حساب الأدمن لا يعمل إطلاقاً بدون اتصال حقيقي بقاعدة البيانات.
 */
const Auth = (() => {
  'use strict';

  const SESSION_KEY = 'dijla_taxi_session';
  let currentSession = null;

  function loadSession() {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) currentSession = JSON.parse(stored);
    } catch (e) {}
  }

  function saveSession() {
    if (currentSession) localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
    else localStorage.removeItem(SESSION_KEY);
  }

  loadSession();

  const cloudUp = () => !!(window.Cloud && Cloud.enabled && Cloud.online);

  const AUTH_ERRORS = {
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
    'auth/user-disabled': 'هذا الحساب موقوف من الإدارة',
    'auth/user-not-found': 'البريد الإلكتروني غير مسجل',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/invalid-login-credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة خاطئة، حاول بعد قليل',
    'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
    'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
    'auth/network-request-failed': 'تعذر الاتصال بالإنترنت',
    'auth/requires-recent-login': 'سجّل الخروج وادخل من جديد ثم أعد المحاولة',
    'auth/operation-not-allowed': 'فعّل طريقة الدخول Email/Password من لوحة Firebase'
  };

  function errorMessage(err) {
    return AUTH_ERRORS[err?.code] || err?.message || 'تعذر إتمام العملية';
  }

  function getSession() {
    return currentSession;
  }

  function setSession(session) {
    currentSession = session;
    saveSession();
    return session;
  }

  /* ================= الدخول ================= */
  async function login(email, password, roleHint) {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail || !password) {
      return { success: false, message: 'أدخل البريد الإلكتروني وكلمة المرور' };
    }

    if (cloudUp()) return cloudLogin(cleanEmail, password);
    return localLogin(cleanEmail, password, roleHint);
  }

  async function cloudLogin(email, password) {
    const auth = Cloud.auth();
    let cred;
    try {
      cred = await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }

    const uid = cred.user.uid;
    try {
      let account = await Cloud.getAccount(uid);

      if (!account) {
        const adminSnap = await Cloud.fs().collection('admins').doc(uid).get();
        if (adminSnap.exists) account = { role: 'admin', refId: uid };
      }

      if (!account) {
        await auth.signOut();
        return { success: false, message: 'لا يوجد ملف حساب مرتبط بهذا البريد في قاعدة البيانات' };
      }

      const profile = await Cloud.getProfile(account.role, account.refId);
      if (!profile) {
        await auth.signOut();
        return { success: false, message: 'ملف الحساب غير مكتمل، راجع الإدارة' };
      }

      if (account.role === 'driver' && profile.status !== 'approved') {
        await auth.signOut();
        return {
          success: false,
          message: profile.status === 'rejected'
            ? 'تم رفض طلبك للانضمام كسائق. راجع الإدارة.'
            : 'حسابك قيد المراجعة من قبل الإدارة. سيتم إبلاغك فور الموافقة عليه.'
        };
      }

      cacheProfile(account.role, profile);
      await Cloud.refresh();

      setSession({
        userId: account.role === 'admin' ? String(profile.id) : profile.id,
        role: account.role,
        uid,
        email,
        loginAt: new Date().toISOString()
      });

      return { success: true, user: profile, role: account.role };
    } catch (err) {
      try { await auth.signOut(); } catch (_) {}
      return { success: false, message: errorMessage(err) };
    }
  }

  function cacheProfile(role, profile) {
    if (role === 'customer') DB.upsertCustomer(profile);
    else if (role === 'driver') DB.upsertDriver(profile);
    else DB.upsertAdmin(profile);
  }

  /** دخول محلي احتياطي (بدون إنترنت) — للزبون والسائق والأدمن المحلي */
  function localLogin(email, password, role) {
    let user = DB.findAdminByEmail(email) || DB.findCustomerByEmail(email) || DB.findDriverByEmail(email);
    const resolvedRole = user ? (DB.findAdminByEmail(email) ? 'admin' : DB.findCustomerByEmail(email) ? 'customer' : 'driver') : null;
    if (!user) return { success: false, message: 'البريد الإلكتروني غير مسجل' };
    if (!user.password || user.password !== password) {
      return { success: false, message: 'كلمة المرور غير صحيحة (أو الحساب سحابي ويحتاج اتصال)' };
    }
    if (resolvedRole === 'driver' && user.status !== 'approved') {
      return { success: false, message: 'حسابك قيد المراجعة من قبل الإدارة.' };
    }

    setSession({ userId: user.id, role: resolvedRole, offline: true, loginAt: new Date().toISOString() });
    return { success: true, user, role: resolvedRole };
  }

  /* ================= إنشاء الحسابات ================= */
  async function register(data, role) {
    const email = String(data.email || '').trim();
    const password = String(data.password || '');

    if (role === 'driver' && (!data.carModel || !data.plate || !data.license)) {
      return { success: false, message: 'أكمل بيانات السيارة والرخصة' };
    }
    if (role === 'driver') {
      const docs = data.documents || {};
      const uploaded = ['id', 'license', 'ownership', 'insurance']
        .filter((k) => docs[k]?.uploaded || docs[k] === true).length;
      if (uploaded < 2) return { success: false, message: 'ارفع على الأقل هويتك ورخصة القيادة' };
    }
    if (password.length < 6) return { success: false, message: 'كلمة المرور 6 أحرف على الأقل' };

    if (!cloudUp()) {
      return {
        success: false,
        message: 'تعذر الاتصال بقاعدة البيانات. تأكد من الإنترنت ثم أعد المحاولة.'
      };
    }

    const auth = Cloud.auth();
    let cred;
    try {
      cred = await auth.createUserWithEmailAndPassword(email, password);
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }

    const uid = cred.user.uid;

    try {
      if (role === 'customer') {
        const profile = DB.addCustomer({
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phone: data.phone,
          uid
        });
        delete profile.password;
        await Cloud.push('customers', profile);
        await Cloud.createAccount(uid, 'customer', profile.id, { email });

        DB.addNotification({
          userId: profile.id,
          userType: 'customer',
          title: 'أهلاً بك في تكسي دجلة الناصرية! 🎉',
          message: `احصل على خصم لأول رحلاتك باستخدام كود ${DB.getSettings().welcomeCode || 'WELCOME50'}`,
          type: 'system'
        });

        await auth.signOut();
        return { success: true, user: profile };
      }

      const docs = data.documents || {};
      const profile = DB.addDriver({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        phone: data.phone,
        uid,
        carType: data.carType,
        carModel: data.carModel,
        plate: data.plate,
        license: data.license,
        color: data.color || 'أبيض',
        location: { lat: 31.0452, lng: 46.2561, area: 'مركز الناصرية' },
        documents: {
          id: docs.id || { uploaded: false },
          license: docs.license || { uploaded: false },
          ownership: docs.ownership || { uploaded: false },
          insurance: docs.insurance || { uploaded: false }
        }
      });
      delete profile.password;
      await Cloud.push('drivers', profile);
      await Cloud.createAccount(uid, 'driver', profile.id, { email });

      for (const kind of ['id', 'license', 'ownership', 'insurance']) {
        const file = docs[kind];
        if (file?.data) await DB.saveDriverDocument(profile.id, kind, file);
      }

      DB.addNotification({
        userId: 'all',
        userType: 'admin',
        title: 'سائق جديد بانتظار الموافقة',
        message: `${data.firstName} ${data.lastName} يطلب الانضمام كسائق في الناصرية`,
        type: 'driver_request'
      });

      await auth.signOut();
      return {
        success: true,
        pending: true,
        message: 'تم إرسال طلبك إلى الإدارة! سيتم مراجعته والرد عليك.',
        user: profile
      };
    } catch (err) {
      console.warn('register profile failed', err);
      try { await cred.user.delete(); } catch (_) { try { await auth.signOut(); } catch (__) {} }
      return { success: false, message: 'تعذر حفظ بياناتك في قاعدة البيانات: ' + errorMessage(err) };
    }
  }

  /* ================= إدارة كلمة المرور ================= */
  async function sendReset(email) {
    if (!cloudUp()) return { success: false, message: 'يتطلب اتصالاً بقاعدة البيانات' };
    try {
      await Cloud.auth().sendPasswordResetEmail(String(email || '').trim());
      return { success: true, message: 'أُرسل رابط إعادة تعيين كلمة المرور إلى بريدك' };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }

  async function changePassword(currentPassword, newPassword) {
    if (!cloudUp()) return { success: false, message: 'يتطلب اتصالاً بقاعدة البيانات' };
    const user = Cloud.auth().currentUser;
    if (!user) return { success: false, message: 'سجّل الدخول أولاً' };
    if (String(newPassword || '').length < 8) {
      return { success: false, message: 'كلمة المرور الجديدة 8 أحرف على الأقل' };
    }
    try {
      const credential = Cloud.firebase().auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }

  /* ================= الجلسة ================= */
  async function restore() {
    if (!window.Cloud || !Cloud.enabled) return currentSession;
    await Cloud.ready();

    const user = Cloud.auth()?.currentUser;
    if (!user) {
      if (currentSession && !currentSession.offline) setSession(null);
      return currentSession;
    }

    try {
      let account = await Cloud.getAccount(user.uid);
      if (!account) {
        const adminSnap = await Cloud.fs().collection('admins').doc(user.uid).get();
        if (adminSnap.exists) account = { role: 'admin', refId: user.uid };
      }
      if (!account) { setSession(null); return null; }

      const profile = await Cloud.getProfile(account.role, account.refId);
      if (!profile) { setSession(null); return null; }
      if (account.role === 'driver' && profile.status !== 'approved') {
        await Cloud.auth().signOut();
        setSession(null);
        return null;
      }

      cacheProfile(account.role, profile);
      await Cloud.refresh();

      return setSession({
        userId: account.role === 'admin' ? String(profile.id) : profile.id,
        role: account.role,
        uid: user.uid,
        email: user.email,
        loginAt: currentSession?.loginAt || new Date().toISOString()
      });
    } catch (err) {
      console.warn('restore session failed', err?.code || err?.message);
      return currentSession;
    }
  }

  async function logout() {
    try {
      if (window.Cloud?.enabled && Cloud.auth()) await Cloud.auth().signOut();
    } catch (_) {}
    setSession(null);
  }

  async function quickLogin(role) {
    const demo = {
      customer: { email: 'ahmed@dijla.iq', password: '123456' },
      driver: { email: 'karim@dijla.iq', password: '123456' }
    }[role];
    if (!demo) return { success: false, message: 'حساب الإدارة لا يملك دخولاً تجريبياً' };
    return login(demo.email, demo.password, role);
  }

  return {
    login,
    logout,
    register,
    quickLogin,
    getSession,
    restore,
    sendReset,
    changePassword,
    isCloud: cloudUp
  };
})();

window.Auth = Auth;
