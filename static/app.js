const state = { pickup: null, dropoff: null, carType: 'economy', distance: 0, baseFare: 0, currentRide: null };
let authState = { authenticated: false, user: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatMoney = (number) => `${Number(number).toLocaleString('ar-IQ')} د.ع`;

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// Navigation
$$('.nav-link[data-view]').forEach(button => button.addEventListener('click', () => {
  $$('.nav-link[data-view]').forEach(item => item.classList.toggle('active', item === button));
  $$('.view').forEach(view => view.classList.remove('active'));
  $(`#${button.dataset.view}View`).classList.add('active');
  if (button.dataset.view === 'customer') setTimeout(() => map.invalidateSize(), 80);
  if (button.dataset.view === 'driver') loadDriverRides();
  if (button.dataset.view === 'admin') loadAdmin();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

$('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  $('#themeToggle').textContent = document.body.classList.contains('dark') ? '☀' : '☾';
});

// Map, centered on Nasiriyah
const map = L.map('map', { zoomControl: false }).setView([31.0449, 46.2676], 14);
L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const taxiIcon = L.divIcon({ className: 'taxi-marker', html: '🚕', iconSize: [32, 32], iconAnchor: [16, 16] });
const pickupIcon = L.divIcon({ className: 'point-marker pickup-marker', iconSize: [24, 24], iconAnchor: [12, 12] });
const dropoffIcon = L.divIcon({ className: 'point-marker dropoff-marker', iconSize: [24, 24], iconAnchor: [12, 12] });
let pickupMarker, dropoffMarker, routeLine;

[[31.049,46.259],[31.037,46.277],[31.055,46.275],[31.043,46.248],[31.061,46.263],[31.032,46.260],[31.051,46.289],[31.068,46.248]].forEach((point, index) => {
  const marker = L.marker(point, { icon: taxiIcon, interactive: false }).addTo(map);
  setTimeout(() => marker.setLatLng([point[0] + (Math.random()-.5)*.002, point[1] + (Math.random()-.5)*.002]), index * 100);
});

function approximateAddress(latlng) {
  const places = [
    { name: 'شارع الحبوبي', lat: 31.0522, lng: 46.2573 },
    { name: 'جامعة ذي قار', lat: 31.0468, lng: 46.2270 },
    { name: 'مستشفى الحسين التعليمي', lat: 31.0596, lng: 46.2450 },
    { name: 'تقاطع البهو', lat: 31.0404, lng: 46.2668 },
    { name: 'سوق الشيوخ', lat: 30.8922, lng: 46.4521 }
  ];
  let nearest = places[0], best = Infinity;
  places.forEach(place => {
    const distance = Math.hypot(latlng.lat - place.lat, latlng.lng - place.lng);
    if (distance < best) { best = distance; nearest = place; }
  });
  return best < .018 ? nearest.name : `موقع محدد (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
}

function setPoint(kind, latlng, name) {
  if (kind === 'pickup') {
    state.pickup = latlng;
    if (pickupMarker) pickupMarker.setLatLng(latlng); else pickupMarker = L.marker(latlng, { icon: pickupIcon }).addTo(map);
    $('#pickupName').value = name || approximateAddress(latlng);
    $('#mapInstruction').innerHTML = '<b>2</b> هسه اضغط على الخريطة لتحديد الوجهة';
  } else {
    state.dropoff = latlng;
    if (dropoffMarker) dropoffMarker.setLatLng(latlng); else dropoffMarker = L.marker(latlng, { icon: dropoffIcon }).addTo(map);
    $('#dropoffName').value = name || approximateAddress(latlng);
    $('#mapInstruction').innerHTML = '<b>✓</b> تم تحديد المسار، تقدر تغير أي نقطة بالضغط عليها';
  }
  $('#resetMap').style.display = 'block';
  updateRoute();
}

map.on('click', event => {
  if (!state.pickup || (state.pickup && state.dropoff)) setPoint('pickup', event.latlng);
  else setPoint('dropoff', event.latlng);
});

function haversine(a, b) {
  const rad = n => n * Math.PI / 180, R = 6371;
  const dLat = rad(b.lat-a.lat), dLng = rad(b.lng-a.lng);
  const q = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

function fare(distance, multiplier=1) {
  const raw = Math.max(3000, (2000 + distance * 700) * multiplier);
  return Math.round(raw / 250) * 250;
}

function updateRoute() {
  if (!state.pickup || !state.dropoff) return;
  if (routeLine) routeLine.remove();
  routeLine = L.polyline([state.pickup, state.dropoff], { color: '#0b5cff', weight: 5, opacity: .8, dashArray: '9 11' }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [65, 65] });
  state.distance = Math.max(.5, haversine(state.pickup, state.dropoff) * 1.22);
  const estimate = fare(state.distance, Number($(`.ride-option[data-type="${state.carType}"]`).dataset.multiplier));
  state.baseFare = estimate;
  $('#distanceMetric').textContent = `${state.distance.toFixed(1)} كم`;
  $('#timeMetric').textContent = `${Math.max(4, Math.round(state.distance * 3.2))} دقيقة`;
  $('#fareMetric').textContent = formatMoney(estimate);
  $('#submitFare').textContent = formatMoney(estimate);
  $$('.ride-option').forEach(option => {
    option.querySelector('.option-price').textContent = formatMoney(fare(state.distance, Number(option.dataset.multiplier)));
  });
}

$('#resetMap').addEventListener('click', () => {
  state.pickup = state.dropoff = null; state.distance = 0;
  [pickupMarker, dropoffMarker, routeLine].forEach(item => item && item.remove());
  pickupMarker = dropoffMarker = routeLine = null;
  $('#pickupName').value = $('#dropoffName').value = '';
  $('#distanceMetric').textContent = $('#timeMetric').textContent = $('#fareMetric').textContent = '—';
  $('#submitFare').textContent = 'حدد الوجهة';
  $$('.option-price').forEach(item => item.textContent = '—');
  $('#mapInstruction').innerHTML = '<b>1</b> اضغط على الخريطة لتحديد موقع الانطلاق';
  $('#resetMap').style.display = 'none';
  map.setView([31.0449, 46.2676], 14);
});

$('#locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) return showToast('المتصفح ما يدعم تحديد الموقع');
  showToast('جاري تحديد موقعك...');
  navigator.geolocation.getCurrentPosition(
    position => {
      const point = L.latLng(position.coords.latitude, position.coords.longitude);
      setPoint('pickup', point, 'موقعي الحالي'); map.setView(point, 15);
    },
    () => showToast('ما كدرنا نوصل لموقعك، حدده من الخريطة'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

$$('#quickPlaces button').forEach(button => button.addEventListener('click', () => {
  const point = L.latLng(Number(button.dataset.lat), Number(button.dataset.lng));
  const kind = !state.pickup ? 'pickup' : 'dropoff';
  setPoint(kind, point, button.dataset.name);
}));

$$('.ride-option').forEach(option => option.addEventListener('click', () => {
  $$('.ride-option').forEach(item => item.classList.remove('active'));
  option.classList.add('active'); state.carType = option.dataset.type; updateRoute();
}));

$('#rideForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!authState.authenticated) {
    $('#authModal').hidden = false;
    return showToast('سجل دخولك أو أنشئ حساب حتى تطلب مشوار');
  }
  if (authState.user.role !== 'customer') return showToast('طلب المشوار متاح لحساب الزبون فقط');
  if (!state.pickup || !state.dropoff) return showToast('حدد موقع الانطلاق والوجهة من الخريطة');
  const submit = event.submitter; submit.disabled = true; submit.querySelector('span').textContent = 'جاري إرسال الطلب...';
  const payload = {
    rider_name: $('#riderName').value, phone: $('#riderPhone').value,
    pickup_name: $('#pickupName').value, pickup_lat: state.pickup.lat, pickup_lng: state.pickup.lng,
    dropoff_name: $('#dropoffName').value, dropoff_lat: state.dropoff.lat, dropoff_lng: state.dropoff.lng,
    car_type: state.carType
  };
  try {
    const response = await fetch('/api/rides', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'تعذر إرسال الطلب');
    state.currentRide = result.id;
    $('#ticketId').textContent = `#${result.id}`; $('#ticketFare').textContent = formatMoney(result.price);
    $('#successModal').hidden = false;
  } catch (error) { showToast(error.message); }
  finally { submit.disabled = false; submit.querySelector('span').textContent = 'اطلب دجلة رايد'; }
});

['#closeModal','#trackButton'].forEach(selector => $(selector).addEventListener('click', () => $('#successModal').hidden = true));

// Driver dashboard
async function loadDriverRides() {
  const container = $('#driverRides');
  try {
    const response = await fetch('/api/rides'); const rides = await response.json();
    const available = rides.filter(ride => ['pending','accepted','arriving','in_trip'].includes(ride.status));
    if (!available.length) { container.innerHTML = '<div class="empty-state"><span>☕</span><b>ماكو طلبات حالياً</b><small>راح تظهر الطلبات الجديدة هنا تلقائياً</small></div>'; return; }
    container.innerHTML = available.map(ride => `
      <article class="request-card">
        <div><span class="request-id">طلب #${ride.id} · ${ride.distance_km} كم</span><h4>${escapeHtml(ride.rider_name)}</h4>
          <div class="mini-route"><span><i></i>${escapeHtml(ride.pickup_name)}</span><span><i></i>${escapeHtml(ride.dropoff_name)}</span></div>
        </div>
        <div class="request-meta"><strong>${formatMoney(ride.price)}</strong><small>${ride.status_label}</small>
          ${ride.status === 'pending' ? `<button class="accept-button" onclick="updateRide(${ride.id},'accepted')">اقبل الطلب</button>` : `<button class="accept-button" onclick="advanceRide(${ride.id},'${ride.status}')">تحديث الحالة</button>`}
        </div>
      </article>`).join('');
  } catch { container.innerHTML = '<div class="empty-state"><b>تعذر تحميل الطلبات</b></div>'; }
}

window.updateRide = async (id, status) => {
  const response = await fetch(`/api/rides/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status, driver_id:1 }) });
  if (response.ok) { showToast(status === 'accepted' ? 'تم قبول الطلب بنجاح' : 'تم تحديث الرحلة'); loadDriverRides(); }
};
window.advanceRide = (id, status) => {
  const next = { accepted:'arriving', arriving:'in_trip', in_trip:'completed' }[status] || 'completed';
  updateRide(id, next);
};
$('#refreshRides').addEventListener('click', loadDriverRides);
$('#driverOnline').addEventListener('change', async event => {
  await fetch('/api/drivers/1', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({online:event.target.checked}) });
  $('#onlineLabel').textContent = event.target.checked ? 'متصل وتستقبل طلبات' : 'غير متصل';
  showToast(event.target.checked ? 'أنت متصل الآن' : 'تم إيقاف استقبال الطلبات');
});

// Admin dashboard
const escapeHtml = text => String(text ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
async function loadAdmin() {
  try {
    const [statsResponse, ridesResponse] = await Promise.all([fetch('/api/stats'), fetch('/api/rides')]);
    const stats = await statsResponse.json(), rides = await ridesResponse.json();
    $('#statTotal').textContent = stats.total_rides || 0; $('#statCompleted').textContent = stats.completed || 0;
    $('#statActive').textContent = stats.active || 0; $('#statDrivers').textContent = stats.online_drivers || 0;
    $('#ridesTable').innerHTML = rides.length ? rides.map(ride => `<tr>
      <td><b>#${ride.id}</b><small>${new Date(ride.created_at).toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'})}</small></td>
      <td>${escapeHtml(ride.rider_name)}<small>${escapeHtml(ride.phone)}</small></td>
      <td>${escapeHtml(ride.pickup_name)}<small>إلى ${escapeHtml(ride.dropoff_name)}</small></td>
      <td>${escapeHtml(ride.driver_name || 'غير محدد')}</td><td><b>${formatMoney(ride.price)}</b></td>
      <td><span class="status-badge status-${ride.status}">${ride.status_label}</span></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">لا توجد رحلات بعد</div></td></tr>';
  } catch { showToast('تعذر تحديث لوحة الإدارة'); }
}
$('#refreshAdmin').addEventListener('click', loadAdmin);
$('#todayDate').textContent = new Intl.DateTimeFormat('ar-IQ', { weekday:'long', day:'numeric', month:'long' }).format(new Date());

// Accounts and driver onboarding
async function loadAuth() {
  try {
    authState = await (await fetch('/api/auth/me')).json();
    const accountButton = $('#accountButton');
    if (authState.authenticated) {
      accountButton.textContent = `${authState.user.name} · خروج`;
      if (authState.user.role === 'customer') {
        $('#riderName').value = authState.user.name;
        $('#riderPhone').value = authState.user.phone;
        $('#riderName').readOnly = $('#riderPhone').readOnly = true;
      }
      if (authState.user.role === 'driver' && authState.user.driver_application) {
        const labels = { pending:'طلبك قيد التدقيق', approved:'حسابك مقبول', rejected:'طلبك مرفوض' };
        $('#driverApplyButton').textContent = labels[authState.user.driver_application.status] || 'حالة الطلب';
      }
    } else {
      accountButton.textContent = 'دخول / حساب جديد';
      $('#riderName').readOnly = $('#riderPhone').readOnly = false;
    }
  } catch { /* website remains usable if session check fails */ }
}

$('#accountButton').addEventListener('click', async () => {
  if (authState.authenticated) {
    await fetch('/api/auth/logout', { method:'POST' });
    authState = { authenticated:false, user:null };
    $('#riderName').value = $('#riderPhone').value = '';
    await loadAuth(); showToast('تم تسجيل الخروج');
  } else $('#authModal').hidden = false;
});

$$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).hidden = true));
$$('[data-auth-tab]').forEach(button => button.addEventListener('click', () => {
  $$('[data-auth-tab]').forEach(item => item.classList.toggle('active', item === button));
  $('#loginForm').hidden = button.dataset.authTab !== 'login';
  $('#registerForm').hidden = button.dataset.authTab !== 'register';
}));

