// Estado global de la aplicación
const state = {
  currentLang: localStorage.getItem("bsas_lang") || "es",
  waiterId: null,
  waiterName: "Isaias",
  activeCategory: "food",
  activeTab: "tab-map",
  searchQuery: "",
  map: null,
  markersLayer: null,
  safetyLayerGroup: null,
  safetyVisible: true,
  userLocationMarker: null,
  userCoords: null,
  selectedPlace: null,
  places: [],
  categories: [],
  pass: null,
  isVip: false,
  newReviewRating: 5,
  newReviewPhotoBase64: null,
  currentPlaceReviews: []
};

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  await initWaiterTracking();
  initLanguage();
  initTabs();
  initMap();
  await loadCategories();
  initFilters();
  initModalEvents();
  renderGuideList();

  // Comprobar si el dispositivo ya tiene pase VIP activo
  await checkOrPromptPass();

  // Cargar lugares
  await loadPlaces();
});

// 1. Seguimiento del Mozo (?m=isaias)
async function initWaiterTracking() {
  const urlParams = new URLSearchParams(window.location.search);
  const m = urlParams.get("m");
  if (m) {
    state.waiterId = m.trim().toLowerCase();
    localStorage.setItem("bsas_waiter", state.waiterId);
  } else {
    state.waiterId = localStorage.getItem("bsas_waiter") || "isaias";
  }

  try {
    const res = await fetch(`/api/waiter-info?id=${state.waiterId}`);
    if (res.ok) {
      const data = await res.json();
      state.waiterName = data.name;
    }
  } catch (e) {
    state.waiterName = capitalize(state.waiterId);
  }

  const waiterTag = document.getElementById("waiter-tag");
  if (waiterTag) {
    const i18n = APP_DATA.i18n[state.currentLang];
    waiterTag.textContent = `${i18n.recommendedBy}: ${state.waiterName}`;
    waiterTag.style.display = "inline-block";
  }

  const banner = document.getElementById("activation-waiter-banner");
  if (banner) {
    banner.textContent = `👨‍🍳 ${state.waiterName}`;
  }
}

// 2. Control de Estado VIP / Pase 21 Días (Modo Freemium)
async function checkOrPromptPass() {
  const passId = localStorage.getItem("bsas_pass_id");
  let deviceToken = localStorage.getItem("bsas_device_token");

  if (!deviceToken) {
    deviceToken = "dev_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("bsas_device_token", deviceToken);
  }

  if (!passId) {
    state.isVip = false;
    updateVipUI();
    return;
  }

  try {
    const res = await fetch(`/api/check-pass?passId=${passId}&deviceToken=${deviceToken}`);
    const data = await res.json();

    if (data.valid) {
      state.pass = data;
      state.isVip = true;
      updateVipUI();
    } else {
      state.isVip = false;
      localStorage.removeItem("bsas_pass_id");
      updateVipUI();
    }
  } catch (err) {
    state.isVip = false;
    updateVipUI();
  }
}

function updateVipUI() {
  const unlockBtn = document.getElementById("btn-header-unlock");
  const passTag = document.getElementById("pass-tag");

  if (state.isVip) {
    if (unlockBtn) unlockBtn.style.display = "none";
    if (passTag) {
      passTag.textContent = `⭐ VIP Activo (${state.pass ? state.pass.daysRemaining : 21}d)`;
      passTag.style.display = "inline-block";
    }
  } else {
    if (unlockBtn) unlockBtn.style.display = "inline-flex";
    if (passTag) passTag.style.display = "none";
  }

  renderTangoList();
}

function openUnlockModal() {
  document.getElementById("unlock-modal").style.display = "flex";
  setTimeout(() => {
    const pinInput = document.getElementById("input-pin-code");
    if (pinInput) pinInput.focus();
  }, 100);
}

function closeUnlockModal() {
  document.getElementById("unlock-modal").style.display = "none";
}

