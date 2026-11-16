# BsAs Local Guide 🇦🇷 (Sistema con Servicio del Mozo & Liquidación por Alias)

Guía web interactiva para turistas en Buenos Aires con modelo de **Servicio del Mozo ($3 USD)**, **corte a las 3 semanas (21 días)** y **Panel de Liquidaciones con Alias de Mercado Pago**.

---

## ⚡ Cómo iniciar el servidor

Abrí una terminal en esta carpeta y ejecutá:

```bash
node server.js
```
*(o `npm start`)*

* 📱 **Vista Turista:** `http://localhost:3000/?m=isaias`
* 🔐 **Panel de Admin:** `http://localhost:3000/admin` *(PIN: `1234`)*

---

## 💡 Cómo funciona el modelo "Servicio del Mozo"

1. **El concepto:**  
   En vez de llamarlo "propina", se presenta como **"Servicio de Asesoría del Mozo & Guía VIP"**.  
   El turista siente que está retribuyendo la atención personalizada de su mozo amigo y a cambio recibe la guía digital completa por 3 semanas.
2. **El cobro:**  
   El turista abona **$3.00 USD** con su tarjeta internacional o Apple Pay.
3. **La comisión del mozo:**  
   El servidor acredita automáticamente **$1.50 USD** en el saldo acumulado del mozo.
4. **La transferencia por Alias:**  
   En tu panel `/admin` tenés la lista de mozos con su Alias (ej: `isaias.mozo.mp`) y el monto equivalente en pesos argentinos.  
   Tocás **"📋 Copiar Alias"**, abrís Mercado Pago en tu celular, le transferís su parte y tocás **"💸 Marcar como Transferido"**.
