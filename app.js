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
  currentPlaceReviews: [],
  currentRouteLayer: null,
  routeGlowLayer: null,
  currentRouteTarget: null,
  currentRouteMode: 'walking',
  isRainyFilterActive: false,
  selectedTipPercent: 10,
  exchangeRates: { USD: 1180, EUR: 1280, BRL: 215, updated: false }
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
  renderEventsList();

  // Comprobar si el dispositivo ya tiene pase VIP activo
  await checkOrPromptPass();

  // Cargar lugares
  await loadPlaces();

  // Auto-lanzar el tour guiado la primera vez que un turista entra a la app
  setTimeout(() => {
    try {
      if (!localStorage.getItem("bsas_tour_completed")) {
        openOnboardingTour();
      }
    } catch(e) {}
  }, 1200);
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

// ==================== TOUR DE PRIMERA VEZ (TUTORIAL GUIADO) ====================
const ONBOARDING_STEPS = [
  {
    icon: "🗺️",
    badge: { es: "Paso 1 de 5", en: "Step 1 of 5", pt: "Passo 1 de 5" },
    title: {
      es: "Mapa en Vivo y Cómo Llegar",
      en: "Live Map & Direct Rides",
      pt: "Mapa ao Vivo e Como Chegar"
    },
    desc: {
      es: "Tocá cualquier pin en el mapa para ver fotos reales, cartas con precios actualizados y pedir un Uber o DiDi directo a la puerta.",
      en: "Tap any pin on the map to see authentic photos, menus with current prices, and request an Uber or DiDi straight to the entrance.",
      pt: "Toque em qualquer pin no mapa para ver fotos reais, cardápios com preços atualizados e pedir um Uber ou DiDi direto até a porta."
    }
  },
  {
    icon: "🥩",
    badge: { es: "Paso 2 de 5", en: "Step 2 of 5", pt: "Passo 2 de 5" },
    title: {
      es: "Categorías para Cada Momento",
      en: "Categories for Every Mood",
      pt: "Categorias para Cada Momento"
    },
    desc: {
      es: "Filtrá al instante entre las mejores Parrillas, Pizzerías históricas, Shows de Tango, Cafés notables, Museos y Heladerías de la ciudad.",
      en: "Filter in one tap between the best Steakhouses, classic Pizzerias, Tango Shows, Historic Cafes, Museums, and world-class Gelatos.",
      pt: "Filtre com um toque entre as melhores Churrascarias, Pizzarias históricas, Shows de Tango, Cafés notáveis, Museus e Sorveterias."
    }
  },
  {
    icon: "☔",
    badge: { es: "Paso 3 de 5", en: "Step 3 of 5", pt: "Passo 3 de 5" },
    title: {
      es: "Día de Lluvia y Zonas Seguras",
      en: "Rainy Days & Safe Zones",
      pt: "Dia de Chuva e Áreas Seguras"
    },
    desc: {
      es: "¿El clima no acompaña? Activá el botón 'Día de Lluvia' para ver planes 100% bajo techo. También contás con el mapa de zonas turísticas seguras.",
      en: "Rain outside? Tap 'Día de Lluvia' to highlight 100% covered indoor plans. You can also view safe, tourist-friendly walking areas.",
      pt: "Tempo chuvoso? Ative o botão 'Día de Lluvia' para planos 100% cobertos. Conte também com o mapa de áreas seguras recomendadas."
    }
  },
  {
    icon: "💵",
    badge: { es: "Paso 4 de 5", en: "Step 4 of 5", pt: "Passo 4 de 5" },
    title: {
      es: "Propina y Divisas en Argentina",
      en: "Tipping & Currency Converter",
      pt: "Gorjeta e Câmbio na Argentina"
    },
    desc: {
      es: "En Buenos Aires la propina habitual es del 10%. Tocá el botón 'Propina & Divisas' arriba para calcular el monto exacto y convertir a dólares o reales.",
      en: "Standard tipping in Buenos Aires is 10%. Tap 'Propina & Divisas' at the top to calculate the exact tip and convert your bill to USD or BRL.",
      pt: "Em Buenos Aires a gorjeta habitual é de 10%. Toque em 'Propina & Divisas' no topo para calcular o valor exato e converter para dólares ou reais."
    }
  },
  {
    icon: "👨‍🍳",
    badge: { es: "Paso 5 de 5", en: "Step 5 of 5", pt: "Passo 5 de 5" },
    title: {
      es: "Tips de Mozos y Pase VIP",
      en: "Waiter Tips & VIP Pass",
      pt: "Dicas de Garçons e Passe VIP"
    },
    desc: {
      es: "Tu mozo anfitrión te comparte secretos gastronómicos locales que no están en Google. Con el Pase VIP desbloqueás todos los tips y descuentos.",
      en: "Your host waiter shares local insider secrets not found on Google. Unlock the VIP Pass to access all tips and exclusive tango discounts.",
      pt: "Seu garçom anfitrião compartilha segredos locais que não estão no Google. Com o Passe VIP você desbloqueia todas as dicas e descontos exclusivos."
    }
  }
];

let currentTourStep = 0;

function openOnboardingTour() {
  currentTourStep = 0;
  renderTourStep();
  const modal = document.getElementById("onboarding-tour-modal");
  if (modal) modal.style.display = "flex";
}

function closeOnboardingTour(markCompleted = true) {
  const modal = document.getElementById("onboarding-tour-modal");
  if (modal) modal.style.display = "none";
  if (markCompleted) {
    try { localStorage.setItem("bsas_tour_completed", "true"); } catch(e) {}
  }
}

function renderTourStep() {
  const step = ONBOARDING_STEPS[currentTourStep];
  if (!step) return;
  const lang = state.currentLang || "es";

  const badgeEl = document.getElementById("tour-step-badge");
  if (badgeEl) badgeEl.textContent = step.badge[lang] || step.badge.es;

  const iconEl = document.getElementById("tour-step-icon");
  if (iconEl) iconEl.textContent = step.icon;

  const titleEl = document.getElementById("tour-step-title");
  if (titleEl) titleEl.textContent = step.title[lang] || step.title.es;

  const descEl = document.getElementById("tour-step-desc");
  if (descEl) descEl.textContent = step.desc[lang] || step.desc.es;

  // Actualizar dots
  const dots = document.querySelectorAll("#tour-dots-bar .tour-dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentTourStep);
  });

  // Botón Anterior
  const prevBtn = document.getElementById("btn-tour-prev");
  if (prevBtn) {
    prevBtn.style.display = currentTourStep === 0 ? "none" : "block";
    prevBtn.textContent = lang === "en" ? "← Back" : (lang === "pt" ? "← Voltar" : "← Anterior");
  }

  // Botón Siguiente / Finalizar
  const nextBtn = document.getElementById("btn-tour-next");
  if (nextBtn) {
    if (currentTourStep === ONBOARDING_STEPS.length - 1) {
      nextBtn.textContent = lang === "en" ? "🚀 Start Exploring!" : (lang === "pt" ? "🚀 Começar a Explorar!" : "🚀 ¡Empezar a Explorar!");
      nextBtn.style.background = "#10b981";
    } else {
      nextBtn.textContent = lang === "en" ? "Next →" : (lang === "pt" ? "Próximo →" : "Siguiente →");
      nextBtn.style.background = "#6366f1";
    }
  }
}

function nextTourStep() {
  if (currentTourStep < ONBOARDING_STEPS.length - 1) {
    currentTourStep++;
    renderTourStep();
  } else {
    closeOnboardingTour(true);
  }
}

