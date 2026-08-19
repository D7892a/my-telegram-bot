/**
 * تطبيق تكسي دجلة — الناصرية
 * حجز، تسعير حسب نوع السيارة، تتبع حقيقي، مستمسكات، إعدادات
 */
const App = (() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const all = (selector, root = document) => [...(root || document).querySelectorAll(selector)];

  const state = {
    from: null,
    to: null,
    route: null,
    vehicle: 'comfort',
    coupon: null,
    payment: 'cash',
    fare: 0,
    breakdown: null,
    ride: null,
    rating: 5,
    tip: 0,
    tags: [],
    searchTimer: null,
    requestTimer: null,
    bound: false,
    pendingDocs: {},
    trackPhase: null
  };

  const VEHICLE_META = {
    economy: { label: 'اقتصادي', eta: '3-5 دقائق' },
    comfort: { label: 'كومفورت', eta: '2-4 دقائق' },
    premium: { label: 'بريميوم', eta: '5-8 دقائق' },
    van: { label: 'عائلي', eta: '7-10 دقائق' }
  };

  const PLACE_ICONS = {
    البيت: 'fa-house',
    العمل: 'fa-briefcase',
    الجامعة: 'fa-graduation-cap',
    السوق: 'fa-store',
    المول: 'fa-bag-shopping'
  };

  const DOC_LABELS = {
    id: 'هوية الأحوال',
    license: 'رخصة القيادة',
    ownership: 'إسناد السيارة',
    insurance: 'بوليصة التأمين'
  };

  function toast(message, type = 'info') {
    if (typeof window.toast === 'function') window.toast(message, type);
  }

  function formatIQD(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('en-US')} د.ع`;
  }

  function formatKm(km) {
    return `${Number(km).toFixed(1)} كم`;
  }

  function formatMin(min) {
    const n = Math.max(1, Math.round(min));
    return n >= 60 ? `${Math.floor(n / 60)} س ${n % 60} د` : `${n} دقيقة`;
  }

  function currentUser() {
    const session = window.Auth?.getSession();
    if (!session || !window.DB) return null;
    if (session.role === 'customer') return DB.findCustomerById(session.userId);
    if (session.role === 'driver') return DB.findDriverById(session.userId);
    if (session.role === 'admin') return DB.findAdminByEmail('admin@dijla.iq');
    return null;
  }

  function currentSession() {
    return window.Auth?.getSession() || null;
  }

  function cityCenter() {
    return window.Maps?.CITY_CENTER || [31.0452, 46.2561];
  }

  function surgeInfo() {
    const hour = new Date().getHours();
    const pricing = DB.getPricing();
    if (hour >= 22 || hour < 6) {
      return { key: 'night', label: 'زيادة ليلية', multiplier: pricing.surgeMultipliers?.night || 1.3 };
    }
    if ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)) {
      return { key: 'peak', label: 'زيادة الذروة', multiplier: pricing.surgeMultipliers?.peak || 1.5 };
    }
    return { key: 'normal', label: 'سعر عادي', multiplier: 1 };
  }

  function calcFareFor(type, distanceKm, coupon) {
    const pricing = DB.getPricing();
    const kind = DB.normalizeCarType(type);
    const km = Math.max(Number(distanceKm) || 0, 0.4);
    const perKm = pricing.perKm?.[kind] || pricing.perKm?.comfort || 800;
    const surge = surgeInfo();
    const base = Number(pricing.base) || 1000;
    const raw = (base + km * perKm) * surge.multiplier;
    const beforeDiscount = Math.max(raw, Number(pricing.minimum) || 3000);
    let discount = 0;
    if (coupon?.type === 'percent') discount = beforeDiscount * (coupon.discount / 100);
    else if (coupon?.type === 'fixed') discount = coupon.discount;
    const total = Math.max(Math.round((beforeDiscount - discount) / 100) * 100, Number(pricing.minimum) || 3000);
    return {
      type: kind,
      km,
      base,
      perKm,
      surge,
      beforeDiscount: Math.round(beforeDiscount / 100) * 100,
      discount: Math.round(discount),
      total
    };
  }

  function recalc() {
    if (!state.route) {
      state.fare = 0;
      state.breakdown = null;
      renderFare();
      return null;
    }
    state.breakdown = calcFareFor(state.vehicle, state.route.distance, state.coupon);
    state.fare = state.breakdown.total;
    renderFare();
    return state.breakdown;
  }

  function availableCount(type) {
    return (DB.getDriversByType?.(type, true) || []).length;
  }

  function renderFare() {
    const distanceEl = byId('routeDistance');
    const durationEl = byId('routeDuration');
    const priceEl = byId('routePrice');
    const btnPrice = byId('bookBtnPrice');
    const breakdown = byId('fareBreakdown');

    all('#vehicleTypes .vehicle-card').forEach((card) => {
      const type = card.dataset.type;
      const count = availableCount(type);
      let meta = card.querySelector('.v-avail');
      if (!meta) {
        meta = document.createElement('span');
        meta.className = 'v-avail';
        card.querySelector('.v-info')?.appendChild(meta);
      }
      meta.textContent = count ? `${count} سائق متاح` : 'لا يوجد سائق الآن';
      card.classList.toggle('unavailable', count === 0);
    });

    if (!state.route) {
      if (distanceEl) distanceEl.textContent = '--';
      if (durationEl) durationEl.textContent = '--';
      if (priceEl) priceEl.textContent = '--';
      if (btnPrice) btnPrice.textContent = '-- د.ع';
      all('.v-price-val').forEach((el) => { el.textContent = '--'; });
      if (breakdown) breakdown.innerHTML = '<p class="muted">حدد الانطلاق والوجهة داخل الناصرية حتى يتحسب المبلغ فوراً</p>';
      return;
    }

    if (distanceEl) distanceEl.textContent = formatKm(state.route.distance);
    if (durationEl) durationEl.textContent = formatMin(state.route.duration);
    if (priceEl) priceEl.textContent = formatIQD(state.fare);
    if (btnPrice) btnPrice.textContent = formatIQD(state.fare);

    all('#vehicleTypes .vehicle-card').forEach((card) => {
      const type = card.dataset.type;
      const info = calcFareFor(type, state.route.distance, state.coupon);
      const val = card.querySelector('.v-price-val');
      if (val) val.textContent = info.total.toLocaleString('en-US');
    });

    if (breakdown && state.breakdown) {
      const b = state.breakdown;
      breakdown.innerHTML = `
        <div class="fb-row"><span>نوع الرحلة</span><strong>${VEHICLE_META[b.type]?.label || b.type}</strong></div>
        <div class="fb-row"><span>سعر الانطلاق</span><strong>${formatIQD(b.base)}</strong></div>
        <div class="fb-row"><span>المسافة ${formatKm(b.km)} × ${b.perKm.toLocaleString('en-US')}</span><strong>${formatIQD(b.km * b.perKm)}</strong></div>
        <div class="fb-row"><span>${b.surge.label}${b.surge.multiplier > 1 ? ` ×${b.surge.multiplier}` : ''}</span><strong>${b.surge.multiplier > 1 ? 'مفعّلة' : 'بدون زيادة'}</strong></div>
        ${b.discount ? `<div class="fb-row save"><span>خصم ${state.coupon.code}</span><strong>- ${formatIQD(b.discount)}</strong></div>` : ''}
        <div class="fb-row total"><span>المبلغ النهائي</span><strong>${formatIQD(b.total)}</strong></div>
      `;
    }
  }

  function setInput(id, value) {
    const el = byId(id);
    if (el) el.value = value || '';
  }

  function updatePickHint() {
    const hint = byId('mapPickHint');
    const fromBtn = byId('pickFromBtn');
    const toBtn = byId('pickToBtn');
    const mode = Maps.getPickMode?.() || 'auto';
    fromBtn?.classList.toggle('active', mode === 'from' || (mode === 'auto' && !state.from));
    toBtn?.classList.toggle('active', mode === 'to' || (mode === 'auto' && !!state.from && !state.to));
    if (!hint) return;
    if (!state.from) hint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> اضغط على الخريطة لتحديد <strong>نقطة الانطلاق داخل الناصرية</strong>';
    else if (!state.to) hint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> هسه حدد <strong>الوجهة</strong> من الخريطة أو أحياء الناصرية';
    else hint.innerHTML = '<i class="fa-solid fa-route"></i> تقدر تسحب العلامات أو تغير النقاط. المبلغ محسوب تلقائياً';
  }

  function rejectOutside() {
    toast('الخدمة حالياً داخل الناصرية فقط. اختر نقطة داخل المدينة', 'error');
  }

  function setFrom(lat, lng, label) {
    if (Maps.isInsideCity && !Maps.isInsideCity(lat, lng)) {
      rejectOutside();
      return;
    }
    const name = label || Maps.reverseGeocode(lat, lng);
    state.from = { lat, lng, label: name, coords: [lat, lng] };
    setInput('bookFrom', name);
    hideSuggest('fromSuggest');
    Maps.setFromPoint(lat, lng, name, true);
    updatePickHint();
    if (state.to) applyRoute();
  }

  function setTo(lat, lng, label) {
    if (Maps.isInsideCity && !Maps.isInsideCity(lat, lng)) {
      rejectOutside();
      return;
    }
    const name = label || Maps.reverseGeocode(lat, lng);
    state.to = { lat, lng, label: name, coords: [lat, lng] };
    setInput('bookTo', name);
    hideSuggest('toSuggest');
    Maps.setToPoint(lat, lng, name, true);
    updatePickHint();
    if (state.from) applyRoute();
  }

  async function applyRoute() {
    if (!state.from || !state.to) return;
    const route = await Maps.calculateRoute();
    if (route) {
      state.route = route;
      recalc();
    }
  }

  function clearBooking(keepVehicle) {
    state.from = null;
    state.to = null;
    state.route = null;
    state.fare = 0;
    state.breakdown = null;
    if (!keepVehicle) state.coupon = null;
    setInput('bookFrom', '');
    setInput('bookTo', '');
    if (byId('couponCode')) byId('couponCode').value = '';
    if (byId('couponMsg')) {
      byId('couponMsg').textContent = '';
      byId('couponMsg').className = '';
    }
    Maps.resetBookingMap?.();
    Maps.setPickMode?.('auto');
    updatePickHint();
    renderFare();
  }

  function useCurrentLocation(target = 'from') {
    toast('جاري تحديد موقعك داخل الناصرية...', 'info');
    Maps.locateUser((coords, reason) => {
      const point = coords || cityCenter();
      if (reason === 'outside') {
        toast('موقعك خارج الناصرية. تم توسيط الخريطة على مركز المدينة', 'error');
      }
      const label = Maps.reverseGeocode(point[0], point[1]);
      if (target === 'to') setTo(point[0], point[1], label);
      else setFrom(point[0], point[1], 'موقعي الحالي · ' + label);
      if (reason !== 'outside') toast('تم تحديد الموقع', 'success');
    });
  }

  function locateMe() {
    Maps.locateUser((coords, reason) => {
      Maps.flyTo(coords || cityCenter(), 15);
      toast(reason === 'outside' ? 'خدمتنا داخل الناصرية فقط' : 'تم توسيط الخريطة على موقعك', reason === 'outside' ? 'error' : 'success');
    });
  }

  function renderCityPlaces() {
    const box = byId('baghdadPlaces') || byId('nasiriyahPlaces');
    if (!box) return;
    box.innerHTML = Maps.PLACES.map((p) =>
      `<button type="button" class="place-chip" data-lat="${p.coords[0]}" data-lng="${p.coords[1]}" data-name="${p.name}">
        <i class="fa-solid fa-location-dot"></i>${p.name}
      </button>`
    ).join('');
    box.querySelectorAll('.place-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const name = btn.dataset.name;
        const mode = Maps.getPickMode?.() || 'auto';
        if (mode === 'to' || (mode === 'auto' && state.from && !state.to) || (state.from && !state.to)) {
          setTo(lat, lng, name);
          toast(`تم تحديد الوجهة: ${name}`, 'success');
        } else {
          setFrom(lat, lng, name);
          Maps.setPickMode('to');
          toast(`تم تحديد الانطلاق: ${name} — هسه اختر الوجهة`, 'success');
        }
        updatePickHint();
      });
    });
  }

  function hideSuggest(id) {
    const el = byId(id);
    if (el) {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }

  function renderSuggest(id, results, onPick) {
    const el = byId(id);
    if (!el) return;
    if (!results.length) {
      hideSuggest(id);
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = results.map((r, i) => `
      <button type="button" class="suggest-item" data-i="${i}">
        <i class="fa-solid fa-location-dot"></i>
        <span><strong>${r.name}</strong><small>${r.address || r.fullName || ''}</small></span>
      </button>
    `).join('');
    el.querySelectorAll('.suggest-item').forEach((btn) => {
      btn.addEventListener('click', () => onPick(results[Number(btn.dataset.i)]));
    });
  }

  async function typeSearch(which, query) {
    const results = await Maps.searchPlace(query);
    renderSuggest(which === 'from' ? 'fromSuggest' : 'toSuggest', results, (place) => {
      const [lat, lng] = place.coords;
      if (which === 'from') setFrom(lat, lng, place.name);
      else setTo(lat, lng, place.name);
    });
  }

  async function searchPlace() {
    const input = byId('placeSearch');
    const box = byId('searchResults');
    const query = input?.value.trim();
    if (!query) return toast('اكتب اسم الحي أو المكان في الناصرية', 'error');
    const results = await Maps.searchPlace(query);
    if (!box) return;
    if (!results.length) {
      box.classList.remove('hidden');
      box.innerHTML = '<div class="search-result-item"><span>ماكو نتائج بهالاسم داخل الناصرية</span></div>';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = results.map((r, i) => `
      <div class="search-result-item" data-i="${i}">
        <i class="fa-solid fa-location-dot"></i>
        <div><strong>${r.name}</strong><small>${r.address || r.fullName || ''}</small></div>
      </div>
    `).join('');
    box.querySelectorAll('.search-result-item').forEach((row) => {
      row.addEventListener('click', () => {
        const place = results[Number(row.dataset.i)];
        box.classList.add('hidden');
        startBookingTo(place.coords[0], place.coords[1], place.name);
      });
    });
  }

  function startBookingTo(lat, lng, label) {
    switchCustTabSafe('custBook');
    const current = Maps.getCurrentCoords();
    const origin = (current && Maps.isInsideCity(current[0], current[1])) ? current : cityCenter();
    setFrom(origin[0], origin[1], current ? 'موقعي الحالي' : 'مركز الناصرية');
    setTo(lat, lng, label);
    Maps.setPickMode('auto');
    updatePickHint();
  }

  function startBookingFromSaved(place) {
    startBookingTo(place.coords[0], place.coords[1], place.name || place.address);
  }

  function openDestPicker() {
    Maps.setPickMode('to');
    updatePickHint();
    const list = byId('destPickerList');
    if (list) {
      list.innerHTML = Maps.PLACES.map((p) => `
        <button type="button" class="dest-item" data-lat="${p.coords[0]}" data-lng="${p.coords[1]}" data-name="${p.name}">
          <i class="fa-solid fa-map-pin"></i>
          <span><strong>${p.name}</strong><small>${p.address}</small></span>
        </button>
      `).join('');
      list.querySelectorAll('.dest-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTo(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng), btn.dataset.name);
          closeModal('destPickerModal');
          toast('تم تحديد الوجهة', 'success');
        });
      });
    }
    openModal('destPickerModal');
  }

  function selectVehicle(type, card) {
    const kind = DB.normalizeCarType(type || 'comfort');
    const changed = state.vehicle !== kind;
    state.vehicle = kind;
    all('#vehicleTypes .vehicle-card').forEach((el) => el.classList.remove('selected'));
    const target = card?.closest?.('.vehicle-card') || card || document.querySelector(`#vehicleTypes .vehicle-card[data-type="${kind}"]`);
    target?.classList.add('selected');
    recalc();
    if (!changed) return;
    const count = availableCount(kind);
    toast(count
      ? `تم اختيار ${VEHICLE_META[kind].label} — ${count} سائق متاح`
      : `تم اختيار ${VEHICLE_META[kind].label} — حالياً ماكو سائق بهالنوع`, count ? 'success' : 'info');
  }

  function applyCoupon() {
    const input = byId('couponCode');
    const msg = byId('couponMsg');
    const code = input?.value.trim();
    if (!code) {
      state.coupon = null;
      if (msg) {
        msg.textContent = '';
        msg.className = '';
      }
      recalc();
      return;
    }
    const result = DB.validateCoupon(code);
    if (!result.valid) {
      state.coupon = null;
      if (msg) {
        msg.textContent = result.message;
        msg.className = 'error';
      }
      toast(result.message, 'error');
      recalc();
      return;
    }
    state.coupon = result.coupon;
    if (msg) {
      msg.textContent = `تم تطبيق خصم ${result.coupon.discount}%`;
      msg.className = 'success';
    }
    toast(`تم تطبيق كود ${result.coupon.code}`, 'success');
    recalc();
  }

  function applyPromoCode(code) {
    switchCustTabSafe('custBook');
    if (byId('couponCode')) byId('couponCode').value = code;
    applyCoupon();
  }

  function nearestDriver(type) {
    const wanted = DB.normalizeCarType(type || state.vehicle);
    let drivers = DB.getDriversByType?.(wanted, true) || [];
    if (!drivers.length) {
      drivers = (DB.getDrivers?.() || []).filter((d) => d.status === 'approved' && DB.normalizeCarType(d.carType) === wanted);
    }
    if (!drivers.length) return null;
    if (!state.from) return drivers[0];
    return drivers.slice().sort((a, b) => {
      const da = Maps.haversine(state.from.coords, [a.location.lat, a.location.lng]);
      const db = Maps.haversine(state.from.coords, [b.location.lat, b.location.lng]);
      return da - db;
    })[0];
  }

  function findDriver() {
    if (!state.from || !state.to) {
      toast('حدد نقطة الانطلاق والوجهة داخل الناصرية أولاً', 'error');
      Maps.setPickMode(state.from ? 'to' : 'from');
      updatePickHint();
      return;
    }
    if (!state.route) {
      applyRoute().then(() => {
        if (state.route) findDriver();
        else toast('تعذر حساب المسار، حاول مرة ثانية', 'error');
      });
      return;
    }
    recalc();
    const user = currentUser();
    if (state.payment === 'wallet' && user && (user.wallet || 0) < state.fare) {
      toast('رصيد المحفظة لا يكفي. اشحن أو اختر دفع نقدي', 'error');
      openWalletModal('topup');
      return;
    }

    const driver = nearestDriver(state.vehicle);
    if (!driver) {
      toast(`ماكو سائق ${VEHICLE_META[state.vehicle].label} متاح هسه. جرّب نوع ثاني`, 'error');
      return;
    }

    const steps = all('#searchSteps .search-step');
    steps.forEach((s, i) => {
      s.classList.remove('done', 'active');
      if (i < 2) s.classList.add('done');
      if (i === 2) s.classList.add('active');
    });
    if (byId('searchStatus')) byId('searchStatus').textContent = `ندور على أقرب سائق ${VEHICLE_META[state.vehicle].label} بالناصرية`;
    openModal('searchingModal');

    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      steps[2]?.classList.remove('active');
      steps[2]?.classList.add('done');
      steps[3]?.classList.add('active');
      if (byId('searchStatus')) byId('searchStatus').textContent = 'تم إرسال الطلب، ننتظر قبول السائق';
    }, 1100);

    state.requestTimer = window.setTimeout(() => {
      confirmDriver(driver);
    }, 2200);
  }

  function etaFromDriver(driver) {
    if (!driver?.location || !state.from) return 4;
    const km = Maps.haversine(state.from.coords, [driver.location.lat, driver.location.lng]);
    return Math.max(2, Math.round(km * 3.1));
  }

  function confirmDriver(driver) {
    const session = currentSession();
    const user = currentUser();
    const eta = etaFromDriver(driver);
    const ride = DB.addRide({
      customerId: session?.userId,
      driverId: driver.id,
      customer: user ? `${user.firstName} ${user.lastName}` : 'زبون',
      driver: `${driver.firstName} ${driver.lastName}`,
      from: state.from.label,
      to: state.to.label,
      fromCoords: state.from.coords,
      toCoords: state.to.coords,
      driverStart: [driver.location.lat, driver.location.lng],
      distance: Number(state.route.distance.toFixed(1)),
      duration: Math.round(state.route.duration),
      etaPickup: eta,
      fare: state.fare,
      type: state.vehicle,
      status: 'active',
      payment: state.payment,
      coupon: state.coupon?.code || null,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      rating: 0
    });
    state.ride = ride;
    try { localStorage.setItem('dijla_active_ride', JSON.stringify(ride)); } catch (_) {}

    if (state.coupon) DB.useCoupon(state.coupon.code);
    if (state.payment === 'wallet' && session) {
      DB.updateWallet(session.userId, -state.fare);
      DB.addTransaction({
        userId: session.userId,
        userType: 'customer',
        type: 'payment',
        amount: -state.fare,
        method: 'wallet',
        description: `دفع رحلة - ${state.from.label} إلى ${state.to.label}`
      });
      refreshCustomerHeader();
    }

    DB.addPendingRequest({
      rideId: ride.id,
      customer: ride.customer,
      from: ride.from,
      to: ride.to,
      fare: ride.fare,
      distance: ride.distance,
      type: ride.type,
      driverId: driver.id
    });

    DB.addNotification({
      userId: session?.userId,
      userType: 'customer',
      title: 'تم قبول رحلتك',
      message: `${driver.firstName} ${driver.lastName} جاي من ${driver.location.area || 'الناصرية'} خلال ${eta} دقائق`,
      type: 'trip'
    });

    closeModal('searchingModal');
    fillFoundDriver(driver, ride, eta);
    openModal('driverFoundModal');
  }

  function fillFoundDriver(driver, ride, eta) {
    const minutes = eta || ride.etaPickup || 4;
    const card = document.querySelector('#driverFoundModal .found-driver-card');
    if (card) {
      card.innerHTML = `
        <div class="fd-photo driver-avatar">${driver.firstName?.[0] || 'س'}</div>
        <div class="fd-info">
          <strong>${driver.firstName} ${driver.lastName}</strong>
          <span class="muted"><i class="fa-solid fa-star text-yellow"></i> ${driver.rating} (${driver.trips || 0} رحلة)</span>
          <span class="car-plate">${driver.carModel || ''} • ${driver.color || ''} • ${driver.plate || ''}</span>
          <span class="muted small">ينطلق من ${driver.location?.area || 'الناصرية'}</span>
        </div>
        <div class="fd-eta"><strong>${minutes}</strong><span>دقيقة</span></div>
      `;
    }
    const p = document.querySelector('#driverFoundModal > p');
    if (p) p.textContent = `${driver.firstName} ${driver.lastName} جاي من ${driver.location?.area || 'الناصرية'} إليك`;
    if (byId('tripFromText2')) byId('tripFromText2').textContent = ride.from;
    if (byId('tripToText2')) byId('tripToText2').textContent = ride.to;
    if (byId('tripDistText2')) byId('tripDistText2').textContent = formatKm(ride.distance);
    if (byId('tripFareText2')) byId('tripFareText2').textContent = formatIQD(ride.fare);
  }

  function goToTrip() {
    closeModal('driverFoundModal');
    fillTripScreen();
    switchCustTabSafe('custTrip');
    startLiveTracking();
  }

  function startLiveTracking() {
    const ride = state.ride;
    if (!ride) return;
    const driver = DB.findDriverById(ride.driverId) || {
      firstName: (ride.driver || 'ك').split(' ')[0],
      location: ride.driverStart ? { lat: ride.driverStart[0], lng: ride.driverStart[1] } : null
    };
    setTripStep(1);
    state.trackPhase = 'to_pickup';
    Maps.initTrackingMap?.();
    Maps.startTracking(ride.fromCoords, ride.toCoords, driver);
  }

  function fillTripScreen() {
    const ride = state.ride;
    if (!ride) return;
    const driver = DB.findDriverById(ride.driverId) || {
      firstName: (ride.driver || 'سائق').split(' ')[0],
      lastName: '',
      rating: 4.9,
      trips: 0,
      plate: '',
      phone: '0790 111 2233'
    };
    if (byId('driverPhoto')) byId('driverPhoto').textContent = driver.firstName?.[0] || 'س';
    if (byId('tripDriverName')) byId('tripDriverName').textContent = `${driver.firstName} ${driver.lastName || ''}`.trim();
    if (byId('tripDriverRating')) byId('tripDriverRating').textContent = driver.rating;
    if (byId('tripDriverTrips')) byId('tripDriverTrips').textContent = `${driver.trips || 0} رحلة`;
    if (byId('tripDriverPlate')) byId('tripDriverPlate').textContent = driver.plate || ride.driver;
    if (byId('tripFromText')) byId('tripFromText').textContent = ride.from;
    if (byId('tripToText')) byId('tripToText').textContent = ride.to;
    if (byId('tripDistance')) byId('tripDistance').textContent = formatKm(ride.distance);
    if (byId('tripETA')) byId('tripETA').textContent = formatMin(ride.etaPickup || ride.duration || ride.distance * 2.6);
    if (byId('tripFare')) byId('tripFare').textContent = formatIQD(ride.fare);
  }

  function cancelSearch() {
    window.clearTimeout(state.searchTimer);
    window.clearTimeout(state.requestTimer);
    closeModal('searchingModal');
    closeModal('driverFoundModal');
    if (state.ride && state.ride.status === 'active') {
      DB.updateRide(state.ride.id, { status: 'cancelled' });
      state.ride = null;
      try { localStorage.removeItem('dijla_active_ride'); } catch (_) {}
    }
    toast('تم إلغاء البحث', 'info');
  }

  function cancelTrip() {
    if (!state.ride) {
      switchCustTabSafe('custHome');
      return;
    }
    if (!window.confirm('تأكيد إلغاء الرحلة؟ قد تُحتسب رسوم إلغاء بسيطة.')) return;
    Maps.stopTracking?.();
    DB.updateRide(state.ride.id, { status: 'cancelled' });
    state.ride = null;
    try { localStorage.removeItem('dijla_active_ride'); } catch (_) {}
    toast('تم إلغاء الرحلة', 'success');
    switchCustTabSafe('custHome');
    renderCustomerTrips();
  }

  function setTripStep(index) {
    all('#custTrip .trip-step').forEach((step, i) => {
      step.classList.remove('done', 'active');
      if (i < index) step.classList.add('done');
      if (i === index) step.classList.add('active');
    });
  }

  function simulateArrival() {
    if (!state.ride) return toast('ماكو رحلة نشطة', 'error');
    if (state.trackPhase === 'to_dest') {
      setTripStep(3);
      completeCustomerTrip();
      return;
    }
    setTripStep(2);
    toast('السائق وصل لموقعك، الرحلة بدأت', 'success');
    state.trackPhase = 'to_dest';
  }

  function completeCustomerTrip() {
    if (!state.ride) return;
    Maps.stopTracking?.();
    DB.updateRide(state.ride.id, { status: 'completed' });
    const session = currentSession();
    const user = currentUser();
    if (user) DB.updateCustomer(user.id, { trips: (user.trips || 0) + 1 });
    if (state.ride.driverId) {
      const driver = DB.findDriverById(state.ride.driverId);
      if (driver) {
        const commission = (DB.getPricing().commission || 15) / 100;
        const net = Math.round(state.ride.fare * (1 - commission));
        DB.updateDriver(driver.id, {
          trips: (driver.trips || 0) + 1,
          earnings: (driver.earnings || 0) + net
        });
      }
    }
    if (session) {
      DB.addNotification({
        userId: session.userId,
        userType: 'customer',
        title: 'اكتملت الرحلة',
        message: 'قيّم السائق وساعدنا نحسّن الخدمة',
        type: 'trip'
      });
    }
    openModal('ratingModal');
  }

  function addTag(btn) {
    btn.classList.toggle('active');
    state.tags = all('.quick-tags .qt.active').map((el) => el.textContent.trim());
  }

  function selectTip(btn, amount) {
    all('.tip-options button').forEach((el) => el.classList.remove('active'));
    btn?.classList.add('active');
    state.tip = Number(amount) || 0;
  }

  function bindRatingStars() {
    all('#ratingStars i').forEach((star) => {
      star.addEventListener('click', () => {
        state.rating = Number(star.dataset.r) || 5;
        all('#ratingStars i').forEach((s) => {
          s.classList.toggle('active', Number(s.dataset.r) <= state.rating);
        });
      });
    });
  }

  function submitRating() {
    const comment = byId('ratingComment')?.value.trim() || '';
    if (state.ride) {
      DB.updateRide(state.ride.id, {
        status: 'completed',
        rating: state.rating,
        comment,
        tip: state.tip
      });
    }
    if (state.tip && currentSession()) {
      DB.updateWallet(currentSession().userId, -state.tip);
      DB.addTransaction({
        userId: currentSession().userId,
        userType: 'customer',
        type: 'payment',
        amount: -state.tip,
        method: state.payment,
        description: 'بقشيش للسائق'
      });
    }
    closeModal('ratingModal');
    state.ride = null;
    try { localStorage.removeItem('dijla_active_ride'); } catch (_) {}
    clearBooking(true);
    toast('شكراً لتقييمك! نتمنى لك يوماً سعيداً', 'success');
    switchCustTabSafe('custHome');
    refreshCustomerHeader();
    renderCustomerTrips();
  }

  function callDriver() {
    const ride = state.ride;
    const driver = ride ? DB.findDriverById(ride.driverId) : currentUser();
    const phone = driver?.phone || '0790 111 2233';
    toast(`اتصال: ${phone}`, 'success');
    try { window.location.href = `tel:${phone.replace(/\s/g, '')}`; } catch (_) {}
  }

  function chatDriver() {
    const list = byId('chatMessages');
    if (list && !list.dataset.ready) {
      list.innerHTML = `
        <div class="chat-bubble them">مرحباً، أنا بالناصرية وفي الطريق إليك الآن 🚕</div>
        <div class="chat-bubble me">تمام، أنتظرك عند الباب</div>
      `;
      list.dataset.ready = '1';
    }
    openModal('chatModal');
  }

  function sendChat() {
    const input = byId('chatInput');
    const list = byId('chatMessages');
    const text = input?.value.trim();
    if (!text || !list) return;
    const mine = document.createElement('div');
    mine.className = 'chat-bubble me';
    mine.textContent = text;
    list.appendChild(mine);
    input.value = '';
    list.scrollTop = list.scrollHeight;
    window.setTimeout(() => {
      const reply = document.createElement('div');
      reply.className = 'chat-bubble them';
      reply.textContent = 'تم، أكمل الطريق حسب المسار.';
      list.appendChild(reply);
      list.scrollTop = list.scrollHeight;
    }, 700);
  }

  function emergencyCall() {
    if (!window.confirm('اتصال بالطوارئ (115) ومشاركة موقع الرحلة داخل الناصرية؟')) return;
    toast('تم إرسال موقعك لجهات الطوارئ والاتصال بـ 115', 'success');
  }

  function shareTrip() {
    const ride = state.ride;
    const text = ride
      ? `أتابع رحلتي على تكسي دجلة الناصرية من ${ride.from} إلى ${ride.to} — الأجرة ${formatIQD(ride.fare)}`
      : 'أشارك رحلتي عبر تكسي دجلة الناصرية';
    if (navigator.share) {
      navigator.share({ title: 'تكسي دجلة', text }).catch(() => {});
    } else {
      try {
        navigator.clipboard.writeText(text);
        toast('تم نسخ تفاصيل الرحلة', 'success');
      } catch (_) {
        toast(text, 'info');
      }
    }
  }

  function renderSavedPlaces() {
    const grid = byId('savedPlacesGrid');
    const user = currentUser();
    if (!grid) return;
    const places = user?.addresses?.length
      ? user.addresses
      : Maps.PLACES.slice(0, 4).map((p, i) => ({
        id: i + 1,
        name: p.name,
        address: p.address,
        coords: p.coords
      }));
    grid.innerHTML = places.map((p) => `
      <button type="button" class="place-card" data-id="${p.id}">
        <div class="place-icon"><i class="fa-solid ${PLACE_ICONS[p.name] || 'fa-location-dot'}"></i></div>
        <div class="place-info"><strong>${p.name}</strong><span>${p.address}</span></div>
      </button>
    `).join('');
    grid.querySelectorAll('.place-card').forEach((card, i) => {
      card.addEventListener('click', () => startBookingFromSaved(places[i]));
    });
  }

  function renderCustomerTrips(filter = 'all') {
    const list = byId('customerTripsList');
    if (!list) return;
    const session = currentSession();
    let rides = session ? DB.getCustomerRides(session.userId) : DB.getRides().slice(0, 12);
    if (filter !== 'all') rides = rides.filter((r) => r.status === filter);
    if (!rides.length) {
      list.innerHTML = '<div class="empty-state">ماكو رحلات بهالتصنيف</div>';
      return;
    }
    list.innerHTML = rides.slice(0, 30).map((r) => `
      <article class="trip-card">
        <div class="trip-card-head">
          <div class="trip-route-line">
            <span class="dot dot-green"></span>${r.from}
            <i class="fa-solid fa-arrow-left"></i>
            <span class="dot dot-red"></span>${r.to}
          </div>
          <div class="trip-fare-big">${Number(r.fare).toLocaleString('en-US')} <small>د.ع</small></div>
        </div>
        <div class="trip-card-foot">
          <span>${r.date || ''} • ${VEHICLE_META[r.type]?.label || ''} • ${r.driver || ''}</span>
          <span class="trip-status ${r.status}">${statusLabel(r.status)}</span>
        </div>
      </article>
    `).join('');
  }

  function statusLabel(status) {
    return { completed: 'مكتملة', active: 'قيد التنفيذ', cancelled: 'ملغية', searching: 'جاري البحث', pending: 'معلق', paid: 'مدفوع' }[status] || status;
  }

  function renderWallet() {
    const user = currentUser();
    const session = currentSession();
    if (!user || !session) return;
    if (byId('walletBalance')) byId('walletBalance').innerHTML = `${Number(user.wallet || 0).toLocaleString('en-US')} <small>د.ع</small>`;
    if (byId('quickBalance')) byId('quickBalance').innerHTML = `${Number(user.wallet || 0).toLocaleString('en-US')} <small>د.ع</small>`;
    const list = byId('walletTransactions');
    if (!list) return;
    const txns = DB.getUserTransactions(session.userId, 'customer');
    list.innerHTML = txns.length ? txns.map((t) => `
      <div class="txn-row">
        <div class="txn-icon ${t.amount >= 0 ? 'in' : 'out'}"><i class="fa-solid ${t.amount >= 0 ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></div>
        <div class="txn-info"><strong>${t.description}</strong><span>${String(t.createdAt).slice(0, 16)}</span></div>
        <div class="txn-amount ${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : ''}${Number(t.amount).toLocaleString('en-US')}</div>
      </div>
    `).join('') : '<div class="empty-state">لا توجد عمليات بعد</div>';
  }

  function openWalletModal(action = 'topup') {
    const title = { topup: 'شحن المحفظة', send: 'تحويل رصيد', withdraw: 'سحب الرصيد', card: 'بطاقة بنكية' }[action] || 'المحفظة';
    if (byId('walletModalTitle')) byId('walletModalTitle').textContent = title;
    if (byId('walletModalAction')) byId('walletModalAction').value = action;
    if (byId('walletAmount')) byId('walletAmount').value = action === 'topup' ? 10000 : '';
    openModal('walletModal');
  }

  function confirmWalletAction() {
    const action = byId('walletModalAction')?.value || 'topup';
    const amount = Number(byId('walletAmount')?.value);
    const session = currentSession();
    const user = currentUser();
    if (!session || !user) return;
    if (!amount || amount <= 0) return toast('أدخل مبلغاً صحيحاً', 'error');
    if (action === 'topup' || action === 'card') {
      DB.updateWallet(session.userId, amount);
      DB.addTransaction({
        userId: session.userId,
        userType: 'customer',
        type: 'topup',
        amount,
        method: action === 'card' ? 'card' : 'wallet',
        description: action === 'card' ? 'شحن ببطاقة بنكية' : 'شحن المحفظة'
      });
      toast(`تم شحن ${formatIQD(amount)}`, 'success');
    } else if (action === 'withdraw' || action === 'send') {
      if ((user.wallet || 0) < amount) return toast('الرصيد لا يكفي', 'error');
      DB.updateWallet(session.userId, -amount);
      DB.addTransaction({
        userId: session.userId,
        userType: 'customer',
        type: action,
        amount: -amount,
        method: 'wallet',
        description: action === 'send' ? 'تحويل رصيد' : 'سحب رصيد'
      });
      toast(action === 'send' ? 'تم التحويل' : 'تم طلب السحب', 'success');
    }
    closeModal('walletModal');
    refreshCustomerHeader();
    renderWallet();
  }

  function manageAddresses() {
    const user = currentUser();
    const list = byId('addressesList');
    const places = user?.addresses || [];
    if (list) {
      list.innerHTML = places.length ? places.map((p) => `
        <button type="button" class="dest-item">
          <i class="fa-solid fa-location-dot"></i>
          <span><strong>${p.name}</strong><small>${p.address}</small></span>
        </button>
      `).join('') : '<p class="muted">لا توجد عناوين محفوظة بعد</p>';
      list.querySelectorAll('.dest-item').forEach((btn, i) => {
        btn.addEventListener('click', () => {
          closeModal('addressesModal');
          startBookingFromSaved(places[i]);
        });
      });
    }
    openModal('addressesModal');
  }

  function saveNewAddress() {
    const name = byId('newAddressName')?.value.trim();
    const address = byId('newAddressText')?.value.trim();
    const session = currentSession();
    if (!name || !address || !session) return toast('أكمل بيانات العنوان', 'error');
    const match = Maps.localSearch(address)[0] || Maps.PLACES[0];
    DB.saveAddress(session.userId, { name, address, coords: match.coords });
    toast('تم حفظ العنوان', 'success');
    if (byId('newAddressName')) byId('newAddressName').value = '';
    if (byId('newAddressText')) byId('newAddressText').value = '';
    renderSavedPlaces();
    manageAddresses();
  }

  function managePromo() {
    const list = byId('promoList');
    const codes = DB.getPromoCodes?.() || [];
    if (list) {
      list.innerHTML = codes.map((c) => `
        <button type="button" class="promo-pick" data-code="${c.code}">
          <strong>${c.code}</strong>
          <span>خصم ${c.discount}${c.type === 'percent' ? '%' : ' د.ع'}</span>
        </button>
      `).join('');
      list.querySelectorAll('.promo-pick').forEach((btn) => {
        btn.addEventListener('click', () => {
          closeModal('promoModal');
          applyPromoCode(btn.dataset.code);
        });
      });
    }
    openModal('promoModal');
  }

  function openEditProfile() {
    const user = currentUser();
    const session = currentSession();
    if (!user || !session) return;
    if (byId('editFirstName')) byId('editFirstName').value = user.firstName || '';
    if (byId('editLastName')) byId('editLastName').value = user.lastName || '';
    if (byId('editPhone')) byId('editPhone').value = user.phone || '';
    if (byId('editEmail')) byId('editEmail').value = user.email || '';
    openModal('editProfileModal');
  }

  function saveProfile() {
    const session = currentSession();
    const user = currentUser();
    if (!session || !user) return;
    const updates = {
      firstName: byId('editFirstName')?.value.trim() || user.firstName,
      lastName: byId('editLastName')?.value.trim() || user.lastName,
      phone: byId('editPhone')?.value.trim() || user.phone
    };
    if (session.role === 'customer') DB.updateCustomer(user.id, updates);
    else if (session.role === 'driver') DB.updateDriver(user.id, updates);
    closeModal('editProfileModal');
    toast('تم حفظ بياناتك', 'success');
    refreshCustomerHeader();
    refreshDriverHeader();
  }

  function openPaymentMethods() {
    openModal('paymentsModal');
  }

  function refreshCustomerHeader() {
    const user = currentUser();
    if (!user || !user.firstName) return;
    const fullName = `${user.firstName} ${user.lastName}`;
    const set = (id, val) => { if (byId(id)) byId(id).textContent = val; };
    set('custAvatar', user.firstName?.[0] || 'ز');
    set('custName', fullName);
    set('greetName', user.firstName);
    set('custRating', user.rating);
    set('custTrips', `${user.trips || 0} رحلة`);
    set('totalTripsCount', user.trips || 0);
    set('profileAvatarBig', user.firstName?.[0] || 'ز');
    set('profileNameBig', fullName);
    set('profileEmailBig', user.email);
    set('psTrips', user.trips || 0);
    set('psRating', user.rating);
    if (byId('quickBalance')) byId('quickBalance').innerHTML = `${Number(user.wallet || 0).toLocaleString('en-US')} <small>د.ع</small>`;
    if (byId('walletBalance')) byId('walletBalance').innerHTML = `${Number(user.wallet || 0).toLocaleString('en-US')} <small>د.ع</small>`;
    const spent = (DB.getCustomerRides(user.id) || [])
      .filter((r) => r.status === 'completed')
      .reduce((s, r) => s + (r.fare || 0), 0);
    const spentBox = document.querySelector('#custHome .qs-item:nth-child(2) strong');
    if (spentBox) spentBox.textContent = spent >= 1000 ? `${Math.round(spent / 1000)}K` : spent;
  }

  function restoreActiveRide() {
    try {
      const raw = localStorage.getItem('dijla_active_ride');
      if (!raw) return;
      const ride = JSON.parse(raw);
      const fresh = DB.getRides().find((r) => r.id === ride.id);
      if (fresh && fresh.status === 'active') state.ride = fresh;
      else localStorage.removeItem('dijla_active_ride');
    } catch (_) {}
  }

  /* ========== السائق ========== */
  function toggleOnline() {
    const session = currentSession();
    const driver = currentUser();
    if (!session || !driver) return;
    const next = !driver.online;
    DB.updateDriverOnline(driver.id, next);
    const btn = byId('onlineToggle');
    btn?.classList.toggle('offline', !next);
    if (byId('onlineText')) byId('onlineText').textContent = next ? 'متصل' : 'غير متصل';
    if (byId('waitingState')) byId('waitingState').classList.toggle('hidden', !next);
    toast(next ? 'أنت متصل وتستقبل الطلبات داخل الناصرية' : 'تم إيقاف استقبال الطلبات', 'success');
  }

  function refreshDriverHeader() {
    const driver = currentUser();
    if (!driver || !driver.firstName) return;
    if (byId('driverAvatar')) byId('driverAvatar').textContent = driver.firstName?.[0] || 'س';
    if (byId('driverName')) byId('driverName').textContent = `${driver.firstName} ${driver.lastName}`;
    if (byId('driverRating')) byId('driverRating').textContent = driver.rating;
    if (byId('driverStatus')) byId('driverStatus').textContent = driver.status === 'approved' ? 'معتمد' : 'قيد المراجعة';
    if (byId('driverProfileAvatar')) byId('driverProfileAvatar').textContent = driver.firstName?.[0] || 'س';
    if (byId('driverProfileName')) byId('driverProfileName').textContent = `${driver.firstName} ${driver.lastName}`;
    if (byId('driverCar')) byId('driverCar').textContent = driver.carModel || '';
    if (byId('driverPlate')) byId('driverPlate').textContent = driver.plate || '';
    if (byId('driverArea')) byId('driverArea').textContent = `${driver.location?.area || 'الناصرية'}، الناصرية`;
    if (byId('todayEarnings')) byId('todayEarnings').innerHTML = `${Number(Math.round((driver.earnings || 0) * 0.04)).toLocaleString('en-US')} <small>د.ع</small>`;
    byId('onlineToggle')?.classList.toggle('offline', !driver.online);
    if (byId('onlineText')) byId('onlineText').textContent = driver.online ? 'متصل' : 'غير متصل';
    renderDriverDocsPreview(driver);
  }

  function renderDriverDocsPreview(driver) {
    const box = byId('driverDocsStatus');
    if (!box || !driver) return;
    const kinds = ['id', 'license', 'ownership', 'insurance'];
    box.innerHTML = kinds.map((k) => {
      const ok = DB.hasDocument(driver.documents?.[k]);
      return `<span class="doc-chip ${ok ? 'ok' : 'missing'}"><i class="fa-solid fa-${ok ? 'check' : 'xmark'}"></i> ${DOC_LABELS[k]}</span>`;
    }).join('');
  }

  function renderDriverTrips() {
    const list = byId('driverTripsList');
    const session = currentSession();
    if (!list || !session) return;
    const rides = DB.getDriverRides(session.userId);
    list.innerHTML = rides.length ? rides.slice(0, 25).map((r) => `
      <article class="trip-card">
        <div class="trip-card-head">
          <div class="trip-route-line">
            <span class="dot dot-green"></span>${r.from}
            <i class="fa-solid fa-arrow-left"></i>
            <span class="dot dot-red"></span>${r.to}
          </div>
          <div class="trip-fare-big">${Number(r.fare).toLocaleString('en-US')}</div>
        </div>
        <div class="trip-card-foot">
          <span>${r.customer || ''} • ${r.date || ''}</span>
          <span class="trip-status ${r.status}">${statusLabel(r.status)}</span>
        </div>
      </article>
    `).join('') : '<div class="empty-state">لا توجد رحلات بعد</div>';
  }

  function showIncomingFromPending() {
    const session = currentSession();
    const pendingAll = DB.getPendingRequests?.() || [];
    const pending = pendingAll.find((p) => !p.driverId || p.driverId === session?.userId) || pendingAll[0];
    const box = byId('incomingRequest');
    if (!box) return;
    if (!pending) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    box.dataset.req = pending.id;
    const fromEl = box.querySelector('.rd-row:first-child strong');
    const toEl = box.querySelectorAll('.rd-row strong')[1];
    if (fromEl) fromEl.textContent = pending.from;
    if (toEl) toEl.textContent = pending.to;
    const fare = box.querySelector('.fare-item.highlight strong');
    if (fare) fare.textContent = formatIQD(pending.fare);
    startRequestCountdown();
  }

  function startRequestCountdown() {
    let n = 15;
    const el = byId('requestCountdown');
    window.clearInterval(state.requestTimer);
    state.requestTimer = window.setInterval(() => {
      n -= 1;
      if (el) el.textContent = String(n);
      if (n <= 0) {
        window.clearInterval(state.requestTimer);
        rejectRequest();
      }
    }, 1000);
  }

  function rejectRequest() {
    window.clearInterval(state.requestTimer);
    const box = byId('incomingRequest');
    if (box?.dataset.req) DB.clearPendingRequest(Number(box.dataset.req));
    box?.classList.add('hidden');
    toast('تم رفض الطلب', 'info');
  }

  function acceptRequest() {
    window.clearInterval(state.requestTimer);
    const box = byId('incomingRequest');
    if (box?.dataset.req) DB.clearPendingRequest(Number(box.dataset.req));
    box?.classList.add('hidden');
    byId('waitingState')?.classList.add('hidden');
    byId('activeTrip')?.classList.remove('hidden');
    toast('تم قبول الطلب، توجّه للزبون حسب المسار', 'success');
  }

  function completeTrip() {
    byId('activeTrip')?.classList.add('hidden');
    byId('waitingState')?.classList.remove('hidden');
    toast('تم إنهاء الرحلة وإضافة الأجرة', 'success');
    renderDriverTrips();
    refreshDriverHeader();
  }

  function requestWithdrawal() {
    const driver = currentUser();
    if (!driver) return;
    const amount = Number(window.prompt('مبلغ السحب (د.ع)', '50000'));
    if (!amount || amount <= 0) return;
    DB.addWithdrawal({ driverId: driver.id, amount, status: 'pending' });
    toast('تم إرسال طلب السحب، يصل خلال 24 ساعة', 'success');
    renderPayouts();
  }

  function editVehicle() {
    const driver = currentUser();
    if (!driver) return;
    if (byId('vehModel')) byId('vehModel').value = driver.carModel || '';
    if (byId('vehPlate')) byId('vehPlate').value = driver.plate || '';
    if (byId('vehColor')) byId('vehColor').value = driver.color || '';
    if (byId('vehType')) byId('vehType').value = DB.normalizeCarType(driver.carType);
    openModal('vehicleModal');
  }

  function saveVehicle() {
    const driver = currentUser();
    if (!driver) return;
    DB.updateDriver(driver.id, {
      carModel: byId('vehModel')?.value.trim() || driver.carModel,
      plate: byId('vehPlate')?.value.trim() || driver.plate,
      color: byId('vehColor')?.value.trim() || driver.color,
      carType: byId('vehType')?.value || driver.carType
    });
    closeModal('vehicleModal');
    refreshDriverHeader();
    toast('تم تحديث بيانات السيارة', 'success');
  }

  function openDriverDocs() {
    const driver = currentUser();
    if (!driver) return;
    renderDocsManager(driver, true);
    openModal('docsModal');
  }

  function renderDocsManager(driver, canUpload) {
    const box = byId('docsManager');
    if (!box) return;
    const kinds = ['id', 'license', 'ownership', 'insurance'];
    box.innerHTML = kinds.map((k) => {
      const doc = driver.documents?.[k];
      const ok = DB.hasDocument(doc);
      return `
        <div class="doc-manage-row">
          <div>
            <strong>${DOC_LABELS[k]}</strong>
            <small>${ok ? (doc.name || 'مرفوعة') + ' — ' + (doc.uploadedAt || '') : 'غير مرفوعة'}</small>
          </div>
          <div class="doc-manage-actions">
            ${ok ? `<button type="button" class="btn-secondary" data-view="${k}">عرض</button>` : ''}
            ${canUpload ? `<label class="btn-primary file-label">رفع<input type="file" accept="image/*,.pdf" data-doc="${k}" hidden /></label>` : ''}
          </div>
        </div>
      `;
    }).join('');
    box.querySelectorAll('input[type="file"]').forEach((input) => {
      input.addEventListener('change', () => handleDocFile(driver.id, input.dataset.doc, input.files?.[0], true));
    });
    box.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => viewDocument(driver.id, btn.dataset.view));
    });
  }

  async function handleDocFile(driverId, kind, file, refresh) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast('حجم الملف أكبر من 4 ميغابايت', 'error');
    const dataUrl = await readFileAsDataUrl(file);
    await DB.saveDriverDocument(driverId, kind, {
      name: file.name,
      mime: file.type,
      size: file.size,
      data: dataUrl
    });
    toast(`تم رفع ${DOC_LABELS[kind] || kind}`, 'success');
    if (refresh) {
      const driver = DB.findDriverById(driverId);
      renderDocsManager(driver, true);
      refreshDriverHeader();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function viewDocument(driverId, kind) {
    const stored = await DB.getDriverDocumentFile(driverId, kind);
    const driver = DB.findDriverById(driverId);
    const meta = driver?.documents?.[kind];
    const frame = byId('docViewerBody');
    if (!frame) return;
    if (byId('docViewerTitle')) byId('docViewerTitle').textContent = DOC_LABELS[kind] || 'المستند';
    if (stored?.data) {
      if ((stored.mime || '').includes('pdf')) {
        frame.innerHTML = `<iframe src="${stored.data}" title="مستند"></iframe>`;
      } else {
        frame.innerHTML = `<img src="${stored.data}" alt="${stored.name || kind}" />`;
      }
    } else {
      frame.innerHTML = `<div class="empty-state">${meta?.name || 'تم تسجيل المستند'} — لا توجد معاينة محفوظة لهذا الملف التجريبي</div>`;
    }
    openModal('docViewerModal');
  }

  function renderPayouts() {
    const list = byId('payoutsList');
    const driver = currentUser();
    if (!list) return;
    const items = DB.getWithdrawals?.(driver?.id) || [];
    const rows = items.length ? items : [
      { createdAt: '2026-08-12', amount: 180000, status: 'paid' }
    ];
    list.innerHTML = rows.map((p) => `
      <div class="txn-row">
        <div class="txn-icon in"><i class="fa-solid fa-building-columns"></i></div>
        <div class="txn-info"><strong>سحب إلى الحساب</strong><span>${p.createdAt} • ${statusLabel(p.status)}</span></div>
        <div class="txn-amount plus">+${Number(p.amount).toLocaleString('en-US')}</div>
      </div>
    `).join('');
  }

  function openBankAccount() {
    const driver = currentUser();
    if (!driver) return;
    if (byId('bankName')) byId('bankName').value = driver.bank?.name || '';
    if (byId('bankAccount')) byId('bankAccount').value = driver.bank?.account || '';
    openModal('bankModal');
  }

  function saveBankAccount() {
    const driver = currentUser();
    if (!driver) return;
    DB.updateDriver(driver.id, {
      bank: {
        name: byId('bankName')?.value.trim() || '',
        account: byId('bankAccount')?.value.trim() || ''
      }
    });
    closeModal('bankModal');
    toast('تم حفظ الحساب البنكي', 'success');
  }

  /* ========== الأدمن ========== */
  function renderAdmin() {
    const rides = DB.getRides();
    const pending = (DB.getDrivers() || []).filter((d) => d.status === 'pending');
    if (byId('pendingCount')) byId('pendingCount').textContent = pending.length;
    if (byId('pendingChipCount')) byId('pendingChipCount').textContent = pending.length;
    const body = byId('adminTripsBody');
    if (body) {
      body.innerHTML = rides.slice(0, 8).map((r) => `
        <tr>
          <td>${r.id}</td>
          <td>${r.customer || '-'}</td>
          <td>${r.driver || '-'}</td>
          <td>${r.from} → ${r.to}</td>
          <td>${Number(r.fare).toLocaleString('en-US')}</td>
          <td><span class="trip-status ${r.status}">${statusLabel(r.status)}</span></td>
        </tr>
      `).join('');
    }
    const allBody = byId('allRidesBody');
    if (allBody) {
      allBody.innerHTML = rides.slice(0, 40).map((r) => `
        <tr>
          <td>${r.id}</td>
          <td>${r.customer || '-'}</td>
          <td>${r.driver || '-'}</td>
          <td>${r.from} → ${r.to}</td>
          <td>${Number(r.fare).toLocaleString('en-US')}</td>
          <td>${r.rating || '-'}</td>
          <td>${r.date || ''}</td>
          <td><span class="trip-status ${r.status}">${statusLabel(r.status)}</span></td>
        </tr>
      `).join('');
    }
    renderAdminDrivers(document.querySelector('#adminDrivers .ft-tab.active')?.dataset.filter || 'pending');
    renderAdminUsers();
    fillPricingForm();
    fillSettingsForm();
    drawAdminCharts();
    renderDbStatus();
  }

  function renderDbStatus() {
    const box = byId('dbStatusBox');
    if (!box) return;
    const snap = DB.getData();
    box.innerHTML = `
      <div class="ss-item"><span>الزبائن</span><strong>${snap.users.customers.length}</strong></div>
      <div class="ss-item"><span>السائقون</span><strong>${snap.users.drivers.length}</strong></div>
      <div class="ss-item"><span>الرحلات</span><strong>${snap.rides.length}</strong></div>
      <div class="ss-item"><span>المدينة</span><strong>${snap.city}</strong></div>
    `;
  }

  function renderAdminDrivers(filter = 'pending') {
    const list = byId('adminDriversList');
    if (!list) return;
    let drivers = DB.getDrivers() || [];
    if (filter !== 'all') drivers = drivers.filter((d) => d.status === filter);
    list.innerHTML = drivers.map((d) => `
      <article class="driver-review-card">
        <div class="drv-head">
          <div class="user-avatar">${d.firstName?.[0] || 'س'}</div>
          <div>
            <strong>${d.firstName} ${d.lastName}</strong>
            <span class="muted">${d.carModel || ''} • ${VEHICLE_META[DB.normalizeCarType(d.carType)]?.label || ''} • ${d.phone || ''}</span>
          </div>
        </div>
        <div class="docs-list">
          <span class="doc-chip ${DB.hasDocument(d.documents?.id) ? 'ok' : 'missing'}"><i class="fa-solid fa-${DB.hasDocument(d.documents?.id) ? 'check' : 'xmark'}"></i> هوية</span>
          <span class="doc-chip ${DB.hasDocument(d.documents?.license) ? 'ok' : 'missing'}"><i class="fa-solid fa-${DB.hasDocument(d.documents?.license) ? 'check' : 'xmark'}"></i> رخصة</span>
          <span class="doc-chip ${DB.hasDocument(d.documents?.ownership) ? 'ok' : 'missing'}"><i class="fa-solid fa-${DB.hasDocument(d.documents?.ownership) ? 'check' : 'xmark'}"></i> إسناد</span>
          <span class="doc-chip ${DB.hasDocument(d.documents?.insurance) ? 'ok' : 'missing'}"><i class="fa-solid fa-${DB.hasDocument(d.documents?.insurance) ? 'check' : 'xmark'}"></i> تأمين</span>
        </div>
        <div class="drv-actions">
          <button class="btn-secondary" data-viewdocs="${d.id}">المستمسكات</button>
          ${d.status !== 'approved' ? `<button class="btn-approve" data-id="${d.id}" data-act="approved">اعتماد</button>` : ''}
          ${d.status !== 'blocked' ? `<button class="btn-reject-sm" data-id="${d.id}" data-act="blocked">حظر</button>` : `<button class="btn-approve" data-id="${d.id}" data-act="approved">فك الحظر</button>`}
        </div>
      </article>
    `).join('') || '<div class="empty-state">لا يوجد سائقون في هذا التصنيف</div>';
    list.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        DB.updateDriverStatus(Number(btn.dataset.id), btn.dataset.act);
        if (btn.dataset.act === 'approved') {
          DB.addNotification({
            userId: Number(btn.dataset.id),
            userType: 'driver',
            title: 'تم اعتماد حسابك',
            message: 'يمكنك الآن استقبال الطلبات داخل الناصرية',
            type: 'system'
          });
        }
        toast(btn.dataset.act === 'approved' ? 'تم اعتماد السائق' : 'تم تحديث حالة السائق', 'success');
        renderAdmin();
      });
    });
    list.querySelectorAll('[data-viewdocs]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const driver = DB.findDriverById(Number(btn.dataset.viewdocs));
        if (!driver) return;
        renderDocsManager(driver, false);
        openModal('docsModal');
      });
    });
  }

  function renderAdminUsers() {
    const grid = byId('usersGrid');
    if (!grid) return;
    grid.innerHTML = (DB.getCustomers() || []).map((u) => `
      <article class="user-card">
        <div class="user-avatar">${u.firstName?.[0] || 'ز'}</div>
        <strong>${u.firstName} ${u.lastName}</strong>
        <span class="muted">${u.email}</span>
        <div class="user-card-stats">
          <div><strong>${u.trips || 0}</strong>رحلة</div>
          <div><strong>${u.rating}</strong>تقييم</div>
          <div><strong>${Number(u.wallet || 0).toLocaleString('en-US')}</strong>رصيد</div>
        </div>
      </article>
    `).join('');
  }

  function fillPricingForm() {
    const p = DB.getPricing();
    if (byId('priceEconomy')) byId('priceEconomy').value = p.perKm.economy;
    if (byId('priceComfort')) byId('priceComfort').value = p.perKm.comfort;
    if (byId('pricePremium')) byId('pricePremium').value = p.perKm.premium;
    if (byId('priceVan')) byId('priceVan').value = p.perKm.van;
    if (byId('priceMin')) byId('priceMin').value = p.minimum;
    if (byId('priceBase')) byId('priceBase').value = p.base;
    if (byId('commissionRate')) byId('commissionRate').value = p.commission;
    const s = DB.getSettings();
    if (byId('newUserDiscount')) byId('newUserDiscount').value = s.newUserDiscount;
    if (byId('welcomeCode')) byId('welcomeCode').value = s.welcomeCode;
  }

  function fillSettingsForm() {
    const s = DB.getSettings();
    if (byId('searchRadius')) byId('searchRadius').value = s.searchRadiusKm;
    if (byId('coveredCities')) byId('coveredCities').value = 'الناصرية';
    if (byId('maxWait')) byId('maxWait').value = s.maxWaitMin;
    setSwitch('swNotifyRequest', s.notifyNewRequest);
    setSwitch('swNotifyComplete', s.notifyTripComplete);
    setSwitch('swNotifyPromo', s.notifyPromo);
    setSwitch('swNotifyDriver', s.notifyDriverApproved);
    setSwitch('swTwoFactor', s.twoFactor);
    setSwitch('swEmergency', s.shareEmergency);
    setSwitch('swRecord', s.recordAudio);
    setSwitch('swVerify', s.verifyCustomer);
  }

  function setSwitch(id, on) {
    const el = byId(id);
    if (!el) return;
    el.classList.toggle('on', !!on);
  }

  function readSwitch(id, fallback) {
    const el = byId(id);
    if (!el) return fallback;
    return el.classList.contains('on');
  }

  function savePricing() {
    DB.updatePricing({
      base: Number(byId('priceBase')?.value) || 1000,
      minimum: Number(byId('priceMin')?.value) || 3000,
      perKm: {
        economy: Number(byId('priceEconomy')?.value) || 500,
        comfort: Number(byId('priceComfort')?.value) || 800,
        premium: Number(byId('pricePremium')?.value) || 1500,
        van: Number(byId('priceVan')?.value) || 1000
      }
    });
    toast('تم حفظ التسعير في قاعدة البيانات', 'success');
    recalc();
  }

  function saveCommissions() {
    const welcome = (byId('welcomeCode')?.value || 'WELCOME50').trim().toUpperCase();
    DB.updatePricing({ commission: Number(byId('commissionRate')?.value) || 15 });
    DB.updateSettings({
      newUserDiscount: Number(byId('newUserDiscount')?.value) || 30,
      welcomeCode: welcome
    });
    const codes = DB.getPromoCodes();
    const existing = codes.find((c) => c.code === 'WELCOME50' || c.code === welcome);
    if (existing) existing.code = welcome;
    toast('تم حفظ العمولات وكود الترحيب', 'success');
  }

  function saveServiceArea() {
    DB.updateSettings({
      city: 'الناصرية',
      cities: ['الناصرية'],
      searchRadiusKm: Number(byId('searchRadius')?.value) || 8,
      maxWaitMin: Number(byId('maxWait')?.value) || 5
    });
    if (byId('coveredCities')) byId('coveredCities').value = 'الناصرية';
    toast('تم حفظ منطقة الخدمة: الناصرية فقط', 'success');
  }

  function saveNotificationSettings() {
    DB.updateSettings({
      notifyNewRequest: readSwitch('swNotifyRequest', true),
      notifyTripComplete: readSwitch('swNotifyComplete', true),
      notifyPromo: readSwitch('swNotifyPromo', false),
      notifyDriverApproved: readSwitch('swNotifyDriver', true)
    });
    toast('تم حفظ إعدادات الإشعارات', 'success');
  }

  function saveSecuritySettings() {
    DB.updateSettings({
      twoFactor: readSwitch('swTwoFactor', true),
      shareEmergency: readSwitch('swEmergency', true),
      recordAudio: readSwitch('swRecord', false),
      verifyCustomer: readSwitch('swVerify', true)
    });
    toast('تم حفظ إعدادات الأمان', 'success');
  }

  function drawChart(id, config) {
    const canvas = byId(id);
    if (!canvas || !window.Chart) return;
    const existing = canvas._chart;
    if (existing) existing.destroy();
    canvas._chart = new Chart(canvas, config);
  }

  function drawAdminCharts() {
    const rides = DB.getRides();
    const byType = { economy: 0, comfort: 0, premium: 0, van: 0 };
    rides.forEach((r) => {
      const t = DB.normalizeCarType(r.type);
      if (byType[t] !== undefined) byType[t] += 1;
    });
    drawChart('revenueChart', {
      type: 'line',
      data: {
        labels: ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'],
        datasets: [{
          label: 'الإيراد',
          data: [0.9, 1.1, 0.8, 1.3, 1.2, 1.6, 1.8],
          borderColor: '#eab308',
          backgroundColor: 'rgba(250,204,21,.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    drawChart('tripsDonut', {
      type: 'doughnut',
      data: {
        labels: ['اقتصادي', 'كومفورت', 'بريميوم', 'عائلي'],
        datasets: [{ data: [byType.economy, byType.comfort, byType.premium, byType.van], backgroundColor: ['#3b82f6', '#facc15', '#a855f7', '#22c55e'] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }

  function drawDriverCharts() {
    drawChart('earningsChart', {
      type: 'bar',
      data: {
        labels: ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'],
        datasets: [{ label: 'د.ع', data: [28, 32, 25, 40, 34, 45, 48], backgroundColor: '#22c55e' }]
      },
      options: { plugins: { legend: { display: false } } }
    });
    drawChart('tripsChart', {
      type: 'doughnut',
      data: {
        labels: ['مكتملة', 'ملغية'],
        datasets: [{ data: [92, 8], backgroundColor: ['#22c55e', '#ef4444'] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }

  function switchCustTabSafe(id) {
    if (typeof window.switchCustTab === 'function') window.switchCustTab(id);
    onTabChange(id);
  }

  function openModal(id) {
    byId(id)?.classList.add('show', 'active');
  }

  function closeModal(id) {
    byId(id)?.classList.remove('show', 'active');
  }

  function onEnterDashboard(session) {
    restoreActiveRide();
    if (session.role === 'customer') {
      refreshCustomerHeader();
      renderSavedPlaces();
      renderCustomerTrips();
      renderWallet();
      renderCityPlaces();
      Maps.initCustomerMap?.();
      if (state.ride) fillTripScreen();
    } else if (session.role === 'driver') {
      refreshDriverHeader();
      renderDriverTrips();
      renderPayouts();
      Maps.initDriverMap?.();
      showIncomingFromPending();
    } else {
      renderAdmin();
    }
  }

  function onTabChange(tabId) {
    if (tabId === 'custHome') {
      Maps.initCustomerMap?.();
      Maps.invalidateSize('customerMap');
      renderSavedPlaces();
    }
    if (tabId === 'custBook') {
      Maps.initBookingMap?.();
      Maps.invalidateSize('bookingMap');
      renderCityPlaces();
      updatePickHint();
      renderFare();
    }
    if (tabId === 'custTrip') {
      Maps.initTrackingMap?.();
      Maps.invalidateSize('trackingMap');
      fillTripScreen();
      if (state.ride && state.ride.status === 'active') startLiveTracking();
    }
    if (tabId === 'custTrips') renderCustomerTrips(document.querySelector('#custTrips .ft-tab.active')?.dataset.filter || 'all');
    if (tabId === 'custWallet') renderWallet();
    if (tabId === 'custProfile') refreshCustomerHeader();
    if (tabId === 'driverHome') {
      Maps.initDriverMap?.();
      Maps.invalidateSize('driverMap');
      showIncomingFromPending();
    }
    if (tabId === 'driverTrips') renderDriverTrips();
    if (tabId === 'driverEarnings') {
      renderPayouts();
      drawDriverCharts();
    }
    if (tabId === 'driverProfile') refreshDriverHeader();
    if (String(tabId).startsWith('admin')) renderAdmin();
    if (tabId === 'adminDrivers') renderAdminDrivers(document.querySelector('#adminDrivers .ft-tab.active')?.dataset.filter || 'pending');
  }

  async function captureRegisterDoc(kind, input, box) {
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast('حجم الملف أكبر من 4 ميغابايت', 'error');
    const data = await readFileAsDataUrl(file);
    state.pendingDocs[kind] = { name: file.name, mime: file.type, size: file.size, data, uploaded: true };
    box?.classList.add('uploaded');
    const small = box?.querySelector('small');
    if (small) small.textContent = file.name;
    toast(`تم تجهيز ${DOC_LABELS[kind] || kind}`, 'success');
  }

  function takePendingDocs() {
    const docs = state.pendingDocs;
    state.pendingDocs = {};
    return docs;
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    all('#vehicleTypes .vehicle-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        selectVehicle(card.dataset.type, card);
      });
    });

    byId('paymentMethod')?.addEventListener('change', (e) => {
      state.payment = e.target.value;
    });

    byId('bookFrom')?.addEventListener('input', (e) => typeSearch('from', e.target.value));
    byId('bookTo')?.addEventListener('input', (e) => typeSearch('to', e.target.value));
    byId('bookFrom')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = Maps.localSearch(e.target.value)[0];
        if (first) setFrom(first.coords[0], first.coords[1], first.name);
      }
    });
    byId('bookTo')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = Maps.localSearch(e.target.value)[0];
        if (first) setTo(first.coords[0], first.coords[1], first.name);
      }
    });

    byId('placeSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchPlace();
      }
    });

    byId('pickFromBtn')?.addEventListener('click', () => {
      Maps.setPickMode('from');
      updatePickHint();
      toast('اضغط على الخريطة لتحديد الانطلاق', 'info');
    });
    byId('pickToBtn')?.addEventListener('click', () => {
      Maps.setPickMode('to');
      updatePickHint();
      toast('اضغط على الخريطة لتحديد الوجهة', 'info');
    });
    byId('clearRouteBtn')?.addEventListener('click', () => {
      clearBooking(true);
      toast('تم مسح المسار', 'info');
    });

    all('#custTrips .ft-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        all('#custTrips .ft-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderCustomerTrips(tab.dataset.filter || 'all');
      });
    });

    all('#adminDrivers .ft-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        all('#adminDrivers .ft-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderAdminDrivers(tab.dataset.filter || 'all');
      });
    });

    all('.promo-card').forEach((card) => {
      card.addEventListener('click', () => {
        const code = card.querySelector('code')?.textContent?.trim();
        if (code) applyPromoCode(code);
      });
    });

    all('.switch').forEach((sw) => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        sw.classList.toggle('on');
      });
    });

    byId('destSearch')?.addEventListener('input', (e) => {
      const results = Maps.localSearch(e.target.value);
      const list = byId('destPickerList');
      if (!list) return;
      list.innerHTML = results.map((p) => `
        <button type="button" class="dest-item" data-lat="${p.coords[0]}" data-lng="${p.coords[1]}" data-name="${p.name}">
          <i class="fa-solid fa-map-pin"></i>
          <span><strong>${p.name}</strong><small>${p.address}</small></span>
        </button>
      `).join('');
      list.querySelectorAll('.dest-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTo(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng), btn.dataset.name);
          closeModal('destPickerModal');
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.addr-input-wrap')) {
        hideSuggest('fromSuggest');
        hideSuggest('toSuggest');
      }
      if (!e.target.closest('.big-map-card')) {
        byId('searchResults')?.classList.add('hidden');
      }
    });

    Maps.on?.('from', (payload) => {
      state.from = { lat: payload.lat, lng: payload.lng, label: payload.label, coords: payload.coords };
      setInput('bookFrom', payload.label);
      updatePickHint();
    });
    Maps.on?.('to', (payload) => {
      state.to = { lat: payload.lat, lng: payload.lng, label: payload.label, coords: payload.coords };
      setInput('bookTo', payload.label);
      updatePickHint();
    });
    Maps.on?.('route', (route) => {
      state.route = route;
      recalc();
    });
    Maps.on?.('homeclick', (payload) => {
      startBookingTo(payload.lat, payload.lng, payload.label);
    });
    Maps.on?.('outside', () => rejectOutside());
    Maps.on?.('reset', () => updatePickHint());
    Maps.on?.('track', (info) => {
      if (byId('tripETA')) byId('tripETA').textContent = formatMin(info.remainMin);
      if (info.phase === 'to_pickup') setTripStep(1);
      if (info.phase === 'to_dest') setTripStep(2);
    });
    Maps.on?.('arrived_pickup', () => {
      state.trackPhase = 'to_dest';
      setTripStep(2);
      toast('السائق وصل لموقعك، بدأت الرحلة', 'success');
    });
    Maps.on?.('arrived_dest', () => {
      setTripStep(3);
      completeCustomerTrip();
    });

    bindRatingStars();
  }

  function init() {
    bindEvents();
    renderCityPlaces();
    updatePickHint();
    renderFare();
    const session = currentSession();
    if (session) onEnterDashboard(session);
  }

  return {
    init,
    onEnterDashboard,
    onTabChange,
    useCurrentLocation,
    openDestPicker,
    locateMe,
    searchPlace,
    findDriver,
    applyCoupon,
    cancelSearch,
    goToTrip,
    cancelTrip,
    simulateArrival,
    callDriver,
    chatDriver,
    sendChat,
    emergencyCall,
    shareTrip,
    walletAction: openWalletModal,
    confirmWalletAction,
    manageAddresses,
    saveNewAddress,
    managePromo,
    toggleOnline,
    rejectRequest,
    acceptRequest,
    completeTrip,
    requestWithdrawal,
    editVehicle,
    saveVehicle,
    savePricing,
    saveCommissions,
    saveServiceArea,
    saveNotificationSettings,
    saveSecuritySettings,
    submitRating,
    selectTip,
    addTag,
    applyPromoCode,
    startBookingTo,
    clearBooking,
    openModal,
    closeModal,
    selectVehicle,
    openEditProfile,
    saveProfile,
    openPaymentMethods,
    openDriverDocs,
    openBankAccount,
    saveBankAccount,
    captureRegisterDoc,
    takePendingDocs,
    viewDocument
  };
})();

