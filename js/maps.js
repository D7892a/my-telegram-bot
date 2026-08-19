/**
 * خرائط تكسي دجلة
 * Leaflet + OpenStreetMap + بحث محلي لبغداد
 * يعمل حتى لو تأخر تحميل المكتبة الخارجية
 */
const Maps = (() => {
  const BAGHDAD_CENTER = [33.3152, 44.3661];
  const DEFAULT_ZOOM = 12;
  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const PLACES = [
    { name: 'الكرادة', address: 'الكرادة، بغداد', coords: [33.3152, 44.3661] },
    { name: 'الكرادة داخل', address: 'الكرادة داخل، بغداد', coords: [33.3028, 44.4280] },
    { name: 'المنصور', address: 'المنصور، بغداد', coords: [33.3128, 44.3467] },
    { name: 'الحارثية', address: 'الحارثية، المنصور', coords: [33.3080, 44.3520] },
    { name: 'اليرموك', address: 'اليرموك، بغداد', coords: [33.3005, 44.3400] },
    { name: 'الجادرية', address: 'الجادرية، بغداد', coords: [33.2770, 44.3770] },
    { name: 'أبو نؤاس', address: 'شارع أبو نؤاس، بغداد', coords: [33.3240, 44.4040] },
    { name: 'الباب الشرقي', address: 'الباب الشرقي، بغداد', coords: [33.3285, 44.4105] },
    { name: 'ساحة التحرير', address: 'ساحة التحرير، بغداد', coords: [33.3280, 44.4090] },
    { name: 'شارع السعدون', address: 'شارع السعدون، بغداد', coords: [33.3220, 44.4150] },
    { name: 'العلاوي', address: 'العلاوي، بغداد', coords: [33.3180, 44.3920] },
    { name: 'الكاظمية', address: 'الكاظمية، بغداد', coords: [33.3800, 44.3380] },
    { name: 'الأعظمية', address: 'الأعظمية، بغداد', coords: [33.3710, 44.3670] },
    { name: 'الصليخ', address: 'الصليخ، بغداد', coords: [33.3900, 44.3700] },
    { name: 'بغداد الجديدة', address: 'بغداد الجديدة', coords: [33.3050, 44.4550] },
    { name: 'زيونة', address: 'زيونة، بغداد', coords: [33.3200, 44.4500] },
    { name: 'الشعب', address: 'الشعب، بغداد', coords: [33.4100, 44.4000] },
    { name: 'الدورة', address: 'الدورة، بغداد', coords: [33.2550, 44.3700] },
    { name: 'البياع', address: 'البياع، بغداد', coords: [33.2700, 44.3200] },
    { name: 'السيدية', address: 'السيدية، بغداد', coords: [33.2600, 44.3300] },
    { name: 'الغزالية', address: 'الغزالية، بغداد', coords: [33.3400, 44.2600] },
    { name: 'العامرية', address: 'العامرية، بغداد', coords: [33.3250, 44.2700] },
    { name: 'الحرية', address: 'الحرية، بغداد', coords: [33.3600, 44.3000] },
    { name: 'الشعلة', address: 'الشعلة، بغداد', coords: [33.3700, 44.2800] },
    { name: 'الزعفرانية', address: 'الزعفرانية، بغداد', coords: [33.2400, 44.5000] },
    { name: 'مطار بغداد الدولي', address: 'مطار بغداد الدولي', coords: [33.2625, 44.2346] },
    { name: 'جامعة بغداد', address: 'جامعة بغداد، الجادرية', coords: [33.2730, 44.3775] },
    { name: 'مدينة الطب', address: 'مدينة الطب، باب المعظم', coords: [33.3450, 44.3850] },
    { name: 'بغداد مول', address: 'بغداد مول، الجادرية', coords: [33.2775, 44.3760] },
    { name: 'مول المنصور', address: 'مول المنصور', coords: [33.3140, 44.3450] },
    { name: 'محطة بغداد', address: 'محطة قطار بغداد', coords: [33.3255, 44.3900] },
    { name: 'كرادة مريم', address: 'كرادة مريم، بغداد', coords: [33.3120, 44.3850] },
    { name: 'باب المعظم', address: 'باب المعظم، بغداد', coords: [33.3480, 44.3900] },
    { name: 'الوشاش', address: 'الوشاش، المنصور', coords: [33.3050, 44.3550] },
    { name: 'الجعيفر', address: 'الجعيفر، بغداد', coords: [33.3350, 44.3550] }
  ];

  let customerMap = null;
  let driverMap = null;
  let bookingMap = null;
  let trackingMap = null;
  let userMarker = null;
  let driverMarker = null;
  let fromMarker = null;
  let toMarker = null;
  let routeLayer = null;
  let nearbyLayer = null;
  let userCoords = null;
  let fromCoords = null;
  let toCoords = null;
  let fromLabel = '';
  let toLabel = '';
  let pickMode = 'auto';
  const listeners = {};

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach((fn) => {
      try { fn(payload); } catch (err) { console.warn(err); }
    });
  }

  function whenReady(cb, tries = 50) {
    if (window.L) {
      cb();
      return;
    }
    if (tries <= 0) {
      emit('unavailable');
      return;
    }
    window.setTimeout(() => whenReady(cb, tries - 1), 120);
  }

  function haversine([lat1, lon1], [lat2, lon2]) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function makeIcon(html, size) {
    return L.divIcon({
      className: 'dijla-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function addTiles(map) {
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  }

  function createMap(id, zoom = DEFAULT_ZOOM) {
    const el = document.getElementById(id);
    if (!el || !window.L) return null;
    const map = L.map(id, {
      zoomControl: false,
      attributionControl: false,
      tap: true
    }).setView(BAGHDAD_CENTER, zoom);
    addTiles(map);
    window.setTimeout(() => map.invalidateSize(), 80);
    window.setTimeout(() => map.invalidateSize(), 320);
    window.setTimeout(() => map.invalidateSize(), 800);
    return map;
  }

  function addPopularPlaces(map) {
    if (!map) return;
    PLACES.slice(0, 12).forEach((place) => {
      L.circleMarker(place.coords, {
        radius: 5,
        color: '#fff',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.9
      }).addTo(map).bindPopup(`<strong>${place.name}</strong><br><small>${place.address}</small>`);
    });
  }

  function getApprovedOnlineDrivers() {
    const users = window.DB?.get?.('users');
    const list = users?.drivers || [];
    return list.filter((d) => d.status === 'approved' && d.online && d.location);
  }

  function showNearbyDrivers(map) {
    if (!map) return;
    getApprovedOnlineDrivers().forEach((driver) => {
      L.marker([driver.location.lat, driver.location.lng], {
        icon: makeIcon(
          `<div class="driver-marker">${driver.firstName?.[0] || 'س'}</div>`,
          36
        )
      }).addTo(map).bindPopup(`
        <div style="text-align:right;direction:rtl;min-width:150px">
          <strong>${driver.firstName} ${driver.lastName}</strong><br>
          <small>${driver.carModel || ''}</small><br>
          <small>⭐ ${driver.rating} (${driver.trips || 0} رحلة)</small>
        </div>
      `);
    });
  }

  function reverseGeocode(lat, lng) {
    let best = PLACES[0];
    let bestD = Infinity;
    PLACES.forEach((place) => {
      const d = haversine([lat, lng], place.coords);
      if (d < bestD) {
        bestD = d;
        best = place;
      }
    });
    if (bestD < 0.8) return best.name;
    if (bestD < 2.5) return `قرب ${best.name}`;
    return `${best.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  function localSearch(query) {
    if (!query) return PLACES.slice(0, 8);
    const q = String(query).trim().toLowerCase();
    return PLACES.filter((p) =>
      p.name.includes(query) ||
      p.address.includes(query) ||
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q)
    );
  }

  async function searchPlace(query) {
    const local = localSearch(query);
    if (!query || query.length < 2) return local.slice(0, 8);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' بغداد العراق')}&format=json&limit=5&accept-language=ar`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return local;
      const results = await response.json();
      const remote = (results || []).map((r) => ({
        name: (r.display_name || '').split(',')[0],
        address: r.display_name,
        fullName: r.display_name,
        coords: [parseFloat(r.lat), parseFloat(r.lon)],
        type: r.type
      }));
      const merged = [...remote];
      local.forEach((item) => {
        if (!merged.some((m) => m.name === item.name)) merged.push(item);
      });
      return merged.slice(0, 8);
    } catch (_) {
      return local;
    }
  }

  function setPickMode(mode) {
    pickMode = mode || 'auto';
    emit('pickmode', pickMode);
  }

  function getPickMode() {
    return pickMode;
  }

  function ensureBookingMap() {
    if (!bookingMap) initBookingMap();
    return bookingMap;
  }

  function setFromPoint(lat, lng, label, silent) {
    fromCoords = [lat, lng];
    fromLabel = label || reverseGeocode(lat, lng);
    const map = ensureBookingMap();
    if (map && window.L) {
      if (fromMarker) map.removeLayer(fromMarker);
      fromMarker = L.marker([lat, lng], {
        draggable: true,
        icon: makeIcon(
          `<div style="width:32px;height:32px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">أ</div>`,
          32
        )
      }).addTo(map).bindPopup(`الانطلاق: ${fromLabel}`);
      fromMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        setFromPoint(p.lat, p.lng, reverseGeocode(p.lat, p.lng));
      });
      if (!toCoords) map.setView([lat, lng], 14);
    }
    if (!silent) emit('from', { lat, lng, label: fromLabel, coords: fromCoords });
    if (fromCoords && toCoords) calculateRoute();
    return fromLabel;
  }

  function setToPoint(lat, lng, label, silent) {
    toCoords = [lat, lng];
    toLabel = label || reverseGeocode(lat, lng);
    const map = ensureBookingMap();
    if (map && window.L) {
      if (toMarker) map.removeLayer(toMarker);
      toMarker = L.marker([lat, lng], {
        draggable: true,
        icon: makeIcon(
          `<div style="width:32px;height:32px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">ب</div>`,
          32
        )
      }).addTo(map).bindPopup(`الوجهة: ${toLabel}`);
      toMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        setToPoint(p.lat, p.lng, reverseGeocode(p.lat, p.lng));
      });
      if (fromCoords) {
        map.fitBounds(L.latLngBounds([fromCoords, toCoords]), { padding: [50, 50] });
      } else {
        map.setView([lat, lng], 14);
      }
    }
    if (!silent) emit('to', { lat, lng, label: toLabel, coords: toCoords });
    if (fromCoords && toCoords) calculateRoute();
    return toLabel;
  }

  function handleBookingClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const label = reverseGeocode(lat, lng);
    if (pickMode === 'from' || (pickMode === 'auto' && !fromCoords)) {
      setFromPoint(lat, lng, label);
      if (pickMode === 'auto') setPickMode('to');
      return;
    }
    setToPoint(lat, lng, label);
    if (pickMode === 'to') setPickMode('auto');
  }

  function initCustomerMap() {
    whenReady(() => {
      if (customerMap) {
        invalidateSize('customerMap');
        return;
      }
      customerMap = createMap('customerMap', 13);
      if (!customerMap) return;
      addPopularPlaces(customerMap);
      showNearbyDrivers(customerMap);
      customerMap.on('click', (e) => {
        const label = reverseGeocode(e.latlng.lat, e.latlng.lng);
        emit('homeclick', { lat: e.latlng.lat, lng: e.latlng.lng, label });
      });
      locateUser();
    });
  }

  function initDriverMap() {
    whenReady(() => {
      if (driverMap) {
        invalidateSize('driverMap');
        return;
      }
      driverMap = createMap('driverMap', 13);
      if (!driverMap) return;
      addPopularPlaces(driverMap);
      showNearbyDrivers(driverMap);
    });
  }

  function initBookingMap() {
    whenReady(() => {
      if (bookingMap) {
        invalidateSize('bookingMap');
        return;
      }
      bookingMap = createMap('bookingMap', 13);
      if (!bookingMap) return;
      addPopularPlaces(bookingMap);
      showNearbyDrivers(bookingMap);
      bookingMap.on('click', handleBookingClick);
      if (fromCoords) setFromPoint(fromCoords[0], fromCoords[1], fromLabel, true);
      if (toCoords) setToPoint(toCoords[0], toCoords[1], toLabel, true);
    });
  }

  function initTrackingMap() {
    whenReady(() => {
      if (trackingMap) {
        invalidateSize('trackingMap');
        return;
      }
      trackingMap = createMap('trackingMap', 13);
    });
  }

  function locateUser(cb) {
    const fallback = () => {
      userCoords = BAGHDAD_CENTER.slice();
      placeUserMarker(userCoords, 'بغداد — الموقع الافتراضي');
      if (cb) cb(userCoords);
    };

    if (!navigator.geolocation) {
      fallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        placeUserMarker(userCoords, 'موقعك الحالي');
        if (cb) cb(userCoords);
      },
      () => fallback(),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  }

  function placeUserMarker(coords, title) {
    if (!customerMap || !window.L) return;
    customerMap.setView(coords, 14);
    if (userMarker) customerMap.removeLayer(userMarker);
    userMarker = L.marker(coords, {
      icon: makeIcon(
        `<div class="user-marker"></div>`,
        24
      )
    }).addTo(customerMap).bindPopup(title);
  }

  function calculateDirectRoute() {
    if (!fromCoords || !toCoords) return null;
    const distance = Math.max(haversine(fromCoords, toCoords), 0.4);
    const duration = Math.max(distance * 2.4, 4);
    return { distance, duration, coords: [fromCoords, toCoords], fallback: true };
  }

  function drawRoute(coords) {
    if (!bookingMap || !window.L || !coords?.length) return;
    if (routeLayer) bookingMap.removeLayer(routeLayer);
    routeLayer = L.polyline(coords, {
      color: '#eab308',
      weight: 5,
      opacity: 0.95,
      lineJoin: 'round'
    }).addTo(bookingMap);
    bookingMap.fitBounds(routeLayer.getBounds(), { padding: [48, 48] });
  }

  async function calculateRoute() {
    if (!fromCoords || !toCoords) return null;
    const fallback = calculateDirectRoute();
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const result = {
          distance: route.distance / 1000,
          duration: route.duration / 60,
          coords: route.geometry.coordinates.map((c) => [c[1], c[0]]),
          fallback: false
        };
        drawRoute(result.coords);
        emit('route', result);
        return result;
      }
    } catch (_) {
      /* fallback below */
    }
    if (fallback) {
      drawRoute(fallback.coords);
      emit('route', fallback);
    }
    return fallback;
  }

  function startTracking(from, to, driver) {
    whenReady(() => {
      if (!trackingMap) initTrackingMap();
      window.setTimeout(() => {
        if (!trackingMap) return;
        trackingMap.eachLayer((layer) => {
          if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            trackingMap.removeLayer(layer);
          }
        });
        L.marker(from, {
          icon: makeIcon(`<div style="width:22px;height:22px;background:#22c55e;border:3px solid #fff;border-radius:50%"></div>`, 22)
        }).addTo(trackingMap);
        L.marker(to, {
          icon: makeIcon(`<div style="width:22px;height:22px;background:#ef4444;border:3px solid #fff;border-radius:50%"></div>`, 22)
        }).addTo(trackingMap);
        driverMarker = L.marker(from, {
          icon: makeIcon(
            `<div class="driver-marker">${driver?.firstName?.[0] || 'ك'}</div>`,
            40
          )
        }).addTo(trackingMap);
        routeLayer = L.polyline([from, to], {
          color: '#facc15',
          weight: 4,
          opacity: 0.7,
          dashArray: '8 6'
        }).addTo(trackingMap);
        trackingMap.fitBounds(L.latLngBounds([from, to]), { padding: [60, 60] });
        simulateDriverMovement(from, to, (point) => driverMarker?.setLatLng(point));
        invalidateSize('trackingMap');
      }, 180);
    });
  }

  function simulateDriverMovement(from, to, callback) {
    const steps = 40;
    let i = 0;
    const timer = window.setInterval(() => {
      if (i >= steps) {
        window.clearInterval(timer);
        return;
      }
      const ratio = (i + 1) / steps;
      callback([
        from[0] + (to[0] - from[0]) * ratio,
        from[1] + (to[1] - from[1]) * ratio
      ]);
      i += 1;
    }, 1600);
  }

  function resetBookingMap() {
    fromCoords = null;
    toCoords = null;
    fromLabel = '';
    toLabel = '';
    pickMode = 'auto';
    if (bookingMap) {
      if (fromMarker) bookingMap.removeLayer(fromMarker);
      if (toMarker) bookingMap.removeLayer(toMarker);
      if (routeLayer) bookingMap.removeLayer(routeLayer);
      fromMarker = toMarker = routeLayer = null;
      bookingMap.setView(BAGHDAD_CENTER, DEFAULT_ZOOM);
    }
    emit('reset');
  }

  function invalidateSize(mapName) {
    const map = { customerMap, driverMap, bookingMap, trackingMap }[mapName];
    [80, 250, 600, 1200].forEach((ms) => {
      window.setTimeout(() => map?.invalidateSize?.(), ms);
    });
  }

  function flyTo(coords, zoom = 15) {
    const map = customerMap || bookingMap;
    if (map && coords) map.setView(coords, zoom);
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
    getCurrentCoords: () => userCoords,
    getFromCoords: () => fromCoords,
    getToCoords: () => toCoords,
    getFromLabel: () => fromLabel,
    getToLabel: () => toLabel,
    setFromCoords: (c) => { fromCoords = c; },
    setToCoords: (c) => { toCoords = c; },
    resetBookingMap,
    invalidateSize,
    setPickMode,
    getPickMode,
    reverseGeocode,
    haversine,
    whenReady,
    on,
    flyTo,
    showNearbyDrivers,
    getApprovedOnlineDrivers,
    PLACES,
    BAGHDAD_CENTER
  };
})();

window.Maps = Maps;