// Desbloquear con PIN del Mozo
async function submitTouristPin() {
  const pin = document.getElementById("input-pin-code").value.trim();
  const name = document.getElementById("input-pin-name").value.trim() || "Turista VIP";
  const deviceToken = localStorage.getItem("bsas_device_token");

  if (!pin) {
    alert("Por favor ingresá el PIN de 4 dígitos que te dio tu mozo.");
    return;
  }

  try {
    const res = await fetch("/api/unlock-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        name,
        waiterId: state.waiterId,
        deviceToken
      })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("bsas_pass_id", data.passId);
      state.pass = data;
      state.isVip = true;
      closeUnlockModal();
      updateVipUI();
      if (state.selectedPlace) {
        updateModalContent(state.selectedPlace);
      }
      alert(`🎉 ¡Excelente ${name}! Tu acceso VIP ha sido desbloqueado por 21 días.`);
    } else {
      alert(data.error || "PIN incorrecto. Pedile el PIN a tu mozo.");
    }
  } catch (e) {
    alert("Error de conexión con el servidor.");
  }
}

// Pago con Mercado Pago
async function payWithMercadoPago() {
  const name = document.getElementById("input-pin-name").value.trim() || "Turista Amigo";
  const deviceToken = localStorage.getItem("bsas_device_token");

  try {
    const res = await fetch("/api/pay-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        waiterId: state.waiterId,
        deviceToken
      })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("bsas_pass_id", data.passId);
      state.pass = data;
      state.isVip = true;
      closeUnlockModal();
      updateVipUI();
      if (state.selectedPlace) updateModalContent(state.selectedPlace);

      if (data.mpLink) {
        window.open(data.mpLink, "_blank");
      }
      alert(`¡Gracias ${name}! Tu guía VIP ha sido desbloqueada.`);
    }
  } catch (e) {
    alert("Error al conectar con Mercado Pago.");
  }
}

// Activación rápida en Modo Prueba (para testear sin pagar)
async function activateTestMode() {
  const name = document.getElementById("input-pin-name").value.trim() || "Tester";
  const deviceToken = localStorage.getItem("bsas_device_token");

  try {
    const res = await fetch("/api/pay-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        waiterId: state.waiterId,
        deviceToken,
        isTest: true
      })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem("bsas_pass_id", data.passId);
      state.pass = data;
      state.isVip = true;
      closeUnlockModal();
      updateVipUI();
      if (state.selectedPlace) updateModalContent(state.selectedPlace);
      alert(`🧪 ¡Modo Prueba VIP activado para ${name}!`);
    }
  } catch (e) {
    state.isVip = true;
    closeUnlockModal();
    updateVipUI();
  }
}

// 3. Carga de lugares
async function loadPlaces() {
  try {
    const res = await fetch("/api/places");
    if (res.ok) {
      const dbPlaces = await res.json();
      state.places = dbPlaces.map(p => ({
        id: p.id,
        category: p.category,
        name: p.name,
        address: p.address || "",
        neighborhood: p.neighborhood,
        lat: p.lat,
        lng: p.lng,
        price: p.price,
        tag: p.tag,
        image: p.image,
        tips: {
          es: p.tip_es,
          en: p.tip_en,
          pt: p.tip_pt
        }
      }));
    } else {
      state.places = APP_DATA.places;
    }
  } catch (err) {
    state.places = APP_DATA.places;
  }

  renderMarkers();
  renderTangoList();
}

// 4. Idiomas
function initLanguage() {
  const buttons = document.querySelectorAll(".lang-btn");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === state.currentLang);
    btn.addEventListener("click", () => {
      setLanguage(btn.dataset.lang);
    });
  });
  updateUITranslations();
}

function setLanguage(lang) {
  state.currentLang = lang;
  localStorage.setItem("bsas_lang", lang);

  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  updateUITranslations();
  renderMarkers();
  renderTangoList();
  renderGuideList();
  if (state.selectedPlace) {
    updateModalContent(state.selectedPlace);
  }
}

