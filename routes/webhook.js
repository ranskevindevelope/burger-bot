// webhook.js — Procesa los mensajes de WhatsApp que llegan de OpenWA
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const config = require('../config');
const { leerComprobante } = require('../ocr');
const { verificarPorGmail } = require('../gmail');
const { verificarPago } = require('../verificador');
const { guardarPago, buscarDuplicadoReciente } = require('../db');
const { enviarMensaje } = require('../bot/openwa');
const { formatearResultado, guardarFoto } = require('../bot/utils');
const { pagosPendientes, historialPagos } = require('../bot/state');
const comandos = require('../bot/comandos');

const NEGOCIO = config.NEGOCIO_NOMBRE;

const MENSAJES = {
  procesando: `⏳ Verificando el pago... un momento.`,
  sinFoto: `Por favor envía la *foto del comprobante*, no texto.`,
  errorLectura: `No pude leer bien ese comprobante. Asegúrate de que la imagen sea clara y completa.`,
};

// Mapeo de LID (OpenWA) a números reales
const lidMap = {
  '234668473466924@lid': '573045530381@c.us',
  '61856135819279@lid': '573013411244@c.us',
  '165369796944036@lid': '573167064671@c.us',
  '241759531581483@c.us': '573044372639@c.us',
};

// ─── Middleware: validar secreto del webhook ─────────────
router.use((req, res, next) => {
  const recibido = req.get('X-Webhook-Secret');
  const INBOUND_WEBHOOK_SECRET = config.INBOUND_WEBHOOK_SECRET;
  if (!INBOUND_WEBHOOK_SECRET) return res.status(503).json({ ok: false, error: 'Integración no configurada' });
  if (
    typeof recibido !== 'string' ||
    recibido.length !== INBOUND_WEBHOOK_SECRET.length ||
    !crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(INBOUND_WEBHOOK_SECRET))
  ) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  next();
});

// ─── Endpoint retirado: MacroDroid y la app Android ya no se usan
router.post('/pago-recibido', (req, res) => {
  res.status(410).json({ ok: false, error: 'Este endpoint ya no está disponible' });
});

