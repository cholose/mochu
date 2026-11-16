// Estado global de la aplicación
const state = {
  currentLang: localStorage.getItem("bsas_lang") || "es",
  waiterId: null,
  waiterName: "Isaias",
  activeCategory: "food",
  activeTab: "tab-map",
  map: null,
  markersLayer: null,
  userLocationMarker: null,
  selectedPlace: null,
  places: [],
  pass: null,
  isVip: false
};

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  await initWaiterTracking();
  initLanguage();
  initTabs();
  initMap();
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

  document.getElementById("lbl-how-to-get").textContent = t.howToGetThere;
  document.getElementById("lbl-close").textContent = t.closeBtn;

  if (state.waiterName) {
    document.getElementById("waiter-tag").textContent = `${t.recommendedBy}: ${state.waiterName}`;
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

// 6. Mapa Leaflet (Arranca en ubicación del cliente)
function initMap() {
  const defaultCoords = [-34.6037, -58.3816];
  state.map = L.map("map", { zoomControl: false }).setView(defaultCoords, 14);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(state.map);

  L.control.zoom({ position: "topright" }).addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);

  document.getElementById("btn-locate").addEventListener("click", () => locateUser(false));

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 300);

  // Ubicación del cliente al inicio
  locateUser(true);
}

function renderMarkers() {
  if (!state.markersLayer) return;
  state.markersLayer.clearLayers();

  const placesToRender = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;

  // Filtrado por categoría seleccionada
  const filteredPlaces = placesToRender.filter(place => {
    if (state.activeCategory === "all") return true;
    return place.category === state.activeCategory;
  });

  filteredPlaces.forEach(place => {
    let iconEmoji = "🥩";
    if (place.category === "tango") iconEmoji = "💃";
    if (place.category === "shopping") iconEmoji = "🛍️";

    const customIcon = L.divIcon({
      className: "custom-map-pin",
      html: `<div style="
        background: #1e293b;
        color: white;
        border: 2px solid #10b981;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 19px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        cursor: pointer;
      ">${iconEmoji}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
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
    },
    () => {
      if (!silent) alert("Activá el GPS para ver tu ubicación.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// 7. Filtros
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
}

function openPlaceModal(place) {
  state.selectedPlace = place;
  updateModalContent(place);
  document.getElementById("place-modal").classList.add("active");
}

function updateModalContent(place) {
  document.getElementById("sheet-name").textContent = place.name;
  document.getElementById("sheet-neighborhood").textContent = place.neighborhood;
  document.getElementById("sheet-price").textContent = place.price;
  document.getElementById("sheet-tag").textContent = place.tag;
  document.getElementById("sheet-image").src = place.image;

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