function updateUITranslations() {
  const t = APP_DATA.i18n[state.currentLang];
  document.getElementById("lbl-title").textContent = `📍 ${t.appTitle}`;
  document.getElementById("lbl-subtitle").textContent = t.subtitle;
  document.getElementById("nav-map").textContent = t.tabMap;
  document.getElementById("nav-tango").textContent = t.tabTango;
  document.getElementById("nav-guide").textContent = t.tabGuide;

  document.getElementById("btn-filter-all").textContent = t.filterAll;
  document.getElementById("btn-filter-food").textContent = t.filterFood;
  document.getElementById("btn-filter-tango").textContent = t.filterTango;
  document.getElementById("btn-filter-shopping").textContent = t.filterShopping;

  const searchInput = document.getElementById("map-search-input");
  if (searchInput && t.searchPlaceholder) {
    searchInput.placeholder = t.searchPlaceholder;
  }
  const safetyLbl = document.getElementById("lbl-safety-toggle");
  if (safetyLbl) {
    safetyLbl.textContent = state.safetyVisible ? (t.safetyBtnOn || "Zonas Seguras: ON") : (t.safetyBtnOff || "Zonas Seguras: OFF");
  }

  document.getElementById("lbl-how-to-get").textContent = t.howToGetThere;
  document.getElementById("lbl-close").textContent = t.closeBtn;

  if (state.waiterName) {
    document.getElementById("waiter-tag").textContent = `${t.recommendedBy}: ${state.waiterName}`;
  }

  const reviewsTitleEl = document.getElementById("lbl-reviews-title");
  if (reviewsTitleEl && t.reviewsTitle) {
    reviewsTitleEl.textContent = t.reviewsTitle;
  }
  const addReviewBtnEl = document.getElementById("lbl-btn-add-review");
  if (addReviewBtnEl && t.addReviewBtn) {
    addReviewBtnEl.textContent = t.addReviewBtn;
  }
}

// 5. Pestañas
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      state.activeTab = targetId;

      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById(targetId).classList.add("active");

      if (targetId === "tab-map" && state.map) {
        setTimeout(() => state.map.invalidateSize(), 150);
      }
    });
  });
}

// 6. Mapa Leaflet Moderno (CartoDB Voyager + Zonas Seguras + Búsqueda)
function initMap() {
  const defaultCoords = [-34.6037, -58.3816];
  state.map = L.map("map", { zoomControl: false }).setView(defaultCoords, 14);

  // OpenStreetMap tiles (100% libre, sin marcas de agua ni API key)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(state.map);

  L.control.zoom({ position: "topright" }).addTo(state.map);
  
  // Capas de mapa
  state.safetyLayerGroup = L.layerGroup().addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);

  // Dibujar semáforo de seguridad (zonas verdes, amarillas y rojas)
  renderSafetyZones();

  document.getElementById("btn-locate").addEventListener("click", () => locateUser(false));

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 300);

  // Centrar con GPS del cliente al inicio
  locateUser(true);
}

