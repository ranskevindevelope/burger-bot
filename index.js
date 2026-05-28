// index.js — Bot verificador de pagos para Hamburguesas
// WhatsApp via OpenWA (local) + OCR + Verificación bancaria

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { leerComprobante } = require('./ocr');
const { verificarPago } = require('./verificador');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

const NEGOCIO = process.env.NEGOCIO_NOMBRE || 'VinsonBurgers';

// ─── Config OpenWA ────────────────────────────────────────
const OPENWA_URL     = process.env.OPENWA_URL     || 'http://localhost:2785';
const OPENWA_KEY     = process.env.OPENWA_API_KEY || 'dev-admin-key';
const OPENWA_SESSION = process.env.OPENWA_SESSION || 'vinson';

// ─── Mensajes del bot ─────────────────────────────────────
const MENSAJES = {
  bienvenida: `💵 *${NEGOCIO}* — Verificador de Pagos\n\nHola! Soy el asistente de verificación de pagos.\n\nEnvíame la *foto del comprobante* de transferencia y te digo en segundos si el pago es real.`,
  procesando: `⏳ Verificando el pago... un momento.`,
  sinFoto: `Por favor envía la *foto del comprobante*, no texto.`,
  errorLectura: `No pude leer bien ese comprobante. Asegúrate de que la imagen sea clara y completa.`,
  ayuda: `Comandos disponibles:\n• Escribe *cerrar* para terminar la conversacion\n• Envía una *foto* del comprobante para verificar\n• Escribe *historial* para ver los últimos pagos\n• Escribe *hola* para reiniciar`,
};

// ─── Enviar mensaje WhatsApp via OpenWA ───────────────────
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
    );7
    const data = await res.json();
    console.log('[Bot] Mensaje enviado a', chatId, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot] Error enviando mensaje:', err.message);
  }
}

// ─── Formatear resultado de verificación ─────────────────
function formatearResultado(datos, verificacion) {
  const lineas = [verificacion.mensaje, ''];
  if (datos.banco)      lineas.push(`🏦 Banco: ${datos.banco}`);
  if (datos.monto)      lineas.push(`💵 Monto: $${parseFloat(datos.monto).toLocaleString('es-CO')}`);
  if (datos.referencia) lineas.push(`🔑 Referencia: ${datos.referencia}`);
  if (datos.fecha)      lineas.push(`📅 Fecha: ${datos.fecha}`);
  lineas.push('');
  if (verificacion.estado === 'REAL')                lineas.push('✅ Puedes preparar el pedido.');
  else if (verificacion.estado === 'DUPLICADO')       lineas.push('🚫 NO entregues. Comprobante ya utilizado.');
  else if (verificacion.estado === 'NO_ENCONTRADO')   lineas.push('🚫 NO entregues. Llama al dueño si el cliente insiste.');
  else if (verificacion.estado === 'MONTO_INCORRECTO') lineas.push('🚫 NO entregues. Montos no coinciden.');
  return lineas.join('\n');
}

// ─── Historial de pagos recientes ────────────────────────
const historialPagos = [];

