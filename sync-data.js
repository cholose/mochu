// sync-data.js - Sincroniza los lugares desde database.sqlite hacia data.js para GitHub Pages y celulares
const fs = require("node:fs");
const path = require("node:path");

try {
  const { DatabaseSync } = require("node:sqlite");
  const dbPath = path.join(__dirname, "database.sqlite");
  if (!fs.existsSync(dbPath)) {
    console.log("No existe database.sqlite, nada para sincronizar.");
    process.exit(0);
  }

  const db = new DatabaseSync(dbPath);
  const rows = db.prepare("SELECT * FROM places WHERE active = 1 ORDER BY created_at ASC").all();

  if (!rows || rows.length === 0) {
    console.log("No hay lugares en la base de datos.");
    process.exit(0);
  }

  const formattedPlaces = rows.map(r => ({
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
  let dataJsContent = fs.readFileSync(dataJsPath, "utf8");

  try {
    const fn = new Function(dataJsContent + '; return (typeof APP_DATA !== "undefined" ? APP_DATA : null);');
    const appData = fn();
    if (appData) {
      appData.places = formattedPlaces;
      try {
        const sqliteWaiters = db.prepare("SELECT * FROM waiters").all();
        if (sqliteWaiters && sqliteWaiters.length > 0) {
          appData.waiters = sqliteWaiters.map(w => ({
            id: w.id,
            name: w.name,
            phone: w.phone || "",
            alias: w.alias || "",
            pin: w.pin || "1234",
            commission_usd: w.commission_usd || 1.5
          }));
        }
        const sqlitePasses = db.prepare("SELECT * FROM passes ORDER BY created_at DESC").all();
        if (sqlitePasses && sqlitePasses.length > 0) {
          appData.tourists = sqlitePasses.map(p => ({
            id: p.id,
            tourist_name: p.tourist_name,
            tourist_contact: p.tourist_contact || "",
            waiter_id: p.waiter_id,
            payment_method: p.amount_paid_usd > 0 ? "Cobro Confirmado" : "Prueba",
            amount_paid_usd: p.amount_paid_usd || 3.0,
            created_at: p.created_at,
            expires_at: p.expires_at,
            is_active: p.is_active !== undefined ? p.is_active : 1
          }));
        }
      } catch(e) {}
      appData.version = "20261120_" + Date.now();
      fs.writeFileSync(dataJsPath, '// Base de datos de lugares, traducciones y tips para Buenos Aires\nconst APP_DATA = ' + JSON.stringify(appData, null, 2) + ';\n', 'utf8');
      console.log(`✅ ¡Éxito! Se sincronizaron ${formattedPlaces.length} lugares desde SQLite hacia data.js`);
      process.exit(0);
    }
  } catch(e) {}

  const placesJson = JSON.stringify(formattedPlaces, null, 2);
  const regex = /["']?places["']?:\s*\[[\s\S]*?\n\s*\],/;
  if (regex.test(dataJsContent)) {
    dataJsContent = dataJsContent.replace(regex, `"places": ${placesJson},`);
    fs.writeFileSync(dataJsPath, dataJsContent, "utf8");
    console.log(`✅ ¡Éxito! Se sincronizaron ${formattedPlaces.length} lugares desde SQLite hacia data.js`);
  } else {
    console.warn("⚠️ No se pudo actualizar places en data.js");
  }
} catch (err) {
  console.error("Error sincronizando data.js:", err.message);
}