function prevTourStep() {
  if (currentTourStep > 0) {
    currentTourStep--;
    renderTourStep();
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
    if (res.ok) {
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
        return;
      } else {
        alert(data.error || "PIN incorrecto. Pedile el PIN a tu mozo.");
        return;
      }
    }
  } catch (e) {
    // Si estamos en GitHub Pages o modo offline
  }

  // Fallback para GitHub Pages (PIN 1234)
  if (pin === "1234") {
    const fakePass = {
      passId: "pass_ghp_" + Date.now(),
      waiterId: state.waiterId || "isaias",
      touristName: name,
      daysLeft: 21
    };
    localStorage.setItem("bsas_pass_id", fakePass.passId);
    state.pass = fakePass;
    state.isVip = true;
    closeUnlockModal();
    updateVipUI();
    if (state.selectedPlace) {
      updateModalContent(state.selectedPlace);
    }
    alert(`🎉 ¡Excelente ${name}! Tu acceso VIP ha sido desbloqueado por 21 días.`);
  } else {
    alert("PIN incorrecto. Recordá que por defecto es 1234.");
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
  // TRABAJAR SOLO CON GITHUB: Cargar siempre data.js fresco sin caché
  try {
    const res = await fetch(`data.js?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });
    if (res.ok) {
      const text = await res.text();
      const fn = new Function("let window={}; " + text + "; return (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA);");
      const freshData = fn();
      if (freshData && freshData.places && freshData.places.length > 0) {
        if (freshData.categories && freshData.categories.length > 0) {
          APP_DATA.categories = freshData.categories;
        }
        if (freshData.waiters && freshData.waiters.length > 0) {
          APP_DATA.waiters = freshData.waiters;
        }
        state.places = freshData.places.map(p => ({
          id: p.id,
          category: p.category,
          name: p.name,
          address: p.address || "",
          neighborhood: p.neighborhood || "",
          lat: parseFloat(p.lat) || -34.6037,
          lng: parseFloat(p.lng) || -58.3816,
          price: p.price || "$$",
          tag: p.tag || "Recomendado",
          image: p.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
          menu_url: p.menu_url || "",
          is_indoor: p.is_indoor !== undefined ? (p.is_indoor === 1 || p.is_indoor === true ? 1 : 0) : 1,
          active: p.active !== undefined ? (p.active !== 0 && p.active !== false && p.active !== "0" ? 1 : 0) : 1,
          tips: p.tips ? p.tips : {
            es: p.tip_es || "",
            en: p.tip_en || p.tip_es || "",
            pt: p.tip_pt || p.tip_es || ""
          }
        }));
        try {
          localStorage.setItem("bsas_places", JSON.stringify(state.places));
        } catch(e) {}
        renderMarkers();
        renderTangoList();
        initContinuousCloudSync();
        return;
      }
    }
  } catch (err) {
    console.warn("Aviso cargando data.js de GitHub:", err);
  }

  // Fallback si no hay conexión
  const officialPlaces = (typeof APP_DATA !== "undefined" && APP_DATA.places) ? APP_DATA.places : [];
  state.places = officialPlaces.map(p => ({
    id: p.id,
    category: p.category,
    name: p.name,
    address: p.address || "",
    neighborhood: p.neighborhood || "",
    lat: parseFloat(p.lat) || -34.6037,
    lng: parseFloat(p.lng) || -58.3816,
    price: p.price || "$$",
    tag: p.tag || "Recomendado",
    image: p.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
    menu_url: p.menu_url || "",
    is_indoor: p.is_indoor !== undefined ? (p.is_indoor === 1 || p.is_indoor === true ? 1 : 0) : 1,
    active: p.active !== undefined ? (p.active !== 0 && p.active !== false && p.active !== "0" ? 1 : 0) : 1,
    tips: p.tips ? p.tips : {
      es: p.tip_es || "",
      en: p.tip_en || p.tip_es || "",
      pt: p.tip_pt || p.tip_es || ""
    }
  }));

  renderMarkers();
  renderTangoList();
  initContinuousCloudSync();
}

let isCloudSyncRunning = false;
let cloudSyncInterval = null;

function initContinuousCloudSync() {
  // 1. Chequeo inicial
  syncPlacesFromCloud(true);

  // 2. Chequeo continuo en segundo plano cada 8 segundos
  if (cloudSyncInterval) clearInterval(cloudSyncInterval);
  cloudSyncInterval = setInterval(() => {
    syncPlacesFromCloud(true);
  }, 8000);

  // 3. Chequeo instantáneo cuando el usuario vuelve a la app o desbloquea el celular
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncPlacesFromCloud(true);
    }
  });

  window.addEventListener("focus", () => {
    syncPlacesFromCloud(true);
  });

  // 4. Chequeo al cambiar de pestaña en la barra inferior
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      syncPlacesFromCloud(true);
    });
  });

  // 5. Soporte de gesto táctil pull-down en el encabezado
  initPullDownToRefresh();
}

async function syncPlacesFromCloud(isSilent = true) {
  if (isCloudSyncRunning) return;
  isCloudSyncRunning = true;

  try {
    const res = await fetch(`data.js?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });

    if (res.ok) {
      const text = await res.text();
      const fn = new Function("let window={}; " + text + "; return (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA);");
      const freshData = fn();

      if (freshData) {
        // Actualizar datos de mozos en vivo
        if (freshData.waiters && Array.isArray(freshData.waiters)) {
          APP_DATA.waiters = freshData.waiters;
          if (state.waiterId) {
            const foundWaiter = freshData.waiters.find(w => w.id === state.waiterId);
            if (foundWaiter && foundWaiter.name && foundWaiter.name !== state.waiterName) {
              state.waiterName = foundWaiter.name;
              const banner = document.getElementById("activation-waiter-banner");
              if (banner) banner.textContent = `👨‍🍳 ${state.waiterName}`;
              const waiterTag = document.getElementById("waiter-tag");
              if (waiterTag) {
                const i18n = APP_DATA.i18n[state.currentLang];
                waiterTag.textContent = `${i18n.recommendedBy}: ${state.waiterName}`;
              }
            }
          }
        }

        if (freshData.places && freshData.places.length > 0) {
          const formatted = freshData.places
            .map(p => ({
              id: p.id,
              category: p.category,
              name: p.name,
              address: p.address || "",
              neighborhood: p.neighborhood || "",
              lat: parseFloat(p.lat) || -34.6037,
              lng: parseFloat(p.lng) || -58.3816,
              price: p.price || "$$",
              tag: p.tag || "Recomendado",
              image: p.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
              menu_url: p.menu_url || "",
              is_indoor: p.is_indoor !== undefined ? (p.is_indoor === 1 || p.is_indoor === true ? 1 : 0) : 1,
              active: p.active !== undefined ? (p.active !== 0 && p.active !== false && p.active !== "0" ? 1 : 0) : 1,
              tips: p.tips ? p.tips : {
                es: p.tip_es || "",
                en: p.tip_en || p.tip_es || "",
                pt: p.tip_pt || p.tip_es || ""
              }
            }));

          // Comparación profunda de todos los campos para detectar cualquier cambio
          const currentSignature = JSON.stringify(state.places.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            cat: p.category,
            lat: p.lat,
            lng: p.lng,
            menu: p.menu_url,
            active: p.active,
            indoor: p.is_indoor,
            img: p.image,
            tip: p.tips?.es
          })));

          const freshSignature = JSON.stringify(formatted.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            cat: p.category,
            lat: p.lat,
            lng: p.lng,
            menu: p.menu_url,
            active: p.active,
            indoor: p.is_indoor,
            img: p.image,
            tip: p.tips?.es
          })));

          if (currentSignature !== freshSignature) {
            console.log("⚡ [Auto-Sync Nube] Cambios detectados del Admin. Actualizando interfaz en vivo:", formatted.length, "lugares.");
            state.places = formatted;
            try {
              localStorage.setItem("bsas_places", JSON.stringify(formatted));
            } catch(e) {}

            renderMarkers();
            renderTangoList();
            renderGuideList();
            renderEventsList();

            if (state.selectedPlace) {
              const updatedPlace = state.places.find(p => p.id === state.selectedPlace.id);
              if (updatedPlace) {
                state.selectedPlace = updatedPlace;
                updateModalContent(updatedPlace);
              }
            }

            if (!isSilent) {
              showSyncToast("✅ Datos actualizados con la nube");
            }
          }
        }
      }
    }
  } catch (err) {
    // Silencioso para navegación continua
  } finally {
    isCloudSyncRunning = false;
  }
}

function showSyncToast(text) {
  let toast = document.getElementById("sync-live-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sync-live-toast";
    toast.style.cssText = "position:fixed; top:65px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.92); color:#34d399; border:1px solid #10b981; padding:8px 16px; border-radius:999px; font-size:0.8rem; font-weight:700; z-index:9999; box-shadow:0 10px 25px rgba(0,0,0,0.5); pointer-events:none; transition:opacity 0.3s ease;";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = "1";
  setTimeout(() => {
    if (toast) toast.style.opacity = "0";
  }, 2200);
}

function initPullDownToRefresh() {
  const header = document.querySelector(".app-header");
  if (!header) return;

  let startY = 0;
  let currentY = 0;
  let isPulling = false;

  header.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });

  header.addEventListener("touchmove", (e) => {
    if (!isPulling || e.touches.length !== 1) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 50) {
      let pullIndicator = document.getElementById("mobile-pull-indicator");
      if (pullIndicator) {
        pullIndicator.style.display = "flex";
        pullIndicator.style.opacity = "1";
      }
    }
  }, { passive: true });

  header.addEventListener("touchend", () => {
    if (!isPulling) return;
    isPulling = false;
    const diff = currentY - startY;
    startY = 0;
    currentY = 0;

    const pullIndicator = document.getElementById("mobile-pull-indicator");
    if (diff > 50) {
      if (pullIndicator) {
        pullIndicator.innerHTML = "<span>🔄 Actualizando con la nube...</span>";
      }
      syncPlacesFromCloud(false).finally(() => {
        setTimeout(() => {
          if (pullIndicator) {
            pullIndicator.style.opacity = "0";
            setTimeout(() => {
              pullIndicator.style.display = "none";
              pullIndicator.innerHTML = "<span>⬇️ Soltá para recargar</span>";
            }, 300);
          }
        }, 500);
      });
    } else {
      if (pullIndicator) {
        pullIndicator.style.opacity = "0";
        setTimeout(() => { pullIndicator.style.display = "none"; }, 200);
      }
    }
  }, { passive: true });

  // Doble toque en el logo del header para recargar al instante
  header.addEventListener("dblclick", () => {
    showSyncToast("🔄 Buscando cambios en la nube...");
    syncPlacesFromCloud(false);
  });
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
  renderEventsList();
  if (state.selectedPlace) {
    updateModalContent(state.selectedPlace);
    loadPlaceReviews(state.selectedPlace.id);
  }
}

