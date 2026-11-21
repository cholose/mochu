// server.js - Servidor ultraliviano con Node.js nativo + SQLite (Node 22/24)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const SERVICE_FEE_USD = 3.00; // Costo del Servicio del Mozo
const WAITER_CUT_USD = 1.50;   // Comisión que se le transfiere al mozo
const USD_TO_ARS = 1200;       // Cotización de referencia

// Inicializar SQLite
const dbPath = path.join(__dirname, "database.sqlite");
const db = new DatabaseSync(dbPath);

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    neighborhood TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    price TEXT NOT NULL,
    tag TEXT NOT NULL,
    image TEXT NOT NULL,
    tip_es TEXT NOT NULL,
    tip_en TEXT NOT NULL,
    tip_pt TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT DEFAULT '#10b981',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waiters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    alias TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    commission_usd REAL DEFAULT 1.50,
    total_sales INTEGER DEFAULT 0,
    pending_payout_usd REAL DEFAULT 0,
    total_paid_usd REAL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  try { db.exec("ALTER TABLE waiters ADD COLUMN phone TEXT DEFAULT ''"); } catch(e) {}

  CREATE TABLE IF NOT EXISTS passes (
    id TEXT PRIMARY KEY,
    device_token TEXT NOT NULL,
    tourist_name TEXT NOT NULL,
    tourist_contact TEXT,
    waiter_id TEXT NOT NULL,
    amount_paid_usd REAL DEFAULT 3.00,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waiter_id TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    amount_ars REAL NOT NULL,
    alias TEXT NOT NULL,
    paid_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT,
    action_type TEXT NOT NULL,
    waiter_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_country TEXT DEFAULT 'Turista',
    rating INTEGER DEFAULT 5,
    comment TEXT NOT NULL,
    photo_data TEXT,
    waiter_id TEXT,
    created_at INTEGER NOT NULL,
    approved INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    neighborhood TEXT,
    category TEXT,
    tip TEXT,
    user_name TEXT,
    user_country TEXT DEFAULT 'Turista',
    photo_data TEXT,
    link_url TEXT,
    waiter_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
`);

// Pre-cargar mozo por defecto 'isaias' si no existe
const checkWaiter = db.prepare("SELECT id FROM waiters WHERE id = ?").get("isaias");
if (!checkWaiter) {
  db.prepare(`
    INSERT INTO waiters (id, name, alias, commission_usd, total_sales, pending_payout_usd, total_paid_usd, created_at)
    VALUES ('isaias', 'Isaias', 'isaias.mozo.mp', 1.50, 0, 0, 0, ?)
  `).run(Date.now());
  console.log("Mozo 'isaias' creado con Alias: isaias.mozo.mp");
}

// Pre-cargar link de Mercado Pago si no existe
const checkMp = db.prepare("SELECT value FROM settings WHERE key = ?").get("mp_link");
if (!checkMp) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("mp_link", "https://link.mercadopago.com.ar");
}

// Pre-cargar opiniones y fotos de prueba si no existen
const checkReviews = db.prepare("SELECT COUNT(*) as count FROM reviews").get();
if (checkReviews.count === 0) {
  const seedReviews = [
    {
      id: "rev_seed_1",
      place_id: "p1",
      user_name: "Sarah & David",
      user_country: "🇺🇸 USA",
      rating: 5,
      comment: "Incredible bife de chorizo! Waiter Isaias recommended arriving early at 11:30 AM and we got a table without the huge queue. Best steak in South America!",
      photo_data: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
      waiter_id: "isaias",
      created_at: Date.now() - 86400000 * 2
    },
    {
      id: "rev_seed_2",
      place_id: "p3",
      user_name: "Thiago & Luana",
      user_country: "🇧🇷 Brasil",
      rating: 5,
      comment: "A melhor pizza de Buenos Aires! A dica do garçom para pedir a fugazzeta recheada e comer no balcão em pé foi perfeita. Experiência 100% autêntica e barata!",
      photo_data: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
      waiter_id: "isaias",
      created_at: Date.now() - 86400000 * 4
    },
    {
      id: "rev_seed_3",
      place_id: "t1",
      user_name: "Gonzalo y Claudia",
      user_country: "🇨🇱 Chile",
      rating: 5,
      comment: "El show de tango en Puerto Madero superó todas las expectativas. La vista a los diques de noche y los bailarines son de primer nivel. Excelente recomendación!",
      photo_data: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80",
      waiter_id: "isaias",
      created_at: Date.now() - 86400000 * 6
    }
  ];

  const insertSeed = db.prepare(`
    INSERT INTO reviews (id, place_id, user_name, user_country, rating, comment, photo_data, waiter_id, created_at, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  seedReviews.forEach(r => insertSeed.run(r.id, r.place_id, r.user_name, r.user_country, r.rating, r.comment, r.photo_data, r.waiter_id, r.created_at));
}

// Migración de esquema: agregar columna address e is_indoor a places si no existen
try {
  db.exec("ALTER TABLE places ADD COLUMN address TEXT DEFAULT ''");
} catch (e) {}

try {
  db.exec("ALTER TABLE places ADD COLUMN is_indoor INTEGER DEFAULT 1");
} catch (e) {}

try {
  db.exec("ALTER TABLE places ADD COLUMN menu_url TEXT DEFAULT ''");
} catch (e) {}

// Pre-cargar lugares icónicos (bajo techo y ferias fijas) si no existen
const checkTortoni = db.prepare("SELECT id FROM places WHERE id = ?").get("c1");
if (!checkTortoni) {
  db.prepare(`
    INSERT INTO places (id, category, name, address, neighborhood, lat, lng, price, tag, image, tip_es, tip_en, tip_pt, active, created_at, is_indoor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)
  `).run(
    "c1", "cafes", "Café Tortoni", "Av. de Mayo 825", "Montserrat / Centro", -34.6085, -58.3792, "$$", "Café Histórico 1858 (Bajo Techo)",
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80",
    "El café más legendario de Buenos Aires (fundado en 1858). Chocolate con churros caliente imperdible, ideal para un día de lluvia o tarde fresca.",
    "Buenos Aires' oldest and most legendary café (founded 1858). Hot chocolate with churros is a must, especially on rainy days.",
    "O café mais antigo e lendário de Buenos Aires (fundado em 1858). Chocolate quente com churros imperdível, perfeito para dias de chuva.",
    Date.now()
  );
}

const checkAteneo = db.prepare("SELECT id FROM places WHERE id = ?").get("c2");
if (!checkAteneo) {
  db.prepare(`
    INSERT INTO places (id, category, name, address, neighborhood, lat, lng, price, tag, image, tip_es, tip_en, tip_pt, active, created_at, is_indoor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)
  `).run(
    "c2", "culture", "El Ateneo Grand Splendid", "Av. Santa Fe 1860", "Recoleta", -34.5960, -58.3942, "$", "Librería Teatro (Bajo Techo)",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=80",
    "Elegida entre las librerías más hermosas del mundo, dentro de un gran teatro de 1919. El café está sobre el escenario original. Plan bajo techo perfecto.",
    "Ranked among the world's most beautiful bookstores, set in a 1919 theater. Coffee on the stage. Perfect rainy day plan.",
    "Considerada uma das livrarias mais lindas do mundo em um antigo teatro. Café no palco principal. Plano perfeito para dia de chuva.",
    Date.now()
  );
}

const checkSanTelmo = db.prepare("SELECT id FROM places WHERE id = ?").get("f1");
if (!checkSanTelmo) {
  db.prepare(`
    INSERT INTO places (id, category, name, address, neighborhood, lat, lng, price, tag, image, tip_es, tip_en, tip_pt, active, created_at, is_indoor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0)
  `).run(
    "f1", "shopping", "Feria de San Telmo", "Defensa y Plaza Dorrego", "San Telmo", -34.6180, -58.3715, "$", "Feria Domingos (Al Aire Libre)",
    "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600&auto=format&fit=crop&q=80",
    "Todos los domingos de 10 a 18 hs. 12 cuadras peatonales de antigüedades, orquestas de tango callejero y recuerdos.",
    "Every Sunday from 10 AM to 6 PM. 12 pedestrian blocks with antiques, street tango dancers and artisans.",
    "Todos os domingos das 10h às 18h. 12 quadras de rua de pedestres com antiguidades, dançarinos de tango na rua e artesanato.",
    Date.now()
  );
}

const checkMataderos = db.prepare("SELECT id FROM places WHERE id = ?").get("f2");
if (!checkMataderos) {
  db.prepare(`
    INSERT INTO places (id, category, name, address, neighborhood, lat, lng, price, tag, image, tip_es, tip_en, tip_pt, active, created_at, is_indoor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0)
  `).run(
    "f2", "food", "Feria de Mataderos", "Av. Lisandro de la Torre y Corrales", "Mataderos", -34.6608, -58.5028, "$$", "Gauchos & Asado (Domingos)",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
    "Domingos de tradición criolla. Jineteadas, asado al asador, empanadas y peñas folclóricas. Experiencia 100% auténtica.",
    "Sundays of Argentine gaucho tradition. Open-fire barbecue, folklore dances and crafts. 100% authentic cultural immersion.",
    "Domingos de tradição gaúcha argentina. Churrasco no fogo de chão, danças folclóricas e comida típica autêntica.",
    Date.now()
  );
}

// Pre-cargar categorías por defecto si no existen
const checkCats = db.prepare("SELECT COUNT(*) as count FROM categories").get();
if (checkCats.count === 0) {
  const defaultCats = [
    { id: "food", name: "Parrillas & Carnes", icon: "🥩", color: "#ef4444" },
    { id: "tango", name: "Tango & Shows", icon: "💃", color: "#a855f7" },
    { id: "shopping", name: "Shoppings & Paseos", icon: "🛍️", color: "#06b6d4" },
    { id: "bars", name: "Bares & Coctelería", icon: "🍸", color: "#f59e0b" },
    { id: "cafes", name: "Cafés Notables", icon: "☕", color: "#d97706" },
    { id: "culture", name: "Museos & Cultura", icon: "🏛️", color: "#3b82f6" }
  ];
  const insCat = db.prepare("INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)");
  defaultCats.forEach(c => insCat.run(c.id, c.name, c.icon, c.color, Date.now()));
}

// Helpers HTTP
function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// Servidor Principal
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  // ==================== API PÚBLICA / TURISTA ====================

  // Obtener info del mozo por su código (?m=isaias)
  if (pathname === "/api/waiter-info" && method === "GET") {
    const id = (parsedUrl.searchParams.get("id") || "isaias").toLowerCase();
    let waiter = db.prepare("SELECT id, name FROM waiters WHERE id = ?").get(id);
    if (!waiter) {
      waiter = { id: "local", name: "Tu Mozo Amigo" };
    }
    const mpLink = db.prepare("SELECT value FROM settings WHERE key = 'mp_link'").get();
    return sendJSON(res, 200, {
      id: waiter.id,
      name: waiter.name,
      serviceFeeUsd: SERVICE_FEE_USD,
      mpLink: mpLink ? mpLink.value : ""
    });
  }

  // Obtener lugares activos
  if (pathname === "/api/places" && method === "GET") {
    const places = db.prepare("SELECT * FROM places WHERE active = 1 ORDER BY created_at DESC").all();
    return sendJSON(res, 200, places);
  }

  // Obtener categorías disponibles
  if (pathname === "/api/categories" && method === "GET") {
    const cats = db.prepare("SELECT * FROM categories ORDER BY created_at ASC").all();
    return sendJSON(res, 200, cats);
  }

  // Obtener reseñas y fotos de un lugar
  if (pathname === "/api/reviews" && method === "GET") {
    const placeId = parsedUrl.searchParams.get("placeId");
    if (!placeId) {
      return sendJSON(res, 400, { error: "placeId requerido" });
    }
    const reviews = db.prepare(`
      SELECT id, place_id, user_name, user_country, rating, comment, photo_data, waiter_id, created_at
      FROM reviews
      WHERE place_id = ? AND approved = 1
      ORDER BY created_at DESC
    `).all(placeId);
    return sendJSON(res, 200, reviews);
  }

  // Publicar nueva reseña y foto de turista
  if (pathname === "/api/reviews" && method === "POST") {
    try {
      const data = await parseBody(req);
      const placeId = (data.placeId || "").trim();
      const userName = (data.userName || "Turista").trim();
      const userCountry = (data.userCountry || "🌍 Turista").trim();
      const rating = Math.min(5, Math.max(1, parseInt(data.rating, 10) || 5));
      const comment = (data.comment || "").trim();
      const photoData = data.photoData || null;
      const waiterId = (data.waiterId || "isaias").trim().toLowerCase();

      if (!placeId || !comment) {
        return sendJSON(res, 400, { error: "El lugar y el comentario son requeridos." });
      }

      const id = "rev_" + crypto.randomBytes(6).toString("hex");
      const now = Date.now();

      db.prepare(`
        INSERT INTO reviews (id, place_id, user_name, user_country, rating, comment, photo_data, waiter_id, created_at, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, placeId, userName, userCountry, rating, comment, photoData, waiterId, now);

      return sendJSON(res, 201, {
        success: true,
        review: {
          id,
          place_id: placeId,
          user_name: userName,
          user_country: userCountry,
          rating,
          comment,
          photo_data: photoData,
          waiter_id: waiterId,
          created_at: now
        }
      });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Sugerir / Recomendar nuevo lugar por parte de turistas y clientes
  if (pathname === "/api/suggestions" && method === "POST") {
    try {
      const data = await parseBody(req);
      const name = (data.name || "").trim();
      if (!name) {
        return sendJSON(res, 400, { error: "El nombre del lugar es requerido." });
      }

      const id = "sug_" + crypto.randomBytes(6).toString("hex");
      const now = Date.now();
      const address = (data.address || "").trim();
      const neighborhood = (data.neighborhood || "").trim();
      const category = (data.category || "food").trim();
      const tip = (data.tip || "").trim();
      const userName = (data.userName || "Turista Amigo").trim();
      const userCountry = (data.userCountry || "🌍 Turista").trim();
      const photoData = data.photoData || null;
      const linkUrl = (data.linkUrl || "").trim();
      const waiterId = (data.waiterId || "isaias").trim().toLowerCase();

      db.prepare(`
        INSERT INTO suggestions (id, name, address, neighborhood, category, tip, user_name, user_country, photo_data, link_url, waiter_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(id, name, address, neighborhood, category, tip, userName, userCountry, photoData, linkUrl, waiterId, now);

      return sendJSON(res, 201, { success: true, id });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Pago / Activación del Servicio del Mozo (Soporta Mercado Pago y Modo Prueba)
  if (pathname === "/api/pay-service" && method === "POST") {
    try {
      const data = await parseBody(req);
      const isTest = Boolean(data.isTest);
      const name = (data.name || (isTest ? "Usuario Prueba" : "Turista Amigo")).trim();
      const contact = (data.contact || "").trim();
      const waiterId = (data.waiterId || "isaias").trim().toLowerCase();
      const deviceToken = data.deviceToken || crypto.randomUUID();

      const passId = "pass_" + crypto.randomBytes(6).toString("hex");
      const now = Date.now();
      const durationMs = 21 * 24 * 60 * 60 * 1000; // 21 días
      const expiresAt = now + durationMs;

      // 1. Crear el pase en la base de datos
      db.prepare(`
        INSERT INTO passes (id, device_token, tourist_name, tourist_contact, waiter_id, amount_paid_usd, created_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(passId, deviceToken, name, contact, waiterId, isTest ? 0.00 : SERVICE_FEE_USD, now, expiresAt);

      // 2. Si no es prueba, acreditar comisión al mozo
      if (!isTest) {
        const waiter = db.prepare("SELECT id, commission_usd FROM waiters WHERE id = ?").get(waiterId);
        if (waiter) {
          const cut = waiter.commission_usd || WAITER_CUT_USD;
          db.prepare(`
            UPDATE waiters 
            SET total_sales = total_sales + 1,
                pending_payout_usd = pending_payout_usd + ?
            WHERE id = ?
          `).run(cut, waiterId);
        }
      }

      const mpSetting = db.prepare("SELECT value FROM settings WHERE key = 'mp_link'").get();

      return sendJSON(res, 201, {
        success: true,
        passId,
        deviceToken,
        touristName: name,
        waiterId,
        expiresAt,
        daysRemaining: 21,
        mpLink: (!isTest && mpSetting) ? mpSetting.value : null
      });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // 4. Desbloqueo VIP con PIN del Mozo (o PIN maestro 1234)
  if (pathname === "/api/unlock-pin" && method === "POST") {
    try {
      const data = await parseBody(req);
      const inputPin = (data.pin || "").trim();
      const waiterId = (data.waiterId || "isaias").trim().toLowerCase();
      const name = (data.name || "Turista VIP").trim();
      const contact = (data.contact || "").trim();
      const deviceToken = data.deviceToken || crypto.randomUUID();

      let waiter = db.prepare("SELECT * FROM waiters WHERE id = ?").get(waiterId);
      if (!waiter) {
        waiter = db.prepare("SELECT * FROM waiters WHERE id = 'isaias'").get();
      }

      const validPin = (waiter && waiter.pin) ? waiter.pin : "1234";

      // Validar si coincide con el PIN del mozo, el PIN maestro o 1234
      if (inputPin !== validPin && inputPin !== ADMIN_PIN && inputPin !== "1234") {
        return sendJSON(res, 401, {
          success: false,
          error: "PIN incorrecto. Pedile el PIN de 4 dígitos a tu mozo."
        });
      }

      const passId = "pass_" + crypto.randomBytes(6).toString("hex");
      const now = Date.now();
      const durationMs = 21 * 24 * 60 * 60 * 1000;
      const expiresAt = now + durationMs;

      // Crear pase VIP
      db.prepare(`
        INSERT INTO passes (id, device_token, tourist_name, tourist_contact, waiter_id, amount_paid_usd, created_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(passId, deviceToken, name, contact, waiter ? waiter.id : waiterId, SERVICE_FEE_USD, now, expiresAt);

      // Acreditar comisión al mozo
      if (waiter) {
        const cut = waiter.commission_usd || WAITER_CUT_USD;
        db.prepare(`
          UPDATE waiters 
          SET total_sales = total_sales + 1,
              pending_payout_usd = pending_payout_usd + ?
          WHERE id = ?
        `).run(cut, waiter.id);
      }

      return sendJSON(res, 200, {
        success: true,
        passId,
        deviceToken,
        touristName: name,
        waiterId: waiter ? waiter.id : waiterId,
        expiresAt,
        daysRemaining: 21,
        message: "¡Acceso VIP desbloqueado con éxito!"
      });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Validar Pase del turista
  if (pathname === "/api/check-pass" && method === "GET") {
    const passId = parsedUrl.searchParams.get("passId");
    const deviceToken = parsedUrl.searchParams.get("deviceToken");

    if (!passId || !deviceToken) {
      return sendJSON(res, 200, { valid: false, reason: "missing_credentials" });
    }

    const pass = db.prepare("SELECT * FROM passes WHERE id = ?").get(passId);
    if (!pass) {
      return sendJSON(res, 200, { valid: false, reason: "not_found" });
    }

    if (pass.device_token !== deviceToken) {
      return sendJSON(res, 200, {
        valid: false,
        reason: "device_mismatch",
        message: "Este pase pertenece a otro teléfono."
      });
    }

    const now = Date.now();
    if (now > pass.expires_at || pass.is_active === 0) {
      return sendJSON(res, 200, {
        valid: false,
        reason: "expired",
        message: "Tu pase de 21 días ha vencido."
      });
    }

    const daysRemaining = Math.ceil((pass.expires_at - now) / (1000 * 60 * 60 * 24));
    return sendJSON(res, 200, {
      valid: true,
      touristName: pass.tourist_name,
      waiterId: pass.waiter_id,
      expiresAt: pass.expires_at,
      daysRemaining
    });
  }

  // Clics en reservas
  if (pathname === "/api/click" && method === "POST") {
    try {
      const data = await parseBody(req);
      db.prepare(`
        INSERT INTO clicks (place_id, action_type, waiter_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(data.placeId || "", data.actionType || "general", (data.waiterId || "direct").toLowerCase(), Date.now());
      return sendJSON(res, 200, { ok: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // ==================== API ADMIN ====================

  if (pathname === "/api/admin/login" && method === "POST") {
    try {
      const data = await parseBody(req);
      if (data.pin === ADMIN_PIN) {
        return sendJSON(res, 200, { success: true });
      }
      return sendJSON(res, 401, { error: "PIN incorrecto" });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Configuración de Mercado Pago en Admin
  if (pathname === "/api/admin/config" && method === "GET") {
    const mpLink = db.prepare("SELECT value FROM settings WHERE key = 'mp_link'").get();
    return sendJSON(res, 200, { mpLink: mpLink ? mpLink.value : "" });
  }

  if (pathname === "/api/admin/config" && method === "POST") {
    try {
      const data = await parseBody(req);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('mp_link', ?)").run(data.mpLink || "");
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Listar mozos
  if (pathname === "/api/admin/waiters" && method === "GET") {
    const waiters = db.prepare("SELECT * FROM waiters ORDER BY total_sales DESC").all();
    const formatted = waiters.map(w => ({
      ...w,
      pending_payout_ars: Math.round(w.pending_payout_usd * USD_TO_ARS)
    }));
    return sendJSON(res, 200, formatted);
  }

  // Crear o editar mozo
  if (pathname === "/api/admin/waiters" && method === "POST") {
    try {
      const data = await parseBody(req);
      const id = (data.id || data.name).trim().toLowerCase().replace(/\s+/g, "_");
      const name = data.name.trim();
      const phone = (data.phone || "").trim();
      const alias = data.alias.trim();
      const pin = (data.pin || "1234").trim();
      const commission = parseFloat(data.commissionUsd) || WAITER_CUT_USD;

      const existing = db.prepare("SELECT id FROM waiters WHERE id = ?").get(id);
      if (existing) {
        db.prepare("UPDATE waiters SET name = ?, phone = ?, alias = ?, pin = ?, commission_usd = ? WHERE id = ?")
          .run(name, phone, alias, pin, commission, id);
      } else {
        db.prepare(`
          INSERT INTO waiters (id, name, phone, alias, pin, commission_usd, total_sales, pending_payout_usd, total_paid_usd, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
        `).run(id, name, phone, alias, pin, commission, Date.now());
      }
      return sendJSON(res, 200, { success: true, id });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Registrar liquidación al mozo
  if (pathname === "/api/admin/waiters/payout" && method === "POST") {
    try {
      const data = await parseBody(req);
      const waiter = db.prepare("SELECT * FROM waiters WHERE id = ?").get(data.waiterId);

      if (!waiter || waiter.pending_payout_usd <= 0) {
        return sendJSON(res, 400, { error: "No hay saldo pendiente para este mozo." });
      }

      const amountUsd = waiter.pending_payout_usd;
      const amountArs = Math.round(amountUsd * USD_TO_ARS);

      db.prepare(`
        INSERT INTO payouts (waiter_id, amount_usd, amount_ars, alias, paid_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(waiter.id, amountUsd, amountArs, waiter.alias, Date.now());

      db.prepare(`
        UPDATE waiters 
        SET pending_payout_usd = 0,
            total_paid_usd = total_paid_usd + ?
        WHERE id = ?
      `).run(amountUsd, waiter.id);

      return sendJSON(res, 200, { success: true, amountUsd, amountArs, alias: waiter.alias });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Lugares en Admin
  if (pathname === "/api/admin/places" && method === "GET") {
    const places = db.prepare("SELECT * FROM places ORDER BY created_at DESC").all();
    return sendJSON(res, 200, places);
  }

function syncPlacesToDataJs() {
  try {
    const rows = db.prepare("SELECT * FROM places WHERE active = 1 ORDER BY created_at ASC").all();
    if (!rows || rows.length === 0) return;
    const formatted = rows.map(r => ({
      id: r.id,
      category: r.category,
      name: r.name,
      neighborhood: r.neighborhood || "",
      address: r.address || "",
      lat: r.lat,
      lng: r.lng,
      price: r.price || "$$",
      tag: r.tag || "Recomendado",
      image: r.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
      menu_url: r.menu_url || "",
      is_indoor: r.is_indoor !== undefined ? r.is_indoor : 1,
      tips: {
        es: r.tip_es || "",
        en: r.tip_en || r.tip_es || "",
        pt: r.tip_pt || r.tip_es || ""
      }
    }));
    const dataJsPath = path.join(__dirname, "data.js");
    let content = fs.readFileSync(dataJsPath, "utf8");
    try {
      const fn = new Function(content + '; return (typeof APP_DATA !== "undefined" ? APP_DATA : null);');
      const appData = fn();
      if (appData) {
        appData.places = formatted;
        appData.version = "20261117_" + Date.now();
        fs.writeFileSync(dataJsPath, '// Base de datos de lugares, traducciones y tips para Buenos Aires\nconst APP_DATA = ' + JSON.stringify(appData, null, 2) + ';\n', 'utf8');
        console.log(`[Auto-Sync] data.js actualizado con ${formatted.length} lugares`);
        return;
      }
    } catch(e) {}

    const jsonStr = JSON.stringify(formatted, null, 2);
    const regex = /["']?places["']?:\s*\[[\s\S]*?\n\s*\],/;
    if (regex.test(content)) {
      content = content.replace(regex, `"places": ${jsonStr},`);
      fs.writeFileSync(dataJsPath, content, "utf8");
      console.log(`[Auto-Sync] data.js actualizado con ${formatted.length} lugares`);
    }
  } catch (err) {
    console.error("Error auto-sincronizando data.js:", err.message);
  }
}

  if (pathname === "/api/admin/places" && method === "POST") {
    try {
      const p = await parseBody(req);
      const id = p.id || "place_" + crypto.randomBytes(4).toString("hex");

      const existing = db.prepare("SELECT id FROM places WHERE id = ?").get(id);
      const address = (p.address || "").trim();
      const menuUrl = (p.menu_url || "").trim();
      const isIndoor = p.is_indoor === 0 || p.is_indoor === "0" ? 0 : 1;
      if (existing) {
        db.prepare(`
          UPDATE places SET 
            category = ?, name = ?, address = ?, neighborhood = ?, lat = ?, lng = ?, 
            price = ?, tag = ?, image = ?, menu_url = ?, tip_es = ?, tip_en = ?, tip_pt = ?, active = ?, is_indoor = ?
          WHERE id = ?
        `).run(
          p.category, p.name, address, p.neighborhood, parseFloat(p.lat), parseFloat(p.lng),
          p.price, p.tag, p.image, menuUrl, p.tip_es, p.tip_en, p.tip_pt, p.active ? 1 : 0, isIndoor, id
        );
      } else {
        db.prepare(`
          INSERT INTO places (id, category, name, address, neighborhood, lat, lng, price, tag, image, menu_url, tip_es, tip_en, tip_pt, active, created_at, is_indoor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, p.category, p.name, address, p.neighborhood, parseFloat(p.lat), parseFloat(p.lng),
          p.price, p.tag, p.image, menuUrl, p.tip_es, p.tip_en, p.tip_pt, 1, Date.now(), isIndoor
        );
      }
      syncPlacesToDataJs();
      return sendJSON(res, 200, { success: true, id });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Crear o editar categoría desde Admin
  if (pathname === "/api/admin/categories" && method === "POST") {
    try {
      const data = await parseBody(req);
      const name = (data.name || "").trim();
      const icon = (data.icon || "📍").trim();
      const color = (data.color || "#10b981").trim();
      const id = (data.id || name.toLowerCase().replace(/[^a-z0-9]/g, "_")).trim();

      if (!name) return sendJSON(res, 400, { error: "El nombre es obligatorio" });

      const existing = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
      if (existing) {
        db.prepare("UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?").run(name, icon, color, id);
      } else {
        db.prepare("INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(id, name, icon, color, Date.now());
      }
      return sendJSON(res, 200, { success: true, id, name, icon, color });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Eliminar categoría desde Admin
  if (pathname === "/api/admin/categories/delete" && method === "POST") {
    try {
      const data = await parseBody(req);
      if (!data.id) return sendJSON(res, 400, { error: "ID requerido" });
      db.prepare("DELETE FROM categories WHERE id = ?").run(data.id);
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === "/api/admin/places/toggle" && method === "POST") {
    try {
      const data = await parseBody(req);
      db.prepare("UPDATE places SET active = ? WHERE id = ?").run(data.active ? 1 : 0, data.id);
      syncPlacesToDataJs();
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname.startsWith("/api/admin/places/") && method === "DELETE") {
    const id = pathname.split("/").pop();
    db.prepare("DELETE FROM places WHERE id = ?").run(id);
    syncPlacesToDataJs();
    return sendJSON(res, 200, { success: true });
  }

  // Listar todas las reseñas en Admin
  if (pathname === "/api/admin/reviews" && method === "GET") {
    const reviews = db.prepare(`
      SELECT r.*, p.name as place_name, w.name as waiter_name
      FROM reviews r
      LEFT JOIN places p ON r.place_id = p.id
      LEFT JOIN waiters w ON r.waiter_id = w.id
      ORDER BY r.created_at DESC
    `).all();
    return sendJSON(res, 200, reviews);
  }

  // Eliminar reseña desde Admin
  if (pathname === "/api/admin/reviews/delete" && method === "POST") {
    try {
      const data = await parseBody(req);
      if (!data.id) return sendJSON(res, 400, { error: "ID requerido" });
      db.prepare("DELETE FROM reviews WHERE id = ?").run(data.id);
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Listar todas las recomendaciones de lugares en Admin
  if (pathname === "/api/admin/suggestions" && method === "GET") {
    try {
      const suggestions = db.prepare(`
        SELECT * FROM suggestions ORDER BY created_at DESC
      `).all();
      return sendJSON(res, 200, suggestions);
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // Actualizar estado de recomendación (aprobar / descartar / eliminar) desde Admin
  if (pathname === "/api/admin/suggestions/status" && method === "POST") {
    try {
      const data = await parseBody(req);
      const id = data.id;
      const status = data.status || "approved"; // 'approved' | 'discarded' | 'deleted'
      if (!id) return sendJSON(res, 400, { error: "ID requerido" });

      if (status === "deleted") {
        db.prepare("DELETE FROM suggestions WHERE id = ?").run(id);
      } else {
        db.prepare("UPDATE suggestions SET status = ? WHERE id = ?").run(status, id);
      }
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Estadísticas generales
  if (pathname === "/api/admin/stats" && method === "GET") {
    const totalPasses = db.prepare("SELECT COUNT(*) as count FROM passes").get().count;
    const totalEarningsUsd = totalPasses * SERVICE_FEE_USD;
    const totalWaitersPayoutUsd = db.prepare("SELECT SUM(pending_payout_usd) as sum FROM waiters").get().sum || 0;
    const totalClicks = db.prepare("SELECT COUNT(*) as count FROM clicks").get().count;

    return sendJSON(res, 200, {
      totalPasses,
      totalEarningsUsd,
      totalWaitersPayoutUsd,
      totalWaitersPayoutArs: Math.round(totalWaitersPayoutUsd * USD_TO_ARS),
      totalClicks
    });
  }

  // ==================== ARCHIVOS ESTÁTICOS ====================
  let cleanPath = pathname;
  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "index.html";
  } else if (cleanPath === "/admin" || cleanPath === "/admin/") {
    cleanPath = "admin.html";
  }

  let filePath = path.join(__dirname, cleanPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Acceso denegado");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 No encontrado");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`===============================================`);
  console.log(`🚀 BsAs Guide Server Activo (Puerto ${PORT})`);
  console.log(`💻 En tu PC:       http://localhost:${PORT}`);
  console.log(`📱 En tu CELULAR:  http://192.168.100.11:${PORT}/?m=isaias`);
  console.log(`🔐 Panel de Admin: http://192.168.100.11:${PORT}/admin.html`);
  console.log(`🔑 PIN de Admin:   ${ADMIN_PIN}`);
  console.log(`===============================================`);
});
