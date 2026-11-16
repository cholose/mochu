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

  CREATE TABLE IF NOT EXISTS waiters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    commission_usd REAL DEFAULT 1.50,
    total_sales INTEGER DEFAULT 0,
    pending_payout_usd REAL DEFAULT 0,
    total_paid_usd REAL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

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
      const alias = data.alias.trim();
      const pin = (data.pin || "1234").trim();
      const commission = parseFloat(data.commissionUsd) || WAITER_CUT_USD;

      const existing = db.prepare("SELECT id FROM waiters WHERE id = ?").get(id);
      if (existing) {
        db.prepare("UPDATE waiters SET name = ?, alias = ?, pin = ?, commission_usd = ? WHERE id = ?")
          .run(name, alias, pin, commission, id);
      } else {
        db.prepare(`
          INSERT INTO waiters (id, name, alias, pin, commission_usd, total_sales, pending_payout_usd, total_paid_usd, created_at)
          VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)
        `).run(id, name, alias, pin, commission, Date.now());
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

  if (pathname === "/api/admin/places" && method === "POST") {
    try {
      const p = await parseBody(req);
      const id = p.id || "place_" + crypto.randomBytes(4).toString("hex");

      const existing = db.prepare("SELECT id FROM places WHERE id = ?").get(id);
      if (existing) {
        db.prepare(`
          UPDATE places SET 
            category = ?, name = ?, neighborhood = ?, lat = ?, lng = ?, 
            price = ?, tag = ?, image = ?, tip_es = ?, tip_en = ?, tip_pt = ?, active = ?
          WHERE id = ?
        `).run(
          p.category, p.name, p.neighborhood, parseFloat(p.lat), parseFloat(p.lng),
          p.price, p.tag, p.image, p.tip_es, p.tip_en, p.tip_pt, p.active ? 1 : 0, id
        );
      } else {
        db.prepare(`
          INSERT INTO places (id, category, name, neighborhood, lat, lng, price, tag, image, tip_es, tip_en, tip_pt, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, p.category, p.name, p.neighborhood, parseFloat(p.lat), parseFloat(p.lng),
          p.price, p.tag, p.image, p.tip_es, p.tip_en, p.tip_pt, 1, Date.now()
        );
      }
      return sendJSON(res, 200, { success: true, id });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === "/api/admin/places/toggle" && method === "POST") {
    try {
      const data = await parseBody(req);
      db.prepare("UPDATE places SET active = ? WHERE id = ?").run(data.active ? 1 : 0, data.id);
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname.startsWith("/api/admin/places/") && method === "DELETE") {
    const id = pathname.split("/").pop();
    db.prepare("DELETE FROM places WHERE id = ?").run(id);
    return sendJSON(res, 200, { success: true });
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
