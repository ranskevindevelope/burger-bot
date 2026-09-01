// ocr.js — Lectura de comprobantes con Claude AI
const fetch = require('node-fetch');
const sharp = require('sharp');

// ─── Prompt único ────────────────────────────
const PROMPT_OCR = `Eres un experto en comprobantes de pago colombianos. Analiza esta imagen y extrae los datos.

REGLA CRÍTICA: Si ves el logo "Bre-B" en cualquier parte de la imagen, el banco es SIEMPRE "breb". Bre-B NO es AV Villas. NUNCA pongas "avvillas" si ves "Bre-B".

IDENTIFICACIÓN DEL BANCO - revisa en este ORDEN ESTRICTO:
1. BRE-B: logo "Bre-B" en cualquier parte (con o sin logo de otro banco al lado como "Banco Cooperativo Coop Central"). Puede tener fondo oscuro O fondo blanco. Señales: "¡Pago exitoso!" o "Transferencia exitosa", "Código de negocio" o "Nro. de confirmación", "Punto de venta" o "Enviado a", "Valor del pago" o "Valor enviado", "Llave destino", check verde. Si ves "Bre-B" → banco = "breb"
2. NEQUI: QR con letra "N" en el centro, dice "Pago realizado", campo "¿Cuánto?", "Llave", referencia empieza con "M", fondo con ilustraciones grises de ciudad
3. BANCOLOMBIA: dice "¡Transferencia exitosa!", "Comprobante No.", secciones con fondo oscuro negro, "Datos de la transferencia", "Producto destino"
4. DAVIVIENDA: logo "DAVIVIENDA" rojo/naranja, fondo rojo arriba, dice "Transacción exitosa", "Número de comprobante", "Llave Bancolombia", "Costo de la transacción". Si ves "DAVIVIENDA" → banco = "davivienda"
5. DAVIPLATA: logo "DAVI bank" rojo, dice "Pagaste", sello circular "TRANSACCIÓN EXITOSA", "Número de transacción" largo hexadecimal
6. AVVILLAS: SOLO si dice TEXTUALMENTE "AVVillas" o "AV Villas" en la pantalla, tema rojo, "Tu pago se realizó con éxito", icono pulgar azul. Si no dice "AVVillas" explícitamente, NO es avvillas.
7. TRANSFIYA: icono de celular con check azul, dice "¡Envío exitoso!", "Cuenta origen", "ID Transacción", referencia empieza con "APIU"
8. NU: logo "nu" morado, dice "Comprobante de transferencia", entidad "Nu C.F.", NIT 901.658.107-2

EXTRACCIÓN DEL MONTO - MUY IMPORTANTE:
- En Colombia el PUNTO separa miles (25.900 = veinticinco mil novecientos)
- Si hay "Monto total" Y "Monto" por separado, USA SOLO el campo "Monto" SIN impuesto (el "Monto total" incluye impuesto 4x1000 y NO es lo que llega a la cuenta)
- Ignora centavos (.00 o ,00 o ,20)
- Busca en campos: "Valor", "Valor del pago", "Valor enviado", "¿Cuánto?", "Pagaste", "Valor de la transferencia", "Monto"
- Devuelve SOLO el número entero sin puntos ni comas (ejemplo: 99800 no 99.800,00)

EXTRACCIÓN DE REFERENCIA:
- Nequi: campo "Referencia" (empieza con M)
- Bancolombia: "Comprobante No."
- Davivienda: "Número de comprobante" (número corto como 90653910)
- Daviplata: "Número de transacción" (código hexadecimal largo)
- AV Villas: "No. de autorización"
- Transfiya: "Número de transacción" (empieza con APIU)
- Nu: "Número de comprobante" o "Referencia interna"
- Bre-B: "Comprobante No." o "Nro. de confirmación" (código alfanumérico o numérico largo)

FECHA: devuelve siempre en formato DD/MM/AAAA

Responde SOLO en JSON puro sin backticks ni texto adicional:
{"banco":"nequi/bancolombia/davivienda/daviplata/avvillas/transfiya/nu/breb/otro","monto":"99800","referencia":"ABC123","fecha":"07/08/2026","parece_falso":false}

parece_falso = true si la imagen está borrosa, editada, cortada o los datos no son coherentes.`;