function updateUITranslations() {
  const t = APP_DATA.i18n[state.currentLang];
  if (!t) return;

  // Header & Nav
  const elTitle = document.getElementById("lbl-title");
  if (elTitle) elTitle.textContent = `📍 ${t.appTitle}`;
  const elSubtitle = document.getElementById("lbl-subtitle");
  if (elSubtitle) elSubtitle.textContent = t.subtitle;
  const navMap = document.getElementById("nav-map");
  if (navMap) navMap.textContent = t.tabMap;
  const navEvents = document.getElementById("nav-events");
  if (navEvents && t.tabEvents) navEvents.textContent = t.tabEvents;
  const navTango = document.getElementById("nav-tango");
  if (navTango) navTango.textContent = t.tabTango;
  const navGuide = document.getElementById("nav-guide");
  if (navGuide) navGuide.textContent = t.tabGuide;

  // Header buttons
  const btnCalc = document.getElementById("lbl-btn-calc");
  if (btnCalc && t.btnCalc) btnCalc.textContent = t.btnCalc;

  const btnTour = document.getElementById("lbl-btn-tour");
  if (btnTour) {
    btnTour.textContent = state.currentLang === "en" ? "First time?" : (state.currentLang === "pt" ? "Primeira vez?" : "¿Primera vez?");
  }
  if (document.getElementById("onboarding-tour-modal") && document.getElementById("onboarding-tour-modal").style.display === "flex") {
    renderTourStep();
  }

  const rainyLbl = document.getElementById("lbl-rainy-toggle");
  if (rainyLbl && t.rainyFilter) rainyLbl.textContent = t.rainyFilter;

  // Filters
  const fAll = document.getElementById("btn-filter-all");
  if (fAll) fAll.textContent = t.filterAll;
  const fFood = document.getElementById("btn-filter-food");
  if (fFood) fFood.textContent = t.filterFood;
  const fTango = document.getElementById("btn-filter-tango");
  if (fTango) fTango.textContent = t.filterTango;
  const fShop = document.getElementById("btn-filter-shopping");
  if (fShop) fShop.textContent = t.filterShopping;

  const searchInput = document.getElementById("map-search-input");
  if (searchInput && t.searchPlaceholder) {
    searchInput.placeholder = t.searchPlaceholder;
  }
  const safetyLbl = document.getElementById("lbl-safety-toggle");
  if (safetyLbl) {
    safetyLbl.textContent = state.safetyVisible ? (t.safetyBtnOn || "Zonas Seguras: ON") : (t.safetyBtnOff || "Zonas Seguras: OFF");
  }

  // Modal Place details
  const lblHow = document.getElementById("lbl-how-to-get");
  if (lblHow) lblHow.textContent = t.howToGetThere;
  const lblClose = document.getElementById("lbl-close");
  if (lblClose) lblClose.textContent = t.closeBtn;

  const lblRouteWalk = document.getElementById("lbl-route-walk");
  if (lblRouteWalk) lblRouteWalk.textContent = t.btnRouteWalk || "Trazar camino a pie en el mapa";
  const lblRouteDrive = document.getElementById("lbl-route-drive");
  if (lblRouteDrive) lblRouteDrive.textContent = t.btnRouteDrive || "Trazar camino en auto en el mapa";

  const uberText = t.btnUber || "Pedir con Uber";
  const didiText = t.btnDidi || "Pedir con DiDi";
  const lblUber = document.getElementById("lbl-uber");
  if (lblUber) lblUber.textContent = state.isVip ? uberText : `🔒 ${uberText} (VIP)`;
  const lblDidi = document.getElementById("lbl-didi");
  if (lblDidi) lblDidi.textContent = state.isVip ? didiText : `🔒 ${didiText} (VIP)`;
  const lblGmaps = document.getElementById("lbl-gmaps");
  if (lblGmaps) lblGmaps.textContent = t.btnGoogleMaps || "Abrir en Google Maps (Gratis)";
  const lblMenu = document.getElementById("lbl-digital-menu");
  if (lblMenu) lblMenu.textContent = t.viewMenu || "Ver Carta Digital / Menú Online";

  if (state.waiterName) {
    const waiterTag = document.getElementById("waiter-tag");
    if (waiterTag) waiterTag.textContent = `${t.recommendedBy}: ${state.waiterName}`;
  }

  // Reviews section
  const reviewsTitleEl = document.getElementById("lbl-reviews-title");
  if (reviewsTitleEl && t.reviewsTitle) reviewsTitleEl.textContent = t.reviewsTitle;
  const addReviewBtnEl = document.getElementById("lbl-btn-add-review");
  if (addReviewBtnEl && t.addReviewBtn) addReviewBtnEl.textContent = t.addReviewBtn;

  const formTitleEl = document.getElementById("lbl-form-title");
  if (formTitleEl && t.formReviewTitle) formTitleEl.textContent = t.formReviewTitle;
  const formRatingEl = document.getElementById("lbl-form-rating");
  if (formRatingEl && t.formRatingLabel) formRatingEl.textContent = t.formRatingLabel;
  const authorNameEl = document.getElementById("review-author-name");
  if (authorNameEl && t.formNamePlaceholder) authorNameEl.placeholder = t.formNamePlaceholder;
  const commentTextEl = document.getElementById("review-comment-text");
  if (commentTextEl && t.formCommentPlaceholder) commentTextEl.placeholder = t.formCommentPlaceholder;
  const photoPickerEl = document.getElementById("lbl-photo-picker");
  if (photoPickerEl && t.formPhotoPicker) photoPickerEl.textContent = t.formPhotoPicker;
  const submitReviewEl = document.getElementById("lbl-form-submit");
  if (submitReviewEl && t.formSubmitBtn) submitReviewEl.textContent = t.formSubmitBtn;
  const cancelReviewEl = document.getElementById("lbl-form-cancel");
  if (cancelReviewEl && t.formCancelBtn) cancelReviewEl.textContent = t.formCancelBtn;

  // Recomendación de lugares por turistas
  const lblRecToggle = document.getElementById("lbl-recommend-toggle");
  if (lblRecToggle && t.btnRecommendToggle) lblRecToggle.textContent = t.btnRecommendToggle;
  const lblRecModalTitle = document.getElementById("lbl-rec-modal-title");
  if (lblRecModalTitle && t.recModalTitle) lblRecModalTitle.textContent = t.recModalTitle;
  const lblRecModalSub = document.getElementById("lbl-rec-modal-sub");
  if (lblRecModalSub && t.recModalSub) lblRecModalSub.textContent = t.recModalSub;
  const lblRecName = document.getElementById("lbl-rec-name");
  if (lblRecName && t.recNameLabel) lblRecName.textContent = t.recNameLabel;
  const recNameInput = document.getElementById("rec-name");
  if (recNameInput && t.recNamePlaceholder) recNameInput.placeholder = t.recNamePlaceholder;
  const lblRecAddress = document.getElementById("lbl-rec-address");
  if (lblRecAddress && t.recAddressLabel) lblRecAddress.textContent = t.recAddressLabel;
  const recAddressInput = document.getElementById("rec-address");
  if (recAddressInput && t.recAddressPlaceholder) recAddressInput.placeholder = t.recAddressPlaceholder;
  const lblRecCat = document.getElementById("lbl-rec-cat");
  if (lblRecCat && t.recCatLabel) lblRecCat.textContent = t.recCatLabel;
  const lblRecAuthor = document.getElementById("lbl-rec-author");
  if (lblRecAuthor && t.recAuthorLabel) lblRecAuthor.textContent = t.recAuthorLabel;
  const recAuthorInput = document.getElementById("rec-user-name");
  if (recAuthorInput && t.recAuthorPlaceholder) recAuthorInput.placeholder = t.recAuthorPlaceholder;
  const lblRecTip = document.getElementById("lbl-rec-tip");
  if (lblRecTip && t.recTipLabel) lblRecTip.textContent = t.recTipLabel;
  const recTipInput = document.getElementById("rec-tip");
  if (recTipInput && t.recTipPlaceholder) recTipInput.placeholder = t.recTipPlaceholder;
  const lblRecPhoto = document.getElementById("lbl-rec-photo");
  if (lblRecPhoto && t.recPhotoLabel) lblRecPhoto.textContent = t.recPhotoLabel;
  const lblRecPhotoBtn = document.getElementById("lbl-rec-photo-btn");
  if (lblRecPhotoBtn && t.recPhotoBtn) lblRecPhotoBtn.textContent = t.recPhotoBtn;
  const lblRecLink = document.getElementById("lbl-rec-link");
  if (lblRecLink && t.recLinkLabel) lblRecLink.textContent = t.recLinkLabel;
  const lblRecSubmitBtn = document.getElementById("lbl-rec-submit-btn");
  if (lblRecSubmitBtn && t.recSubmitBtn) lblRecSubmitBtn.textContent = t.recSubmitBtn;
  const lblRecSuccessTitle = document.getElementById("lbl-rec-success-title");
  if (lblRecSuccessTitle && t.recSuccessTitle) lblRecSuccessTitle.textContent = t.recSuccessTitle;
  const lblRecSuccessText = document.getElementById("lbl-rec-success-text");
  if (lblRecSuccessText && t.recSuccessText) lblRecSuccessText.textContent = t.recSuccessText;
  const lblRecWaBtn = document.getElementById("lbl-rec-wa-btn");
  if (lblRecWaBtn && t.recWaBtn) lblRecWaBtn.textContent = t.recWaBtn;

  // Route floating panel
  const routeToEl = document.getElementById("route-to-label");
  if (routeToEl && t.routeToLabel) routeToEl.textContent = t.routeToLabel;

  // Tip Calculator Modal
  const calcTitle = document.getElementById("calc-modal-title");
  if (calcTitle && t.calcModalTitle) calcTitle.textContent = t.calcModalTitle;
  const calcBill = document.getElementById("lbl-calc-bill");
  if (calcBill && t.calcBillLabel) calcBill.textContent = t.calcBillLabel;
  const calcTipChoice = document.getElementById("lbl-calc-tip-choice");
  if (calcTipChoice && t.calcTipChoiceLabel) calcTipChoice.textContent = t.calcTipChoiceLabel;
  const tip10Sub = document.getElementById("lbl-tip-10-sub");
  if (tip10Sub && t.calcTip10Note) tip10Sub.textContent = t.calcTip10Note;
  const tip15Sub = document.getElementById("lbl-tip-15-sub");
  if (tip15Sub && t.calcTip15Note) tip15Sub.textContent = t.calcTip15Note;
  const tip0Sub = document.getElementById("lbl-tip-0-sub");
  if (tip0Sub && t.calcTip0Note) tip0Sub.textContent = t.calcTip0Note;
  const calcNote = document.getElementById("calc-cultural-note");
  if (calcNote && t.calcCulturalNote) calcNote.innerHTML = t.calcCulturalNote;
  const resSubtotal = document.getElementById("lbl-res-subtotal");
  if (resSubtotal && t.calcSubtotal) resSubtotal.textContent = t.calcSubtotal;
  const resTotal = document.getElementById("lbl-res-total");
  if (resTotal && t.calcTotal) resTotal.textContent = t.calcTotal;
  const fxApprox = document.getElementById("lbl-fx-approx");
  if (fxApprox && t.calcFxApprox) fxApprox.textContent = t.calcFxApprox;

  // VIP Unlock Modal
  const unlockTitle = document.getElementById("lbl-unlock-title");
  if (unlockTitle && t.unlockTitle) unlockTitle.textContent = t.unlockTitle;
  const unlockHosted = document.getElementById("lbl-unlock-hosted");
  if (unlockHosted && t.unlockHostedBy) unlockHosted.textContent = t.unlockHostedBy;
  const unlockQ = document.getElementById("lbl-unlock-question");
  if (unlockQ && t.unlockPinQuestion) unlockQ.textContent = t.unlockPinQuestion;
  const pinName = document.getElementById("input-pin-name");
  if (pinName && t.unlockNamePlaceholder) pinName.placeholder = t.unlockNamePlaceholder;
  const pinCode = document.getElementById("input-pin-code");
  if (pinCode && t.unlockPinPlaceholder) pinCode.placeholder = t.unlockPinPlaceholder;
  const btnPinSubmit = document.getElementById("btn-unlock-pin-submit");
  if (btnPinSubmit && t.unlockPinBtn) btnPinSubmit.textContent = t.unlockPinBtn;
  const btnMp = document.getElementById("btn-unlock-mp");
  if (btnMp && t.unlockMpBtn) btnMp.textContent = t.unlockMpBtn;
  const btnTest = document.getElementById("btn-unlock-test");
  if (btnTest && t.unlockTestBtn) btnTest.textContent = t.unlockTestBtn;
  const btnCloseUnlock = document.getElementById("btn-unlock-close");
  if (btnCloseUnlock && t.unlockCloseBtn) btnCloseUnlock.textContent = t.unlockCloseBtn;
}

