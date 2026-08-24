// gmail.js — Verificación de pagos vía correos de Bancolombia (multi-negocio)
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { obtenerTokenGmail, guardarTokenGmail } = require('./db');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Fallback: token.json del archivo para negocio 1 (retrocompatibilidad)
const TOKEN_PATH = path.join(__dirname, 'token.json');

let credentialsCache = null;

function getCredentials() {
  if (!credentialsCache) {
    credentialsCache = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  }
  return credentialsCache;
}

// ─── Obtener auth OAuth2 por negocio ────────────────────
async function getAuth(negocio_id) {
  const credentials = getCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Intentar token de BD para este negocio
  const tokenDB = await obtenerTokenGmail(negocio_id);

  if (tokenDB) {
    oAuth2Client.setCredentials({
      access_token: tokenDB.access_token,
      refresh_token: tokenDB.refresh_token,
      expiry_date: tokenDB.expiry_date,
    });

    // Listener: si Google refresca el token, guardarlo en BD
    oAuth2Client.on('tokens', async (newTokens) => {
      try {
        await guardarTokenGmail(negocio_id, {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expiry_date: newTokens.expiry_date,
          email: tokenDB.email,
        });
        console.log(`[Gmail] Token refrescado para negocio ${negocio_id}`);
      } catch (e) {
        console.error(`[Gmail] Error guardando token refrescado:`, e.message);
      }
    });

    console.log(`[Gmail] Usando token de BD para negocio ${negocio_id} (${tokenDB.email})`);
    return oAuth2Client;
  }

  // Fallback: token.json del archivo solo para negocio 1
  if (negocio_id === 1 && fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    console.log('[Gmail] Usando token.json (fallback negocio 1)');
    return oAuth2Client;
  }

  return null;
}

// ─── Función principal con reintentos ─────────────────────
async function verificarPorGmail(montoEsperado, negocio_id = 1, opciones = {}) {
  const maxIntentos = opciones.intentos || 4;
  const esperaMs = opciones.esperaMs || 10000;

  const auth = await getAuth(negocio_id);
  if (!auth) {
    console.log(`[Gmail] Negocio ${negocio_id} no tiene Gmail conectado`);
    return null;
  }

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const resultado = await buscarEnGmail(auth, montoEsperado);

      if (resultado) {
        console.log(`[Gmail] ✅ Pago encontrado al intento ${intento} (negocio ${negocio_id})`);
        return resultado;
      }

      if (intento < maxIntentos) {
        console.log(`[Gmail] Intento ${intento}/${maxIntentos} sin resultado. Reintentando en ${esperaMs / 1000}s...`);
        await new Promise(r => setTimeout(r, esperaMs));
      }
    } catch (err) {
      console.error(`[Gmail] Error intento ${intento}:`, err.message);
      if (intento === maxIntentos) return null;
    }
  }

  console.log(`[Gmail] No se encontró el pago después de todos los intentos (negocio ${negocio_id})`);
  return null;
}

// ─── Función interna que hace la búsqueda real ────────────
async function buscarEnGmail(auth, montoEsperado) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:notificacionesbancolombia.com is:unread newer_than:1d',
      maxResults: 10,
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      console.log('[Gmail] No hay correos nuevos de Bancolombia');
      return null;
    }

    const montoBuscado = parseInt(montoEsperado);

    for (const msg of res.data.messages) {
      const detalle = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const snippet = detalle.data.snippet || '';
      console.log('[Gmail] Revisando correo:', snippet);

      const match = snippet.match(/\$\s?([\d.,]+)/);
      if (!match) continue;

      let montoTexto = match[1];
      if (/\.\d{2}$/.test(montoTexto)) {
        montoTexto = montoTexto.slice(0, -3);
      }
      const montoCorreo = parseInt(montoTexto.replace(/[.,]/g, ''));

      if (montoCorreo === montoBuscado) {
        console.log(`[Gmail] ✅ Pago encontrado: $${montoCorreo}`);

        let nombreCliente = null;
        const matchNombre = snippet.match(/pago de (.+?) por/i);
        if (matchNombre) {
          nombreCliente = matchNombre[1].trim();
          console.log('[Gmail] Cliente:', nombreCliente);
        }

        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });

        return { monto: montoCorreo, fuente: 'Gmail', nombre: nombreCliente };
      }
    }

    console.log('[Gmail] No se encontró coincidencia de monto');
    return null;

  } catch (err) {
    console.error('[Gmail] Error:', err.message);
    return null;
  }
}

// ─── Listar ingresos (transferencias recibidas) de Bancolombia del día ───
//  No filtra por un monto específico: devuelve TODOS los ingresos detectados
//  en notificaciones de Bancolombia de las últimas 24h para un negocio.
async function listarIngresosDelDia(negocio_id = 1) {
  const auth = await getAuth(negocio_id);
  if (!auth) {
    console.log(`[Gmail] Negocio ${negocio_id} no tiene Gmail conectado`);
    return [];
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:notificacionesbancolombia.com newer_than:1d is:unread',
      maxResults: 20,
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      console.log('[Gmail] No hay correos de Bancolombia del día');
      return [];
    }

    const ingresos = [];

    for (const msg of res.data.messages) {
      const detalle = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

            const snippet = detalle.data.snippet || '';

      // ❌ Excluir retiros / salidas de dinero (evitar falsos "ingresos")
      if (/retiraste|retiró|retiro|debitaste|pagaste|descont|cajero|de tu t\.deb|de tu t deb|de su t\.deb|compra|compraste|folios?|avance|retiro en/i.test(snippet)) {
        continue;
      }

      // ✅ Requerir señales claras de INGRESO (transferencias recibidas)
      if (!/recibiste|recibido|recibida|recibimos|consignaci|abono|un pago de|una transferencia|transferencia de|te hicieron|te realizaron|a tu cuenta|a su cuenta|ingresó|ingreso de|depósito|deposito/i.test(snippet)) {
        continue;
      }

      const match = snippet.match(/\$\s?([\d.,]+)/);
      if (!match) continue;

      let montoTexto = match[1];
      if (/\.\d{2}$/.test(montoTexto)) {
        montoTexto = montoTexto.slice(0, -3);
      }
      const monto = parseInt(montoTexto.replace(/[.,]/g, ''));
      if (isNaN(monto)) continue;

      let nombreCliente = null;
      const matchNombre = snippet.match(/pago de (.+?) por/i);
      if (matchNombre) {
        nombreCliente = matchNombre[1].trim();
      }

      ingresos.push({ monto, nombre: nombreCliente, snippet });
    }

    console.log(`[Gmail] Ingresos detectados del día (negocio ${negocio_id}): ${ingresos.length}`);
    return ingresos;

  } catch (err) {
    console.error('[Gmail] Error listando ingresos:', err.message);
    return [];
  }
}

module.exports = { verificarPorGmail, listarIngresosDelDia };