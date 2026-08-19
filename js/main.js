/**
 * النواة العامة لتطبيق تكسي دجلة — الناصرية
 */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  function revealApp() {
    const splash = byId('splash');
    const app = byId('app');

    if (app) app.classList.remove('hidden');
    if (!splash) return;

    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    window.setTimeout(() => splash.remove(), 500);
  }

  function showPage(pageId) {
    const target = byId(pageId);
    if (!target) return;

    all('.page').forEach((page) => page.classList.remove('active'));
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectAuthTab(tab, preferredRole) {
    const registering = tab === 'register';
    byId('loginForm')?.classList.toggle('hidden', registering);
    byId('registerForm')?.classList.toggle('hidden', !registering);
    byId('registerTypeSelector')?.classList.toggle('hidden', !registering);

    all('.auth-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });

    const title = byId('authTitle');
    if (title) title.textContent = registering ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
    if (preferredRole) selectRole(preferredRole);
  }

  function selectRole(role) {
    const roleInput = byId('registerRole');
    if (roleInput) roleInput.value = role;
    byId('driverFields')?.classList.toggle('hidden', role !== 'driver');
    all('.role-option').forEach((button) => {
      button.classList.toggle('selected', button.dataset.role === role);
    });
  }

  function openAuth(tab = 'login', role = 'customer') {
    selectAuthTab(tab, role);
    showPage('authPage');
  }

  function userForSession(session) {
    if (!session || !window.DB) return null;
    if (session.role === 'customer') return DB.findCustomerById(session.userId);
    if (session.role === 'driver') return DB.findDriverById(session.userId);
    if (session.role === 'admin') return DB.findAdminByEmail('admin@dijla.iq');
    return null;
  }

  function fillText(id, value) {
    const element = byId(id);
    if (element && value !== undefined && value !== null) element.textContent = value;
  }

  function enterDashboard(session, suppliedUser) {
    const user = suppliedUser || userForSession(session);
    if (!session || !user) {
      showPage('landingPage');
      return;
    }

    if (session.role === 'customer') {
      const fullName = `${user.firstName} ${user.lastName}`;
      fillText('custAvatar', user.firstName?.[0] || 'ز');
      fillText('custName', fullName);
      fillText('greetName', user.firstName);
      fillText('custRating', user.rating);
      fillText('custTrips', `${user.trips || 0} رحلة`);
      fillText('totalTripsCount', user.trips || 0);
      showPage('customerApp');
      window.setTimeout(() => {
        if (window.L && window.Maps) Maps.initCustomerMap?.();
        window.App?.onEnterDashboard?.(session, user);
      }, 120);
    } else if (session.role === 'driver') {
      fillText('driverAvatar', user.firstName?.[0] || 'س');
      fillText('driverName', `${user.firstName} ${user.lastName}`);
      fillText('driverRating', user.rating);
      showPage('driverApp');
      window.setTimeout(() => {
        if (window.L && window.Maps) Maps.initDriverMap?.();
        window.App?.onEnterDashboard?.(session, user);
      }, 120);
    } else {
      showPage('adminApp');
      window.setTimeout(() => window.App?.onEnterDashboard?.(session, user), 80);
    }
  }

  function handleAuthResult(result) {
    if (!result?.success) {
      toast(result?.message || 'تعذر تسجيل الدخول', 'error');
      return;
    }
    toast('تم تسجيل الدخول بنجاح', 'success');
    enterDashboard(Auth.getSession(), result.user || userForSession(Auth.getSession()));
  }

  function quickLogin(role) {
    if (!window.Auth) return toast('تعذر تشغيل نظام تسجيل الدخول', 'error');
    handleAuthResult(Auth.quickLogin(role), role);
  }

  function logout() {
    window.Maps?.stopTracking?.();
    window.Auth?.logout();
    showPage('landingPage');
    toast('تم تسجيل الخروج', 'success');
  }

  let toastTimer;
  function toast(message, type = 'info') {
    const element = byId('toast');
    if (!element) return;
    window.clearTimeout(toastTimer);
    element.textContent = message;
    element.className = `toast show ${type}`;
    toastTimer = window.setTimeout(() => element.classList.remove('show'), 3200);
  }

  function switchDashboardTab(tabId, sourceButton) {
    const target = byId(tabId);
    if (!target) return;
    const dashboard = target.closest('.dashboard');
    if (!dashboard) return;
    all('.dash-tab', dashboard).forEach((tab) => tab.classList.remove('active'));
    target.classList.add('active');
    all('.bnav-btn', dashboard).forEach((button) => {
      button.classList.toggle('active', button === sourceButton || button.dataset.tab === tabId);
    });

    window.setTimeout(() => {
      if (window.L && window.Maps) {
        if (tabId === 'custBook') Maps.initBookingMap?.();
        if (tabId === 'custHome') Maps.initCustomerMap?.();
        if (tabId === 'custTrip') Maps.initTrackingMap?.();
        if (tabId === 'driverHome') Maps.initDriverMap?.();
      }
      window.App?.onTabChange?.(tabId);
    }, 80);
  }

  function openModal(id) {
    byId(id)?.classList.add('active', 'show');
  }

  function closeModal(id) {
    byId(id)?.classList.remove('active', 'show');
  }

  function openNotifications() {
    const list = byId('notificationsList');
    const session = window.Auth?.getSession();
    if (list && session && window.DB) {
      const notifications = DB.getUserNotifications(session.userId, session.role);
      list.innerHTML = notifications.length
        ? notifications.map((item) => `<div class="notification-item ${item.read ? '' : 'unread'}"><strong>${item.title}</strong><p>${item.message}</p></div>`).join('')
        : '<p class="muted">لا توجد إشعارات حالياً</p>';
      DB.markAllNotificationsRead(session.userId, session.role);
    }
    openModal('notificationsModal');
  }

  function toggleDarkMode() {
    const root = document.documentElement;
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    byId('darkModeSwitch')?.classList.toggle('on', dark);
    try { localStorage.setItem('dijla_theme', root.dataset.theme); } catch (_) {}
  }

  async function mockUpload(box, label) {
    const kindMap = {
      'هوية الأحوال المدنية': 'id',
      'هوية الأحوال': 'id',
      'رخصة القيادة': 'license',
      'إسناد السيارة': 'ownership',
      'التأمين': 'insurance',
      'بوليصة التأمين': 'insurance'
    };
    const kind = box?.dataset?.doc || kindMap[label] || 'id';
    let input = box.querySelector('input[type="file"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';
      input.hidden = true;
      box.appendChild(input);
    }
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await window.App?.captureRegisterDoc?.(kind, input, box);
    };
    input.click();
  }

  function submitContact(event) {
    event?.preventDefault();
    const form = event?.target;
    const name = form?.querySelector('input[type="text"]')?.value?.trim();
    const email = form?.querySelector('input[type="email"]')?.value?.trim();
    const subject = form?.querySelector('select')?.value;
    const message = form?.querySelector('textarea')?.value?.trim();
    if (window.DB?.addTicket) {
      DB.addTicket({
        name: name || 'زائر',
        email: email || '',
        subject: subject || 'استفسار',
        message: message || '',
        city: 'الناصرية'
      });
    }
    form?.reset();
    toast('تم حفظ رسالتك في قاعدة البيانات، سنتواصل معك قريباً', 'success');
  }

  function bindEvents() {
    all('.auth-tab').forEach((button) => {
      button.addEventListener('click', () => selectAuthTab(button.dataset.tab));
    });
    all('.role-option').forEach((button) => {
      button.addEventListener('click', () => selectRole(button.dataset.role));
    });
    all('.bnav-btn[data-tab]').forEach((button) => {
      button.addEventListener('click', () => switchDashboardTab(button.dataset.tab, button));
    });

    byId('loginForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = byId('loginEmail')?.value.trim();
      const password = byId('loginPassword')?.value;
      const role = email === 'admin@dijla.iq' ? 'admin' :
        window.DB?.findDriverByEmail(email) ? 'driver' : 'customer';
      handleAuthResult(Auth.login(email, password, role), role);
    });

    byId('registerForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const role = byId('registerRole')?.value || 'customer';
      const docs = window.App?.takePendingDocs?.() || {};
      const result = Auth.register({
        firstName: byId('regFirstName')?.value.trim(),
        lastName: byId('regLastName')?.value.trim(),
        email: byId('regEmail')?.value.trim(),
        phone: byId('regPhone')?.value.trim(),
        password: byId('regPassword')?.value,
        carType: byId('regCarType')?.value,
        carModel: byId('regCarModel')?.value.trim(),
        plate: byId('regPlate')?.value.trim(),
        license: byId('regLicense')?.value.trim(),
        documents: docs
      }, role);

      if (!result.success) return toast(result.message, 'error');
      toast(result.pending ? result.message : 'تم إنشاء الحساب، يمكنك تسجيل الدخول الآن', 'success');
      selectAuthTab('login');
      event.target.reset();
      all('#driverFields .upload-box').forEach((box) => {
        box.classList.remove('uploaded');
        const small = box.querySelector('small');
        if (small) small.textContent = 'اضغط لرفع';
      });
    });

    all('#driverFields .upload-box').forEach((box) => {
      const kind = box.dataset.doc;
      const input = box.querySelector('input[type="file"]');
      if (!input) return;
      box.addEventListener('click', (e) => {
        if (e.target === input) return;
        input.click();
      });
      input.addEventListener('change', () => {
        window.App?.captureRegisterDoc?.(kind, input, box);
      });
    });
  }

  function init() {
    try {
      const savedTheme = localStorage.getItem('dijla_theme');
      if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    } catch (_) {}

    bindEvents();
    window.App?.init?.();
    revealApp();

    const session = window.Auth?.getSession();
    if (session) enterDashboard(session);
  }

  Object.assign(window, {
    revealApp, showPage, openAuth, quickLogin, logout, toast,
    closeModal, openNotifications, toggleDarkMode, mockUpload,
    submitContact,
    switchCustTab: (id) => switchDashboardTab(id),
    switchAdminTab: (id) => switchDashboardTab(id),
    openWallet: () => switchDashboardTab('custWallet')
  });

  init();
})();
