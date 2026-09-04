// webhook.js — Procesa los mensajes de WhatsApp que llegan de OpenWA (multi-negocio)
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const config = require('../config');
const { leerComprobante } = require('../ocr');
const { verificarPorGmail } = require('../gmail');
const { verificarPago } = require('../verificador');
const {
  db, guardarPago, buscarDuplicadoReciente, contarComprobantesDelMes, obtenerNegocio, verificarTrialActivo,
  marcarNegocioPagado, actualizarPagoPlataforma, obtenerAdminDeNegocio,
} = require('../db');
const { enviarMensaje, descargarMediaMeta } = require('../bot/openwa');
const { formatearResultado, guardarFoto } = require('../bot/utils');
const { pagosPendientes, historialPagos } = require('../bot/state');
const comandos = require('../bot/comandos');
const { obtenerTransferenciaEsperada, limpiarTransferenciaEsperada } = require('./wompi');
const { enviarGraciasPago } = require('../mailer');

// ─── Pago de la suscripción de FlashPago por transferencia manual ──
// Se dispara cuando el admin manda una foto y su negocio está "esperando"
// un comprobante de pago de plataforma (ver routes/wompi.js /transferencia/iniciar).
// Usa el mismo OCR que los comprobantes de clientes, y además cruza contra
// el Gmail conectado en config.NEGOCIO_ID_SUSCRIPCION (la cuenta bancaria
// real de FlashPago) — igual de confiable que la verificación de clientes,
// no le cree ciegamente a la imagen.
async function procesarPagoPlataforma(from, transferencia, mediaUrl, mediaBase64) {
  const { negocio_id } = transferencia;
  await enviarMensaje(from, '⏳ Verificando tu pago de suscripción...');
  try {
    const datos = await leerComprobante(mediaUrl, mediaBase64);
    if (datos.error || !datos.monto || isNaN(parseFloat(datos.monto))) {
      await enviarMensaje(from, '⚠️ No pude leer ese comprobante. Asegúrate de que la imagen sea clara, o contacta soporte para activar tu plan manualmente.');
      return;
    }

    const montoLeido = parseInt(datos.monto);
    if (montoLeido !== transferencia.montoPesos) {
      await actualizarPagoPlataforma(transferencia.referencia, { estado: 'RECHAZADO' });
      await enviarMensaje(from,
        `⚠️ El monto del comprobante ($${montoLeido.toLocaleString('es-CO')}) no coincide con el valor de tu plan ($${transferencia.montoPesos.toLocaleString('es-CO')}). ` +
        `Contacta soporte para activarlo manualmente.`
      );
      return;
    }

    // El monto de la imagen coincide — ahora se confirma contra la notificación
    // real del banco antes de activar nada. 5 intentos cada 30s ≈ 2 minutos
    // de margen (más que los 10s/4 intentos del flujo de clientes, porque acá
    // no hay nadie esperando en el chat con el "verificando..." a la vista).
    const confirmadoPorBanco = await verificarPorGmail(montoLeido, config.NEGOCIO_ID_SUSCRIPCION, {
      intentos: 5,
      esperaMs: 30000,
    });

    if (confirmadoPorBanco) {
      await marcarNegocioPagado(negocio_id, transferencia.plan);
      await actualizarPagoPlataforma(transferencia.referencia, { estado: 'APROBADO' });
      limpiarTransferenciaEsperada(from);
      await enviarMensaje(from, `✅ ¡Pago confirmado! Tu plan quedó activo. Gracias por confiar en FlashPago. 🚀`);

      try {
        const admin = await obtenerAdminDeNegocio(negocio_id);
        if (admin) await enviarGraciasPago(admin.email, admin.nombre, transferencia.plan, transferencia.montoPesos * 100);
      } catch (e) {
        console.error('[PagoPlataforma] Error enviando correo de agradecimiento:', e.message);
      }
    } else {
      // El monto de la foto coincide, pero el banco todavía no confirma la
      // transferencia — queda en revisión manual, no se activa solo.
      await enviarMensaje(from,
        `⏳ Recibí tu comprobante, pero todavía no veo la confirmación del banco. Tu pago queda en revisión — te avisamos apenas se confirme, o contactanos si pasa mucho tiempo.`
      );
      try {
        await enviarMensaje(`${config.ADMIN_SUSCRIPCION_WHATSAPP}@c.us`,
          `🚨 *Pago de suscripción sin confirmar por banco*\n\nNegocio: ${negocio_id}\nPlan: ${transferencia.plan}\nMonto leído: $${montoLeido.toLocaleString('es-CO')}\nReferencia: ${transferencia.referencia}\n\nRevisar manualmente.`
        );
      } catch (e) {
        console.error('[PagoPlataforma] Error alertando al admin:', e.message);
      }
    }
  } catch (err) {
    console.error('[PagoPlataforma] Error:', err.message);
    await enviarMensaje(from, '⚠️ Error verificando tu pago. Contacta soporte.');
  }
}

