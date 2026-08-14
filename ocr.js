// ocr.js — Extrae datos del comprobante usando DeepSeek-V4-Flash o Claude
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

function extraerJsonDesdeTexto(texto) {
  console.log('[OCR] Intentando extraer JSON de:', texto);
  
  // Intentar encontrar JSON con múltiples patrones
  let match = texto.match(/\{[\s\S]*\}/);
  if (!match) {
    // Intentar con backticks
    match = texto.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error('[OCR] Error parseando JSON desde backticks:', e.message);
      }
    }
    
    // Intentar encontrar cualquier cosa que parezca JSON
    const jsonMatch = texto.match(/\{[^{]*"banco"[^}]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[OCR] Error parseando JSON parcial:', e.message);
      }
    }
    
    throw new Error('No se encontró JSON en la respuesta del modelo');
  }
  
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    console.error('[OCR] Error parseando JSON:', err.message, 'Contenido:', match[0]);
    throw new Error(`Error parseando JSON: ${err.message}`);
  }
}

async function leerComprobante(urlImagen, base64Data) {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const claudeKey = process.env.CLAUDE_API_KEY;

  console.log('[OCR] DeepSeek key configurada:', deepseekKey ? 'SÍ' : 'NO');
  console.log('[OCR] Claude key configurada:', claudeKey ? 'SÍ' : 'NO');

  if (!deepseekKey && !claudeKey) {
    console.log('[OCR] Error: el servicio de lectura no está disponible');
    return {
      error: true,
      mensaje: '⚠️ Nuestro servicio está fallando en este momento. Volveremos lo más pronto posible.\n\n📞 Por favor contacta al administrador para verificar este pago manualmente.'
    };
  }

  try {
    let imageBase64 = '';
    let mediaType = 'image/jpeg';

    if (base64Data) {
      imageBase64 = base64Data;
      console.log('[OCR] Usando base64 del webhook, longitud:', imageBase64.length);
    } else if (urlImagen) {
      console.log('[OCR] Descargando imagen desde URL:', urlImagen);
      const imgResponse = await fetch(urlImagen);
      const buffer = await imgResponse.buffer();
      imageBase64 = buffer.toString('base64');
      mediaType = imgResponse.headers.get('content-type') || 'image/jpeg';
      console.log('[OCR] Imagen descargada, tamaño:', buffer.length, 'tipo:', mediaType);
    } else {
      throw new Error('Sin imagen disponible');
    }

    const prompt = `Eres un experto en comprobantes de pago colombianos. Analiza esta imagen y extrae los datos.

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

parece_falso = true si la imagen está borrosa, editada, cortada o los datos no son coherentes.`;

    // PRIMERO INTENTAR CON DEEPSEEK
    if (deepseekKey) {
      console.log('[OCR] Intentando con DeepSeek-V4-Flash...');
      
      const requestBody = {
        model: 'deepseek-v4-flash',
        max_tokens: 300,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      };
      
      console.log('[OCR] Enviando request a DeepSeek...');
      
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[OCR] DeepSeek respuesta completa:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error('[OCR] Error DeepSeek:', data.error);
        throw new Error(`DeepSeek error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      const texto = data.choices?.[0]?.message?.content || '';
      console.log('[OCR] DeepSeek contenido:', texto);
      
      // Si la respuesta está vacía, intentar con Claude
      if (!texto || texto.trim() === '') {
        console.log('[OCR] DeepSeek devolvió respuesta vacía');
        if (claudeKey) {
          console.log('[OCR] Intentando con Claude como fallback...');
          return await usarClaude(imageBase64, mediaType, prompt, claudeKey);
        }
        throw new Error('DeepSeek devolvió respuesta vacía');
      }
      
      const json = extraerJsonDesdeTexto(texto);
      console.log('[OCR] DeepSeek JSON parseado:', json);
      return json;
    }

    // SI NO HAY DEEPSEEK, USAR CLAUDE
    if (claudeKey) {
      console.log('[OCR] Usando Claude directamente...');
      return await usarClaude(imageBase64, mediaType, prompt, claudeKey);
    }

    throw new Error('No hay proveedor de OCR configurado');
  } catch (err) {
    console.error('[OCR] Error principal:', err.message);
    console.error('[OCR] Stack:', err.stack);
    
    // Intentar con fallback si hay Claude y DeepSeek falló
    if (process.env.DEEPSEEK_API_KEY && process.env.CLAUDE_API_KEY && err.message.includes('DeepSeek')) {
      console.log('[OCR] Intentando con Claude como fallback después de error...');
      try {
        // Reconstruir imagen para Claude
        let imageBase64 = base64Data;
        let mediaType = 'image/jpeg';
        
        if (!imageBase64 && urlImagen) {
          const imgResponse = await fetch(urlImagen);
          const buffer = await imgResponse.buffer();
          imageBase64 = buffer.toString('base64');
          mediaType = imgResponse.headers.get('content-type') || 'image/jpeg';
        }
        
        const prompt = `Eres un experto en comprobantes de pago colombianos. Analiza esta imagen y extrae los datos.

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

parece_falso = true si la imagen está borrosa, editada, cortada o los datos no son coherentes.`;
        
        return await usarClaude(imageBase64, mediaType, prompt, process.env.CLAUDE_API_KEY);
      } catch (fallbackErr) {
        console.error('[OCR] Fallback Claude también falló:', fallbackErr.message);
      }
    }
  }

  console.log('[OCR] Error: el servicio de lectura no está disponible');
  return {
    error: true,
    mensaje: '⚠️ Nuestro servicio está fallando en este momento. Volveremos lo más pronto posible.\n\n📞 Por favor contacta al administrador para verificar este pago manualmente.'
  };
}

// Función auxiliar para Claude
async function usarClaude(imageBase64, mediaType, prompt, claudeKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    console.log('[OCR] Claude respuesta:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('[OCR] Error Claude:', data.error);
      throw new Error(`Claude error: ${data.error.message}`);
    }
    
    const texto = data.content?.[0]?.text || '';
    console.log('[OCR] Claude contenido:', texto);
    const json = extraerJsonDesdeTexto(texto);
    console.log('[OCR] Claude JSON parseado:', json);
    return json;
  } catch (err) {
    console.error('[OCR] Error en Claude:', err.message);
    throw err;
  }
}

module.exports = { leerComprobante, extraerDatos };