// Zonas de Seguridad Turística (Semáforo de Seguridad BsAs)
function renderSafetyZones() {
  if (!state.safetyLayerGroup) return;
  state.safetyLayerGroup.clearLayers();

  const zones = [
    {
      name: "Puerto Madero",
      color: "#10b981", // Verde
      coords: [
        [-34.5980, -58.3685],
        [-34.6000, -58.3605],
        [-34.6225, -58.3570],
        [-34.6250, -58.3665]
      ],
      desc: {
        es: "🟢 <strong>Zona Verde: Puerto Madero</strong><br>La zona más segura y patrullada de la ciudad. Ideal para pasear a pie a cualquier hora y cenar junto al río.",
        en: "🟢 <strong>Green Zone: Puerto Madero</strong><br>The safest area in the city, continuously patrolled. Perfect for walking day and night.",
        pt: "🟢 <strong>Zona Verde: Puerto Madero</strong><br>A área mais segura da cidade. Perfeita para caminhar a qualquer hora e jantar ao ar livre."
      }
    },
    {
      name: "Recoleta",
      color: "#10b981", // Verde
      coords: [
        [-34.5810, -58.3970],
        [-34.5790, -58.3840],
        [-34.5930, -58.3810],
        [-34.5980, -58.3930]
      ],
      desc: {
        es: "🟢 <strong>Zona Verde: Recoleta</strong><br>Barrio elegante, residencial y muy seguro. Excelente para pasear de día, visitar el Cementerio y disfrutar cafés.",
        en: "🟢 <strong>Green Zone: Recoleta</strong><br>Chic, historic and very safe neighborhood. Great for day walks, cafes, and architecture.",
        pt: "🟢 <strong>Zona Verde: Recoleta</strong><br>Bairro nobre, tranquilo e muito seguro. Ótimo para caminhar e conhecer cafés e museus."
      }
    },
    {
      name: "Palermo Soho & Hollywood",
      color: "#10b981", // Verde
      coords: [
        [-34.5700, -58.4230],
        [-34.5740, -58.4060],
        [-34.5940, -58.4240],
        [-34.5870, -58.4410]
      ],
      desc: {
        es: "🟢 <strong>Zona Verde: Palermo</strong><br>Corazón gastronómico y vida nocturna. Muy seguro y transitado. Cuidar pertenencias en mesas de vereda.",
        en: "🟢 <strong>Green Zone: Palermo</strong><br>Culinary & nightlife capital. Very safe and lively. Keep eye on bags at outdoor sidewalk tables.",
        pt: "🟢 <strong>Zona Verde: Palermo</strong><br>Epicentro gastronômico e noturno. Muito movimentado e seguro. Atenção normal a bolsas na calçada."
      }
    },
    {
      name: "San Telmo",
      color: "#f59e0b", // Amarillo
      coords: [
        [-34.6140, -58.3760],
        [-34.6140, -58.3670],
        [-34.6280, -58.3690],
        [-34.6270, -58.3790]
      ],
      desc: {
        es: "🟡 <strong>Zona Amarilla: San Telmo</strong><br>Muy turístico y pintoresco de día (Mercado, Feria). De noche circular por calles transitadas (Defensa) y guardar celular.",
        en: "🟡 <strong>Yellow Zone: San Telmo</strong><br>Very historic by day. At night stay on busy streets like Defensa and keep your phone in your pocket.",
        pt: "🟡 <strong>Zona Amarela: San Telmo</strong><br>Pitoresco de dia. À noite, prefira ruas iluminadas e movimentadas e evite usar o celular distraído."
      }
    },
    {
      name: "Terminal Retiro",
      color: "#ef4444", // Rojo
      coords: [
        [-34.5900, -58.3780],
        [-34.5880, -58.3720],
        [-34.5960, -58.3720],
        [-34.5950, -58.3785]
      ],
      desc: {
        es: "🔴 <strong>Precaución: Estación Retiro</strong><br>Gran nudo de trasbordo. Mochila y bolso siempre adelante. Evitar caminar de noche; tomar Uber o DiDi en la puerta.",
        en: "🔴 <strong>Caution Zone: Retiro Station</strong><br>Major transport hub. Keep backpacks on front. Avoid walking late at night; call an Uber or DiDi.",
        pt: "🔴 <strong>Atenção: Estação Retiro</strong><br>Terminal movimentado. Mochila na frente. Evite caminhar à noite; chame Uber ou DiDi direto na porta."
      }
    },
    {
      name: "Terminal Constitución",
      color: "#ef4444", // Rojo
      coords: [
        [-34.6240, -58.3840],
        [-34.6240, -58.3770],
        [-34.6320, -58.3780],
        [-34.6310, -58.3850]
      ],
      desc: {
        es: "🔴 <strong>Precaución: Estación Constitución</strong><br>Nudo de trenes y colectivos. No usar el celular en la vereda. Transitar acompañado o usar transporte de app.",
        en: "🔴 <strong>Caution Zone: Constitución Station</strong><br>Transit hub. Keep personal items secure and avoid phone use on sidewalk.",
        pt: "🔴 <strong>Atenção: Estação Constitución</strong><br>Terminal de trens. Não use o celular à mostra e prefira transporte por aplicativo."
      }
    }
  ];

  zones.forEach(z => {
    const polygon = L.polygon(z.coords, {
      color: z.color,
      fillColor: z.color,
      fillOpacity: 0.18,
      weight: 2,
      dashArray: z.color === "#ef4444" ? "4, 4" : null
    });

    const info = z.desc[state.currentLang] || z.desc.es;
    polygon.bindPopup(`<div style="font-size:0.85rem; line-height:1.4;">${info}</div>`);
    state.safetyLayerGroup.addLayer(polygon);
  });
}