// 5. Pestañas
function activateTab(tabId) {
  state.activeTab = tabId;
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));

  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === tabId));

  if (tabId === "tab-map" && state.map) {
    setTimeout(() => state.map.invalidateSize(), 150);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
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

  // Filtrar por categoría activa, búsqueda y filtro de día de lluvia
  const filteredPlaces = placesToRender.filter(place => {
    // Filtro Día de Lluvia: sólo lugares techados / bajo techo
    if (state.isRainyFilterActive) {
      const isIndoor = (place.is_indoor !== 0 && place.is_indoor !== false) || 
                       place.category === 'shopping' || 
                       place.category === 'cafes' || 
                       place.category === 'tango';
      if (!isIndoor) return false;
    }

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
      localStorage.setItem("bsas_categories", JSON.stringify(state.categories));
    } else {
      throw new Error("No backend");
    }
  } catch (e) {
    if (typeof APP_DATA !== "undefined" && APP_DATA.categories && APP_DATA.categories.length > 0) {
      state.categories = APP_DATA.categories;
    } else {
      const saved = localStorage.getItem("bsas_categories");
      if (saved) {
        try { state.categories = JSON.parse(saved); } catch(err) { state.categories = null; }
      }
      if (!state.categories || state.categories.length === 0) {
        state.categories = [
          { id: "food", name: "Parrillas & Carnes", icon: "🥩", color: "#ef4444" },
          { id: "pizzeria", name: "Pizzerías & Bodegones", icon: "🍕", color: "#f97316" },
          { id: "tango", name: "Tango & Shows", icon: "💃", color: "#a855f7" },
          { id: "cafes", name: "Cafés Notables & Desayunos", icon: "☕", color: "#d97706" },
          { id: "bars", name: "Bares & Coctelería", icon: "🍸", color: "#f59e0b" },
          { id: "shopping", name: "Shoppings & Paseos", icon: "🛍️", color: "#06b6d4" },
          { id: "culture", name: "Museos & Cultura", icon: "🏛️", color: "#3b82f6" },
          { id: "dessert", name: "Heladerías & Postres", icon: "🍦", color: "#ec4899" },
          { id: "other", name: "Otros Lugares", icon: "⭐", color: "#10b981" }
        ];
      }
    }
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

  // Acceso directo a Carta Digital / Menú Online
  const menuBtn = document.getElementById("btn-digital-menu");
  if (menuBtn) {
    if (place.menu_url && place.menu_url.trim()) {
      menuBtn.href = place.menu_url.trim();
      menuBtn.style.display = "flex";
      const t = APP_DATA.i18n[state.currentLang];
      const lblMenu = document.getElementById("lbl-digital-menu");
      if (lblMenu && t && t.viewMenu) {
        lblMenu.textContent = t.viewMenu;
      }
    } else {
      menuBtn.style.display = "none";
    }
  }

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

  const t = APP_DATA.i18n[state.currentLang] || APP_DATA.i18n.es;

  // Determinar texto del tip y si requiere link de traducción
  let tipText = "";
  let isOriginalSpanishOnly = false;
  if (place.tips && place.tips[state.currentLang]) {
    tipText = place.tips[state.currentLang];
  } else if (place.tips && place.tips.es) {
    tipText = place.tips.es;
    if (state.currentLang !== "es") isOriginalSpanishOnly = true;
  } else if (place.tip_es) {
    tipText = place.tip_es;
    if (state.currentLang !== "es") isOriginalSpanishOnly = true;
  }

  const tipWrapper = document.getElementById("sheet-tip-wrapper");
  const tipTitle = t.waiterTipTitle || "💡 Tip Local de Mozo:";
  const lockedTitle = t.waiterTipLocked || "💡 Tip Secreto del Mozo";
  const unlockBtnText = t.btnUnlockTip || "🔑 Ingresar PIN para desbloquear este tip";
  const translateLink = isOriginalSpanishOnly ? `
    <div style="margin-top:6px;">
      <a href="https://translate.google.com/?sl=es&tl=${state.currentLang}&text=${encodeURIComponent(tipText)}" target="_blank" style="font-size:0.75rem; color:#38bdf8; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
        ${t.translateTipGoogle || "🌐 Traducir con Google"} ↗
      </a>
    </div>
  ` : "";

  if (state.isVip) {
    // Modo VIP: Tip completo y visible
    tipWrapper.innerHTML = `
      <div class="tip-box">
        <strong>${tipTitle}</strong>
        <p style="margin:4px 0 0 0;">${tipText}</p>
        ${translateLink}
      </div>
    `;
  } else {
    // Modo Freemium: Tip borroso con candado
    tipWrapper.innerHTML = `
      <div class="tip-box locked-tip">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#f59e0b;">${lockedTitle}</strong>
          <span style="font-size:0.7rem; background:#f59e0b; color:#0f172a; font-weight:700; padding:2px 6px; border-radius:4px;">🔒 VIP</span>
        </div>
        <p class="blur-text">${tipText}</p>
        <button class="btn-unlock-inline" onclick="openUnlockModal()">
          ${unlockBtnText}
        </button>
      </div>
    `;
  }

  const uberText = t.btnUber || "Pedir con Uber";
  const didiText = t.btnDidi || "Pedir con DiDi";
  const gmapsText = t.btnGoogleMaps || "Abrir en Google Maps (Gratis)";
  const routeWalkText = t.btnRouteWalk || "Trazar camino a pie en el mapa";
  const routeDriveText = t.btnRouteDrive || "Trazar camino en auto en el mapa";

  const lblUber = document.getElementById("lbl-uber");
  const lblDidi = document.getElementById("lbl-didi");
  const lblGmaps = document.getElementById("lbl-gmaps");
  const lblRouteWalk = document.getElementById("lbl-route-walk");
  const lblRouteDrive = document.getElementById("lbl-route-drive");

  if (lblUber) lblUber.textContent = state.isVip ? uberText : `🔒 ${uberText} (VIP)`;
  if (lblDidi) lblDidi.textContent = state.isVip ? didiText : `🔒 ${didiText} (VIP)`;
  if (lblGmaps) lblGmaps.textContent = gmapsText;
  if (lblRouteWalk) lblRouteWalk.textContent = routeWalkText;
  if (lblRouteDrive) lblRouteDrive.textContent = routeDriveText;

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
  if (!container) return;
  const placesToRender = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;
  const tangos = placesToRender.filter(p => p.category === "tango" && (p.active !== 0 && p.active !== false && p.active !== "0"));
  const t = APP_DATA.i18n[state.currentLang];
  const waiterName = state.waiterName || capitalize(state.waiterId);

  const isEn = state.currentLang === "en";
  const isPt = state.currentLang === "pt";

  const headerHtml = `
    <div class="tango-header-box">
      <div style="font-size:1.15rem; font-weight:800; color:#fff; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
        <span>💃</span> ${isEn ? "Tango Shows & Buenos Aires Nightlife" : (isPt ? "Cenas Show de Tango & Noite Portenha" : "Cenas Show de Tango & Noche Porteña")}
      </div>
      <p style="font-size:0.82rem; color:#cbd5e1; line-height:1.45; margin:0;">
        ${isEn
          ? "Top traditional and modern musical tango dinner shows handpicked by local waitstaff. Direct WhatsApp reservations with VIP hotel transfers and discounts."
          : (isPt
            ? "Os melhores espetáculos de tango tradicional e moderno selecionados pelos garçons. Reserva direta via WhatsApp com traslados e descontos exclusivos."
            : "Los mejores espectáculos de tango tradicional y moderno seleccionados por los mozos. Reserva directa por WhatsApp con traslados y descuentos exclusivos.")}
      </p>
    </div>
  `;

  if (tangos.length === 0) {
    container.innerHTML = headerHtml + `
      <div style="text-align:center; padding:30px 16px; color:#94a3b8; font-size:0.9rem;">
        No hay shows de tango disponibles por el momento.
      </div>
    `;
    return;
  }

  const cardsHtml = tangos.map(item => {
    const tip = (item.tips && (item.tips[state.currentLang] || item.tips.es)) || "";
    const waMsg = `Hola! Me interesa reservar el show de Tango en ${item.name} (${item.neighborhood}). Vengo recomendado por ${waiterName}. ¿Tienen disponibilidad para hoy o mañana?`;
    const waUrl = `https://wa.me/${APP_DATA.config.agencyWhatsApp}?text=${encodeURIComponent(waMsg)}`;

    return `
      <article class="card-item">
        <div class="card-item-img-wrap">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${item.name}</h3>
            <span class="sheet-badge">${t.tangoBadge || 'Verificado'}</span>
          </div>
          <div class="sheet-meta">
            <span>📍 ${item.neighborhood}</span> • <span>${item.price}</span> • <span>${item.tag}</span>
          </div>
          <p class="card-desc">${tip}</p>
          <div class="tango-btn-row">
            ${state.isVip ? `
              <a href="${waUrl}" target="_blank" class="btn-whatsapp" onclick="trackClick('tango', '${item.id}')">
                <span>💬</span> <span>${t.bookTangoBtn}</span>
              </a>
            ` : `
              <button type="button" onclick="openUnlockModal()" class="btn-whatsapp" style="background:#f59e0b; color:#0f172a; font-weight:800; cursor:pointer;">
                <span>🔒</span> <span>${isEn ? 'Unlock VIP Discounts' : (isPt ? 'Desbloquear com PIN' : 'Desbloquear con PIN')}</span>
              </button>
            `}
            <button type="button" class="btn-tango-map" onclick="navigateToPlaceOnMap('${item.id}')" title="${isEn ? 'Show on Map' : (isPt ? 'Ver no mapa' : 'Ver en mapa')}">
              <span>📍</span> <span>${isEn ? 'Map' : (isPt ? 'Mapa' : 'Mapa')}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = headerHtml + `<div class="tango-cards-grid">${cardsHtml}</div>`;
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

  let backendOk = false;
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
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        backendOk = true;
      }
    }
  } catch (err) {
    // Modo GitHub Pages o sin backend
  }

  // Guardar en almacenamiento local siempre para asegurar visibilidad inmediata
  const localReview = {
    id: "rev_" + Date.now(),
    place_id: state.selectedPlace.id,
    place_name: state.selectedPlace.name,
    user_name: userName,
    user_country: userCountry,
    rating: state.newReviewRating || 5,
    comment,
    photo_data: state.newReviewPhotoBase64,
    waiter_id: state.waiterId || "isaias",
    created_at: Date.now()
  };
  const savedReviews = JSON.parse(localStorage.getItem("bsas_reviews") || "[]");
  savedReviews.unshift(localReview);
  localStorage.setItem("bsas_reviews", JSON.stringify(savedReviews));

  closeReviewForm();
  await loadPlaceReviews(state.selectedPlace.id);

  // Armar link de WhatsApp para enviar al Mozo / Admin
  const waiter = (typeof APP_DATA !== "undefined" && Array.isArray(APP_DATA.waiters))
    ? APP_DATA.waiters.find(w => w.id === state.waiterId)
    : null;
  const rawPhone = (waiter && waiter.phone) ? waiter.phone : "";
  let cleanPhone = rawPhone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
  if (cleanPhone.length === 10) cleanPhone = "549" + cleanPhone;

  const starsStr = "★".repeat(state.newReviewRating || 5);
  const waMsg = `👋 ¡Hola! Acabo de dejar una opinión en BsAs Local Guide sobre *${state.selectedPlace.name}*:\n\n⭐ Calificación: ${starsStr}\n👤 Turista: ${userName} (${userCountry})\n💬 Comentario: "${comment}"`;
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` 
    : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

  const promptMsg = cleanPhone
    ? `🎉 ¡Muchas gracias por compartir tu experiencia!\nTu opinión ya se puede ver en la app.\n\n¿Deseas enviarle tu reseña a tu mozo por WhatsApp para que la apruebe y destaque en la guía?`
    : `🎉 ¡Muchas gracias por compartir tu experiencia!\nTu opinión ya se puede ver en la app.\n\n¿Deseas compartir tu reseña por WhatsApp con el mozo o administrador?`;

  if (confirm(promptMsg)) {
    window.open(waUrl, "_blank");
  }
}

async function loadPlaceReviews(placeId) {
  const container = document.getElementById("reviews-list-container");
  const avgRatingEl = document.getElementById("reviews-avg-rating");
  if (!container) return;

  const t = APP_DATA.i18n[state.currentLang] || APP_DATA.i18n.es;
  container.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:10px 0;">...</div>`;

  let reviews = [];
  try {
    const res = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`);
    if (res.ok) {
      reviews = await res.json();
    } else {
      throw new Error("No backend");
    }
  } catch (err) {
    // 1. Cargar reseñas globales de data.js
    const globalReviews = (typeof APP_DATA !== "undefined" && Array.isArray(APP_DATA.reviews))
      ? APP_DATA.reviews.filter(r => r.place_id === placeId)
      : [];
    // 2. Cargar reseñas locales enviadas en este dispositivo
    const saved = JSON.parse(localStorage.getItem("bsas_reviews") || "[]");
    const localReviews = saved.filter(r => r.place_id === placeId);

    // Unir sin duplicados (dando prioridad a lo local más reciente)
    const map = new Map();
    localReviews.forEach(r => map.set(r.id, r));
    globalReviews.forEach(r => { if (!map.has(r.id)) map.set(r.id, r); });
    reviews = Array.from(map.values());
  }
  state.currentPlaceReviews = reviews;

  if (!reviews || reviews.length === 0) {
    container.innerHTML = `<div style="font-size:0.82rem; color:#94a3b8; text-align:center; padding:12px; background:rgba(255,255,255,0.02); border-radius:8px;">${t.noReviewsYet || "Aún no hay opiniones de este lugar. ¡Sé el primero en compartir la tuya!"}</div>`;
    if (avgRatingEl) avgRatingEl.textContent = t.beFirstReview || "Sé el primero en opinar";
    return;
  }

  // Calcular promedio
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avg = (sum / reviews.length).toFixed(1);
  const word = reviews.length === 1 ? (t.reviewWord || "opinión") : (t.reviewsWord || "opiniones");
  if (avgRatingEl) {
    avgRatingEl.textContent = `★ ${avg} / 5 (${reviews.length} ${word})`;
  }

  container.innerHTML = reviews.map(r => {
    const dateStr = new Date(r.created_at || Date.now()).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const stars = "★".repeat(r.rating || 5) + "☆".repeat(Math.max(0, 5 - (r.rating || 5)));
    return `
      <div class="review-item-card">
        <div class="review-item-header">
          <div class="review-author">
            <span>👤 ${r.user_name}</span>
            <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${r.user_country || 'Turista'})</span>
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
}

// 12. Navegación y Trazado de Rutas en el Mapa (OSRM)
function clearCurrentRouteLayersOnly() {
  if (state.currentRouteLayer && state.map) {
    state.map.removeLayer(state.currentRouteLayer);
    state.currentRouteLayer = null;
  }
  if (state.routeGlowLayer && state.map) {
    state.map.removeLayer(state.routeGlowLayer);
    state.routeGlowLayer = null;
  }
}

function clearCurrentRoute() {
  clearCurrentRouteLayersOnly();
  state.currentRouteTarget = null;
  const panel = document.getElementById("route-panel");
  if (panel) panel.style.display = "none";
}

function switchRouteMode(mode) {
  state.currentRouteMode = mode;
  const btnWalk = document.getElementById("btn-toggle-walk");
  const btnDrive = document.getElementById("btn-toggle-drive");
  if (btnWalk) btnWalk.classList.toggle("active", mode === "walking");
  if (btnDrive) btnDrive.classList.toggle("active", mode === "driving");

  if (state.currentRouteTarget) {
    startRoutingFlow(state.currentRouteTarget, mode);
  }
}

async function drawRouteToSelectedPlace(mode = "walking") {
  if (!state.selectedPlace) return;
  const place = state.selectedPlace;

  // Cerrar modal de detalles y pasar al mapa
  const modal = document.getElementById("place-modal");
  if (modal) modal.classList.remove("active");
  activateTab("tab-map");

  state.currentRouteTarget = place;
  state.currentRouteMode = mode;

  await startRoutingFlow(place, mode);
}

async function startRoutingFlow(place, mode) {
  let start = state.userCoords;
  let isSimulated = false;

  if (!start) {
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500, enableHighAccuracy: true });
        });
        start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.userCoords = start;
        if (!state.userLocationMarker && state.map) {
          const userIcon = L.divIcon({
            className: "user-gps-pin",
            html: `<div style="background:#3b82f6; width:20px; height:20px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 0 0 8px rgba(59,130,246,0.4);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          state.userLocationMarker = L.marker([start.lat, start.lng], { icon: userIcon }).addTo(state.map);
        }
      } catch (e) {
        // Denegado o timeout
      }
    }
  }

  if (!start || getDistanceFromLatLonInKm(start.lat, start.lng, -34.6037, -58.3816) > 80) {
    // Si no tiene GPS o está en otra ciudad, usamos el Obelisco como punto neurálgico
    start = { lat: -34.6037, lng: -58.3816 };
    isSimulated = true;
  }

  const dest = { lat: place.lat, lng: place.lng };
  await calculateAndDrawRoute(start, dest, place, mode, isSimulated);
}

async function calculateAndDrawRoute(start, dest, place, mode, isSimulated) {
  clearCurrentRouteLayersOnly();

  const panel = document.getElementById("route-panel");
  const destTitle = document.getElementById("route-dest-title");
  const modeIcon = document.getElementById("route-mode-icon");
  const summaryStats = document.getElementById("route-summary-stats");
  const btnWalk = document.getElementById("btn-toggle-walk");
  const btnDrive = document.getElementById("btn-toggle-drive");

  if (panel) panel.style.display = "block";
  if (destTitle) destTitle.textContent = place.name;
  if (modeIcon) modeIcon.textContent = mode === "walking" ? "🚶‍♂️" : "🚗";
  if (btnWalk) btnWalk.classList.toggle("active", mode === "walking");
  if (btnDrive) btnDrive.classList.toggle("active", mode === "driving");
  const t = APP_DATA.i18n[state.currentLang] || APP_DATA.i18n.es;
  if (summaryStats) summaryStats.textContent = t.routeCalculating || "Calculando la mejor ruta por calles...";

  let routeCoords = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  let usedFallback = false;

  const osrmProfile = mode === "walking" ? "walking" : "driving";
  const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start.lng},${start.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.routes && data.routes.length > 0) {
        const r = data.routes[0];
        routeCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
        distanceMeters = r.distance;
        durationSeconds = r.duration;
      }
    }
  } catch (err) {
    usedFallback = true;
  }

  if (!routeCoords || routeCoords.length === 0) {
    usedFallback = true;
    routeCoords = [
      [start.lat, start.lng],
      [dest.lat, dest.lng]
    ];
    const dKm = getDistanceFromLatLonInKm(start.lat, start.lng, dest.lat, dest.lng);
    distanceMeters = Math.round(dKm * 1000);
    const speedKmh = mode === "walking" ? 5 : 25;
    durationSeconds = Math.round((dKm / speedKmh) * 3600);
  }

  const glowColor = mode === "walking" ? "#38bdf8" : "#60a5fa";
  const lineColor = mode === "walking" ? "#0284c7" : "#2563eb";

  state.routeGlowLayer = L.polyline(routeCoords, {
    color: glowColor,
    weight: 9,
    opacity: 0.4,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(state.map);

  state.currentRouteLayer = L.polyline(routeCoords, {
    color: lineColor,
    weight: 5,
    opacity: 0.95,
    dashArray: mode === "walking" ? "8, 10" : null,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(state.map);

  state.map.fitBounds(state.currentRouteLayer.getBounds(), {
    padding: [70, 70],
    maxZoom: 16
  });

  let distStr = "";
  if (distanceMeters < 1000) {
    distStr = `${Math.round(distanceMeters)} m`;
  } else {
    distStr = `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  const mins = Math.max(1, Math.round(durationSeconds / 60));
  let timeStr = "";
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const restMins = mins % 60;
    timeStr = `~${hours} h ${restMins} min`;
  } else {
    timeStr = `~${mins} min`;
  }

  const originNote = isSimulated ? ` ${t.routeFromObelisco || '(desde Obelisco)'}` : (state.userCoords ? ` ${t.routeFromGps || ''}` : "");
  if (summaryStats) {
    summaryStats.textContent = `📍 ${distStr} • ⏱️ ${timeStr}${originNote}`;
  }
}

// 13. Filtro de Día de Lluvia (Bajo Techo)
function toggleRainyFilter() {
  state.isRainyFilterActive = !state.isRainyFilterActive;
  const btn = document.getElementById("btn-toggle-rainy");
  if (btn) {
    btn.classList.toggle("active", state.isRainyFilterActive);
  }
  renderMarkers();
}

// 14. Calculadora de Propina y Conversión de Monedas
function openTipCalculator() {
  const modal = document.getElementById("tip-calc-modal");
  if (modal) modal.classList.add("active");
  updateTipCalculation();
  fetchExchangeRates();
}

function closeTipCalculator() {
  const modal = document.getElementById("tip-calc-modal");
  if (modal) modal.classList.remove("active");
}

function setTipPercent(percent) {
  state.selectedTipPercent = percent;
  document.querySelectorAll(".tip-percent-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.tip, 10) === percent);
  });
  updateTipCalculation();
}

function updateTipCalculation() {
  const billInput = document.getElementById("calc-bill-amount");
  const subtotal = Math.max(0, parseFloat(billInput ? billInput.value : 0) || 0);
  const percent = state.selectedTipPercent ?? 10;
  const tipAmount = Math.round((subtotal * percent) / 100);
  const totalAmount = subtotal + tipAmount;

  const resSubtotal = document.getElementById("calc-res-subtotal");
  const resTip = document.getElementById("calc-res-tip");
  const resTipLbl = document.getElementById("calc-res-tip-lbl");
  const resTotal = document.getElementById("calc-res-total");

  const t = APP_DATA.i18n[state.currentLang] || APP_DATA.i18n.es;
  const tipLabel = t && t.calcTipLabel ? t.calcTipLabel : "Propina";
  if (resSubtotal) resSubtotal.textContent = `$${subtotal.toLocaleString("es-AR")} ARS`;
  if (resTipLbl) resTipLbl.textContent = `${tipLabel} (${percent}%):`;
  if (resTip) resTip.textContent = `+$${tipAmount.toLocaleString("es-AR")} ARS`;
  if (resTotal) resTotal.textContent = `$${totalAmount.toLocaleString("es-AR")} ARS`;

  const rates = state.exchangeRates || { USD: 1180, EUR: 1280, BRL: 215 };
  const usdVal = totalAmount > 0 ? (totalAmount / rates.USD).toFixed(2) : "0.00";
  const eurVal = totalAmount > 0 ? (totalAmount / rates.EUR).toFixed(2) : "0.00";
  const brlVal = totalAmount > 0 ? (totalAmount / rates.BRL).toFixed(2) : "0.00";

  const fxUsd = document.getElementById("calc-fx-usd");
  const fxEur = document.getElementById("calc-fx-eur");
  const fxBrl = document.getElementById("calc-fx-brl");

  if (fxUsd) fxUsd.textContent = `$${usdVal}`;
  if (fxEur) fxEur.textContent = `€${eurVal}`;
  if (fxBrl) fxBrl.textContent = `R$ ${brlVal}`;
}

async function fetchExchangeRates() {
  if (state.exchangeRates && state.exchangeRates.updated) return;
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue");
    if (res.ok) {
      const data = await res.json();
      if (data && data.venta) {
        state.exchangeRates.USD = data.venta;
        state.exchangeRates.EUR = Math.round(data.venta * 1.08);
        state.exchangeRates.BRL = Math.round(data.venta / 5.4);
        state.exchangeRates.updated = true;
        const note = document.getElementById("calc-fx-updated");
        if (note) note.textContent = `Dólar Blue ~$${data.venta} ARS`;
        updateTipCalculation();
      }
    }
  } catch (e) {
    // Si no hay conexión o falla la API, se usan los valores preestablecidos
  }
}