// ─── Webhook — OpenWA envía los mensajes aquí ─────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const evento = req.body;
  console.log('[Webhook] Evento completo:', JSON.stringify(evento).slice(0, 500));

  // Ignorar eventos de prueba
  if (evento.event === 'test') {
    console.log('[Webhook] Evento de prueba ignorado');
    return;
  }

  // OpenWA manda los datos dentro de evento.data
  const data = evento.data || evento;

  // Extraer campos según estructura de OpenWA
  // OpenWA usa @lid internamente, mapeamos al número real
   const lidMap = {
  '165369796944036@lid': '573167064671@c.us',
  '234668473466924@lid': '573045530381@c.us',

    };
  const rawId = data.chatId || data.from || '';
  const from = lidMap[rawId] || rawId;

  const body      = (data.body || data.text || data.content || data.message?.conversation || '').trim().toLowerCase();
  const mediaUrl  = data.mediaUrl || data.media?.url || data.message?.imageMessage?.url || '';
  const mediaBase64 = data.media?.data || '';
  const mediaType = data.mimetype || data.media?.mimetype || data.message?.imageMessage?.mimetype || '';
  const isMedia   = data.hasMedia || data.type === 'image' || mediaUrl !== '';

  console.log('[Webhook] from:', from, '| body:', body, '| isMedia:', isMedia);

  if (!from) {
    console.log('[Webhook] Sin remitente, ignorando');
    return;
  }

  // Ignorar mensajes propios del bot
  if (data.fromMe || data.key?.fromMe) {
    console.log('[Webhook] Mensaje propio ignorado');
    return;
  }

  console.log(`[Bot] Mensaje de ${from}: ${body || '[imagen]'}`);

  // ─── Procesamiento de imagen ──────────────────────────
  if (isMedia) {
    if (mediaType && !mediaType.startsWith('image/')) {
      await enviarMensaje(from, '⚠️ Solo acepto imágenes de comprobantes. Envía una foto.');
      return;
    }

    await enviarMensaje(from, MENSAJES.procesando);

    try {
      const datos = await leerComprobante(mediaUrl, mediaBase64);
      if (datos.error) {
        await enviarMensaje(from, MENSAJES.errorLectura);
        return;
      }

      // Buscar en pagos recibidos por SMS
const montoNum = parseInt(datos.monto);
let pagoSMS = null;

for (const [key, pago] of pagosRecibidos.entries()) {
  if (Math.abs(parseInt(pago.monto) - montoNum) < 100) {
    pagoSMS = pago;
    pagosRecibidos.delete(key);
    break;
  }
}

const verificacion = pagoSMS
  ? { estado: 'REAL', mensaje: `✅ PAGO VERIFICADO por SMS: $${montoNum.toLocaleString('es-CO')} recibido de ${pagoSMS.nombre} a las ${pagoSMS.hora}` }
  : await verificarPago(datos);

      historialPagos.push({
        estado:     verificacion.estado,
        monto:      datos.monto      || '?',
        banco:      datos.banco      || '?',
        referencia: datos.referencia || '?',
        hora:       new Date().toLocaleTimeString('es-CO'),
        empleado:   from,
      });

      const respuesta = formatearResultado(datos, verificacion);
      await enviarMensaje(from, respuesta);

      if (['NO_ENCONTRADO', 'DUPLICADO', 'MONTO_INCORRECTO'].includes(verificacion.estado)) {
        const alerta = `🚨 *ALERTA — ${NEGOCIO}*\n\n${verificacion.mensaje}\n\nEmpleado: ${from}\nHora: ${new Date().toLocaleTimeString('es-CO')}`;
        await enviarMensaje(process.env.MY_WHATSAPP, alerta);
      }

    } catch (err) {
      console.error('[Bot] Error procesando imagen:', err);
      await enviarMensaje(from, '⚠️ Error interno. Intenta de nuevo o llama al dueño.');
    }
    return;
  }

  // ─── Comandos de texto ────────────────────────────────
  if (['hola', 'inicio', 'start', 'hi'].includes(body)) {
    await enviarMensaje(from, MENSAJES.bienvenida);
    return;
  }

  if (body === 'historial') {
    if (historialPagos.length === 0) {
      await enviarMensaje(from, 'No hay pagos verificados aún hoy.');
    } else {
      const lista = historialPagos.slice(-5).map((p, i) =>
        `${i + 1}. ${p.estado} — $${p.monto} — ${p.banco} — ${p.hora}`
      ).join('\n');
      await enviarMensaje(from, `📊 Últimos pagos verificados:\n\n${lista}`);
    }
    return;
  }

  if (body === 'cerrar') {
    await enviarMensaje(from, '👋 Conversación cerrada. Felices ventas!!😁. Escribe *hola* para volver a empezar.');
    return;
  }

  if (['ayuda', 'help', '?'].includes(body)) {
    await enviarMensaje(from, MENSAJES.ayuda);
    return;
  }

  await enviarMensaje(from, MENSAJES.sinFoto);
});

// ─── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    negocio: NEGOCIO,
    pagosVerificados: historialPagos.length,
    hora: new Date().toLocaleString('es-CO'),
  });
});

// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
// Base de pagos recibidos por SMS
const pagosRecibidos = new Map();

// Endpoint que recibe pagos desde la app Android
app.post('/pago-recibido', (req, res) => {
  res.sendStatus(200);
  const { nombre, monto, fecha } = req.body;
  if (!monto) return;
  const key = `${monto}-${new Date().toLocaleDateString('es-CO')}`;
  pagosRecibidos.set(key, { nombre, monto, fecha, hora: new Date().toLocaleTimeString('es-CO') });
  console.log(`[SMS] ✅ Pago recibido: $${monto} de ${nombre}`);
});
app.listen(PORT, () => {
  console.log(`\n🍔 Bot ${NEGOCIO} corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`🔗 Configura OpenWA Dashboard para apuntar a este webhook\n`);
});