// ─── Webhook principal ───────────────────────────────────
router.post('/', async (req, res) => {
  res.sendStatus(202);

  const evento = req.body;
  console.log('[Webhook] Evento completo:', JSON.stringify(evento).slice(0, 500));

  if (evento.event === 'test') {
    console.log('[Webhook] Evento de prueba ignorado');
    return;
  }

  const data = evento.data || evento;

  const rawId = data.chatId || data.from || '';
  const from = lidMap[rawId] || rawId;

  const body = (data.body || data.text || data.content || data.message?.conversation || '').trim().toLowerCase();
  const mediaUrl = data.mediaUrl || data.media?.url || data.message?.imageMessage?.url || '';
  const mediaBase64 = data.media?.data || '';
  const mediaType = data.mimetype || data.media?.mimetype || data.message?.imageMessage?.mimetype || '';
  const isMedia = data.hasMedia || data.type === 'image' || mediaUrl !== '';

  console.log('[Webhook] from:', from, '| body:', body, '| isMedia:', isMedia);

  if (!from) {
    console.log('[Webhook] Sin remitente, ignorando');
    return;
  }

  if (data.fromMe || data.key?.fromMe) {
    console.log('[Webhook] Mensaje propio ignorado');
    return;
  }

  // ─── Lista blanca: solo empleados autorizados ─────────
  if (!comandos.NUMEROS_AUTORIZADOS.includes(from)) {
    console.log('[Webhook] Remitente no autorizado, ignorando:', from);
    return;
  }

  console.log(`[Bot] Mensaje de ${from}: ${body || '[imagen]'}`);

  // ─── Texto simple → comandos ──────────────────────────
  if (!isMedia) {
    try {
      const cmdResult = await comandos.handleTextEvent(from, body);
      if (cmdResult) return; // el módulo de comandos ya envió las respuestas
    } catch (err) {
      console.error('[Webhook] Error al procesar texto:', err.message);
    }
    await enviarMensaje(from, MENSAJES.sinFoto);
    return;
  }

  // ─── Es media (imagen) ────────────────────────────────
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

    if (!datos.monto || datos.monto === 'null' || isNaN(parseFloat(datos.monto))) {
      await enviarMensaje(from, '⚠️ Esta imagen no parece un comprobante de pago. Por favor envía la captura de pantalla de la transferencia.');
      return;
    }

    const montoNum = parseInt(datos.monto);
    const nombreFoto = mediaBase64 ? guardarFoto(mediaBase64, datos.referencia) : null;

    // ─── Verificar duplicado en la base (últimos 7 días) ─
    if (datos.referencia) {
      const duplicado = await buscarDuplicadoReciente(datos.referencia);
      if (duplicado) {
        await enviarMensaje(from,
          `🚫 DUPLICADO: Este comprobante (Ref: ${datos.referencia}) ya fue verificado el ${duplicado.fecha} a las ${duplicado.hora}.\n\n` +
          `👤 Cliente: ${duplicado.nombre_cliente || 'No registrado'}\n` +
          `💵 Monto: $${duplicado.monto.toLocaleString('es-CO')}\n\n` +
          `No puedes usarlo de nuevo.`
        );
        await guardarPago({
          monto: montoNum,
          referencia: datos.referencia,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          estado: 'DUPLICADO',
          fuente: 'duplicado',
          nombre_cliente: null,
          verificado_por: from,
          negocio_id: 1,
          foto: nombreFoto,
        });
        return;
      }
    }

    // ─── Verificar el pago por Gmail ────────────────────
    console.log(`[DEBUG] Verificando en Gmail $${montoNum}...`);
    const pagoGmail = await verificarPorGmail(datos.monto);
    console.log('[DEBUG] Resultado de Gmail:', pagoGmail);

    // ─── Determinar resultado final ─────────────────────
    const verificacion = pagoGmail
      ? { estado: 'REAL', mensaje: `✅ PAGO CONFIRMADO: $${pagoGmail.monto.toLocaleString('es-CO')}  este pago es confirmado en Bancolombia` }
      : await verificarPago(datos);

    // ─── Guardar el pago en la base de datos ────────────
    if (verificacion.estado === 'REAL') {
      try {
        await guardarPago({
          monto: montoNum,
          referencia: datos.referencia || null,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          estado: 'REAL',
          fuente: pagoGmail ? 'gmail' : 'otro',
          nombre_cliente: pagoGmail?.nombre || null,
          verificado_por: from,
          negocio_id: 1,
          foto: nombreFoto,
        });
        console.log('[DB] Pago guardado en base de datos');
      } catch (err) {
        console.error('[DB] Error guardando pago:', err.message);
      }
    } else if (verificacion.estado === 'NO_ENCONTRADO') {
      try {
        await guardarPago({
          monto: montoNum,
          referencia: datos.referencia || null,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          estado: 'NO_ENCONTRADO',
          fuente: 'pendiente',
          nombre_cliente: null,
          verificado_por: from,
          negocio_id: 1,
          foto: nombreFoto,
        });
        console.log('[DB] Pago pendiente guardado en base de datos');
      } catch (err) {
        console.error('[DB] Error guardando pendiente:', err.message);
      }
    }

    // ─── Historial en memoria ───────────────────────────
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

    // ─── Alertas para estados que requieren atención ────
    if (['NO_ENCONTRADO', 'DUPLICADO', 'MONTO_INCORRECTO'].includes(verificacion.estado)) {
      const alerta = `🚨 *ALERTA — ${NEGOCIO}*\n\n${verificacion.mensaje}\n\nEmpleado: ${from}\nHora: ${new Date().toLocaleTimeString('es-CO')}`;
      await enviarMensaje(process.env.MY_WHATSAPP, alerta);

      if (verificacion.estado === 'NO_ENCONTRADO') {
        pagosPendientes.push({
          monto: montoNum,
          referencia: datos.referencia || null,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          empleado: from,
          foto: mediaBase64 ? guardarFoto(mediaBase64, datos.referencia) : null,
        });
        console.log(`[Pendientes] Pago de $${montoNum} guardado para verificación nocturna. Total pendientes: ${pagosPendientes.length}`);
      }
    }
  } catch (err) {
    console.error('[Bot] Error procesando imagen:', err);
    await enviarMensaje(from, '⚠️ Error interno. Intenta de nuevo o llama al dueño.');
  }
});

module.exports = router;
