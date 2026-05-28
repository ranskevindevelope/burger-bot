// ocr.js — Extrae datos del comprobante usando Claude API
// Acepta base64 directamente desde OpenWA

const fetch = require('node-fetch');

const PATRONES = {
  monto:      [/\$\s?([\d.,]+)/, /valor[\s:]+([,\d.]+)/i, /monto[\s:]+([,\d.]+)/i, /total[\s:]+([,\d.]+)/i],
  referencia: [/ref(?:erencia)?[\s:#]+([A-Z0-9]{6,20})/i, /transacci[oó]n[\s:#]+([A-Z0-9]{6,20})/i, /n[uú]mero[\s:#]+([A-Z0-9]{6,20})/i],
  banco:      [/(nequi)/i, /(bancolombia)/i, /(daviplata)/i, /(davivienda)/i, /(bbva)/i],
  fecha:      [/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/, /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/],
};

function extraerDatos(texto) {
  const resultado = { monto: null, referencia: null, banco: null, fecha: null };
  for (const p of PATRONES.monto)      { const m = texto.match(p); if (m) { resultado.monto = m[1].replace(/\./g, '').replace(',', '.'); break; } }
  for (const p of PATRONES.referencia) { const m = texto.match(p); if (m) { resultado.referencia = m[1]; break; } }
  for (const p of PATRONES.banco)      { const m = texto.match(p); if (m) { resultado.banco = m[1].toLowerCase(); break; } }
  for (const p of PATRONES.fecha)      { const m = texto.match(p); if (m) { resultado.fecha = m[1]; break; } }
  return resultado;
}

async function leerComprobante(urlImagen, base64Data) {
  if (process.env.CLAUDE_API_KEY) {
    try {
      let imageBase64 = '';
      let mediaType = 'image/jpeg';

      if (base64Data) {
        // OpenWA mandó la imagen en base64 directamente
        imageBase64 = base64Data;
        console.log('[OCR] Usando base64 del webhook');
      } else if (urlImagen) {
        // Intentar descargar desde URL
        const imgResponse = await fetch(urlImagen);
        const buffer = await imgResponse.buffer();
        imageBase64 = buffer.toString('base64');
        mediaType = imgResponse.headers.get('content-type') || 'image/jpeg';
        console.log('[OCR] Imagen descargada desde URL');
      } else {
        throw new Error('Sin imagen disponible');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              {
                type: 'text',
                text: `Analiza este comprobante de pago colombiano y responde SOLO en JSON sin texto adicional:\n{"banco":"nequi/bancolombia/daviplata/otro","monto":"45000","referencia":"ABC123","fecha":"14/05/2026","parece_falso":false}`,
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const texto = data.content?.[0]?.text || '';
      console.log('[OCR] Respuesta Claude:', texto);
      const match = texto.match(/\{[\s\S]*\}/);
      const json = JSON.parse(match[0]);
      console.log('[OCR] Claude leyó:', json);
      return json;

    } catch (err) {
      console.error('[OCR] Error Claude:', err.message);
    }
  }

  // Modo demo
  console.log('[OCR] Modo demo activo');
  return extraerDatos(`
    Nequi - Transferencia exitosa
    Valor: $45.000
    Referencia: NEQ8842719
    Fecha: ${new Date().toLocaleDateString('es-CO')}
  `);
}

module.exports = { leerComprobante, extraerDatos };