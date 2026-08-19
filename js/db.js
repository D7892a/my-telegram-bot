/**
 * طبقة قاعدة البيانات
 * Database Layer
 * يستخدم localStorage كقاعدة بيانات دائمة
 * Provides persistent data storage with full CRUD operations
 */

const DB = (() => {
  const STORAGE_KEY = 'dijla_taxi_db_v1';

  // البيانات الأولية
  const initialData = {
    users: {
      customers: [
        {
          id: 1, firstName: 'أحمد', lastName: 'محمد',
          email: 'ahmed@dijla.iq', password: '123456',
          phone: '0770 123 4567', rating: 4.9, wallet: 25000,
          createdAt: '2024-01-15', trips: 45,
          addresses: [
            { id: 1, name: 'البيت', address: 'الكرادة، شارع 62، بناية 15', coords: [33.3152, 44.3661] },
            { id: 2, name: 'العمل', address: 'المنصور، مجاور مول المنصور', coords: [33.3128, 44.3467] },
            { id: 3, name: 'المول', address: 'بغداد مول، الجادرية', coords: [33.2915, 44.3809] },
            { id: 4, name: 'المطار', address: 'مطار بغداد الدولي', coords: [33.2625, 44.2346] }
          ]
        },
        {
          id: 2, firstName: 'سارة', lastName: 'علي',
          email: 'sara@dijla.iq', password: '123456',
          phone: '0790 234 5678', rating: 4.8, wallet: 18000,
          createdAt: '2024-02-20', trips: 32
        }
      ],
      drivers: [
        {
          id: 101, firstName: 'كريم', lastName: 'عبدالله',
          email: 'karim@dijla.iq', password: '123456',
          phone: '0790 111 2233', carType: 'sedan',
          carModel: 'تويوتا كامري 2022', plate: '12-345-أ ب',
          license: 'IQ-2023-001', color: 'أبيض',
          rating: 4.9, status: 'approved', online: true,
          createdAt: '2023-06-15', trips: 1250, earnings: 2500000,
          location: { lat: 33.3128, lng: 44.3467 },
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 102, firstName: 'محمد', lastName: 'علي',
          email: 'mohammed@dijla.iq', password: '123456',
          phone: '0770 222 3344', carType: 'premium',
          carModel: 'مرسيدس C-Class 2023', plate: '15-678-ب ج',
          license: 'IQ-2023-002', color: 'أسود',
          rating: 4.9, status: 'approved', online: true,
          createdAt: '2023-07-20', trips: 980, earnings: 1800000,
          location: { lat: 33.3152, lng: 44.3661 },
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 103, firstName: 'علي', lastName: 'حسين',
          email: 'ali.h@dijla.iq', password: '123456',
          phone: '0780 333 4455', carType: 'van',
          carModel: 'هيونداي H1 2021', plate: '20-111-ج د',
          license: 'IQ-2023-003', color: 'فضي',
          rating: 4.7, status: 'approved', online: false,
          createdAt: '2023-08-10', trips: 450, earnings: 850000,
          location: { lat: 33.2915, lng: 44.3809 },
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 201, firstName: 'حيدر', lastName: 'كاظم',
          email: 'haider@dijla.iq', password: '123456',
          phone: '0790 555 6677', carType: 'sedan',
          carModel: 'كيا سيراتو 2023', plate: '25-333-هـ و',
          license: 'IQ-2024-005', color: 'أحمر',
          rating: 4.9, status: 'pending', online: false,
          createdAt: '2024-05-15', trips: 0, earnings: 0,
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 202, firstName: 'مصطفى', lastName: 'رحيم',
          email: 'mustafa@dijla.iq', password: '123456',
          phone: '0770 666 7788', carType: 'premium',
          carModel: 'بي ام دبليو 5 2022', plate: '30-444-و ز',
          license: 'IQ-2024-006', color: 'أزرق غامق',
          rating: 4.8, status: 'pending', online: false,
          createdAt: '2024-05-16', trips: 0, earnings: 0,
          documents: { id: true, license: true, insurance: false }
        },
        {
          id: 203, firstName: 'عباس', lastName: 'جاسم',
          email: 'abbas@dijla.iq', password: '123456',
          phone: '0780 777 8899', carType: 'van',
          carModel: 'تويوتا هايس 2021', plate: '35-555-ز ح',
          license: 'IQ-2024-007', color: 'أبيض',
          rating: 4.5, status: 'pending', online: false,
          createdAt: '2024-05-17', trips: 0, earnings: 0,
          documents: { id: false, license: true, insurance: true }
        },
        {
          id: 204, firstName: 'علي', lastName: 'كاظم',
          email: 'ali.k@dijla.iq', password: '123456',
          phone: '0790 888 9900', carType: 'sedan',
          carModel: 'هيونداي أكسنت 2022', plate: '10-222-د',
          license: 'IQ-2024-004', color: 'رمادي',
          rating: 4.6, status: 'pending', online: false,
          createdAt: '2024-05-18', trips: 0, earnings: 0,
          documents: { id: true, license: false, insurance: true }
        },
        {
          id: 205, firstName: 'حسن', lastName: 'علي',
          email: 'hassan.a@dijla.iq', password: '123456',
          phone: '0770 999 0011', carType: 'comfort',
          carModel: 'تويوتا كورولا 2023', plate: '40-666-ح ط',
          license: 'IQ-2024-008', color: 'أبيض',
          rating: 4.7, status: 'pending', online: false,
          createdAt: '2024-05-19', trips: 0, earnings: 0,
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 206, firstName: 'يوسف', lastName: 'طالب',
          email: 'yousef@dijla.iq', password: '123456',
          phone: '0790 111 2233', carType: 'sedan',
          carModel: 'نيسان صني 2022', plate: '45-777-ط',
          license: 'IQ-2024-009', color: 'فضي',
          rating: 4.8, status: 'pending', online: false,
          createdAt: '2024-05-20', trips: 0, earnings: 0,
          documents: { id: true, license: true, insurance: true }
        },
        {
          id: 207, firstName: 'أحمد', lastName: 'كاظم',
          email: 'ahmed.k@dijla.iq', password: '123456',
          phone: '0770 222 3344', carType: 'premium',
          carModel: 'لكزس ES 2023', plate: '50-888-ي',
          license: 'IQ-2024-010', color: 'أسود',
          rating: 4.9, status: 'pending', online: false,
          createdAt: '2024-05-20', trips: 0, earnings: 0,
          documents: { id: true, license: true, insurance: true }
        }
      ],
      admins: [
        {
          id: 999, name: 'مدير النظام',
          email: 'admin@dijla.iq', password: 'admin',
          role: 'super_admin'
        }
      ]
    },
    rides: generateInitialRides(),
    transactions: [
      { id: 1, userId: 1, userType: 'customer', type: 'topup', amount: 50000, method: 'card', description: 'شحن المحفظة', createdAt: '2024-05-15' },
      { id: 2, userId: 1, userType: 'customer', type: 'payment', amount: -8000, method: 'wallet', description: 'دفع رحلة - الكرادة للمنصور', createdAt: '2024-05-20' },
      { id: 3, userId: 1, userType: 'customer', type: 'topup', amount: 10000, method: 'cash', description: 'شحن المحفظة', createdAt: '2024-05-18' },
      { id: 4, userId: 1, userType: 'customer', type: 'payment', amount: -7000, method: 'wallet', description: 'دفع رحلة - المنصور للكرادة', createdAt: '2024-05-15' },
      { id: 5, userId: 1, userType: 'customer', type: 'gift', amount: 5000, method: 'system', description: 'كوبون ترحيبي', createdAt: '2024-05-10' }
    ],
    promoCodes: [
      { code: 'WELCOME50', discount: 50, type: 'percent', maxUses: 3, usedCount: 0, expiresAt: '2026-12-31', active: true },
      { code: 'WEEKEND20', discount: 20, type: 'percent', maxUses: 100, usedCount: 12, expiresAt: '2026-12-31', active: true },
      { code: 'WALLET15', discount: 15, type: 'percent', maxUses: 200, usedCount: 45, expiresAt: '2026-12-31', active: true }
    ],
    pricing: {
      base: 1000,
      perKm: { economy: 500, comfort: 800, premium: 1500, van: 1000 },
      minimum: 3000,
      commission: 15,
      surgeMultipliers: { peak: 1.5, night: 1.3 }
    },
    notifications: [
      { id: 1, userId: 1, userType: 'customer', title: 'رحلة مكتملة', message: 'تم إنهاء رحلتك بنجاح. قيم تجربتك!', type: 'trip', read: false, createdAt: '2024-05-20 14:30' },
      { id: 2, userId: 1, userType: 'customer', title: 'كوبون جديد!', message: 'استخدم WELCOME50 للحصول على خصم 50%', type: 'promo', read: false, createdAt: '2024-05-19' },
      { id: 3, userId: 1, userType: 'customer', title: 'تم شحن المحفظة', message: 'تم إضافة 50,000 د.ع لمحفظتك بنجاح', type: 'wallet', read: true, createdAt: '2024-05-15' }
    ],
    stats: {
      totalRides: 15420,
      totalRevenue: 15420000,
      totalCustomers: 50230,
      totalDrivers: 3200,
      pendingDrivers: 7,
      todayRides: 1847,
      todayRevenue: 1850000
    }
  };

  function generateInitialRides() {
    const rides = [];
    const routes = [
      ['الكرادة', 'المنصور', [33.3152, 44.3661], [33.3128, 44.3467]],
      ['الجادرية', 'الكرادة', [33.2915, 44.3809], [33.3152, 44.3661]],
      ['الكاظمية', 'الاعظمية', [33.3700, 44.3300], [33.3950, 44.3400]],
      ['المنصور', 'بغداد الجديدة', [33.3128, 44.3467], [33.3050, 44.4200]],
      ['الكرادة', 'مطار بغداد', [33.3152, 44.3661], [33.2625, 44.2346]],
      ['الكرادة', 'الجادرية', [33.3152, 44.3661], [33.2915, 44.3809]],
      ['المنصور', 'الكرادة', [33.3128, 44.3467], [33.3152, 44.3661]],
      ['الكرادة', 'مركز المدينة', [33.3152, 44.3661], [33.3400, 44.3950]]
    ];
    const customers = ['أحمد محمد', 'سارة علي', 'علي حسين', 'مريم خالد', 'حسن عبدالله'];
    const drivers = ['كريم عبدالله', 'محمد علي', 'سامي نوري', 'يوسف طالب'];
    const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'active', 'cancelled'];
    const types = ['economy', 'comfort', 'premium', 'van'];

    for (let i = 0; i < 50; i++) {
      const route = routes[i % routes.length];
      const customer = customers[i % customers.length];
      const driver = drivers[i % drivers.length];
      const status = i < 30 ? 'completed' : (i < 35 ? 'active' : 'cancelled');
      const distance = Math.round((3 + Math.random() * 25) * 10) / 10;
      const type = types[i % types.length];
      const multipliers = { economy: 1, comfort: 1.5, premium: 2.5, van: 2 };
      const fare = Math.round((1000 + distance * 500 * multipliers[type]) / 100) * 100;
      const day = Math.floor(Math.random() * 30) + 1;
      rides.push({
        id: 5000 + i,
        customerId: (i % 5) + 1,
        driverId: (i % 4) + 101,
        customer, driver,
        from: route[0], to: route[1],
        fromCoords: route[2], toCoords: route[3],
        distance, fare, type, status,
        rating: status === 'completed' ? Math.floor(Math.random() * 2) + 4 : 0,
        date: `2024-05-${day.toString().padStart(2, '0')} ${(10 + i % 8).toString().padStart(2, '0')}:${(i * 7 % 60).toString().padStart(2, '0')}`
      });
    }
    return rides;
  }

  // تحميل البيانات من localStorage
  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load DB:', e);
    }
    save(initialData);
    return JSON.parse(JSON.stringify(initialData));
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save DB:', e);
    }
  }

  let data = load();

  // ============== واجهة قاعدة البيانات العامة ==============
  return {
    // العمليات الأساسية
    get: (path) => {
      const keys = path.split('.');
      let result = data;
      for (const key of keys) {
        result = result?.[key];
        if (result === undefined) return null;
      }
      return result;
    },

    // استعلام عام
    query: (collection, filterFn) => {
      return data[collection]?.filter(filterFn) || [];
    },

    find: (collection, id) => {
      return data[collection]?.find(item => item.id === id) || null;
    },

    // إضافة عنصر
    insert: (collection, item) => {
      if (!data[collection]) data[collection] = [];
      const ids = data[collection].map(i => i.id || 0);
      item.id = item.id || Math.max(...ids, 0) + 1;
      data[collection].push(item);
      save(data);
      return item;
    },

    // تحديث عنصر
    update: (collection, id, updates) => {
      const item = data[collection]?.find(i => i.id === id);
      if (item) {
        Object.assign(item, updates);
        save(data);
      }
      return item;
    },

    // حذف عنصر
    delete: (collection, id) => {
      if (data[collection]) {
        data[collection] = data[collection].filter(i => i.id !== id);
        save(data);
      }
    },

    // المستخدمون
    findCustomerByEmail: (email) => {
      return data.users.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
    },
    findDriverByEmail: (email) => {
      return data.users.drivers.find(d => d.email.toLowerCase() === email.toLowerCase());
    },
    findAdminByEmail: (email) => {
      return data.users.admins.find(a => a.email.toLowerCase() === email.toLowerCase());
    },
    findCustomerById: (id) => data.users.customers.find(c => c.id === id),
    findDriverById: (id) => data.users.drivers.find(d => d.id === id),

    addCustomer: (customer) => {
      customer.id = Math.max(...data.users.customers.map(c => c.id || 0), 0) + 1;
      customer.rating = 5.0;
      customer.wallet = 5000;
      customer.trips = 0;
      customer.createdAt = new Date().toISOString().split('T')[0];
      customer.addresses = [];
      data.users.customers.push(customer);
      save(data);
      return customer;
    },

    addDriver: (driver) => {
      driver.id = Math.max(...data.users.drivers.map(d => d.id || 0), 0) + 1;
      driver.rating = 5.0;
      driver.status = 'pending';
      driver.online = false;
      driver.trips = 0;
      driver.earnings = 0;
      driver.createdAt = new Date().toISOString().split('T')[0];
      driver.documents = { id: false, license: false, insurance: false };
      data.users.drivers.push(driver);
      save(data);
      return driver;
    },

    updateDriverStatus: (id, status) => {
      const driver = data.users.drivers.find(d => d.id === id);
      if (driver) {
        driver.status = status;
        save(data);
      }
      return driver;
    },

    updateDriverOnline: (id, online) => {
      const driver = data.users.drivers.find(d => d.id === id);
      if (driver) {
        driver.online = online;
        save(data);
      }
      return driver;
    },

    // الرحلات
    addRide: (ride) => {
      ride.id = Math.max(...data.rides.map(r => r.id || 0), 5000) + 1;
      ride.createdAt = new Date().toISOString();
      data.rides.unshift(ride);
      save(data);
      return ride;
    },

    updateRide: (id, updates) => {
      const ride = data.rides.find(r => r.id === id);
      if (ride) {
        Object.assign(ride, updates);
        save(data);
      }
      return ride;
    },

    getCustomerRides: (customerId) => {
      return data.rides.filter(r => r.customerId === customerId).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getDriverRides: (driverId) => {
      return data.rides.filter(r => r.driverId === driverId).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // المعاملات المالية
    addTransaction: (transaction) => {
      transaction.id = Math.max(...data.transactions.map(t => t.id || 0), 0) + 1;
      transaction.createdAt = new Date().toISOString();
      data.transactions.unshift(transaction);
      save(data);
      return transaction;
    },

    getUserTransactions: (userId, userType) => {
      return data.transactions.filter(t => t.userId === userId && t.userType === userType)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    updateWallet: (userId, amount) => {
      const customer = data.users.customers.find(c => c.id === userId);
      if (customer) {
        customer.wallet += amount;
        save(data);
      }
      return customer;
    },

    // كوبونات
    validateCoupon: (code) => {
      const coupon = data.promoCodes.find(c => c.code.toUpperCase() === code.toUpperCase() && c.active);
      if (!coupon) return { valid: false, message: 'كود غير صحيح' };
      if (coupon.usedCount >= coupon.maxUses) return { valid: false, message: 'الكود مستنفذ' };
      if (new Date(coupon.expiresAt) < new Date()) return { valid: false, message: 'الكود منتهي الصلاحية' };
      return { valid: true, coupon };
    },

    useCoupon: (code) => {
      const coupon = data.promoCodes.find(c => c.code.toUpperCase() === code.toUpperCase());
      if (coupon) {
        coupon.usedCount++;
        save(data);
      }
    },

    // الإشعارات
    addNotification: (notif) => {
      notif.id = Math.max(...data.notifications.map(n => n.id || 0), 0) + 1;
      notif.createdAt = new Date().toISOString();
      notif.read = false;
      data.notifications.unshift(notif);
      save(data);
      return notif;
    },

    getUserNotifications: (userId, userType) => {
      return data.notifications.filter(n => n.userId === userId && n.userType === userType)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    markAllNotificationsRead: (userId, userType) => {
      data.notifications.filter(n => n.userId === userId && n.userType === userType)
        .forEach(n => n.read = true);
      save(data);
    },

    // التسعير
    getPricing: () => data.pricing,
    updatePricing: (pricing) => {
      data.pricing = { ...data.pricing, ...pricing };
      save(data);
    },

    // الإحصائيات
    getStats: () => data.stats,
    updateStats: (updates) => {
      Object.assign(data.stats, updates);
      save(data);
    },

    getDrivers: () => data.users.drivers,
    getCustomers: () => data.users.customers,
    getRides: () => data.rides,
    getPromoCodes: () => data.promoCodes,

    addPendingRequest: (request) => {
      if (!data.pendingRequests) data.pendingRequests = [];
      request.id = request.id || Date.now();
      request.createdAt = new Date().toISOString();
      data.pendingRequests.unshift(request);
      save(data);
      return request;
    },

    getPendingRequests: () => data.pendingRequests || [],

    clearPendingRequest: (id) => {
      data.pendingRequests = (data.pendingRequests || []).filter((r) => r.id !== id);
      save(data);
    },

    updateCustomer: (id, updates) => {
      const customer = data.users.customers.find((c) => c.id === id);
      if (customer) {
        Object.assign(customer, updates);
        save(data);
      }
      return customer;
    },

    updateDriver: (id, updates) => {
      const driver = data.users.drivers.find((d) => d.id === id);
      if (driver) {
        Object.assign(driver, updates);
        save(data);
      }
      return driver;
    },

    saveAddress: (customerId, address) => {
      const customer = data.users.customers.find((c) => c.id === customerId);
      if (!customer) return null;
      if (!customer.addresses) customer.addresses = [];
      address.id = Math.max(0, ...customer.addresses.map((a) => a.id || 0)) + 1;
      customer.addresses.push(address);
      save(data);
      return address;
    },

    // إعادة تعيين
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      data = load();
    },

    // الوصول المباشر للبيانات الخام
    getData: () => data
  };
})();

// تصدير للاستخدام في الوحدات الأخرى
window.DB = DB;
