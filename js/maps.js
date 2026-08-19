/**
 * خرائط تكسي دجلة — الناصرية فقط
 * Leaflet + OpenStreetMap + مسار حقيقي للسائق من موقعه الفعلي
 */
const Maps = (() => {
  'use strict';

  const CITY_CENTER = [31.0452, 46.2561];
  const DEFAULT_ZOOM = 13;
  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const BOUNDS = { north: 31.125, south: 30.935, east: 46.355, west: 46.075 };

  const PLACES = [
    { name: 'الحبوبي', address: 'شارع الحبوبي، مركز الناصرية', coords: [31.0461, 46.2525] },
    { name: 'الصالحية', address: 'حي الصالحية، الناصرية', coords: [31.0520, 46.2642] },
    { name: 'الشموخ', address: 'حي الشموخ، الناصرية', coords: [31.0680, 46.2780] },
    { name: 'الإسكان', address: 'حي الإسكان، الناصرية', coords: [31.0750, 46.2350] },
    { name: 'الجمهورية', address: 'حي الجمهورية، الناصرية', coords: [31.0380, 46.2480] },
    { name: 'الأورفلي', address: 'حي الأورفلي، الناصرية', coords: [31.0550, 46.2400] },
    { name: 'السكك', address: 'حي السكك، الناصرية', coords: [31.0500, 46.2700] },
    { name: 'الشعلة', address: 'حي الشعلة، الناصرية', coords: [31.0720, 46.2500] },
    { name: 'المتنبي', address: 'حي المتنبي، الناصرية', coords: [31.0420, 46.2620] },
    { name: '14 تموز', address: 'حي 14 تموز، الناصرية', coords: [31.0350, 46.2550] },
    { name: 'سومر', address: 'حي سومر، الناصرية', coords: [31.0280, 46.2680] },
    { name: 'حي أور', address: 'حي أور السكني، الناصرية', coords: [31.0200, 46.2450] },
    { name: 'زقورة أور', address: 'مدينة أور الأثرية', coords: [30.9626, 46.1031] },
    { name: 'جامعة ذي قار', address: 'جامعة ذي قار، الناصرية', coords: [31.0320, 46.2380] },
    { name: 'المستشفى العام', address: 'مستشفى الناصرية العام', coords: [31.0480, 46.2450] },
    { name: 'السوق الكبير', address: 'السوق الكبير، الناصرية', coords: [31.0440, 46.2580] },
    { name: 'كورنيش الفرات', address: 'كورنيش نهر الفرات', coords: [31.0410, 46.2500] },
    { name: 'جسر النصر', address: 'جسر النصر، الناصرية', coords: [31.0400, 46.2470] },
    { name: 'حي العسكري', address: 'حي العسكري، الناصرية', coords: [31.0600, 46.2300] },
    { name: 'حي المعلمين', address: 'حي المعلمين، الناصرية', coords: [31.0580, 46.2700] },
    { name: 'حي الحسين', address: 'حي الحسين، الناصرية', coords: [31.0650, 46.2550] },
    { name: 'حي الأمير', address: 'حي الأمير، الناصرية', coords: [31.0300, 46.2750] },
    { name: 'حي النفط', address: 'حي النفط، الناصرية', coords: [31.0800, 46.2600] },
    { name: 'الصناعي', address: 'الحي الصناعي، الناصرية', coords: [31.0780, 46.2280] },
    { name: 'شارع بغداد', address: 'شارع بغداد، الناصرية', coords: [31.0620, 46.2650] },
    { name: 'ملعب الناصرية', address: 'ملعب الناصرية الأولمبي', coords: [31.0500, 46.2400] },
    { name: 'مجمع ذي قار', address: 'مجمع ذي قار التجاري', coords: [31.0470, 46.2550] },
    { name: 'محطة القطار', address: 'محطة قطار الناصرية', coords: [31.0520, 46.2720] },
    { name: 'حي الصابئة', address: 'حي الصابئة، الناصرية', coords: [31.0430, 46.2450] },
    { name: 'الجامعة التقنية', address: 'الجامعة التقنية الجنوبية', coords: [31.0260, 46.2520] }
  ];

  let customerMap = null;
  let driverMap = null;
  let bookingMap = null;
  let trackingMap = null;
  let userMarker = null;
  let fromMarker = null;
  let toMarker = null;
  let routeLayer = null;
  let trackingDriverMarker = null;
  let trackingPickupLine = null;
  let trackingTripLine = null;
  let trackingPassedLine = null;
  let userCoords = null;
  let fromCoords = null;
  let toCoords = null;
  let fromLabel = '';
  let toLabel = '';
  let pickMode = 'auto';
  let trackTimer = null;
  let trackState = null;
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

  function isInsideCity(lat, lng) {
    return lat >= BOUNDS.south && lat <= BOUNDS.north && lng >= BOUNDS.west && lng <= BOUNDS.east;
  }

  function clampToCity(lat, lng) {
    if (isInsideCity(lat, lng)) return [lat, lng];
    return CITY_CENTER.slice();
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

  function cityLatLngBounds() {
    return L.latLngBounds(
      [BOUNDS.south, BOUNDS.west],
      [BOUNDS.north, BOUNDS.east]
    );
  }

  function createMap(id, zoom = DEFAULT_ZOOM) {
    const el = document.getElementById(id);
    if (!el || !window.L) return null;
    const map = L.map(id, {
      zoomControl: false,
      attributionControl: false,
      tap: true,
      maxBounds: cityLatLngBounds().pad(0.18),
      maxBoundsViscosity: 0.85
    }).setView(CITY_CENTER, zoom);
    addTiles(map);
    window.setTimeout(() => map.invalidateSize(), 80);
    window.setTimeout(() => map.invalidateSize(), 320);
    window.setTimeout(() => map.invalidateSize(), 800);
    return map;
  }

  function addPopularPlaces(map) {
    if (!map) return;
    PLACES.slice(0, 14).forEach((place) => {
      L.circleMarker(place.coords, {
        radius: 5,
        color: '#fff',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.9
      }).addTo(map).bindPopup(`<strong>${place.name}</strong><br><small>${place.address}</small>`);
    });
  }

  function getApprovedOnlineDrivers(type) {
    const wanted = type ? window.DB?.normalizeCarType?.(type) : null;
    const list = window.DB?.getDrivers?.() || [];
    return list.filter((d) => {
      if (d.status !== 'approved' || !d.online || !d.location) return false;
      if (wanted && window.DB.normalizeCarType(d.carType) !== wanted) return false;
      return true;
    });
  }

  function showNearbyDrivers(map, type) {
    if (!map) return;
    getApprovedOnlineDrivers(type).forEach((driver) => {
      L.marker([driver.location.lat, driver.location.lng], {
        icon: makeIcon(
          `<div class="driver-marker">${driver.firstName?.[0] || 'س'}</div>`,
          36
        )
      }).addTo(map).bindPopup(`
        <div style="text-align:right;direction:rtl;min-width:160px">
          <strong>${driver.firstName} ${driver.lastName}</strong><br>
          <small>${driver.carModel || ''}</small><br>
          <small>${typeLabel(driver.carType)} • ${driver.location.area || 'الناصرية'}</small><br>
          <small>⭐ ${driver.rating} (${driver.trips || 0} رحلة)</small>
        </div>
      `);
    });
  }

  function typeLabel(type) {
    return {
      economy: 'اقتصادي',
      comfort: 'كومفورت',
      premium: 'بريميوم',
      van: 'عائلي',
      sedan: 'اقتصادي'
    }[type] || type || '';
  }

  function reverseGeocode(lat, lng) {
    if (!isInsideCity(lat, lng)) return 'خارج منطقة الخدمة';
    let best = PLACES[0];
    let bestD = Infinity;
    PLACES.forEach((place) => {
      const d = haversine([lat, lng], place.coords);
      if (d < bestD) {
        bestD = d;
        best = place;
      }
    });
    if (bestD < 0.45) return best.name;
    if (bestD < 1.4) return `قرب ${best.name}`;
    return `${best.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  function localSearch(query) {
    if (!query) return PLACES.slice(0, 10);
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
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' الناصرية ذي قار العراق')}&format=json&limit=6&accept-language=ar&viewbox=46.07,31.13,46.36,30.93&bounded=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return local;
      const results = await response.json();
      const remote = (results || [])
        .map((r) => ({
          name: (r.display_name || '').split(',')[0],
          address: r.display_name,
          fullName: r.display_name,
          coords: [parseFloat(r.lat), parseFloat(r.lon)],
          type: r.type
        }))
        .filter((r) => isInsideCity(r.coords[0], r.coords[1]));
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
    if (!isInsideCity(lat, lng)) {
      emit('outside', { lat, lng });
      return null;
    }
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
        if (!isInsideCity(p.lat, p.lng)) {
          fromMarker.setLatLng(fromCoords);
          emit('outside', { lat: p.lat, lng: p.lng });
          return;
        }
        setFromPoint(p.lat, p.lng, reverseGeocode(p.lat, p.lng));
      });
      if (!toCoords) map.setView([lat, lng], 15);
    }
    if (!silent) emit('from', { lat, lng, label: fromLabel, coords: fromCoords });
    if (fromCoords && toCoords) calculateRoute();
    return fromLabel;
  }

  function setToPoint(lat, lng, label, silent) {
    if (!isInsideCity(lat, lng)) {
      emit('outside', { lat, lng });
      return null;
    }
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
        if (!isInsideCity(p.lat, p.lng)) {
          toMarker.setLatLng(toCoords);
          emit('outside', { lat: p.lat, lng: p.lng });
          return;
        }
        setToPoint(p.lat, p.lng, reverseGeocode(p.lat, p.lng));
      });
      if (fromCoords) {
        map.fitBounds(L.latLngBounds([fromCoords, toCoords]), { padding: [50, 50] });
      } else {
        map.setView([lat, lng], 15);
      }
    }
    if (!silent) emit('to', { lat, lng, label: toLabel, coords: toCoords });
    if (fromCoords && toCoords) calculateRoute();
    return toLabel;
  }

  function handleBookingClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    if (!isInsideCity(lat, lng)) {
      emit('outside', { lat, lng });
      return;
    }
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
        if (!isInsideCity(e.latlng.lat, e.latlng.lng)) {
          emit('outside', { lat: e.latlng.lat, lng: e.latlng.lng });
          return;
        }
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
      trackingMap = createMap('trackingMap', 14);
    });
  }

  function locateUser(cb) {
    const fallback = (reason) => {
      userCoords = CITY_CENTER.slice();
      placeUserMarker(userCoords, 'مركز الناصرية — الموقع الافتراضي');
      if (cb) cb(userCoords, reason || 'fallback');
    };

    if (!navigator.geolocation) {
      fallback('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!isInsideCity(lat, lng)) {
          userCoords = CITY_CENTER.slice();
          placeUserMarker(userCoords, 'خدمتنا داخل الناصرية فقط');
          if (cb) cb(userCoords, 'outside');
          emit('outside', { lat, lng });
          return;
        }
        userCoords = [lat, lng];
        placeUserMarker(userCoords, 'موقعك الحالي');
        if (cb) cb(userCoords, 'ok');
      },
      () => fallback('denied'),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 20000 }
    );
  }

  function placeUserMarker(coords, title) {
    if (!customerMap || !window.L) return;
    customerMap.setView(coords, 15);
    if (userMarker) customerMap.removeLayer(userMarker);
    userMarker = L.marker(coords, {
      icon: makeIcon(`<div class="user-marker"></div>`, 24)
    }).addTo(customerMap).bindPopup(title);
  }

  function calculateDirectRoute(a, b) {
    if (!a || !b) return null;
    const distance = Math.max(haversine(a, b), 0.4);
    const duration = Math.max(distance * 2.6, 4);
    return { distance, duration, coords: [a, b], fallback: true };
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

  async function fetchOsrm(from, to) {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const payload = await response.json();
    if (!payload.routes?.[0]) return null;
    const route = payload.routes[0];
    return {
      distance: route.distance / 1000,
      duration: route.duration / 60,
      coords: route.geometry.coordinates.map((c) => [c[1], c[0]]),
      fallback: false
    };
  }

  async function routeBetween(from, to) {
    const fallback = calculateDirectRoute(from, to);
    try {
      const real = await fetchOsrm(from, to);
      if (real) return real;
    } catch (_) { /* fallback */ }
    return fallback;
  }

  async function calculateRoute() {
    if (!fromCoords || !toCoords) return null;
    const result = await routeBetween(fromCoords, toCoords);
    if (result) {
      drawRoute(result.coords);
      emit('route', result);
    }
    return result;
  }

  function clearTrackTimer() {
    if (trackTimer) {
      window.clearInterval(trackTimer);
      trackTimer = null;
    }
  }

  function stopTracking() {
    clearTrackTimer();
    trackState = null;
  }

  function remainingDistance(coords, index) {
    let sum = 0;
    for (let i = index; i < coords.length - 1; i += 1) {
      sum += haversine(coords[i], coords[i + 1]);
    }
    return sum;
  }

  async function startTracking(from, to, driver) {
    stopTracking();
    const pickup = from;
    const dest = to;
    const start = driver?.location
      ? [driver.location.lat, driver.location.lng]
      : [
        pickup[0] + 0.008,
        pickup[1] - 0.007
      ];

    const toPickup = await routeBetween(start, pickup);
    const toDest = await routeBetween(pickup, dest);

    whenReady(() => {
      if (!trackingMap) initTrackingMap();
      window.setTimeout(() => {
        if (!trackingMap || !window.L) return;
        trackingMap.eachLayer((layer) => {
          if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            trackingMap.removeLayer(layer);
          }
        });

        L.marker(pickup, {
          icon: makeIcon(`<div style="width:22px;height:22px;background:#22c55e;border:3px solid #fff;border-radius:50%"></div>`, 22)
        }).addTo(trackingMap).bindPopup('نقطة الانطلاق');

        L.marker(dest, {
          icon: makeIcon(`<div style="width:22px;height:22px;background:#ef4444;border:3px solid #fff;border-radius:50%"></div>`, 22)
        }).addTo(trackingMap).bindPopup('الوجهة');

        trackingPickupLine = L.polyline(toPickup.coords, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.85
        }).addTo(trackingMap);

        trackingTripLine = L.polyline(toDest.coords, {
          color: '#facc15',
          weight: 4,
          opacity: 0.45,
          dashArray: '8 6'
        }).addTo(trackingMap);

        trackingPassedLine = L.polyline([start], {
          color: '#22c55e',
          weight: 4,
          opacity: 0.9
        }).addTo(trackingMap);

        trackingDriverMarker = L.marker(start, {
          icon: makeIcon(
            `<div class="driver-marker">${driver?.firstName?.[0] || 'ك'}</div>`,
            40
          )
        }).addTo(trackingMap).bindPopup(`${driver?.firstName || 'السائق'} في الطريق إليك`);

        const allPts = [...toPickup.coords, ...toDest.coords];
        trackingMap.fitBounds(L.latLngBounds(allPts), { padding: [50, 50] });

        trackState = {
          phase: 'to_pickup',
          pickupPath: toPickup.coords,
          tripPath: toDest.coords,
          index: 0,
          driverId: driver?.id,
          pickupEta: toPickup.duration,
          tripEta: toDest.duration
        };

        const pickupSteps = Math.max(18, Math.min(48, toPickup.coords.length));
        const tripSteps = Math.max(22, Math.min(70, toDest.coords.length));
        const pickupMs = Math.max(9000, Math.min(28000, toPickup.duration * 700));
        const tripMs = Math.max(12000, Math.min(40000, toDest.duration * 500));

        animatePhase('to_pickup', toPickup.coords, pickupSteps, pickupMs / pickupSteps, () => {
          emit('arrived_pickup', { coords: pickup });
          if (trackingPickupLine) trackingMap.removeLayer(trackingPickupLine);
          if (trackingTripLine) {
            trackingTripLine.setStyle({ opacity: 0.95, dashArray: null });
          }
          animatePhase('to_dest', toDest.coords, tripSteps, tripMs / tripSteps, () => {
            emit('arrived_dest', { coords: dest });
          });
        });

        invalidateSize('trackingMap');
      }, 160);
    });
  }

  function animatePhase(phase, coords, steps, interval, onDone) {
    clearTrackTimer();
    if (!coords?.length) {
      onDone?.();
      return;
    }
    const stride = Math.max(1, Math.floor(coords.length / steps));
    let i = 0;
    if (trackState) {
      trackState.phase = phase;
      trackState.index = 0;
    }
    trackTimer = window.setInterval(() => {
      i = Math.min(i + stride, coords.length - 1);
      const point = coords[i];
      trackingDriverMarker?.setLatLng(point);
      trackingPassedLine?.addLatLng(point);
      if (trackingMap) trackingMap.panTo(point, { animate: true, duration: 0.4 });
      const remainKm = remainingDistance(coords, i);
      const remainMin = Math.max(1, remainKm * 2.6);
      emit('track', { phase, point, remainKm, remainMin, index: i, total: coords.length });
      if (trackState?.driverId && window.DB?.updateDriverLocation) {
        window.DB.updateDriverLocation(trackState.driverId, point[0], point[1], reverseGeocode(point[0], point[1]));
      }
      if (i >= coords.length - 1) {
        clearTrackTimer();
        onDone?.();
      }
    }, interval);
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
      bookingMap.setView(CITY_CENTER, DEFAULT_ZOOM);
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

  function focusDriverOnHome(driver) {
    if (!driverMap || !driver?.location) return;
    driverMap.setView([driver.location.lat, driver.location.lng], 15);
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
    routeBetween,
    startTracking,
    stopTracking,
    getCurrentCoords: () => userCoords,
    getFromCoords: () => fromCoords,
    getToCoords: () => toCoords,
    getFromLabel: () => fromLabel,
    getToLabel: () => toLabel,
    resetBookingMap,
    invalidateSize,
    setPickMode,
    getPickMode,
    reverseGeocode,
    haversine,
    isInsideCity,
    clampToCity,
    whenReady,
    on,
    flyTo,
    showNearbyDrivers,
    getApprovedOnlineDrivers,
    focusDriverOnHome,
    typeLabel,
    PLACES,
    CITY_CENTER,
    BAGHDAD_CENTER: CITY_CENTER,
    BOUNDS
  };
})();

window.Maps = Maps;