function toggleSafetyLayer() {
  state.safetyVisible = !state.safetyVisible;
  const btn = document.getElementById("btn-toggle-safety");
  const lbl = document.getElementById("lbl-safety-toggle");
  const t = APP_DATA.i18n[state.currentLang];

  if (state.safetyVisible) {
    if (state.safetyLayerGroup && !state.map.hasLayer(state.safetyLayerGroup)) {
      state.map.addLayer(state.safetyLayerGroup);
    }
    if (btn) btn.classList.remove("off");
    if (lbl) lbl.textContent = t.safetyBtnOn || "Zonas Seguras: ON";
  } else {
    if (state.safetyLayerGroup && state.map.hasLayer(state.safetyLayerGroup)) {
      state.map.removeLayer(state.safetyLayerGroup);
    }
    if (btn) btn.classList.add("off");
    if (lbl) lbl.textContent = t.safetyBtnOff || "Zonas Seguras: OFF";
  }
}

// Búsqueda en tiempo real sobre el mapa
function handleMapSearch(val) {
  state.searchQuery = (val || "").trim().toLowerCase();
  renderMarkers();

  if (state.searchQuery.length >= 3) {
    const placesToRender = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;
    const match = placesToRender.find(p => 
      p.name.toLowerCase().includes(state.searchQuery) ||
      (p.neighborhood && p.neighborhood.toLowerCase().includes(state.searchQuery))
    );
    if (match && state.map) {
      state.map.flyTo([match.lat, match.lng], 16, { duration: 1.2 });
    }
  }
}

// Cálculo de distancia en km entre dos coordenadas (Haversine)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderMarkers() {
  if (!state.markersLayer) return;
  state.markersLayer.clearLayers();

  const placesToRender = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;

  // Filtrar por categoría activa y búsqueda
  const filteredPlaces = placesToRender.filter(place => {
    const matchCategory = (state.activeCategory === "all") || (place.category === state.activeCategory);
    if (!matchCategory) return false;

    if (!state.searchQuery) return true;
    const query = state.searchQuery;
    const nameMatch = place.name && place.name.toLowerCase().includes(query);
    const barrioMatch = place.neighborhood && place.neighborhood.toLowerCase().includes(query);
    const tagMatch = place.tag && place.tag.toLowerCase().includes(query);
    return nameMatch || barrioMatch || tagMatch;
  });

  filteredPlaces.forEach(place => {
    const cat = state.categories.find(c => c.id === place.category);
    const iconEmoji = cat ? cat.icon : (place.category === 'tango' ? '💃' : (place.category === 'shopping' ? '🛍️' : '🥩'));
    const pinColor = cat ? cat.color : '#ef4444';

    const customIcon = L.divIcon({
      className: "modern-pin",
      html: `
        <div class="modern-pin-bubble" style="background: linear-gradient(135deg, ${pinColor}, #0f172a);">
          <span>${iconEmoji}</span>
        </div>
        <div class="modern-pin-label">${place.name}</div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 40]
    });

    const marker = L.marker([place.lat, place.lng], { icon: customIcon });
    marker.on("click", () => openPlaceModal(place));
    state.markersLayer.addLayer(marker);
  });
}

function locateUser(silent = false) {
  if (!navigator.geolocation) {
    if (!silent) alert("Geolocalización no disponible.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      state.userCoords = { lat, lng };

      if (state.userLocationMarker) {
        state.map.removeLayer(state.userLocationMarker);
      }

      const userIcon = L.divIcon({
        className: "user-gps-pin",
        html: `<div style="
          background: #3b82f6;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      state.userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
      state.map.setView([lat, lng], 15);

      // Si el modal está abierto, refrescar la distancia en vivo
      if (state.selectedPlace) {
        updateModalContent(state.selectedPlace);
      }
    },
    () => {
      if (!silent) alert("Activá el GPS para ver tu ubicación.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// 7. Filtros y Categorías Dinámicas
async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    if (res.ok) {
      state.categories = await res.json();
    }
  } catch (e) {
    state.categories = [
      { id: "food", name: "Parrillas & Carnes", icon: "🥩", color: "#ef4444" },
      { id: "tango", name: "Tango & Shows", icon: "💃", color: "#a855f7" },
      { id: "shopping", name: "Shoppings & Paseos", icon: "🛍️", color: "#06b6d4" }
    ];
  }

  renderFilterChips();
}

function renderFilterChips() {
  const container = document.querySelector(".map-filters");
  if (!container || !state.categories || state.categories.length === 0) return;

  const chipsHtml = state.categories.map(c => `
    <button class="filter-chip ${state.activeCategory === c.id ? 'active' : ''}" data-category="${c.id}" id="btn-filter-${c.id}">
      ${c.icon} ${c.name}
    </button>
  `).join("") + `
    <button class="filter-chip ${state.activeCategory === 'all' ? 'active' : ''}" data-category="all" id="btn-filter-all">
      🗺️ Todos
    </button>
  `;

  container.innerHTML = chipsHtml;
  initFilters();
}

function initFilters() {
  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeCategory = chip.dataset.category;
      renderMarkers();
    });
  });
}

