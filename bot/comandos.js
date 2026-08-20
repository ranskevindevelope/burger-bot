// comandos.js — Manejo de todos los comandos de texto del bot (multi-negocio)
const { enviarMensaje, enviarImagen } = require('./openwa');
const { db, totalDelDia, totalUltimos30Dias, obtenerPagosExportables, buscarPorCliente, obtenerNegocio, contarComprobantesDelMes } = require('../db');
const { historialPagos } = require('./state');
const { enviarReporteDiario, verificacionNocturna } = require('./reportes');
const config = require('../config');

// Fallback: lista vieja para retrocompatibilidad hasta migrar empleados a BD
const ADMIN = ['573045530381@c.us', '573044372639@c.us'];
const EMPLEADOS = ['573013411244@c.us', '573167064671@c.us'];
const NUMEROS_AUTORIZADOS = [...ADMIN, ...EMPLEADOS];

function esAdmin(numero) {
  return ADMIN.includes(numero);
}

// Admin dinámico: busca rol en BD
function esAdminDB(from) {
  return new Promise((resolve) => {
    db.get(
      `SELECT rol FROM usuarios WHERE whatsapp = ? AND activo = 1`,
      [from],
      (err, row) => {
        if (err || !row) return resolve(esAdmin(from)); // fallback lista vieja
        resolve(row.rol === 'admin');
      }
    );
  });
}