// 15. Renderizado de la Sección de Eventos & Agendas Oficiales
function renderEventsList() {
  const container = document.getElementById("events-list-container");
  if (!container) return;

  const isEn = state.currentLang === "en";
  const isPt = state.currentLang === "pt";

  container.innerHTML = `
    <!-- Banner de Cabecera -->
    <div class="events-header-box">
      <div style="font-size:1.15rem; font-weight:800; color:#fff; margin-bottom:4px;">
        📅 ${isEn ? "What's Happening in Buenos Aires" : (isPt ? "O que Fazer em Buenos Aires" : "¿Qué hacer en Buenos Aires hoy?")}
      </div>
      <p style="font-size:0.82rem; color:#94a3b8; line-height:1.4; margin:0;">
        ${isEn 
          ? "Direct live access to the official cultural agendas of the City government plus the top weekly fairs and street markets." 
          : (isPt 
            ? "Acesso direto e atualizado às agendas culturais oficiais do governo e aos melhores eventos semanais da cidade." 
            : "Consultá en vivo las agendas oficiales del Gobierno de la Ciudad y las mejores ferias semanales recomendadas por los mozos.")
        }
      </p>
    </div>

    <!-- Sección 1: Portales Oficiales en Vivo -->
    <div class="events-section-title">
      <span>🏛️</span> ${isEn ? "Official Live City Agendas" : (isPt ? "Agendas Oficiais ao Vivo" : "Agendas Oficiales en Vivo (Ciudad)")}
    </div>

    <div class="official-links-grid">
      <!-- Disfrutemos BA -->
      <div class="official-link-card">
        <div>
          <div style="font-size:1.05rem; margin-bottom:6px; color:#fff;">🎭 <strong>Disfrutemos BA</strong></div>
          <p style="font-size:0.78rem; color:#cbd5e1; line-height:1.4; margin:0;">
            ${isEn 
              ? "Official Buenos Aires government cultural agenda. Free outdoor concerts, museum tours, street food festivals, and family events." 
              : (isPt 
                ? "A agenda cultural oficial mais completa do governo. Festivais ao ar livre, cinema, teatro, museus e atrações gratuitas." 
                : "La cartelera cultural oficial más completa del Gobierno de la Ciudad: festivales, cine al aire libre, muestras de arte y recitales gratuitos.")
            }
          </p>
        </div>
        <a href="https://disfrutemosba.buenosaires.gob.ar/" target="_blank" class="btn-event-link">
          🔗 ${isEn ? "Open Disfrutemos BA" : (isPt ? "Abrir Disfrutemos BA" : "Abrir Agenda Disfrutemos BA")}
        </a>
      </div>

      <!-- Turismo BA -->
      <div class="official-link-card">
        <div>
          <div style="font-size:1.05rem; margin-bottom:6px; color:#fff;">🌆 <strong>Turismo BA Planner</strong></div>
          <p style="font-size:0.78rem; color:#cbd5e1; line-height:1.4; margin:0;">
            ${isEn 
              ? "Official Buenos Aires City interactive trip planner. Customize your daily itinerary, discover landmarks, and schedule activities." 
              : (isPt 
                ? "Planejador oficial interativo de viagens da cidade. Monte seu roteiro personalizado, descubra atrações e planeje seus dias." 
                : "Planificador interactivo oficial de la Ciudad. Armá tu itinerario día por día, descubrí paseos y organizá tus actividades.")
            }
          </p>
        </div>
        <a href="https://turismo.buenosaires.gob.ar/es/basic-page/planner" target="_blank" class="btn-event-link">
          🔗 ${isEn ? "Open BA Trip Planner" : (isPt ? "Abrir Planejador Turismo BA" : "Abrir Planificador Turismo BA")}
        </a>
      </div>

      <!-- Teatro Calle Corrientes -->
      <div class="official-link-card">
        <div>
          <div style="font-size:1.05rem; margin-bottom:6px; color:#fff;">🎬 <strong>Cartelera Calle Corrientes</strong></div>
          <p style="font-size:0.78rem; color:#cbd5e1; line-height:1.4; margin:0;">
            ${isEn 
              ? "Buenos Aires is a world capital of theater. Check tonight's Broadway-style musicals, comedies, and drama plays on Corrientes St." 
              : (isPt 
                ? "Buenos Aires é a capital do teatro da América Latina. Veja as peças, musicais e comédias em cartaz na famosa Calle Corrientes." 
                : "Buenos Aires es una de las capitales mundiales del teatro. Obras, comedias y shows musicales en cartelera sobre Av. Corrientes.")
            }
          </p>
        </div>
        <a href="https://www.plateanet.com/" target="_blank" class="btn-event-link">
          🔗 ${isEn ? "View Theater Plays" : (isPt ? "Ver Cartaz de Teatros" : "Ver Cartelera de Teatro")}
        </a>
      </div>
    </div>

    <!-- Sección 2: Los Grandes Eventos Fijos Semanales -->
    <div class="events-section-title">
      <span>🌟</span> ${isEn ? "Iconic Weekly Events & Markets" : (isPt ? "Feiras e Eventos Semanais Clássicos" : "Eventos Semanales Imperdibles")}
    </div>

    <!-- Feria San Telmo -->
    <div class="event-weekly-card">
      <img src="https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600&auto=format&fit=crop&q=80" alt="Feria San Telmo" class="event-weekly-img">
      <div class="event-weekly-body">
        <span class="event-day-badge">📅 ${isEn ? "Every Sunday (10 AM - 6 PM)" : (isPt ? "Todo Domingo (10h às 18h)" : "Todos los Domingos (10:00 a 18:00 hs)")}</span>
        <h3 style="font-size:1.05rem; font-weight:700; color:#fff; margin:2px 0 4px 0;">Feria de San Telmo (Calle Defensa)</h3>
        <p style="font-size:0.8rem; color:#cbd5e1; margin:0 0 6px 0; line-height:1.4;">
          ${isEn 
            ? "12 pedestrian cobblestone blocks full of vintage antiques, buskers, street tango dancers, leather goods, and local treats." 
            : (isPt 
              ? "12 quadras históricas de paralelepípedos com antiguidades, artistas de rua, dançarinos de tango e muito artesanato." 
              : "12 cuadras peatonales repletas de antigüedades, artistas callejeros, parejas bailando tango al aire libre y recuerdos.")
          }
        </p>
        <button type="button" class="btn-event-map" onclick="navigateToPlaceOnMap('f1')">
          📍 ${isEn ? "Show on Map & Get Directions" : (isPt ? "Ver no Mapa e Traçar Rota" : "Ver en el Mapa y Trazar Ruta")}
        </button>
      </div>
    </div>

    <!-- Feria de Mataderos -->
    <div class="event-weekly-card">
      <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80" alt="Feria Mataderos" class="event-weekly-img">
      <div class="event-weekly-body">
        <span class="event-day-badge">📅 ${isEn ? "Sundays & Holidays (11 AM - 7 PM)" : (isPt ? "Domingos e Feriados (11h às 19h)" : "Domingos y Feriados (11:00 a 19:00 hs)")}</span>
        <h3 style="font-size:1.05rem; font-weight:700; color:#fff; margin:2px 0 4px 0;">Feria de las Tradiciones Criollas (Mataderos)</h3>
        <p style="font-size:0.8rem; color:#cbd5e1; margin:0 0 6px 0; line-height:1.4;">
          ${isEn 
            ? "Authentic Argentine gaucho culture: open-pit barbecue (asado al asador), horseback ring races, folklore music, and country crafts." 
            : (isPt 
              ? "Cultura gaúcha tradicional: churrasco no fogo de chão, danças folclóricas, pastel de carne e artesanato criollo autêntico." 
              : "Tradición gauchesca pura: asado a la cruz, destrezas ecuestres, empanadas criollas, peñas folclóricas y artesanías de campo.")
          }
        </p>
        <button type="button" class="btn-event-map" onclick="navigateToPlaceOnMap('f2')">
          📍 ${isEn ? "Show on Map & Get Directions" : (isPt ? "Ver no Mapa e Traçar Rota" : "Ver en el Mapa y Trazar Ruta")}
        </button>
      </div>
    </div>

    <!-- Feria de Plaza Francia y Recoleta -->
    <div class="event-weekly-card">
      <img src="https://images.unsplash.com/photo-1589802829985-817e51171b92?w=600&auto=format&fit=crop&q=80" alt="Recoleta" class="event-weekly-img">
      <div class="event-weekly-body">
        <span class="event-day-badge">📅 ${isEn ? "Saturdays, Sundays & Holidays (11 AM - 8 PM)" : (isPt ? "Sábados, Domingos e Feriados (11h às 20h)" : "Sábados, Domingos y Feriados (11:00 a 20:00 hs)")}</span>
        <h3 style="font-size:1.05rem; font-weight:700; color:#fff; margin:2px 0 4px 0;">Feria de Artesanos de Plaza Francia (Recoleta)</h3>
        <p style="font-size:0.8rem; color:#cbd5e1; margin:0 0 6px 0; line-height:1.4;">
          ${isEn 
            ? "Right next to the famous Recoleta Cemetery. Top-tier silver jewelry, leather mates, acoustic musicians, and European-style gardens." 
            : (isPt 
              ? "Ao lado do famoso Cemitério da Recoleta. Feira de prataria, couro, cuia de mate e música ao vivo em belos jardins franceses." 
              : "Junto al Cementerio de Recoleta. Orfebrería en plata, cuero, mates artesanales, músicos en vivo y cafés al aire libre.")
          }
        </p>
        <button type="button" class="btn-event-map" onclick="navigateToPlaceOnMap('s4')">
          📍 ${isEn ? "Show on Map & Get Directions" : (isPt ? "Ver no Mapa e Traçar Rota" : "Ver en el Mapa y Trazar Ruta")}
        </button>
      </div>
    </div>

    <!-- Noche de los Museos Especial -->
    <div class="event-weekly-card" style="border-color:rgba(168,85,247,0.3); background:rgba(30,27,75,0.4);">
      <div class="event-weekly-body">
        <span class="event-day-badge" style="background:rgba(168,85,247,0.2); color:#c084fc;">🏛️ ${isEn ? "Annual Mega Cultural Nights" : (isPt ? "Mega Noites Culturais Anuais" : "Mega Noches Temáticas Anuales")}</span>
        <h3 style="font-size:1.05rem; font-weight:700; color:#fff; margin:2px 0 4px 0;">La Noche de los Museos & La Noche de las Librerías</h3>
        <p style="font-size:0.8rem; color:#cbd5e1; margin:0 0 8px 0; line-height:1.4;">
          ${isEn 
            ? "Once a year, over 250 museums open for free until 2 AM with complimentary public transport. Similar nights exist for Pizzerias, Bookstores, and Tourism." 
            : (isPt 
              ? "Mais de 250 museus abertos de graça até as 2h da madrugada com ônibus e metrô gratuitos. Também há noites da pizza e livrarias." 
              : "Más de 250 museos y centros culturales abren gratis hasta las 2:00 AM con transporte público gratuito. Además se realizan La Noche de las Pizzerías y de las Librerías.")
          }
        </p>
        <a href="https://turismo.buenosaires.gob.ar/es/article/la-noche-de-los-museos" target="_blank" class="btn-event-link" style="background:linear-gradient(135deg, #7c3aed, #6d28d9); margin-top:4px;">
          🔗 ${isEn ? "Official Museum Night Info" : (isPt ? "Informações Noite dos Museus" : "Ver Fechas Oficiales Noche de los Museos")}
        </a>
      </div>
    </div>
  `;
}