window.App = App;

Object.assign(window, {
  useCurrentLocation: (t) => App.useCurrentLocation(t),
  openDestPicker: () => App.openDestPicker(),
  locateMe: () => App.locateMe(),
  searchPlace: () => App.searchPlace(),
  findDriver: () => App.findDriver(),
  applyCoupon: () => App.applyCoupon(),
  cancelSearch: () => App.cancelSearch(),
  goToTrip: () => App.goToTrip(),
  cancelTrip: () => App.cancelTrip(),
  simulateArrival: () => App.simulateArrival(),
  callDriver: () => App.callDriver(),
  chatDriver: () => App.chatDriver(),
  sendChat: () => App.sendChat(),
  emergencyCall: () => App.emergencyCall(),
  shareTrip: () => App.shareTrip(),
  walletAction: (a) => App.walletAction(a),
  confirmWalletAction: () => App.confirmWalletAction(),
  manageAddresses: () => App.manageAddresses(),
  saveNewAddress: () => App.saveNewAddress(),
  managePromo: () => App.managePromo(),
  toggleOnline: () => App.toggleOnline(),
  rejectRequest: () => App.rejectRequest(),
  acceptRequest: () => App.acceptRequest(),
  completeTrip: () => App.completeTrip(),
  requestWithdrawal: () => App.requestWithdrawal(),
  editVehicle: () => App.editVehicle(),
  saveVehicle: () => App.saveVehicle(),
  savePricing: () => App.savePricing(),
  saveCommissions: () => App.saveCommissions(),
  saveServiceArea: () => App.saveServiceArea(),
  saveNotificationSettings: () => App.saveNotificationSettings(),
  saveSecuritySettings: () => App.saveSecuritySettings(),
  submitRating: () => App.submitRating(),
  selectTip: (btn, amount) => App.selectTip(btn, amount),
  addTag: (btn) => App.addTag(btn),
  selectVehicle: (type, card) => App.selectVehicle(type, card),
  openEditProfile: () => App.openEditProfile(),
  saveProfile: () => App.saveProfile(),
  openPaymentMethods: () => App.openPaymentMethods(),
  openDriverDocs: () => App.openDriverDocs(),
  openBankAccount: () => App.openBankAccount(),
  saveBankAccount: () => App.saveBankAccount()
});