// ─── Extraer JSON desde texto ────────────────
function extraerJsonDesdeTexto(texto) {
  console.log('[OCR] Extrayendo JSON de:', texto.substring(0, 200));

  let match = texto.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); }
    catch (e) { console.error('[OCR] Error parseando JSON:', e.message); }
  }

  match = texto.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) {
    try { return JSON.parse(match[1]); }
    catch (e) { console.error('[OCR] Error parseando JSON backticks:', e.message); }
  }

  const jsonMatch = texto.match(/\{[^{]*"banco"[^}]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); }
    catch (e) { console.error('[OCR] Error parseando JSON parcial:', e.message); }
  }

  throw new Error('No se encontró JSON en la respuesta del modelo');
}

// ─── Redimensionar la imagen antes de enviarla ───
// Claude cobra las imágenes por píxeles (ancho×alto/750 ≈ tokens). Una foto de
// celular sin achicar (12MP+) puede costar 5-10x más que una versión de 1024px,
// que sigue siendo de sobra para leer texto y números de un comprobante.
const ANCHO_MAXIMO = 1024;

async function redimensionarImagen(buffer) {
  try {
    const salida = await sharp(buffer)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    console.log(`[OCR] Imagen redimensionada: ${buffer.length} → ${salida.length} bytes`);
    return { buffer: salida, mediaType: 'image/jpeg' };
  } catch (err) {
    console.error('[OCR] Error redimensionando, se usa la imagen original:', err.message);
    return { buffer, mediaType: 'image/jpeg' };
  }
}

// ─── Obtener imagen en base64 (ya redimensionada) ────
async function obtenerImagen(urlImagen, base64Data) {
  let bufferOriginal;

  if (base64Data) {
    console.log('[OCR] Usando base64 del webhook, longitud:', base64Data.length);
    bufferOriginal = Buffer.from(base64Data, 'base64');
  } else if (urlImagen) {
    console.log('[OCR] Descargando imagen desde URL:', urlImagen);
    const imgResponse = await fetch(urlImagen);
    bufferOriginal = await imgResponse.buffer();
    console.log('[OCR] Imagen descargada, tamaño:', bufferOriginal.length);
  } else {
    throw new Error('Sin imagen disponible');
  }

  const { buffer, mediaType } = await redimensionarImagen(bufferOriginal);
  return { imageBase64: buffer.toString('base64'), mediaType };
}

// ─── Función principal ───────────────────────
async function leerComprobante(urlImagen, base64Data) {
  const claudeKey = process.env.CLAUDE_API_KEY;

  if (!claudeKey) {
    return {
      error: true,
      mensaje: '⚠️ Servicio de lectura no disponible. Contacta al administrador.',
    };
  }

  try {
    const { imageBase64, mediaType } = await obtenerImagen(urlImagen, base64Data);

    console.log('[OCR] Enviando a Claude...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: PROMPT_OCR },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      if (data.error.message?.includes('credit') || data.error.type === 'insufficient_quota') {
        return {
          error: true,
          mensaje: '⚠️ Se agotaron los créditos del servicio de lectura. Contacta al administrador para recargar.',
        };
      }
      throw new Error(`Claude error: ${data.error.message}`);
    }

    const texto = data.content?.[0]?.text || '';
    console.log('[OCR] Claude respuesta:', texto.substring(0, 300));

    const resultado = extraerJsonDesdeTexto(texto);
    console.log('[OCR] ✅ Resultado:', JSON.stringify(resultado));
    return resultado;

  } catch (err) {
    console.error('[OCR] Error:', err.message);
  }

  return {
    error: true,
    mensaje: '⚠️ No pudimos leer el comprobante. Intenta con una foto más clara.',
  };
}

module.exports = { leerComprobante };