function navigateToPlaceOnMap(placeId) {
  activateTab("tab-map");
  const places = (state.places && state.places.length > 0) ? state.places : APP_DATA.places;
  const target = places.find(p => p.id === placeId);
  if (target) {
    if (state.map) {
      state.map.flyTo([target.lat, target.lng], 16, { duration: 1.2 });
    }
    setTimeout(() => {
      openPlaceModal(target);
    }, 700);
  }
}

// ==================== RECOMENDACIONES DE LUGARES POR TURISTAS ====================
let currentRecPhotoData = null;

function openRecommendModal() {
  const modal = document.getElementById("recommend-modal");
  if (!modal) return;
  document.getElementById("recommend-form").reset();
  currentRecPhotoData = null;
  const preview = document.getElementById("rec-photo-preview");
  if (preview) preview.style.display = "none";
  const photoName = document.getElementById("rec-photo-name");
  if (photoName) photoName.textContent = "";
  const successBox = document.getElementById("rec-success-box");
  if (successBox) successBox.style.display = "none";
  const submitBtn = document.getElementById("btn-submit-rec");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    const t = APP_DATA.i18n[state.currentLang] || APP_DATA.i18n.es;
    submitBtn.textContent = t.recSubmitBtn || "🚀 Enviar Recomendación";
  }
  modal.style.display = "flex";
}

