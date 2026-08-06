// gmail.js — Verificación de pagos vía correos de Bancolombia
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  console.log('[Gmail] Scope del token cargado:', token.scope);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

// ─── Función principal con reintentos ─────────────────────
async function verificarPorGmail(montoEsperado, opciones = {}) {
  const maxIntentos = opciones.intentos || 4;
  const esperaMs = opciones.esperaMs || 10000;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const resultado = await buscarEnGmail(montoEsperado);

      if (resultado) {
        console.log(`[Gmail] ✅ Pago encontrado al intento ${intento}`);
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

  console.log('[Gmail] No se encontró el pago después de todos los intentos');
  return null;
}

// ─── Función interna que hace la búsqueda real ────────────
async function buscarEnGmail(montoEsperado) {
  try {
    const auth = getAuth();
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

module.exports = { verificarPorGmail };