async function submitAuth(form, endpoint) {
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const payload = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $('#authModal').hidden = true; form.reset(); await loadAuth(); showToast(result.message);
  } catch (error) { showToast(error.message || 'تعذر إكمال العملية'); }
  finally { button.disabled = false; }
}
$('#loginForm').addEventListener('submit', event => { event.preventDefault(); submitAuth(event.currentTarget, '/api/auth/login'); });
$('#registerForm').addEventListener('submit', event => { event.preventDefault(); submitAuth(event.currentTarget, '/api/auth/register'); });

$('#driverApplyButton').addEventListener('click', () => {
  if (authState.authenticated && authState.user.role === 'driver') {
    const app = authState.user.driver_application;
    return showToast(app?.review_notes || (app?.status === 'approved' ? 'حسابك مقبول وتكدر تستقبل رحلات' : app?.status === 'rejected' ? 'راجع ملاحظات الإدارة' : 'طلبك قيد مراجعة الإدارة'));
  }
  $('#driverModal').hidden = false;
});
$$('.upload-box input').forEach(input => input.addEventListener('change', () => {
  const box = input.closest('.upload-box'); box.classList.toggle('has-file', input.files.length > 0);
  if (input.files[0]) box.querySelector('small').textContent = input.files[0].name;
}));
$('#driverApplicationForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.querySelector('span').textContent = 'جاري رفع المستمسكات...';
  try {
    const response = await fetch('/api/driver-applications', { method:'POST', body:new FormData(form) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $('#driverModal').hidden = true; form.reset(); await loadAuth(); showToast('تم إرسال الطلب، راح نبلغك بعد التدقيق');
  } catch (error) { showToast(error.message || 'تعذر رفع الطلب'); }
  finally { button.disabled = false; button.querySelector('span').textContent = 'إرسال طلب التسجيل'; }
});

loadAuth();