function closeRecommendModal() {
  const modal = document.getElementById("recommend-modal");
  if (modal) modal.style.display = "none";
}

function handleRecPhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const photoName = document.getElementById("rec-photo-name");
  if (photoName) photoName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    currentRecPhotoData = e.target.result;
    const preview = document.getElementById("rec-photo-preview");
    const img = document.getElementById("rec-photo-preview-img");
    if (preview && img) {
      img.src = currentRecPhotoData;
      preview.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
}

async function submitPlaceRecommendation(event) {
  event.preventDefault();

  const name = document.getElementById("rec-name").value.trim();
  const address = document.getElementById("rec-address").value.trim();
  const category = document.getElementById("rec-category").value;
  const userCountry = document.getElementById("rec-user-country").value;
  const userName = document.getElementById("rec-user-name").value.trim() || "Turista Amigo";
  const tip = document.getElementById("rec-tip").value.trim();
  const linkUrl = document.getElementById("rec-link").value.trim();
  const photoData = currentRecPhotoData;
  const waiterId = state.waiterId || "isaias";

  const payload = {
    name,
    address,
    neighborhood: address.split(",")[1] ? address.split(",")[1].trim() : address,
    category,
    tip,
    userName,
    userCountry,
    photoData,
    linkUrl,
    waiterId
  };

  const submitBtn = document.getElementById("btn-submit-rec");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";
    submitBtn.textContent = "⏳ Enviando...";
  }

  let sentToServer = false;
  try {
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      sentToServer = true;
    }
  } catch (err) {}

  // En modo estático o GitHub Pages, guardar también en localStorage para que el admin lo lea
  try {
    const saved = JSON.parse(localStorage.getItem("bsas_suggestions") || "[]");
    saved.unshift({
      id: "sug_" + Date.now().toString(36),
      ...payload,
      status: "pending",
      created_at: Date.now()
    });
    localStorage.setItem("bsas_suggestions", JSON.stringify(saved));
  } catch (e) {}

  // Generar link directo de WhatsApp para avisar al mozo o administrador
  const catNames = {
    food: "Parrilla / Restaurante",
    bars: "Bar / Coctelería",
    cafes: "Café / Merienda",
    tango: "Tango & Show",
    shopping: "Compras / Paseo",
    culture: "Museo / Cultura"
  };
  const catLabel = catNames[category] || category;
  const waMsg = `¡Hola! Recomiendo este lugar para sumar al mapa de BsAs Local Guide:\n\n📍 Lugar: ${name}\n🗺️ Dirección: ${address}\n🏷️ Tipo: ${catLabel}\n💡 Por qué lo recomiendo: ${tip}\n${linkUrl ? '🔗 Link: ' + linkUrl + '\n' : ''}👤 Enviado por: ${userName} (${userCountry})`;
  const agencyPhone = (typeof APP_DATA !== "undefined" && APP_DATA.config && APP_DATA.config.agencyWhatsApp) ? APP_DATA.config.agencyWhatsApp : "5491122334455";
  const waUrl = `https://wa.me/${agencyPhone}?text=${encodeURIComponent(waMsg)}`;

  const waLink = document.getElementById("rec-wa-link");
  if (waLink) waLink.href = waUrl;

  const successBox = document.getElementById("rec-success-box");
  if (successBox) successBox.style.display = "block";
  if (submitBtn) {
    submitBtn.textContent = "✅ ¡Recomendación Registrada!";
  }
}
