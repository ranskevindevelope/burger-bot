// ocr.js — Lectura de comprobantes con Claude AI
const fetch = require('node-fetch');

// ─── Prompt único ────────────────────────────
const PROMPT_OCR = `Eres un experto en comprobantes de pago colombianos. Analiza esta imagen y extrae los datos.

REGLA CRÍTICA: Si ves el logo "Bre-B" en cualquier parte de la imagen, el banco es SIEMPRE "breb". Bre-B NO es AV Villas. NUNCA pongas "avvillas" si ves "Bre-B".

IDENTIFICACIÓN DEL BANCO - revisa en este ORDEN ESTRICTO:
1. BRE-B: logo "Bre-B" arriba con franjas de colores (naranja, azul, amarillo), fondo oscuro gris/negro, dice "¡Pago exitoso!", "Código de negocio", "Punto de venta", check verde circular, "Valor del pago", "Costo del pago". Si ves CUALQUIERA de estas señales → banco = "breb"
2. NEQUI: QR con letra "N" en el centro, dice "Pago realizado", campo "¿Cuánto?", "Llave", referencia empieza con "M", fondo con ilustraciones grises de ciudad
3. BANCOLOMBIA: dice "¡Transferencia exitosa!", "Comprobante No.", secciones con fondo oscuro negro, "Datos de la transferencia", "Producto destino"
4. DAVIPLATA: logo "DAVI bank" rojo, dice "Pagaste", sello circular "TRANSACCIÓN EXITOSA", "Número de transacción" largo hexadecimal
5. AVVILLAS: SOLO si dice TEXTUALMENTE "AVVillas" o "AV Villas" en la pantalla, tema rojo, "Tu pago se realizó con éxito", icono pulgar azul. Si no dice "AVVillas" explícitamente, NO es avvillas.
6. TRANSFIYA: icono de celular con check azul, dice "¡Envío exitoso!", "Cuenta origen", "ID Transacción", referencia empieza con "APIU"
7. NU: logo "nu" morado, dice "Comprobante de transferencia", entidad "Nu C.F.", NIT 901.658.107-2

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
- AV Villas: "No. de autorización"
- Transfiya: "Número de transacción" (empieza con APIU)
- Nu: "Número de comprobante" o "Referencia interna"
- Bre-B: "Comprobante No." (código alfanumérico como TR2LG7Wt8LEC)

FECHA: devuelve siempre en formato DD/MM/AAAA

Responde SOLO en JSON puro sin backticks ni texto adicional:
{"banco":"nequi/bancolombia/daviplata/avvillas/transfiya/nu/breb/otro","monto":"99800","referencia":"ABC123","fecha":"07/08/2026","parece_falso":false}

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

// ─── Obtener imagen en base64 ────────────────
async function obtenerImagen(urlImagen, base64Data) {
  if (base64Data) {
    console.log('[OCR] Usando base64 del webhook, longitud:', base64Data.length);
    return { imageBase64: base64Data, mediaType: 'image/jpeg' };
  }

  if (urlImagen) {
    console.log('[OCR] Descargando imagen desde URL:', urlImagen);
    const imgResponse = await fetch(urlImagen);
    const buffer = await imgResponse.buffer();
    const mediaType = imgResponse.headers.get('content-type') || 'image/jpeg';
    console.log('[OCR] Imagen descargada, tamaño:', buffer.length);
    return { imageBase64: buffer.toString('base64'), mediaType };
  }

  throw new Error('Sin imagen disponible');
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
        model: 'claude-sonnet-4-20250514',
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