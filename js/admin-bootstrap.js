/**
 * التهيئة التلقائية لحساب الإدارة — تكسي دجلة (الناصرية)
 * ------------------------------------------------------------------
 * يقرأ البيانات من js/admin-config.js وعند أول تشغيل للموقع:
 *   1) يفحص مستند config/bootstrap — إذا موجود فالأدمن مُنشأ مسبقاً.
 *   2) إذا غير موجود: ينشئ حساب Firebase Auth بالبريد وكلمة المرور،
 *      ويكتب admins/{uid} + accounts/{uid} + قفل config/bootstrap.
 *   3) يهيّئ مستندات الإعدادات الأساسية (config/settings ...) إذا كانت
 *      القاعدة فارغة حتى يعمل الموقع مباشرة بدون setup.html.
 * كل هذا يحدث بصمت في الخلفية ولا يؤثر على جلسة الزائر الحالي.
 */
const AdminBootstrap = (() => {
  'use strict';

  const TAG = '[AdminBootstrap]';

  async function run() {
    const cfg = window.ADMIN_BOOTSTRAP_CONFIG;
    if (!cfg || !cfg.email || !cfg.password) return false;
    if (String(cfg.password).length < 8) {
      console.warn(TAG, 'كلمة المرور في js/admin-config.js يجب أن تكون 8 أحرف على الأقل');
      return false;
    }
    if (!window.Cloud || !Cloud.enabled) return false;

    await Cloud.ready();
    const mainFs = Cloud.fs();
    if (!Cloud.online || !mainFs) return false;

    /* هل الأدمن مُنشأ مسبقاً؟ (قراءة عامة مسموحة على config) */
    try {
      const boot = await mainFs.collection('config').doc('bootstrap').get();
      if (boot.exists) return true;
    } catch (err) {
      console.warn(TAG, 'تعذر فحص حالة التهيئة:', err?.code || err?.message);
      return false;
    }

    /* تطبيق ثانوي حتى لا نلمس جلسة الزائر في التطبيق الرئيسي */
    const fb = window.firebase;
    const app = fb.apps.find((a) => a.name === 'admin-bootstrap')
      || fb.initializeApp(window.FIREBASE_CONFIG, 'admin-bootstrap');
    const auth = app.auth();
    const fs = app.firestore();

    let uid = null;
    try {
      const cred = await auth.createUserWithEmailAndPassword(cfg.email, cfg.password);
      uid = cred.user.uid;
      console.info(TAG, 'تم إنشاء حساب الإدارة في Firebase Auth:', cfg.email);
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const cred = await auth.signInWithEmailAndPassword(cfg.email, cfg.password);
          uid = cred.user.uid;
        } catch (e2) {
          console.warn(TAG, 'البريد مستخدم مسبقاً وكلمة المرور في الملف لا تطابقه:', e2?.code || e2?.message);
          return false;
        }
      } else {
        console.warn(TAG, 'فشل إنشاء الحساب:', err?.code || err?.message);
        return false;
      }
    }

    try {
      const now = new Date().toISOString();
      const batch = fs.batch();
      batch.set(fs.collection('admins').doc(uid), {
        id: uid, uid, name: cfg.name || 'مدير النظام', email: cfg.email,
        role: 'super_admin', createdAt: now
      });
      batch.set(fs.collection('accounts').doc(uid), {
        uid, role: 'admin', refId: uid, email: cfg.email, createdAt: now
      });
      batch.set(fs.collection('config').doc('bootstrap'), {
        done: true, firstAdmin: uid, auto: true, createdAt: now
      });
      await batch.commit();
      console.info(TAG, 'ملف الأدمن + قفل التهيئة كُتبا بنجاح');

      /* تهيئة الإعدادات الأساسية إذا كانت القاعدة فارغة */
      try {
        const settingsSnap = await fs.collection('config').doc('settings').get();
        if (!settingsSnap.exists && window.DB) {
          const data = DB.getData();
          const strip = (r) => Cloud.sanitize(r);
          await fs.collection('config').doc('settings').set(strip(data.settings), { merge: true });
          await fs.collection('config').doc('pricing').set(strip(data.pricing), { merge: true });
          await fs.collection('config').doc('support').set(strip(data.support), { merge: true });
          await fs.collection('config').doc('stats').set(strip(data.stats), { merge: true });
          console.info(TAG, 'تمت تهيئة إعدادات القاعدة الأساسية');
        }
      } catch (seedErr) {
        console.warn(TAG, 'تعذرت تهيئة الإعدادات الأساسية:', seedErr?.code || seedErr?.message);
      }

      return true;
    } catch (err) {
      console.warn(TAG, 'فشل حفظ ملف الأدمن في Firestore:', err?.code || err?.message);
      return false;
    } finally {
      try { await auth.signOut(); } catch (_) {}
      try { await Cloud.refresh(); } catch (_) {}
    }
  }

  return { run };
})();

window.AdminBootstrap = AdminBootstrap;
