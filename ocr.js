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
          model: 'claude-sonnet-4-5',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              {
                type: 'text',
                text: `Eres un experto en comprobantes de pago colombianos. Analiza esta imagen y extrae los datos.

REGLA IMPORTANTE: Si ves el logo "Bre-B" en la imagen, el banco es SIEMPRE "breb", NUNCA "avvillas". Bre-B NO es AV Villas.

IDENTIFICACIÓN DEL BANCO - revisa en este ORDEN de prioridad:
1. BRE-B: logo "Bre-B" en la parte superior, fondo oscuro gris/negro, dice "¡Pago exitoso!", "Código de negocio", "Punto de venta", check verde circular. Es una plataforma de pagos multi-banco. Si ves "Bre-B" → banco = "breb"
2. NEQUI: QR con letra "N" en el centro, dice "Pago realizado", campo "¿Cuánto?", "Llave", referencia empieza con "M"
3. BANCOLOMBIA: dice "¡Transferencia exitosa!", "Comprobante No.", secciones con fondo oscuro negro
4. AVVILLAS: dice TEXTUALMENTE "AVVillas" o "AV Villas" en la pantalla, tema rojo, "Tu pago se realizó con éxito", icono pulgar azul. Solo si dice "AVVillas" explícitamente.
5. TRANSFIYA: icono de celular con check azul, dice "¡Envío exitoso!", "Cuenta origen", "ID Transacción", referencia empieza con "APIU"
6. NU: logo "nu" morado, dice "Comprobante de transferencia", entidad "Nu C.F.", NIT 901.658.107-2

EXTRACCIÓN DEL MONTO - MUY IMPORTANTE:
- En Colombia el PUNTO separa miles (25.900 = veinticinco mil novecientos)
- Si hay "Monto total" Y "Monto" por separado, USA SOLO el campo "Monto" SIN impuesto (el "Monto total" incluye impuesto 4x1000 y NO es lo que llega a la cuenta)
- Ignora centavos (.00 o ,00 o ,20)
- Busca en campos: "Valor", "Valor del pago", "¿Cuánto?", "Pagaste", "Valor de la transferencia", "Monto"
- Devuelve SOLO el número entero sin puntos ni comas (ejemplo: 99800 no 99.800,00)

EXTRACCIÓN DE REFERENCIA:
- Nequi: campo "Referencia" (empieza con M)
- Bancolombia: "Comprobante No."
- Daviplata: "Número de transacción" (código hexadecimal largo)
- Transfiya: "Número de transacción" (empieza con APIU)
- Nu: "Número de comprobante" (número largo) o "Referencia interna"
- Bre-B: "Comprobante No." (código alfanumérico)

FECHA: devuelve siempre en formato DD/MM/AAAA

Responde SOLO en JSON puro sin backticks ni texto adicional:
{"banco":"nequi/bancolombia/daviplata/avvillas/transfiya/nu/breb/otro","monto":"99800","referencia":"ABC123","fecha":"07/08/2026","parece_falso":false}

parece_falso = true si la imagen está borrosa, editada, cortada o los datos no son coherentes.`,

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

// La API falló — verificar si algun modelo falla
console.log('[OCR] Error: el servicio de lectura no está disponible');
return {
  error: true,
  mensaje: '⚠️ Nuestro servicio está fallando en este momento. Volveremos lo más pronto posible.\n\n📞 Por favor contacta al administrador para verificar este pago manualmente.'
};
}

module.exports = { leerComprobante, extraerDatos };