const MENSAJES = {
  procesando: `⏳ Verificando el pago... un momento.`,
  sinFoto: `Por favor envía la *foto del comprobante*, no texto.`,
  errorLectura: `No pude leer bien ese comprobante. Asegúrate de que la imagen sea clara y completa.`,
  limitePlan: `⚠️ Este negocio alcanzó el límite de comprobantes del mes. Contacta al administrador para mejorar el plan.`,
};

// Mapeo de LID (OpenWA) a números reales
const lidMap = {
  '234668473466924@lid': '573045530381@c.us',
  '61856135819279@lid': '573013411244@c.us',
  '165369796944036@lid': '573167064671@c.us',
  '241759531581483@c.us': '573044372639@c.us',
};

// ─── Cache de empleados → negocio (se refresca cada 5 min) ──
let empleadoCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutos

function cargarEmpleados() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT u.whatsapp, u.negocio_id, n.nombre AS negocio_nombre, n.activo AS negocio_activo
       FROM usuarios u
       JOIN negocios n ON n.id = u.negocio_id
       WHERE u.activo = 1 AND u.whatsapp IS NOT NULL`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        const mapa = {};
        for (const r of rows) {
          // Normalizar: guardar con y sin @c.us
          const num = r.whatsapp.includes('@') ? r.whatsapp : `${r.whatsapp}@c.us`;
          mapa[num] = { negocio_id: r.negocio_id, negocio_nombre: r.negocio_nombre, negocio_activo: r.negocio_activo };
        }
        empleadoCache = mapa;
        cacheTimestamp = Date.now();
        console.log(`[Cache] ${Object.keys(mapa).length} empleados cargados`);
        resolve(mapa);
      }
    );
  });
}

async function getEmpleadoInfo(whatsapp) {
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    try { await cargarEmpleados(); } catch (e) { console.error('[Cache] Error:', e.message); }
  }
  return empleadoCache[whatsapp] || null;
}

// Cargar al iniciar (esperar 2s para que migraciones de DB terminen)
setTimeout(() => {
  cargarEmpleados().catch(e => console.error('[Cache] Error inicial:', e.message));
}, 2000);

// ─── Verificación del webhook (handshake de Meta) ────────
// Meta llama a esta ruta con GET al configurar el webhook en su panel.
// Solo aplica si WA_PROVIDER=meta; con open-wa no se usa.
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && config.META_VERIFY_TOKEN && token === config.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ─── Middleware: validar autenticidad del webhook ────────
// open-wa: secreto plano en header. meta: firma HMAC del body crudo.
router.use((req, res, next) => {
  if (config.WA_PROVIDER === 'meta') {
    const appSecret = config.META_APP_SECRET;
    if (!appSecret) return res.status(503).json({ ok: false, error: 'Integración no configurada' });
    const firmaRecibida = req.get('X-Hub-Signature-256') || '';
    const firmaEsperada = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
    const bufRecibido = Buffer.from(firmaRecibida);
    const bufEsperado = Buffer.from(firmaEsperada);
    if (bufRecibido.length !== bufEsperado.length || !crypto.timingSafeEqual(bufRecibido, bufEsperado)) {
      return res.status(401).json({ ok: false, error: 'Firma inválida' });
    }
    return next();
  }

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

  let from, body, isMedia, mediaUrl = '', mediaBase64 = '', mediaType = '';

  if (config.WA_PROVIDER === 'meta') {
    // ─── Formato de la API oficial de Meta ────────────────
    const value = evento.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) {
      console.log('[Webhook] Evento de Meta sin mensaje (status/delivery), ignorado');
      return;
    }

    from = `${msg.from}@c.us`;
    body = (msg.type === 'text' ? (msg.text?.body || '') : '').trim().toLowerCase();
    isMedia = msg.type === 'image';

    if (isMedia) {
      try {
        const media = await descargarMediaMeta(msg.image.id);
        mediaBase64 = media.base64;
        mediaType = media.mimetype;
      } catch (err) {
        console.error('[Webhook][Meta] Error descargando imagen:', err.message);
        await enviarMensaje(from, MENSAJES.errorLectura);
        return;
      }
    }
  } else {
    // ─── Formato de OpenWA (no oficial) ───────────────────
    const data = evento.data || evento;

    const rawId = data.chatId || data.from || '';
    from = lidMap[rawId] || rawId;

    body = (data.body || data.text || data.content || data.message?.conversation || '').trim().toLowerCase();
    mediaUrl = data.mediaUrl || data.media?.url || data.message?.imageMessage?.url || '';
    mediaBase64 = data.media?.data || '';
    mediaType = data.mimetype || data.media?.mimetype || data.message?.imageMessage?.mimetype || '';
    isMedia = data.hasMedia || data.type === 'image' || mediaUrl !== '';

    if (data.fromMe || data.key?.fromMe) return;
  }

  console.log('[Webhook] from:', from, '| body:', body, '| isMedia:', isMedia);

  if (!from) return;

  // ─── Buscar empleado y su negocio ─────────────────────
  const empleado = await getEmpleadoInfo(from);

  if (!empleado) {
    // Fallback: si está en lista vieja de comandos, usar negocio 1
    if (!comandos.NUMEROS_AUTORIZADOS.includes(from)) {
      console.log('[Webhook] Remitente no autorizado:', from);
      return;
    }
  }

  const negocio_id = empleado?.negocio_id || 1;
  const negocio_nombre = empleado?.negocio_nombre || config.NEGOCIO_NOMBRE;

  if (empleado && !empleado.negocio_activo) {
    await enviarMensaje(from, '⚠️ Este negocio está desactivado. Contacta al administrador.');
    return;
  }

  console.log(`[Bot] Mensaje de ${from} (negocio: ${negocio_nombre}): ${body || '[imagen]'}`);

  // ─── Texto simple → comandos ──────────────────────────
  if (!isMedia) {
    try {
      const cmdResult = await comandos.handleTextEvent(from, body, negocio_id);
      if (cmdResult) return;
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

  // ─── ¿Es un comprobante de pago de la suscripción a FlashPago? ──
  // Va antes del trial/límite: si el negocio está intentando pagar
  // justo porque venció el trial, no lo bloqueamos acá. Se busca por el
  // WhatsApp exacto del remitente (no por negocio_id), para que un
  // empleado mandando un comprobante real de cliente en la misma ventana
  // no se confunda con el pago de suscripción del admin.
  const transferenciaEsperada = obtenerTransferenciaEsperada(from);
  if (transferenciaEsperada) {
    await procesarPagoPlataforma(from, transferenciaEsperada, mediaUrl, mediaBase64);
    return;
  }

  // ─── Verificar trial activo ─────────────────────────────
  try {
    const trial = await verificarTrialActivo(negocio_id);
    if (!trial.activo && trial.razon === 'trial_expirado') {
      await enviarMensaje(from,
        `🔒 *Prueba finalizada*\n\n` +
        `Tu periodo de prueba de 15 días ha terminado. Para seguir verificando comprobantes, elige un plan en el dashboard:\n\n` +
        `🔗 https://flashpago.co/panel`
      );
      console.log(`[Trial] Negocio ${negocio_id} trial expirado`);
      return;
    }
  } catch (err) {
    console.error('[Trial] Error verificando:', err.message);
  }

  // ─── Verificar límite del plan ────────────────────────
  let negocio;
  try {
    negocio = await obtenerNegocio(negocio_id);
    if (negocio) {
      const usados = await contarComprobantesDelMes(negocio_id);
      if (usados >= negocio.limite_comprobantes) {
        await enviarMensaje(from, MENSAJES.limitePlan);
        console.log(`[Plan] Negocio ${negocio_id} alcanzó límite: ${usados}/${negocio.limite_comprobantes}`);
        return;
      }
    }
  } catch (err) {
    console.error('[Plan] Error verificando límite:', err.message);
    // Continuar de todas formas
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

    // ─── Verificar duplicado (filtrado por negocio) ─────
    if (datos.referencia) {
      const duplicado = await buscarDuplicadoReciente(datos.referencia, negocio_id);
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
          negocio_id,
          foto: nombreFoto,
        });
        return;
      }
    }

    // ─── Verificar el pago por Gmail (por negocio) ──────
    console.log(`[DEBUG] Verificando en Gmail $${montoNum} (negocio ${negocio_id})...`);
    const pagoGmail = await verificarPorGmail(datos.monto, negocio_id);
    console.log('[DEBUG] Resultado de Gmail:', pagoGmail);

    // ─── Determinar resultado final ─────────────────────
    const verificacion = pagoGmail
      ? { estado: 'REAL', mensaje: `✅ PAGO CONFIRMADO: $${pagoGmail.monto.toLocaleString('es-CO')}  este pago es confirmado en ${negocio?.banco || 'tu banco'}` }
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
          negocio_id,
          foto: nombreFoto,
        });
        console.log('[DB] Pago guardado (negocio:', negocio_id, ')');
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
          negocio_id,
          foto: nombreFoto,
        });
        console.log('[DB] Pago pendiente guardado (negocio:', negocio_id, ')');
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
      negocio_id,
    });

    const respuesta = formatearResultado(datos, verificacion);
    await enviarMensaje(from, respuesta);

    // ─── Alertas para estados que requieren atención ────
    if (['NO_ENCONTRADO', 'DUPLICADO', 'MONTO_INCORRECTO'].includes(verificacion.estado)) {
      const alerta = `🚨 *ALERTA — ${negocio_nombre}*\n\n${verificacion.mensaje}\n\nEmpleado: ${from}\nHora: ${new Date().toLocaleTimeString('es-CO')}`;
      await enviarMensaje(process.env.MY_WHATSAPP, alerta);

      if (verificacion.estado === 'NO_ENCONTRADO') {
        pagosPendientes.push({
          monto: montoNum,
          referencia: datos.referencia || null,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          empleado: from,
          negocio_id,
          foto: mediaBase64 ? guardarFoto(mediaBase64, datos.referencia) : null,
        });
        console.log(`[Pendientes] Pago de $${montoNum} guardado (negocio ${negocio_id}). Total pendientes: ${pagosPendientes.length}`);
      }
    }
  } catch (err) {
    console.error('[Bot] Error procesando imagen:', err);
    await enviarMensaje(from, '⚠️ Error interno. Intenta de nuevo o llama al dueño.');
  }
});

module.exports = router;