const fetch = require('node-fetch');
const fs = require('fs');
const config = require('../config');

const OPENWA_URL = config.OPENWA_URL;
const OPENWA_KEY = config.OPENWA_KEY;
const OPENWA_SESSION = config.OPENWA_SESSION;

function normalizarNumero(to) {
  return to.replace('@lid', '').replace('@c.us', '');
}

// ─── Proveedor: open-wa (no oficial) ──────────────────────
async function enviarMensajeOpenwa(to, body) {
  try {
    const chatId = `${normalizarNumero(to)}@c.us`;

    const res = await fetch(
      `${OPENWA_URL}/api/sessions/${OPENWA_SESSION}/messages/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_KEY,
        },
        body: JSON.stringify({ chatId, text: body }),
      }
    );
    const data = await res.json();
    console.log('[Bot] Mensaje enviado a', chatId, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot] Error enviando mensaje:', err.message);
  }
}

async function enviarImagenOpenwa(to, rutaFoto, caption) {
  try {
    const chatId = `${normalizarNumero(to)}@c.us`;

    const imagenBuffer = fs.readFileSync(rutaFoto);
    const imagenBase64 = imagenBuffer.toString('base64');

    const res = await fetch(
      `${OPENWA_URL}/api/sessions/${OPENWA_SESSION}/messages/send-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_KEY,
        },
        body: JSON.stringify({
          chatId,
          base64: imagenBase64,
          mimetype: 'image/jpeg',
          caption: caption || '',
        }),
      }
    );
    const data = await res.json();
    console.log('[Bot] Imagen enviada a', chatId, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot] Error enviando imagen:', err.message);
  }
}

// ─── Proveedor: API oficial de Meta (respaldo) ────────────
// Usa el fetch global de Node (18+), no node-fetch, porque necesita
// FormData/Blob nativos para subir imágenes sin agregar dependencias.
function metaHeaders(extra) {
  return { Authorization: `Bearer ${config.META_ACCESS_TOKEN}`, ...extra };
}

async function enviarMensajeMeta(to, body) {
  try {
    const numero = normalizarNumero(to);
    const url = `https://graph.facebook.com/${config.META_API_VERSION}/${config.META_PHONE_NUMBER_ID}/messages`;
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: metaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numero,
        type: 'text',
        text: { body, preview_url: false },
      }),
    });
    const data = await res.json();
    console.log('[Bot][Meta] Mensaje enviado a', numero, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot][Meta] Error enviando mensaje:', err.message);
  }
}

async function enviarImagenMeta(to, rutaFoto, caption) {
  try {
    const numero = normalizarNumero(to);
    const mimetype = 'image/jpeg';
    const buffer = fs.readFileSync(rutaFoto);

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimetype);
    form.append('file', new Blob([buffer], { type: mimetype }), 'comprobante.jpg');

    const uploadRes = await globalThis.fetch(
      `https://graph.facebook.com/${config.META_API_VERSION}/${config.META_PHONE_NUMBER_ID}/media`,
      { method: 'POST', headers: metaHeaders(), body: form }
    );
    const uploadData = await uploadRes.json();
    if (!uploadData.id) {
      console.error('[Bot][Meta] Error subiendo imagen:', JSON.stringify(uploadData));
      return;
    }

    const res = await globalThis.fetch(
      `https://graph.facebook.com/${config.META_API_VERSION}/${config.META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: metaHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numero,
          type: 'image',
          image: { id: uploadData.id, caption: caption || '' },
        }),
      }
    );
    const data = await res.json();
    console.log('[Bot][Meta] Imagen enviada a', numero, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot][Meta] Error enviando imagen:', err.message);
  }
}

// Resuelve un media id de un mensaje entrante de Meta a base64.
// La usa routes/webhook.js cuando WA_PROVIDER=meta y llega una imagen.
async function descargarMediaMeta(mediaId) {
  const metaRes = await globalThis.fetch(
    `https://graph.facebook.com/${config.META_API_VERSION}/${mediaId}`,
    { headers: metaHeaders() }
  );
  const metaData = await metaRes.json();
  if (!metaData.url) throw new Error('No se pudo resolver la URL del medio: ' + JSON.stringify(metaData));

  const fileRes = await globalThis.fetch(metaData.url, { headers: metaHeaders() });
  const arrayBuffer = await fileRes.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mimetype: metaData.mime_type };
}

// ─── Switch de proveedor ───────────────────────────────────
async function enviarMensaje(to, body) {
  if (config.WA_PROVIDER === 'meta') return enviarMensajeMeta(to, body);
  return enviarMensajeOpenwa(to, body);
}

async function enviarImagen(to, rutaFoto, caption) {
  if (config.WA_PROVIDER === 'meta') return enviarImagenMeta(to, rutaFoto, caption);
  return enviarImagenOpenwa(to, rutaFoto, caption);
}

module.exports = { enviarMensaje, enviarImagen, descargarMediaMeta };
