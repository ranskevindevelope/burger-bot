const fetch = require('node-fetch');
const fs = require('fs');
const config = require('../config');

const OPENWA_URL = config.OPENWA_URL;
const OPENWA_KEY = config.OPENWA_KEY;
const OPENWA_SESSION = config.OPENWA_SESSION;

async function enviarMensaje(to, body) {
  try {
    const numero = to.replace('@lid', '').replace('@c.us', '');
    const chatId = `${numero}@c.us`;

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

async function enviarImagen(to, rutaFoto, caption) {
  try {
    const numero = to.replace('@lid', '').replace('@c.us', '');
    const chatId = `${numero}@c.us`;

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

module.exports = { enviarMensaje, enviarImagen };