// 8. Modal y Beneficios (Control de candados VIP)
function initModalEvents() {
  const modal = document.getElementById("place-modal");
  const closeBtn = document.getElementById("btn-close-modal");

  closeBtn.addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("active");
  });

  initRatingStars();
}

function openPlaceModal(place) {
  state.selectedPlace = place;
  updateModalContent(place);
  closeReviewForm();
  loadPlaceReviews(place.id);
  document.getElementById("place-modal").classList.add("active");
}

function updateModalContent(place) {
  document.getElementById("sheet-name").textContent = place.name;
  const locationText = place.address ? `${place.address} (${place.neighborhood})` : place.neighborhood;
  document.getElementById("sheet-neighborhood").textContent = locationText;
  document.getElementById("sheet-price").textContent = place.price;
  document.getElementById("sheet-tag").textContent = place.tag;
  document.getElementById("sheet-image").src = place.image;

  // Distancia y tiempo caminando en vivo según GPS
  const distElem = document.getElementById("sheet-distance");
  if (distElem) {
    if (state.userCoords && place.lat && place.lng) {
      const dKm = getDistanceFromLatLonInKm(state.userCoords.lat, state.userCoords.lng, place.lat, place.lng);
      if (dKm < 1) {
        const meters = Math.round(dKm * 1000);
        const minsWalk = Math.max(1, Math.round(meters / 80));
        distElem.textContent = `📍 a ${meters}m (~${minsWalk} min a pie)`;
      } else {
        distElem.textContent = `📍 a ${dKm.toFixed(1)} km`;
      }
      distElem.style.display = "inline-flex";
    } else {
      distElem.style.display = "none";
    }
  }

  const tipText = place.tips[state.currentLang] || place.tips.es;
  const tipWrapper = document.getElementById("sheet-tip-wrapper");

  if (state.isVip) {
    // Modo VIP: Tip completo y visible
    tipWrapper.innerHTML = `
      <div class="tip-box">
        <strong>💡 Tip Local de Mozo:</strong>
        <p>${tipText}</p>
      </div>
    `;
    document.getElementById("lbl-uber").textContent = "Pedir con Uber";
    document.getElementById("lbl-didi").textContent = "Pedir con DiDi";
  } else {
    // Modo Freemium: Tip borroso con candado
    tipWrapper.innerHTML = `
      <div class="tip-box locked-tip">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#f59e0b;">💡 Tip Secreto del Mozo</strong>
          <span style="font-size:0.7rem; background:#f59e0b; color:#0f172a; font-weight:700; padding:2px 6px; border-radius:4px;">🔒 VIP</span>
        </div>
        <p class="blur-text">${tipText}</p>
        <button class="btn-unlock-inline" onclick="openUnlockModal()">
          🔑 Ingresar PIN para desbloquear este tip
        </button>
      </div>
    `;
    document.getElementById("lbl-uber").textContent = "🔒 Pedir con Uber (VIP)";
    document.getElementById("lbl-didi").textContent = "🔒 Pedir con DiDi (VIP)";
  }

  // Uber
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${place.lat}&dropoff[longitude]=${place.lng}&dropoff[nickname]=${encodeURIComponent(place.name)}`;
  document.getElementById("btn-uber").href = uberUrl;

  // DiDi
  document.getElementById("btn-didi").href = `https://didi.onelink.me/543160416/`;

  // Google Maps (Gratis)
  document.getElementById("btn-gmaps").href = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
}