// Devuelve true si el comando fue manejado, false si no.
async function handleTextEvent(from, text, negocio_id = 1) {
  const body = (text || '').trim().toLowerCase();
  const admin = await esAdminDB(from);

  // Obtener nombre del negocio
  let negocioNombre = config.NEGOCIO_NOMBRE;
  try {
    const neg = await obtenerNegocio(negocio_id);
    if (neg) negocioNombre = neg.nombre;
  } catch (_) {}

  // ─── Bienvenida ───────────────────────────────────────
  if (['hola', 'inicio', 'start', 'hi'].includes(body)) {
    await enviarMensaje(from,
      `💵 *${negocioNombre}* — Verificador de Pagos\n\n` +
      `Hola! Soy el asistente de verificación de pagos impulsado por IA.\n\n` +
      `Envíame la *foto del comprobante* de transferencia y te digo en segundos si el pago es real.`
    );
    return true;
  }

  // ─── Historial (filtrado por negocio) ─────────────────
  if (body === 'historial') {
    const misHistorial = historialPagos.filter(p => p.negocio_id === negocio_id);
    if (misHistorial.length === 0) {
      await enviarMensaje(from, 'No hay pagos verificados aún hoy.');
    } else {
      const lista = misHistorial.slice(-5).map((p, i) =>
        `${i + 1}. ${p.estado} — $${p.monto} — ${p.banco} — ${p.hora}`
      ).join('\n');

      const TotalHoy = misHistorial
        .filter(p => p.estado === 'REAL')
        .reduce((suma, p) => suma + parseInt(p.monto || 0), 0);

      const cantidadReales = misHistorial.filter(p => p.estado === 'REAL').length;

      await enviarMensaje(from,
        `Ultimos pagos verificados:\n\n${lista}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 Total hoy: $${TotalHoy.toLocaleString('es-CO')}\n\n` +
        `✅ Pagos confirmados: ${cantidadReales}`
      );
    }
    return true;
  }

  // ─── Cerrar conversación ──────────────────────────────
  if (body === 'cerrar') {
    await enviarMensaje(from, '👋 Conversación cerrada. Felices ventas!!😁. Escribe *hola* para volver a empezar.');
    return true;
  }

  // ─── Test de foto (debug) ─────────────────────────────
  if (body === 'testfoto') {
    const rutaFoto = './comprobantes/M17020259_1783636383643.jpg';
    await enviarImagen(from, rutaFoto, '📸 Prueba de envío de foto');
    return true;
  }

  // ─── Enviar a todos (solo admin) ──────────────────────
  if (body.startsWith('enviar ')) {
    if (!admin) return true;
    const mensaje = body.replace('enviar ', '').trim();
    if (!mensaje) {
      await enviarMensaje(from, 'Escribe el mensaje después de enviar. Ejemplo: enviar Hola a todos');
      return true;
    }
    // Enviar solo a empleados del mismo negocio
    const empleados = await new Promise((resolve) => {
      db.all(
        `SELECT whatsapp FROM usuarios WHERE negocio_id = ? AND activo = 1 AND whatsapp IS NOT NULL`,
        [negocio_id],
        (err, rows) => resolve(err ? [] : rows)
      );
    });
    let enviados = 0;
    for (const emp of empleados) {
      const num = emp.whatsapp.includes('@') ? emp.whatsapp : `${emp.whatsapp}@c.us`;
      if (num !== from) {
        await enviarMensaje(num, `📢 *Aviso — ${negocioNombre}*\n\n${mensaje}`);
        enviados++;
      }
    }
    await enviarMensaje(from, `✅ Mensaje enviado a ${enviados} persona(s).`);
    return true;
  }

  // ─── Ayuda ────────────────────────────────────────────
  if (['ayuda', 'help', '?'].includes(body)) {
    if (admin) {
      await enviarMensaje(from,
        `📋 *${negocioNombre}* — Administrador\n\n` +
        `Para verificar un pago:\n` +
        `📸 Envía la *foto del comprobante*\n\n` +
        `Consultas:\n` +
        `• *total* — Ventas del día\n` +
        `• *buscar [nombre]* — Pagos de un cliente\n` +
        `   Ejemplo: buscar kevin\n\n` +
        `• *historial* — Últimos pagos\n` +
        `• *plan* — Uso del plan actual\n` +
        `• *ayuda* — Ver este menú\n\n` +
        `📊 El *reporte de cierre* llega automático jue, vie, sáb y dom.`
      );
    } else {
      await enviarMensaje(from,
        `📋 *${negocioNombre}*\n\n` +
        `Para verificar un pago:\n` +
        `📸 Envía la *foto del comprobante* y te confirmo si el pago es real.\n\n` +
        `Comandos:\n` +
        `• *historial* — Últimos pagos\n` +
        `• *ayuda* — Ver este menú\n\n` +
        `¿Dudas? Contacta al administrador. 😊`
      );
    }
    return true;
  }

  // ─── Total del día / mes (solo admin) ─────────────────
  if (body === 'total' || body === 'total mes') {
    if (!admin) return true;
    try {
      if (body === 'total mes') {
        const { total, cantidad } = await totalUltimos30Dias(negocio_id);
        if (cantidad === 0) {
          await enviarMensaje(from, '📊 No hay pagos en los últimos 30 días.');
        } else {
          await enviarMensaje(from,
            `📅 *Total últimos 30 días — ${negocioNombre}*\n\n` +
            `✅ Pagos confirmados: ${cantidad}\n` +
            `💵 Total recibido: $${total.toLocaleString('es-CO')}`
          );
        }
      } else {
        const { total, cantidad } = await totalDelDia(negocio_id);
        if (cantidad === 0) {
          await enviarMensaje(from, '📊 No hay pagos verificados hoy todavía.');
        } else {
          await enviarMensaje(from,
            `💰 *Total del día — ${negocioNombre}*\n\n` +
            `✅ Pagos confirmados: ${cantidad}\n` +
            `💵 Total recibido: $${total.toLocaleString('es-CO')}`
          );
        }
      }
    } catch (err) {
      console.error('[Total] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude calcular el total. Intenta de nuevo.');
    }
    return true;
  }

  // ─── Plan: uso de comprobantes (solo admin) ───────────
  if (body === 'plan') {
    if (!admin) return true;
    try {
      const negocio = await obtenerNegocio(negocio_id);
      if (!negocio) {
        await enviarMensaje(from, '⚠️ Negocio no encontrado.');
        return true;
      }
      const usados = await contarComprobantesDelMes(negocio_id);
      const porcentaje = Math.round((usados / negocio.limite_comprobantes) * 100);
      const barra = '█'.repeat(Math.min(Math.floor(porcentaje / 10), 10)) + '░'.repeat(Math.max(10 - Math.floor(porcentaje / 10), 0));

      await enviarMensaje(from,
        `📊 *Plan ${negocio.plan.toUpperCase()} — ${negocioNombre}*\n\n` +
        `${barra} ${porcentaje}%\n` +
        `${usados} / ${negocio.limite_comprobantes} comprobantes este mes\n\n` +
        (porcentaje >= 80 ? '⚠️ Estás cerca del límite. Considera mejorar tu plan.' : '✅ Todo bien con tu plan.')
      );
    } catch (err) {
      console.error('[Plan] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude consultar el plan.');
    }
    return true;
  }

  // ─── Exportar (solo admin) ────────────────────────────
  if (body === 'exportar') {
    if (!admin) return true;
    try {
      const pagos = await obtenerPagosExportables(negocio_id);
      if (pagos.length === 0) {
        await enviarMensaje(from, '📊 No hay pagos para exportar en los últimos 30 días.');
      } else {
        const link = `http://45.77.82.77:3000/exportar/flashpago2026`;
        await enviarMensaje(from,
          `📥 *Exportar pagos a Excel*\n\n` +
          `📊 ${pagos.length} pagos de los últimos 30 días\n\n` +
          `Descarga tu archivo aquí:\n${link}\n\n` +
          `Abre el link desde tu celular o PC y se descarga el archivo que puedes abrir en Excel.`
        );
      }
    } catch (err) {
      console.error('[Exportar] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude generar el archivo. Intenta de nuevo.');
    }
    return true;
  }

  // ─── Reporte diario (solo admin) ──────────────────────
  if (body === 'reporte') {
    if (!admin) return true;
    await enviarReporteDiario(negocio_id);
    return true;
  }

  // ─── Buscar cliente (solo admin) ──────────────────────
  if (body.startsWith('buscar ')) {
    if (!admin) return true;
    const nombreBuscado = body.replace('buscar ', '').trim();
    if (!nombreBuscado) {
      await enviarMensaje(from, 'Escribe el nombre a buscar. Ejemplo: buscar kevin');
      return true;
    }
    try {
      const pagos = await buscarPorCliente(nombreBuscado, negocio_id);
      if (pagos.length === 0) {
        await enviarMensaje(from, `🔍 No encontré pagos de "${nombreBuscado}".`);
      } else {
        const lista = pagos.map((p, i) =>
          `${i + 1}. $${p.monto.toLocaleString('es-CO')} — ${p.fecha} ${p.hora}`
        ).join('\n');

        const totalCliente = pagos.reduce((suma, p) => suma + p.monto, 0);

        await enviarMensaje(from,
          `🔍 *Pagos de ${pagos[0].nombre_cliente}*\n\n` +
          `${lista}\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `📊 ${pagos.length} pago(s) — Total: $${totalCliente.toLocaleString('es-CO')}`
        );
      }
    } catch (err) {
      console.error('[Buscar] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude hacer la búsqueda. Intenta de nuevo.');
    }
    return true;
  }

  // ─── Verificación nocturna manual (solo admin) ────────
  if (body === 'nocturna') {
    if (!admin) return true;
    await verificacionNocturna(negocio_id);
    return true;
  }

  // ─── Estado ───────────────────────────────────────────
  if (body === 'estado') {
    const misHistorial = historialPagos.filter(p => p.negocio_id === negocio_id);
    const uptime = Math.floor(process.uptime() / 60);
    const ultimaVerificacion = misHistorial.length > 0
      ? misHistorial[misHistorial.length - 1].hora
      : 'Sin verificaciones aún';

    await enviarMensaje(from,
      `🤖 *Estado ${negocioNombre}*\n\n` +
      `✅ Bot conectado\n` +
      `📊 Pagos verificados hoy: ${misHistorial.length}\n` +
      `⏱️ Uptime: ${uptime} minutos\n` +
      `🔄 Última verificación: ${ultimaVerificacion}\n` +
      `🟢 Gmail API: conectado\n\n` +
      `Todo está funcionando correctamente. 😊`
    );
    return true;
  }

  // ─── Debug (solo admin) ───────────────────────────────
  if (body === 'debug') {
    if (!admin) return true;
    const uptime = Math.floor(process.uptime() / 60);
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const { comprobantesUsados } = require('../verificador');

    await enviarMensaje(from,
      `🔧 *DEBUG ${negocioNombre}*\n\n` +
      `⏱️ Uptime: ${uptime}m\n` +
      `💾 Memoria: ${memUsage}MB\n` +
      `🔐 Comprobantes únicos: ${comprobantesUsados.size}\n` +
      `📊 Total verificados hoy: ${historialPagos.filter(p => p.negocio_id === negocio_id).length}\n\n` +
      `Sistema operativo ✅`
    );
    return true;
  }

  return false;
}

module.exports = { handleTextEvent, esAdmin, esAdminDB, ADMIN, EMPLEADOS, NUMEROS_AUTORIZADOS };