/**
 * خرائط تكسي دجلة
 * Maps Module
 * يستخدم Leaflet + OpenStreetMap للخرائط الحقيقية
 * يستخدم Nominatim للبحث عن الأماكن
 * يستخدم OSRM لحساب المسارات
 */

const Maps = (() => {
  // بغداد - نقطة البداية
  const BAGHDAD_CENTER = [33.3152, 44.3661];
  const DEFAULT_ZOOM = 12;

  // الإعدادات
  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTRIBUTION = '© OpenStreetMap';

  let customerMap = null;
  let driverMap = null;
  let bookingMap = null;
  let trackingMap = null;

  let userMarker = null;
  let driverMarker = null;
  let fromMarker = null;
  let toMarker = null;
  let routeLayer = null;

  let userCoords = null;
  let fromCoords = null;
  let toCoords = null;

  // تهيئة خريطة الزبون الرئيسية
  function initCustomerMap() {
    if (customerMap) return;

    customerMap = L.map('customerMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(BAGHDAD_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(customerMap);

    // طبقة المواقع الشهيرة
    addPopularPlaces(customerMap);

    // محاولة الحصول على موقع المستخدم
    locateUser();
  }

  // تهيئة خريطة السائق
  function initDriverMap() {
    if (driverMap) return;

    driverMap = L.map('driverMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(BAGHDAD_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(driverMap);

    addPopularPlaces(driverMap);

    // عرض السائقين النشطين
    showNearbyDrivers(driverMap);
  }

  // تهيئة خريطة الحجز
  function initBookingMap() {
    if (bookingMap) return;

    bookingMap = L.map('bookingMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(BAGHDAD_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(bookingMap);

    bookingMap.on('click', (e) => {
      if (!fromCoords) {
        setFromPoint(e.latlng.lat, e.latlng.lng, 'موقع محدد على الخريطة');
      } else if (!toCoords) {
        setToPoint(e.latlng.lat, e.latlng.lng, 'موقع محدد على الخريطة');
        calculateRoute();
      }
    });
  }

  // تهيئة خريطة التتبع
  function initTrackingMap() {
    if (trackingMap) return;

    trackingMap = L.map('trackingMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(BAGHDAD_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(trackingMap);
  }

  // إضافة الأماكن الشهيرة على الخريطة
  function addPopularPlaces(map) {
    const places = [
      { name: 'الكرادة', coords: [33.3152, 44.3661] },
      { name: 'المنصور', coords: [33.3128, 44.3467] },
      { name: 'الجادرية', coords: [33.2915, 44.3809] },
      { name: 'الكاظمية', coords: [33.3700, 44.3300] },
      { name: 'الاعظمية', coords: [33.3950, 44.3400] },
      { name: 'مطار بغداد', coords: [33.2625, 44.2346] },
      { name: 'بغداد مول', coords: [33.2915, 44.3809] }
    ];

    places.forEach(p => {
      L.marker(p.coords, {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
          iconSize: [14, 14]
        })
      }).addTo(map).bindPopup(`<strong>${p.name}</strong>`);
    });
  }

  // عرض السائقين القريبين
  function showNearbyDrivers(map) {
    const drivers = DB.query('users.drivers', d => d.status === 'approved' && d.online);
    drivers.forEach(d => {
      if (d.location) {
        const marker = L.marker([d.location.lat, d.location.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:32px;height:32px;background:#facc15;border:3px solid white;border-radius:50%;box-shadow:0 3px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1f2937;font-size:13px">${d.firstName[0]}</div>`,
            iconSize: [32, 32]
          })
        }).addTo(map);

        marker.bindPopup(`
          <div style="text-align:right;direction:rtl;min-width:150px">
            <strong>${d.firstName} ${d.lastName}</strong><br>
            <small>${d.carModel}</small><br>
            <small>⭐ ${d.rating} (${d.trips} رحلة)</small>
          </div>
        `);
      }
    });
  }

  // تحديد موقع المستخدم
  function locateUser() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        if (customerMap) {
          customerMap.setView(userCoords, 14);
          if (userMarker) customerMap.removeLayer(userMarker);
          userMarker = L.marker(userCoords, {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:24px;height:24px;background:#facc15;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
              iconSize: [24, 24]
            })
          }).addTo(customerMap).bindPopup('موقعك الحالي');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        userCoords = BAGHDAD_CENTER;
        if (customerMap) {
          if (userMarker) customerMap.removeLayer(userMarker);
          userMarker = L.marker(userCoords, {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:24px;height:24px;background:#facc15;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
              iconSize: [24, 24]
            })
          }).addTo(customerMap).bindPopup('بغداد');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // البحث عن الأماكن
  async function searchPlace(query) {
    if (!query || query.length < 2) return [];

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' بغداد العراق')}&format=json&limit=5&accept-language=ar`
      );
      const results = await response.json();
      return results.map(r => ({
        name: r.display_name.split(',')[0],
        fullName: r.display_name,
        coords: [parseFloat(r.lat), parseFloat(r.lon)],
        type: r.type
      }));
    } catch (e) {
      console.warn('Search failed:', e);
      // البحث في الأماكن المحلية
      return localSearch(query);
    }
  }

  // بحث محلي احتياطي
  function localSearch(query) {
    const local = [
      { name: 'الكرادة', address: 'الكرادة، بغداد', coords: [33.3152, 44.3661] },
      { name: 'المنصور', address: 'المنصور، بغداد', coords: [33.3128, 44.3467] },
      { name: 'الجادرية', address: 'الجادرية، بغداد', coords: [33.2915, 44.3809] },
      { name: 'الكاظمية', address: 'الكاظمية، بغداد', coords: [33.3700, 44.3300] },
      { name: 'الاعظمية', address: 'الاعظمية، بغداد', coords: [33.3950, 44.3400] },
      { name: 'بغداد الجديدة', address: 'بغداد الجديدة', coords: [33.3050, 44.4200] },
      { name: 'مطار بغداد الدولي', address: 'مطار بغداد', coords: [33.2625, 44.2346] },
      { name: 'بغداد مول', address: 'بغداد مول، الجادرية', coords: [33.2915, 44.3809] },
      { name: 'مول المنصور', address: 'مول المنصور', coords: [33.3128, 44.3467] },
      { name: 'جامعة بغداد', address: 'جامعة بغداد', coords: [33.2900, 44.3850] },
      { name: 'المستشفى الأمريكي', address: 'المستشفى الأمريكي', coords: [33.3200, 44.3500] }
    ];
    const lower = query.toLowerCase();
    return local.filter(p =>
      p.name.includes(query) || p.address.toLowerCase().includes(lower)
    );
  }

  // تعيين نقطة الانطلاق
  function setFromPoint(lat, lng, label) {
    fromCoords = [lat, lng];
    if (!bookingMap) initBookingMap();

    if (fromMarker) bookingMap.removeLayer(fromMarker);
    fromMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;background:#22c55e;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">A</div>`,
        iconSize: [30, 30]
      })
    }).addTo(bookingMap).bindPopup(`من: ${label}`);

    if (!toCoords) {
      bookingMap.setView([lat, lng], 14);
    }
  }

  // تعيين الوجهة
  function setToPoint(lat, lng, label) {
    toCoords = [lat, lng];

    if (toMarker) bookingMap.removeLayer(toMarker);
    toMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;background:#ef4444;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">B</div>`,
        iconSize: [30, 30]
      })
    }).addTo(bookingMap).bindPopup(`إلى: ${label}`);

    // ضبط حدود الخريطة لإظهار كلا النقطتين
    const bounds = L.latLngBounds([fromCoords, toCoords]);
    bookingMap.fitBounds(bounds, { padding: [50, 50] });
  }

  // حساب المسار باستخدام OSRM
  async function calculateRoute() {
    if (!fromCoords || !toCoords) return null;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = route.distance / 1000; // كم
        const duration = route.duration / 60; // دقيقة

        // رسم المسار
        if (routeLayer) bookingMap.removeLayer(routeLayer);
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        routeLayer = L.polyline(coords, {
          color: '#facc15',
          weight: 5,
          opacity: .9,
          lineJoin: 'round'
        }).addTo(bookingMap);

        return { distance, duration, coords };
      }
    } catch (e) {
      console.warn('OSRM failed, using fallback:', e);
    }

    // حساب بدائي في حالة الفشل
    return calculateDirectRoute();
  }

  // حساب مباشر (مسافة Haversine)
  function calculateDirectRoute() {
    const distance = haversine(fromCoords, toCoords);
    const duration = distance * 2.5; // تقدير 2.5 دقيقة لكل كم
    return { distance, duration, coords: [fromCoords, toCoords] };
  }

  // صيغة هافيرسين لحساب المسافة
  function haversine([lat1, lon1], [lat2, lon2]) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // بدء تتبع الرحلة
  function startTracking(from, to, driver) {
    if (!trackingMap) initTrackingMap();

    if (routeLayer) trackingMap.removeLayer(routeLayer);
    if (userMarker) trackingMap.removeLayer(userMarker);
    if (driverMarker) trackingMap.removeLayer(driverMarker);
    if (toMarker) trackingMap.removeLayer(toMarker);

    const fromM = L.marker(from, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;background:#22c55e;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
        iconSize: [24, 24]
      })
    }).addTo(trackingMap);

    const toM = L.marker(to, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;background:#ef4444;border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
        iconSize: [24, 24]
      })
    }).addTo(trackingMap);

    driverMarker = L.marker(from, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:40px;height:40px;background:white;border:3px solid #facc15;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-weight:800;color:#facc15;font-size:16px">${driver?.firstName?.[0] || 'ك'}</div>`,
        iconSize: [40, 40]
      })
    }).addTo(trackingMap);

    // رسم مسار مباشر
    routeLayer = L.polyline([from, to], {
      color: '#facc15',
      weight: 4,
      opacity: .6,
      dashArray: '8 6'
    }).addTo(trackingMap);

    const bounds = L.latLngBounds([from, to]);
    trackingMap.fitBounds(bounds, { padding: [60, 60] });

    // محاكاة حركة السائق
    simulateDriverMovement(from, to, driverM => {
      driverMarker.setLatLng(driverM);
    });
  }

  // محاكاة حركة السائق
  function simulateDriverMovement(from, to, callback) {
    const steps = 50;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps) {
        clearInterval(interval);
        return;
      }
      const ratio = (i + 1) / steps;
      const lat = from[0] + (to[0] - from[0]) * ratio;
      const lng = from[1] + (to[1] - from[1]) * ratio;
      callback([lat, lng]);
      i++;
    }, 1500);
  }

  // الحصول على موقع المستخدم الحالي
  function getCurrentCoords() {
    return userCoords;
  }

  function getFromCoords() { return fromCoords; }
  function getToCoords() { return toCoords; }

  function setFromCoords(c) { fromCoords = c; }
  function setToCoords(c) { toCoords = c; }

  // إعادة تعيين الخريطة
  function resetBookingMap() {
    fromCoords = null;
    toCoords = null;
    if (fromMarker) { bookingMap.removeLayer(fromMarker); fromMarker = null; }
    if (toMarker) { bookingMap.removeLayer(toMarker); toMarker = null; }
    if (routeLayer) { bookingMap.removeLayer(routeLayer); routeLayer = null; }
    if (bookingMap) bookingMap.setView(BAGHDAD_CENTER, DEFAULT_ZOOM);
  }

  // إصلاح مشكلة الحجم عند تحميل التبويبات
  function invalidateSize(mapName) {
    setTimeout(() => {
      const map = { customerMap, driverMap, bookingMap, trackingMap }[mapName];
      if (map) map.invalidateSize();
    }, 100);
  }

  return {
    initCustomerMap,
    initDriverMap,
    initBookingMap,
    initTrackingMap,
    locateUser,
    searchPlace,
    localSearch,
    setFromPoint,
    setToPoint,
    calculateRoute,
    startTracking,
    getCurrentCoords,
    getFromCoords,
    getToCoords,
    setFromCoords,
    setToCoords,
    resetBookingMap,
    invalidateSize,
    BAGHDAD_CENTER
  };
})();

window.Maps = Maps;