function handleTransportClick(e, type) {
  if (!state.isVip) {
    e.preventDefault();
    alert("🔒 Para pedir autos con el destino directo necesitas desbloquear el acceso VIP con el PIN de tu mozo.");
    openUnlockModal();
    return false;
  }
  trackClick(type);
  return true;
}

// 9. Tango & Shows (Control VIP)
function renderTangoList() {
  const container = document.getElementById("tango-list-container");
  const placesToRender = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;
  const tangos = placesToRender.filter(p => p.category === "tango");
  const t = APP_DATA.i18n[state.currentLang];
  const waiterName = state.waiterName || capitalize(state.waiterId);

  container.innerHTML = tangos.map(item => {
    const tip = item.tips[state.currentLang] || item.tips.es;
    const waMsg = `Hola! Me interesa reservar el show de Tango en ${item.name} (${item.neighborhood}). Vengo recomendado por ${waiterName}. ¿Tienen disponibilidad para hoy o mañana?`;
    const waUrl = `https://wa.me/${APP_DATA.config.agencyWhatsApp}?text=${encodeURIComponent(waMsg)}`;

    return `
      <article class="card-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${item.name}</h3>
            <span class="sheet-badge">${t.tangoBadge}</span>
          </div>
          <div class="sheet-meta">
            <span>📍 ${item.neighborhood}</span> • <span>${item.price}</span> • <span>${item.tag}</span>
          </div>
          <p class="card-desc">${tip}</p>
          ${state.isVip ? `
            <a href="${waUrl}" target="_blank" class="btn-whatsapp" onclick="trackClick('tango', '${item.id}')">
              <span>💬</span> <span>${t.bookTangoBtn}</span>
            </a>
          ` : `
            <button onclick="openUnlockModal()" class="btn-whatsapp" style="background:#f59e0b; color:#0f172a; font-weight:800; cursor:pointer;">
              <span>🔒</span> <span>Desbloquear Descuentos con PIN</span>
            </button>
          `}
        </div>
      </article>
    `;
  }).join("");
}

// 10. Guía de Seguridad
function renderGuideList() {
  const container = document.getElementById("guide-list-container");
  const guide = APP_DATA.guide;
  const lang = state.currentLang;
  const sections = ["money", "safety", "transport", "tipping"];

  container.innerHTML = sections.map(key => {
    const item = guide[key];
    const title = item.title[lang] || item.title.es;
    const text = item.text[lang] || item.text.es;

    return `
      <article class="guide-card">
        <h3>${title}</h3>
        <p>${text}</p>
      </article>
    `;
  }).join("");
}

// 11. Clics
function trackClick(actionType, placeId = "") {
  try {
    fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType,
        placeId: placeId || (state.selectedPlace ? state.selectedPlace.id : ""),
        waiterId: state.waiterId
      })
    });
  } catch (err) {}
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== RESEÑAS Y FOTOS DE TURISTAS ====================
function initRatingStars() {
  const starBtns = document.querySelectorAll(".star-btn");
  starBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = parseInt(btn.dataset.val, 10);
      setRating(val);
    });
  });
}

function setRating(val) {
  state.newReviewRating = val;
  const starBtns = document.querySelectorAll(".star-btn");
  starBtns.forEach(btn => {
    const btnVal = parseInt(btn.dataset.val, 10);
    btn.classList.toggle("active", btnVal <= val);
  });
}

function toggleReviewForm() {
  const formBox = document.getElementById("review-form-container");
  if (!formBox) return;
  const isHidden = formBox.style.display === "none";
  if (isHidden) {
    formBox.style.display = "block";
    const nameInput = document.getElementById("review-author-name");
    const savedName = localStorage.getItem("bsas_tourist_name");
    if (nameInput && savedName) {
      nameInput.value = savedName;
    }
    const commentInput = document.getElementById("review-comment-text");
    if (commentInput) setTimeout(() => commentInput.focus(), 100);
  } else {
    closeReviewForm();
  }
}

function closeReviewForm() {
  const formBox = document.getElementById("review-form-container");
  if (formBox) formBox.style.display = "none";
  const commentInput = document.getElementById("review-comment-text");
  if (commentInput) commentInput.value = "";
  clearReviewPhoto();
  setRating(5);
}

function onReviewPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Redimensionar para optimizar peso (máx 800px)
      const maxDim = 800;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Comprimir a JPEG con calidad 0.75 (~80KB - 120KB)
      state.newReviewPhotoBase64 = canvas.toDataURL("image/jpeg", 0.75);

      const previewWrap = document.getElementById("review-photo-preview-wrap");
      const previewImg = document.getElementById("review-photo-preview-img");
      if (previewWrap && previewImg) {
        previewImg.src = state.newReviewPhotoBase64;
        previewWrap.style.display = "block";
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearReviewPhoto() {
  state.newReviewPhotoBase64 = null;
  const fileInput = document.getElementById("review-photo-file");
  if (fileInput) fileInput.value = "";
  const previewWrap = document.getElementById("review-photo-preview-wrap");
  if (previewWrap) previewWrap.style.display = "none";
}

async function submitReview() {
  if (!state.selectedPlace) return;

  const nameInput = document.getElementById("review-author-name");
  const countryInput = document.getElementById("review-author-country");
  const commentInput = document.getElementById("review-comment-text");

  const userName = (nameInput ? nameInput.value : "").trim() || "Turista Amigo";
  const userCountry = countryInput ? countryInput.value : "🌍 Turista";
  const comment = (commentInput ? commentInput.value : "").trim();

  if (!comment) {
    alert("Por favor escribí un breve comentario sobre tu experiencia.");
    return;
  }

  localStorage.setItem("bsas_tourist_name", userName);

  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: state.selectedPlace.id,
        userName,
        userCountry,
        rating: state.newReviewRating || 5,
        comment,
        photoData: state.newReviewPhotoBase64,
        waiterId: state.waiterId || "isaias"
      })
    });

    const data = await res.json();
    if (data.success) {
      alert("🎉 ¡Muchas gracias por compartir tu experiencia y foto!");
      closeReviewForm();
      await loadPlaceReviews(state.selectedPlace.id);
    } else {
      alert(data.error || "No se pudo publicar la opinión.");
    }
  } catch (err) {
    alert("Error de conexión al enviar tu opinión.");
  }
}

async function loadPlaceReviews(placeId) {
  const container = document.getElementById("reviews-list-container");
  const avgRatingEl = document.getElementById("reviews-avg-rating");
  if (!container) return;

  container.innerHTML = '<div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:10px 0;">Cargando opiniones...</div>';

  try {
    const res = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`);
    const reviews = await res.json();
    state.currentPlaceReviews = reviews;

    if (!reviews || reviews.length === 0) {
      container.innerHTML = '<div style="font-size:0.82rem; color:#94a3b8; text-align:center; padding:12px; background:rgba(255,255,255,0.02); border-radius:8px;">Aún no hay opiniones de este lugar. ¡Sé el primero en compartir la tuya!</div>';
      if (avgRatingEl) avgRatingEl.textContent = "Sé el primero en opinar";
      return;
    }

    // Calcular promedio
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const avg = (sum / reviews.length).toFixed(1);
    if (avgRatingEl) {
      avgRatingEl.textContent = `★ ${avg} / 5 (${reviews.length} ${reviews.length === 1 ? 'opinión' : 'opiniones'})`;
    }

    container.innerHTML = reviews.map(r => {
      const dateStr = new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      return `
        <div class="review-item-card">
          <div class="review-item-header">
            <div class="review-author">
              <span>👤 ${r.user_name}</span>
              <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${r.user_country})</span>
            </div>
            <div class="review-stars">${stars}</div>
          </div>
          <div class="review-date" style="margin-bottom:6px;">${dateStr}</div>
          <p class="review-comment">${r.comment}</p>
          ${r.photo_data ? `
            <img src="${r.photo_data}" class="review-photo-thumb" alt="Foto de ${r.user_name}" onclick="window.open(this.src, '_blank')">
          ` : ''}
          ${r.waiter_id ? `
            <div>
              <span class="review-waiter-tag">👨‍🍳 Recomendado por mozo ${capitalize(r.waiter_id)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = '<div style="font-size:0.8rem; color:#ef4444; text-align:center; padding:10px 0;">Error al cargar opiniones.</div>';
  }
}
