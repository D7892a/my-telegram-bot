/**
 * نظام المصادقة وإدارة الحسابات
 * Authentication System
 */

const Auth = (() => {
  const SESSION_KEY = 'dijla_taxi_session';

  let currentSession = null;

  // تحميل الجلسة الحالية
  function loadSession() {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) currentSession = JSON.parse(stored);
    } catch (e) {}
  }

  function saveSession() {
    if (currentSession) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  loadSession();

  function getSession() {
    return currentSession;
  }

  function login(email, password, role) {
    let user = null;

    if (role === 'customer') {
      user = DB.findCustomerByEmail(email);
    } else if (role === 'driver') {
      user = DB.findDriverByEmail(email);
    } else if (role === 'admin') {
      user = DB.findAdminByEmail(email);
    }

    if (!user) {
      return { success: false, message: 'البريد الإلكتروني غير مسجل' };
    }

    if (user.password !== password) {
      return { success: false, message: 'كلمة المرور غير صحيحة' };
    }

    if (role === 'driver' && user.status !== 'approved') {
      return {
        success: false,
        message: 'حسابك قيد المراجعة من قبل الإدارة. سيتم إبلاغك فور الموافقة عليه.'
      };
    }

    currentSession = {
      userId: user.id,
      role,
      loginAt: new Date().toISOString()
    };
    saveSession();

    return { success: true, user, role };
  }

  function logout() {
    currentSession = null;
    saveSession();
  }

  function register(data, role) {
    if (role === 'customer') {
      const existing = DB.findCustomerByEmail(data.email);
      if (existing) {
        return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      const newUser = DB.addCustomer({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password
      });

      // إشعار ترحيب
      DB.addNotification({
        userId: newUser.id,
        userType: 'customer',
        title: 'أهلاً بك في تكسي دجلة! 🎉',
        message: 'احصل على خصم 50% لأول 3 رحلات باستخدام كود WELCOME50',
        type: 'system'
      });

      return { success: true, user: newUser };
    } else if (role === 'driver') {
      const existing = DB.findDriverByEmail(data.email);
      if (existing) {
        return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      const newDriver = DB.addDriver({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        carType: data.carType,
        carModel: data.carModel,
        plate: data.plate,
        license: data.license,
        color: 'أبيض'
      });

      DB.addNotification({
        userId: 999,
        userType: 'admin',
        title: 'سائق جديد بانتظار الموافقة',
        message: `${data.firstName} ${data.lastName} يطلب الانضمام كسائق`,
        type: 'driver_request'
      });

      return {
        success: true,
        message: 'تم إرسال طلبك! سيتم مراجعته خلال 24 ساعة',
        pending: true
      };
    }

    return { success: false, message: 'نوع حساب غير معروف' };
  }

  function quickLogin(role) {
    let credentials;
    if (role === 'customer') {
      credentials = { email: 'ahmed@dijla.iq', password: '123456' };
    } else if (role === 'driver') {
      credentials = { email: 'karim@dijla.iq', password: '123456' };
    } else if (role === 'admin') {
      credentials = { email: 'admin@dijla.iq', password: 'admin' };
    }
    return login(credentials.email, credentials.password, role);
  }

  return {
    login,
    logout,
    register,
    quickLogin,
    getSession
  };
})();

window.Auth = Auth;
