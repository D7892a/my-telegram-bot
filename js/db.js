/**
 * قاعدة بيانات تكسي دجلة — الناصرية
 * طبقة بيانات حقيقية: مخطط مُصدَّر، ترحيل، تخزين دائم، مستمسكات، إعدادات
 */
const DB = (() => {
  'use strict';

  const STORAGE_KEY = 'dijla_taxi_db_v3_nasiriyah';
  const LEGACY_KEYS = ['dijla_taxi_db_v2_nasiriyah', 'dijla_taxi_db_v1', 'dijla_taxi_db'];
  const FILES_DB = 'dijla_files_v2';
  const SCHEMA_VERSION = 3;

  const CITY = {
    name: 'الناصرية',
    nameEn: 'Nasiriyah',
    governorate: 'ذي قار',
    center: [31.0452, 46.2561],
    bounds: { north: 31.125, south: 30.935, east: 46.355, west: 46.075 }
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function stamp() {
    return nowIso().replace('T', ' ').slice(0, 16);
  }

  const initialData = {
    version: SCHEMA_VERSION,
    city: CITY.name,
    users: {
      customers: [
        {
          id: 1, firstName: 'أحمد', lastName: 'محمد',
          email: 'ahmed@dijla.iq', password: '123456',
          phone: '0770 123 4567', rating: 4.9, wallet: 25000,
          createdAt: '2025-11-15', trips: 18,
          language: 'ar', notifications: true,
          addresses: [
            { id: 1, name: 'البيت', address: 'الحبوبي، قرب جامع الحبوبي', coords: [31.0461, 46.2525] },
            { id: 2, name: 'العمل', address: 'الصالحية، شارع المركز', coords: [31.0520, 46.2642] },
            { id: 3, name: 'الجامعة', address: 'جامعة ذي قار', coords: [31.0320, 46.2380] },
            { id: 4, name: 'السوق', address: 'السوق الكبير، الناصرية', coords: [31.0440, 46.2580] }
          ]
        },
        {
          id: 2, firstName: 'سارة', lastName: 'علي',
          email: 'sara@dijla.iq', password: '123456',
          phone: '0790 234 5678', rating: 4.8, wallet: 18000,
          createdAt: '2025-12-20', trips: 11, language: 'ar', notifications: true,
          addresses: [
            { id: 1, name: 'البيت', address: 'حي الشموخ', coords: [31.0680, 46.2780] }
          ]
        },
        {
          id: 3, firstName: 'حسين', lastName: 'جاسم',
          email: 'hussein@dijla.iq', password: '123456',
          phone: '0780 345 6789', rating: 4.7, wallet: 9000,
          createdAt: '2026-01-08', trips: 6, language: 'ar', notifications: true, addresses: []
        }
      ],
      drivers: [
        {
          id: 101, firstName: 'كريم', lastName: 'عبدالله',
          email: 'karim@dijla.iq', password: '123456',
          phone: '0790 111 2233', carType: 'comfort',
          carModel: 'تويوتا كامري 2022', plate: '12-345-ذ ق',
          license: 'IQ-2023-001', color: 'أبيض',
          rating: 4.9, status: 'approved', online: true,
          createdAt: '2025-06-15', trips: 420, earnings: 1850000,
          location: { lat: 31.0520, lng: 46.2642, area: 'الصالحية' },
          bank: { name: 'مصرف الرشيد', account: '0045-778899' },
          documents: {
            id: { uploaded: true, name: 'هوية-كريم.jpg', mime: 'image/jpeg', uploadedAt: '2025-06-15' },
            license: { uploaded: true, name: 'رخصة-كريم.jpg', mime: 'image/jpeg', uploadedAt: '2025-06-15' },
            ownership: { uploaded: true, name: 'إسناد-كامري.pdf', mime: 'application/pdf', uploadedAt: '2025-06-15' },
            insurance: { uploaded: true, name: 'تأمين-كريم.jpg', mime: 'image/jpeg', uploadedAt: '2025-06-15' }
          }
        },
        {
          id: 102, firstName: 'محمد', lastName: 'علي',
          email: 'mohammed@dijla.iq', password: '123456',
          phone: '0770 222 3344', carType: 'premium',
          carModel: 'مرسيدس C-Class 2023', plate: '15-678-ذ ق',
          license: 'IQ-2023-002', color: 'أسود',
          rating: 4.9, status: 'approved', online: true,
          createdAt: '2025-07-20', trips: 310, earnings: 2100000,
          location: { lat: 31.0461, lng: 46.2525, area: 'الحبوبي' },
          bank: { name: 'مصرف الرافدين', account: '1122-334455' },
          documents: {
            id: { uploaded: true, name: 'هوية-محمد.jpg', mime: 'image/jpeg', uploadedAt: '2025-07-20' },
            license: { uploaded: true, name: 'رخصة-محمد.jpg', mime: 'image/jpeg', uploadedAt: '2025-07-20' },
            ownership: { uploaded: true, name: 'إسناد-مرسيدس.pdf', mime: 'application/pdf', uploadedAt: '2025-07-20' },
            insurance: { uploaded: true, name: 'تأمين-محمد.jpg', mime: 'image/jpeg', uploadedAt: '2025-07-20' }
          }
        },
        {
          id: 103, firstName: 'علي', lastName: 'حسين',
          email: 'ali.h@dijla.iq', password: '123456',
          phone: '0780 333 4455', carType: 'van',
          carModel: 'هيونداي H1 2021', plate: '20-111-ذ ق',
          license: 'IQ-2023-003', color: 'فضي',
          rating: 4.7, status: 'approved', online: true,
          createdAt: '2025-08-10', trips: 190, earnings: 980000,
          location: { lat: 31.0680, lng: 46.2780, area: 'الشموخ' },
          bank: { name: 'مصرف العراق', account: '7788-001122' },
          documents: {
            id: { uploaded: true, name: 'هوية-علي.jpg', mime: 'image/jpeg', uploadedAt: '2025-08-10' },
            license: { uploaded: true, name: 'رخصة-علي.jpg', mime: 'image/jpeg', uploadedAt: '2025-08-10' },
            ownership: { uploaded: true, name: 'إسناد-H1.pdf', mime: 'application/pdf', uploadedAt: '2025-08-10' },
            insurance: { uploaded: true, name: 'تأمين-علي.jpg', mime: 'image/jpeg', uploadedAt: '2025-08-10' }
          }
        },
        {
          id: 104, firstName: 'سامي', lastName: 'نوري',
          email: 'sami@dijla.iq', password: '123456',
          phone: '0771 444 5566', carType: 'economy',
          carModel: 'كيا ريو 2021', plate: '22-909-ذ ق',
          license: 'IQ-2024-011', color: 'أبيض',
          rating: 4.6, status: 'approved', online: true,
          createdAt: '2025-09-01', trips: 260, earnings: 720000,
          location: { lat: 31.0320, lng: 46.2380, area: 'جامعة ذي قار' },
          bank: { name: 'زين كاش', account: '07714445566' },
          documents: {
            id: { uploaded: true, name: 'هوية-سامي.jpg', mime: 'image/jpeg', uploadedAt: '2025-09-01' },
            license: { uploaded: true, name: 'رخصة-سامي.jpg', mime: 'image/jpeg', uploadedAt: '2025-09-01' },
            ownership: { uploaded: true, name: 'إسناد-ريو.pdf', mime: 'application/pdf', uploadedAt: '2025-09-01' },
            insurance: { uploaded: true, name: 'تأمين-سامي.jpg', mime: 'image/jpeg', uploadedAt: '2025-09-01' }
          }
        },
        {
          id: 105, firstName: 'ياسر', lastName: 'عباس',
          email: 'yasser@dijla.iq', password: '123456',
          phone: '0782 555 6677', carType: 'economy',
          carModel: 'هيونداي أكسنت 2020', plate: '18-220-ذ ق',
          license: 'IQ-2024-012', color: 'رمادي',
          rating: 4.5, status: 'approved', online: true,
          createdAt: '2025-10-12', trips: 140, earnings: 410000,
          location: { lat: 31.0750, lng: 46.2350, area: 'الإسكان' },
          bank: { name: 'آسيا حوالة', account: '07825556677' },
          documents: {
            id: { uploaded: true, name: 'هوية-ياسر.jpg', mime: 'image/jpeg', uploadedAt: '2025-10-12' },
            license: { uploaded: true, name: 'رخصة-ياسر.jpg', mime: 'image/jpeg', uploadedAt: '2025-10-12' },
            ownership: { uploaded: true, name: 'إسناد-أكسنت.pdf', mime: 'application/pdf', uploadedAt: '2025-10-12' },
            insurance: { uploaded: true, name: 'تأمين-ياسر.jpg', mime: 'image/jpeg', uploadedAt: '2025-10-12' }
          }
        },
        {
          id: 106, firstName: 'فلاح', lastName: 'حسن',
          email: 'falah@dijla.iq', password: '123456',
          phone: '0793 666 7788', carType: 'premium',
          carModel: 'لكزس ES 2022', plate: '30-001-ذ ق',
          license: 'IQ-2024-013', color: 'أسود',
          rating: 4.8, status: 'approved', online: false,
          createdAt: '2025-11-03', trips: 88, earnings: 640000,
          location: { lat: 31.0410, lng: 46.2500, area: 'الكورنيش' },
          bank: { name: 'مصرف الرشيد', account: '9900-112233' },
          documents: {
            id: { uploaded: true, name: 'هوية-فلاح.jpg', mime: 'image/jpeg', uploadedAt: '2025-11-03' },
            license: { uploaded: true, name: 'رخصة-فلاح.jpg', mime: 'image/jpeg', uploadedAt: '2025-11-03' },
            ownership: { uploaded: true, name: 'إسناد-لكزس.pdf', mime: 'application/pdf', uploadedAt: '2025-11-03' },
            insurance: { uploaded: true, name: 'تأمين-فلاح.jpg', mime: 'image/jpeg', uploadedAt: '2025-11-03' }
          }
        },
        {
          id: 201, firstName: 'حيدر', lastName: 'كاظم',
          email: 'haider@dijla.iq', password: '123456',
          phone: '0790 555 6677', carType: 'economy',
          carModel: 'كيا سيراتو 2023', plate: '25-333-ذ ق',
          license: 'IQ-2026-005', color: 'أحمر',
          rating: 5, status: 'pending', online: false,
          createdAt: '2026-08-10', trips: 0, earnings: 0,
          location: { lat: 31.0440, lng: 46.2580, area: 'السوق الكبير' },
          bank: {},
          documents: {
            id: { uploaded: true, name: 'هوية-حيدر.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-10' },
            license: { uploaded: true, name: 'رخصة-حيدر.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-10' },
            ownership: { uploaded: true, name: 'إسناد-سيراتو.pdf', mime: 'application/pdf', uploadedAt: '2026-08-10' },
            insurance: { uploaded: true, name: 'تأمين-حيدر.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-10' }
          }
        },
        {
          id: 202, firstName: 'مصطفى', lastName: 'رحيم',
          email: 'mustafa@dijla.iq', password: '123456',
          phone: '0770 666 7788', carType: 'premium',
          carModel: 'بي ام دبليو 5 2022', plate: '30-444-ذ ق',
          license: 'IQ-2026-006', color: 'أزرق غامق',
          rating: 5, status: 'pending', online: false,
          createdAt: '2026-08-12', trips: 0, earnings: 0,
          location: { lat: 31.0580, lng: 46.2700, area: 'حي المعلمين' },
          bank: {},
          documents: {
            id: { uploaded: true, name: 'هوية-مصطفى.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-12' },
            license: { uploaded: true, name: 'رخصة-مصطفى.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-12' },
            ownership: { uploaded: false },
            insurance: { uploaded: false }
          }
        },
        {
          id: 203, firstName: 'عباس', lastName: 'جاسم',
          email: 'abbas@dijla.iq', password: '123456',
          phone: '0780 777 8899', carType: 'van',
          carModel: 'تويوتا هايس 2021', plate: '35-555-ذ ق',
          license: 'IQ-2026-007', color: 'أبيض',
          rating: 5, status: 'pending', online: false,
          createdAt: '2026-08-14', trips: 0, earnings: 0,
          location: { lat: 31.0600, lng: 46.2300, area: 'حي العسكري' },
          bank: {},
          documents: {
            id: { uploaded: false },
            license: { uploaded: true, name: 'رخصة-عباس.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-14' },
            ownership: { uploaded: true, name: 'إسناد-هايس.pdf', mime: 'application/pdf', uploadedAt: '2026-08-14' },
            insurance: { uploaded: true, name: 'تأمين-عباس.jpg', mime: 'image/jpeg', uploadedAt: '2026-08-14' }
          }
        }
      ],
admins: [{
        id: 'admin-1', name: 'مدير النظام', email: 'admin@dijla.iq', password: 'admin1234',
        role: 'super_admin', phone: '+964 770 000 0000', createdAt: '2026-01-01'
      }]
    },
    rides: [],
    transactions: [
      { id: 1, userId: 1, userType: 'customer', type: 'topup', amount: 50000, method: 'card', description: 'شحن المحفظة', createdAt: '2026-08-01 10:00' },
      { id: 2, userId: 1, userType: 'customer', type: 'payment', amount: -6500, method: 'wallet', description: 'دفع رحلة - الحبوبي إلى الصالحية', createdAt: '2026-08-10 14:20' },
      { id: 3, userId: 1, userType: 'customer', type: 'topup', amount: 10000, method: 'zaincash', description: 'شحن من زين كاش', createdAt: '2026-08-12 09:15' }
    ],
    promoCodes: [
      { code: 'WELCOME50', discount: 50, type: 'percent', maxUses: 3, usedCount: 0, expiresAt: '2026-12-31', active: true },
      { code: 'WEEKEND20', discount: 20, type: 'percent', maxUses: 100, usedCount: 8, expiresAt: '2026-12-31', active: true },
      { code: 'WALLET15', discount: 15, type: 'percent', maxUses: 200, usedCount: 21, expiresAt: '2026-12-31', active: true }
    ],
    pricing: {
      base: 1000,
      perKm: { economy: 500, comfort: 800, premium: 1500, van: 1000 },
      minimum: 3000,
      commission: 15,
      surgeMultipliers: { peak: 1.5, night: 1.3 }
    },
    settings: {
      city: CITY.name,
      cities: ['الناصرية'],
      searchRadiusKm: 8,
      maxWaitMin: 5,
      newUserDiscount: 30,
      welcomeCode: 'WELCOME50',
      notifyNewRequest: true,
      notifyTripComplete: true,
      notifyPromo: false,
      notifyDriverApproved: true,
      twoFactor: true,
      shareEmergency: true,
      recordAudio: false,
      verifyCustomer: true,
      language: 'ar'
    },
    support: {
      phone: '+964 770 123 4567',
      whatsapp: '+964 770 123 4567',
      email: 'info@dijla-taxi.iq',
      address: 'الحبوبي، الناصرية، ذي قار',
      hours: '24/7 - متاحون دائماً',
      facebook: '',
      instagram: '',
      telegram: '',
      note: 'فريق الدعم جاهز للرد على استفساراتك على مدار الساعة'
    },
    notifications: [
      { id: 1, userId: 1, userType: 'customer', title: 'أهلاً بك في الناصرية', message: 'تكسي دجلة يخدم الناصرية فقط حالياً. اطلب رحلتك من أي حي داخل المدينة.', type: 'system', read: false, createdAt: '2026-08-18 09:00' },
      { id: 2, userId: 1, userType: 'customer', title: 'كوبون ترحيبي', message: 'استخدم WELCOME50 للحصول على خصم 50% لأول رحلاتك', type: 'promo', read: false, createdAt: '2026-08-18 09:01' }
    ],
    pendingRequests: [],
    tickets: [],
    withdrawals: [
      { id: 1, driverId: 101, amount: 180000, status: 'paid', createdAt: '2026-08-12' },
      { id: 2, driverId: 101, amount: 150000, status: 'paid', createdAt: '2026-08-05' }
    ],
    stats: {
      totalRides: 1860,
      totalRevenue: 2140000,
      totalCustomers: 840,
      totalDrivers: 46,
      pendingDrivers: 3,
      todayRides: 64,
      todayRevenue: 78000
    },
    lostItems: [
      { id: 1, reporterName: 'أحمد محمد', reporterType: 'customer', itemName: 'محفظة جلدية سوداء', description: 'محفظة فيها هوية أحوال ومبلغ 250 ألف دينار', location: 'داخل التكسي - كيا ريو أبيض', phone: '0770 123 4567', photo: null, status: 'published', createdAt: '2026-08-15 14:30' },
      { id: 2, reporterName: 'كريم عبدالله', reporterType: 'driver', itemName: 'هاتف سامسونج A55', description: 'هاتف أسود مع غطاء شفاف تركه زبون في السيارة', location: 'سيارة تكسي - كامري 2022', phone: '0790 111 2233', photo: null, status: 'pending', createdAt: '2026-08-18 09:15' }
    ]
  };

  function generateNasiriyahRides() {
    const routes = [
      ['الحبوبي', 'الصالحية', [31.0461, 46.2525], [31.0520, 46.2642]],
      ['الشموخ', 'جامعة ذي قار', [31.0680, 46.2780], [31.0320, 46.2380]],
      ['الإسكان', 'السوق الكبير', [31.0750, 46.2350], [31.0440, 46.2580]],
      ['الكورنيش', 'حي المعلمين', [31.0410, 46.2500], [31.0580, 46.2700]],
      ['حي العسكري', 'الحبوبي', [31.0600, 46.2300], [31.0461, 46.2525]],
      ['سومر', 'المستشفى العام', [31.0280, 46.2680], [31.0480, 46.2450]],
      ['حي الحسين', 'زقورة أور', [31.0650, 46.2550], [30.9626, 46.1031]],
      ['شارع بغداد', 'الجمهورية', [31.0620, 46.2650], [31.0380, 46.2480]]
    ];
    const customers = [
      { id: 1, name: 'أحمد محمد' },
      { id: 2, name: 'سارة علي' },
      { id: 3, name: 'حسين جاسم' }
    ];
    const drivers = [
      { id: 101, name: 'كريم عبدالله' },
      { id: 102, name: 'محمد علي' },
      { id: 103, name: 'علي حسين' },
      { id: 104, name: 'سامي نوري' }
    ];
    const types = ['economy', 'comfort', 'premium', 'van'];
    const rides = [];
    for (let i = 0; i < 28; i++) {
      const route = routes[i % routes.length];
      const customer = customers[i % customers.length];
      const driver = drivers[i % drivers.length];
      const status = i < 22 ? 'completed' : (i < 24 ? 'cancelled' : 'completed');
      const distance = Math.round((1.4 + (i % 9) * 1.1) * 10) / 10;
      const type = types[i % types.length];
      const multipliers = { economy: 1, comfort: 1.5, premium: 2.5, van: 2 };
      const fare = Math.round((1000 + distance * 500 * multipliers[type]) / 100) * 100;
      const day = String((i % 18) + 1).padStart(2, '0');
      rides.push({
        id: 7000 + i,
        customerId: customer.id,
        driverId: driver.id,
        customer: customer.name,
        driver: driver.name,
        from: route[0],
        to: route[1],
        fromCoords: route[2],
        toCoords: route[3],
        distance,
        duration: Math.round(distance * 2.6),
        fare,
        type,
        status,
        payment: i % 3 === 0 ? 'wallet' : 'cash',
        rating: status === 'completed' ? 4 + (i % 2) : 0,
        date: `2026-08-${day} ${(10 + i % 8).toString().padStart(2, '0')}:${(i * 7 % 60).toString().padStart(2, '0')}`
      });
    }
    return rides;
  }

  initialData.rides = generateNasiriyahRides();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function persist(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('DB persist failed', err);
    }
  }

  function looksLikeBaghdad(payload) {
    const sample = JSON.stringify(payload || {}).slice(0, 4000);
    return /الكرادة|المنصور|بغداد الجديدة|مطار بغداد/.test(sample);
  }

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.version === SCHEMA_VERSION && parsed.city === CITY.name && !looksLikeBaghdad(parsed)) {
          parsed.settings = { ...initialData.settings, ...(parsed.settings || {}) };
          parsed.support = { ...initialData.support, ...(parsed.support || {}) };
          parsed.users = parsed.users || { customers: [], drivers: [], admins: [] };
          parsed.users.admins = parsed.users.admins || [];
          parsed.pricing = { ...initialData.pricing, ...(parsed.pricing || {}) };
          parsed.pendingRequests = parsed.pendingRequests || [];
          parsed.tickets = parsed.tickets || [];
          parsed.withdrawals = parsed.withdrawals || [];
          parsed.lostItems = parsed.lostItems || [];
          return parsed;
        }
      }
    } catch (err) {
      console.warn('DB load failed', err);
    }
    LEGACY_KEYS.forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    const fresh = clone(initialData);
    persist(fresh);
    return fresh;
  }

  let data = load();

  function save() {
    persist(data);
    return data;
  }

  function nextId(list, fallback = 1) {
    const ids = (list || []).map((item) => Number(item.id) || 0);
    return Math.max(fallback - 1, ...ids, 0) + 1;
  }

  function normalizeCarType(type) {
    const map = {
      sedan: 'economy', economy: 'economy',
      comfort: 'comfort',
      premium: 'premium',
      van: 'van', family: 'van'
    };
    return map[String(type || '').toLowerCase()] || 'economy';
  }

  function hasDoc(doc) {
    if (!doc) return false;
    if (doc === true) return true;
    return !!(doc.uploaded || doc.data || doc.name);
  }

  /* IndexedDB للمستمسكات الكبيرة */
  function openFilesDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open(FILES_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putFile(key, payload) {
    try {
      const db = await openFilesDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(payload, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function getFile(key) {
    try {
      const db = await openFilesDb();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return value;
    } catch (_) {
      return null;
    }
  }

  return {
    CITY,
    SCHEMA_VERSION,

    get: (path) => {
      const keys = path.split('.');
      let result = data;
      for (const key of keys) {
        result = result?.[key];
        if (result === undefined) return null;
      }
      return result;
    },

    findCustomerByEmail: (email) => data.users.customers.find((c) => c.email.toLowerCase() === String(email).toLowerCase()),
    findDriverByEmail: (email) => data.users.drivers.find((d) => d.email.toLowerCase() === String(email).toLowerCase()),
    findAdminByEmail: (email) => data.users.admins.find((a) => a.email.toLowerCase() === String(email).toLowerCase()),
    findAdminById: (id) => data.users.admins.find((a) => String(a.id) === String(id)),
    findCustomerById: (id) => data.users.customers.find((c) => c.id === id),
    findDriverById: (id) => data.users.drivers.find((d) => d.id === id),

    addCustomer: (customer) => {
      customer.id = nextId(data.users.customers);
      customer.rating = 5;
      customer.wallet = 5000;
      customer.trips = 0;
      customer.language = 'ar';
      customer.notifications = true;
      customer.createdAt = nowIso().split('T')[0];
      customer.addresses = customer.addresses || [];
      data.users.customers.push(customer);
      save();
      return customer;
    },

    addDriver: (driver) => {
      driver.id = nextId(data.users.drivers, 300);
      driver.rating = 5;
      driver.status = 'pending';
      driver.online = false;
      driver.trips = 0;
      driver.earnings = 0;
      driver.carType = normalizeCarType(driver.carType);
      driver.createdAt = nowIso().split('T')[0];
      driver.location = driver.location || { lat: CITY.center[0], lng: CITY.center[1], area: CITY.name };
      driver.bank = driver.bank || {};
      driver.documents = driver.documents || {
        id: { uploaded: false },
        license: { uploaded: false },
        ownership: { uploaded: false },
        insurance: { uploaded: false }
      };
      data.users.drivers.push(driver);
      save();
      return driver;
    },

    updateDriverStatus: (id, status) => {
      const driver = data.users.drivers.find((d) => d.id === id);
      if (driver) {
        driver.status = status;
        save();
      }
      return driver;
    },

    updateDriverOnline: (id, online) => {
      const driver = data.users.drivers.find((d) => d.id === id);
      if (driver) {
        driver.online = online;
        save();
      }
      return driver;
    },

    updateDriverLocation: (id, lat, lng, area) => {
      const driver = data.users.drivers.find((d) => d.id === id);
      if (driver) {
        driver.location = { lat, lng, area: area || driver.location?.area || CITY.name };
        save();
      }
      return driver;
    },

    addRide: (ride) => {
      ride.id = nextId(data.rides, 8000);
      ride.createdAt = nowIso();
      ride.city = CITY.name;
      data.rides.unshift(ride);
      save();
      return ride;
    },

    updateRide: (id, updates) => {
      const ride = data.rides.find((r) => r.id === id);
      if (ride) {
        Object.assign(ride, updates);
        save();
      }
      return ride;
    },

    getCustomerRides: (customerId) => data.rides
      .filter((r) => r.customerId === customerId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),

    getDriverRides: (driverId) => data.rides
      .filter((r) => r.driverId === driverId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),

    addTransaction: (transaction) => {
      transaction.id = nextId(data.transactions);
      transaction.createdAt = transaction.createdAt || stamp();
      data.transactions.unshift(transaction);
      save();
      return transaction;
    },

    getUserTransactions: (userId, userType) => data.transactions
      .filter((t) => t.userId === userId && t.userType === userType)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),

    updateWallet: (userId, amount) => {
      const customer = data.users.customers.find((c) => c.id === userId);
      if (customer) {
        customer.wallet = Math.max(0, (customer.wallet || 0) + amount);
        save();
      }
      return customer;
    },

    validateCoupon: (code) => {
      const coupon = data.promoCodes.find((c) => c.code.toUpperCase() === String(code).toUpperCase() && c.active);
      if (!coupon) return { valid: false, message: 'كود غير صحيح' };
      if (coupon.usedCount >= coupon.maxUses) return { valid: false, message: 'الكود مستنفذ' };
      if (new Date(coupon.expiresAt) < new Date()) return { valid: false, message: 'الكود منتهي الصلاحية' };
      return { valid: true, coupon };
    },

    useCoupon: (code) => {
      const coupon = data.promoCodes.find((c) => c.code.toUpperCase() === String(code).toUpperCase());
      if (coupon) {
        coupon.usedCount += 1;
        save();
      }
    },

    addNotification: (notif) => {
      notif.id = nextId(data.notifications);
      notif.createdAt = notif.createdAt || stamp();
      notif.read = false;
      data.notifications.unshift(notif);
      save();
      return notif;
    },

    getUserNotifications: (userId, userType) => data.notifications
      .filter((n) => (userType === 'admin' ? n.userType === 'admin' : (n.userId === userId && n.userType === userType)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),

    markAllNotificationsRead: (userId, userType) => {
      const touched = data.notifications
        .filter((n) => (userType === 'admin' ? n.userType === 'admin' : (n.userId === userId && n.userType === userType)));
      touched.forEach((n) => { n.read = true; });
      save();
      return touched;
    },

    getPricing: () => data.pricing,
    updatePricing: (pricing) => {
      data.pricing = {
        ...data.pricing,
        ...pricing,
        perKm: { ...data.pricing.perKm, ...(pricing.perKm || {}) },
        surgeMultipliers: { ...data.pricing.surgeMultipliers, ...(pricing.surgeMultipliers || {}) }
      };
      save();
      return data.pricing;
    },

    getSupport: () => data.support,
    updateSupport: (updates) => {
      data.support = { ...data.support, ...updates };
      save();
      return data.support;
    },

    upsertAdmin: (admin) => {
      data.users.admins = data.users.admins || [];
      const index = data.users.admins.findIndex((a) => String(a.id) === String(admin.id));
      if (index >= 0) {
        data.users.admins[index] = { ...data.users.admins[index], ...admin };
      } else {
        data.users.admins.push(admin);
      }
      save();
      return data.users.admins.find((a) => String(a.id) === String(admin.id));
    },

    upsertCustomer: (customer) => {
      const index = data.users.customers.findIndex((c) => String(c.id) === String(customer.id));
      if (index >= 0) data.users.customers[index] = { ...data.users.customers[index], ...customer };
      else data.users.customers.push(customer);
      save();
      return data.users.customers.find((c) => String(c.id) === String(customer.id));
    },

    upsertDriver: (driver) => {
      const index = data.users.drivers.findIndex((d) => String(d.id) === String(driver.id));
      if (index >= 0) data.users.drivers[index] = { ...data.users.drivers[index], ...driver };
      else data.users.drivers.push(driver);
      save();
      return data.users.drivers.find((d) => String(d.id) === String(driver.id));
    },

    nextIdFor: (collection) => {
      const map = {
        customers: () => nextId(data.users.customers),
        drivers: () => nextId(data.users.drivers, 300),
        rides: () => nextId(data.rides, 8000),
        transactions: () => nextId(data.transactions),
        notifications: () => nextId(data.notifications),
        tickets: () => nextId(data.tickets),
        withdrawals: () => nextId(data.withdrawals)
      };
      return (map[collection] || (() => Date.now()))();
    },

    updateTicket: (id, updates) => {
      const ticket = (data.tickets || []).find((t) => String(t.id) === String(id));
      if (ticket) {
        Object.assign(ticket, updates);
        save();
      }
      return ticket;
    },

    persistNow: save,

    getSettings: () => data.settings,
    updateSettings: (updates) => {
      data.settings = { ...data.settings, ...updates };
      save();
      return data.settings;
    },

    getStats: () => data.stats,
    getDrivers: () => data.users.drivers,
    getCustomers: () => data.users.customers,
    getRides: () => data.rides,
    getPromoCodes: () => data.promoCodes,

    addPendingRequest: (request) => {
      data.pendingRequests = data.pendingRequests || [];
      request.id = request.id || Date.now();
      request.createdAt = nowIso();
      data.pendingRequests.unshift(request);
      save();
      return request;
    },

    getPendingRequests: () => data.pendingRequests || [],

    clearPendingRequest: (id) => {
      data.pendingRequests = (data.pendingRequests || []).filter((r) => r.id !== id);
      save();
    },

    updateCustomer: (id, updates) => {
      const customer = data.users.customers.find((c) => c.id === id);
      if (customer) {
        Object.assign(customer, updates);
        save();
      }
      return customer;
    },

    updateDriver: (id, updates) => {
      const driver = data.users.drivers.find((d) => d.id === id);
      if (driver) {
        if (updates.carType) updates.carType = normalizeCarType(updates.carType);
        Object.assign(driver, updates);
        save();
      }
      return driver;
    },

    saveAddress: (customerId, address) => {
      const customer = data.users.customers.find((c) => c.id === customerId);
      if (!customer) return null;
      customer.addresses = customer.addresses || [];
      address.id = nextId(customer.addresses);
      customer.addresses.push(address);
      save();
      return address;
    },

    deleteAddress: (customerId, addressId) => {
      const customer = data.users.customers.find((c) => c.id === customerId);
      if (!customer) return;
      customer.addresses = (customer.addresses || []).filter((a) => a.id !== addressId);
      save();
    },

    saveDriverDocument: async (driverId, kind, fileMeta) => {
      const driver = data.users.drivers.find((d) => d.id === driverId);
      if (!driver) return null;
      driver.documents = driver.documents || {};
      const record = {
        uploaded: true,
        name: fileMeta.name,
        mime: fileMeta.mime,
        size: fileMeta.size,
        uploadedAt: nowIso().split('T')[0]
      };
      driver.documents[kind] = record;
      save();
      if (fileMeta.data) {
        await putFile(`driver:${driverId}:${kind}`, {
          name: fileMeta.name,
          mime: fileMeta.mime,
          data: fileMeta.data
        });
      }
      return record;
    },

    getDriverDocumentFile: async (driverId, kind) => getFile(`driver:${driverId}:${kind}`),

    hasDocument: hasDoc,
    normalizeCarType,

    getDriversByType: (type, onlyOnline = true) => {
      const wanted = normalizeCarType(type);
      return data.users.drivers.filter((d) => {
        if (d.status !== 'approved') return false;
        if (onlyOnline && !d.online) return false;
        return normalizeCarType(d.carType) === wanted;
      });
    },

    addTicket: (ticket) => {
      data.tickets = data.tickets || [];
      ticket.id = nextId(data.tickets);
      ticket.createdAt = stamp();
      ticket.status = ticket.status || 'open';
      data.tickets.unshift(ticket);
      save();
      return ticket;
    },

    getTickets: () => data.tickets || [],

    addWithdrawal: (item) => {
      data.withdrawals = data.withdrawals || [];
      item.id = nextId(data.withdrawals);
      item.createdAt = item.createdAt || nowIso().split('T')[0];
      item.status = item.status || 'pending';
      data.withdrawals.unshift(item);
      save();
      return item;
    },

    getWithdrawals: (driverId) => (data.withdrawals || []).filter((w) => !driverId || w.driverId === driverId),

    snapshot: () => clone(data),

    reset: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      data = clone(initialData);
      persist(data);
      return data;
    },

    getData: () => data,

    /* ========== الأمانات (Lost & Found) ========== */
    getLostItems: () => data.lostItems || [],

    addLostItem: (item) => {
      data.lostItems = data.lostItems || [];
      item.id = nextId(data.lostItems);
      item.createdAt = stamp();
      item.status = item.status || 'pending';
      data.lostItems.unshift(item);
      save();
      return item;
    },

    updateLostItem: (id, updates) => {
      const item = (data.lostItems || []).find((i) => i.id === id);
      if (item) { Object.assign(item, updates); save(); }
      return item;
    },
  };
})();

window.DB = DB;
