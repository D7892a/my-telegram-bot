/**
 * نظام المصادقة وإدارة الحسابات — الناصرية
 */
const Auth = (() => {
  const SESSION_KEY = 'dijla_taxi_session';

  let currentSession = null;

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

      DB.addNotification({
        userId: newUser.id,
        userType: 'customer',
        title: 'أهلاً بك في تكسي دجلة الناصرية! 🎉',
        message: 'احصل على خصم 50% لأول 3 رحلات باستخدام كود WELCOME50',
        type: 'system'
      });

      return { success: true, user: newUser };
    }

    if (role === 'driver') {
      const existing = DB.findDriverByEmail(data.email);
      if (existing) {
        return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      if (!data.carModel || !data.plate || !data.license) {
        return { success: false, message: 'أكمل بيانات السيارة والرخصة' };
      }

      const docs = data.documents || {};
      const uploadedCount = ['id', 'license', 'ownership', 'insurance']
        .filter((k) => docs[k]?.uploaded || docs[k] === true).length;
      if (uploadedCount < 2) {
        return { success: false, message: 'ارفع على الأقل هويتك ورخصة القيادة' };
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
        color: data.color || 'أبيض',
        location: { lat: 31.0452, lng: 46.2561, area: 'مركز الناصرية' },
        documents: {
          id: docs.id || { uploaded: false },
          license: docs.license || { uploaded: false },
          ownership: docs.ownership || { uploaded: false },
          insurance: docs.insurance || { uploaded: false }
        }
      });

      ['id', 'license', 'ownership', 'insurance'].forEach((kind) => {
        const file = docs[kind];
        if (file?.data) {
          DB.saveDriverDocument(newDriver.id, kind, file);
        }
      });

      DB.addNotification({
        userId: 999,
        userType: 'admin',
        title: 'سائق جديد بانتظار الموافقة',
        message: `${data.firstName} ${data.lastName} يطلب الانضمام كسائق في الناصرية`,
        type: 'driver_request'
      });

      return {
        success: true,
        message: 'تم إرسال طلبك! سيتم مراجعته خلال 24 ساعة',
        pending: true,
        user: newDriver
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
