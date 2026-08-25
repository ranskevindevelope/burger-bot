// webhook.js — Procesa los mensajes de WhatsApp que llegan de OpenWA (multi-negocio)
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const config = require('../config');
const { leerComprobante } = require('../ocr');
const { verificarPorGmail } = require('../gmail');
const { verificarPago } = require('../verificador');
const { db, guardarPago, buscarDuplicadoReciente, contarComprobantesDelMes, obtenerNegocio, verificarTrialActivo } = require('../db');
const { enviarMensaje } = require('../bot/openwa');
const { formatearResultado, guardarFoto } = require('../bot/utils');
const { pagosPendientes, historialPagos } = require('../bot/state');
const comandos = require('../bot/comandos');

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

  if (!from) return;
  if (data.fromMe || data.key?.fromMe) return;

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

  // ─── Verificar trial activo ─────────────────────────────
  try {
    const trial = await verificarTrialActivo(negocio_id);
    if (!trial.activo && trial.razon === 'trial_expirado') {
      await enviarMensaje(from,
        `🔒 *Prueba finalizada*\n\n` +
        `Tu periodo de prueba de 15 días ha terminado. Para seguir verificando comprobantes, elige un plan en el dashboard:\n\n` +
        `🔗 https://flashpago.duckdns.org/panel`
      );
      console.log(`[Trial] Negocio ${negocio_id} trial expirado`);
      return;
    }
  } catch (err) {
    console.error('[Trial] Error verificando:', err.message);
  }

  // ─── Verificar límite del plan ────────────────────────
  try {
    const negocio = await obtenerNegocio(negocio_id);
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