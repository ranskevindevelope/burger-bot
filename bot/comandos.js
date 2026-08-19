// comandos.js — Manejo de todos los comandos de texto del bot
const { enviarMensaje, enviarImagen } = require('./openwa');
const { totalDelDia, totalUltimos30Dias, obtenerPagosExportables, buscarPorCliente } = require('../db');
const { historialPagos } = require('./state');
const { enviarReporteDiario, verificacionNocturna } = require('./reportes');
const config = require('../config');

const NEGOCIO = config.NEGOCIO_NOMBRE;

const ADMIN = ['573045530381@c.us', '573044372639@c.us'];
const EMPLEADOS = ['573013411244@c.us', '573167064671@c.us'];
const NUMEROS_AUTORIZADOS = [...ADMIN, ...EMPLEADOS];

function esAdmin(numero) {
  return ADMIN.includes(numero);
}

const MENSAJES = {
  bienvenida: `💵 *${NEGOCIO}* — Verificador de Pagos\n\nHola! Soy el asistente de verificación de pagos impulsado por IA.\n\nEnvíame la *foto del comprobante* de transferencia y te digo en segundos si el pago es real.`,
};

// Devuelve true si el comando fue manejado, false si no.
async function handleTextEvent(from, text) {
  const body = (text || '').trim().toLowerCase();

  // ─── Bienvenida ───────────────────────────────────────
  if (['hola', 'inicio', 'start', 'hi'].includes(body)) {
    await enviarMensaje(from, MENSAJES.bienvenida);
    return true;
  }

  // ─── Historial ────────────────────────────────────────
  if (body === 'historial') {
    if (historialPagos.length === 0) {
      await enviarMensaje(from, 'No hay pagos verificados aún hoy.');
    } else {
      const lista = historialPagos.slice(-5).map((p, i) =>
        `${i + 1}. ${p.estado} — $${p.monto} — ${p.banco} — ${p.hora}`
      ).join('\n');

      const TotalHoy = historialPagos
        .filter(p => p.estado === 'REAL')
        .reduce((suma, p) => suma + parseInt(p.monto || 0), 0);

      const cantidadReales = historialPagos.filter(p => p.estado == 'REAL').length;

      const mensaje = ` Ultimos pagos verficados:\n\n${lista}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 Total hoy: $${TotalHoy.toLocaleString('es-CO')}\n\n` +
        `✅ Pagos confirmados: ${cantidadReales}`;

      await enviarMensaje(from, mensaje);
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
    if (!esAdmin(from)) return true;
    const mensaje = body.replace('enviar ', '').trim();
    if (!mensaje) {
      await enviarMensaje(from, 'Escribe el mensaje después de enviar. Ejemplo: enviar Hola a todos');
      return true;
    }
    let enviados = 0;
    for (const numero of NUMEROS_AUTORIZADOS) {
      if (numero !== from) {
        await enviarMensaje(numero, `📢 *Aviso Importante*\n\n${mensaje}`);
        enviados++;
      }
    }
    await enviarMensaje(from, `✅ Mensaje enviado a ${enviados} persona(s).`);
    return true;
  }

  // ─── Ayuda ────────────────────────────────────────────
  if (['ayuda', 'help', '?'].includes(body)) {
    if (esAdmin(from)) {
      await enviarMensaje(from,
        `📋 *${NEGOCIO}* — Administrador\n\n` +
        `Para verificar un pago:\n` +
        `📸 Envía la *foto del comprobante*\n\n` +
        `Consultas:\n` +
        `• *total* — Ventas del día\n` +
        `• *buscar [nombre]* — Pagos de un cliente\n` +
        `   Ejemplo: buscar kevin\n\n` +
        `• *historial* — Últimos pagos\n` +
        `• *ayuda* — Ver este menú\n\n` +
        `📊 El *reporte de cierre* llega automático jue, vie, sáb y dom.`
      );
    } else {
      await enviarMensaje(from,
        `📋 *${NEGOCIO}*\n\n` +
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
    if (!esAdmin(from)) return true;
    try {
      if (body === 'total mes') {
        const { total, cantidad } = await totalUltimos30Dias();
        if (cantidad === 0) {
          await enviarMensaje(from, '📊 No hay pagos en los últimos 30 días.');
        } else {
          const mensaje =
            `📅 *Total últimos 30 días*\n\n` +
            `✅ Pagos confirmados: ${cantidad}\n` +
            `💵 Total recibido: $${total.toLocaleString('es-CO')}`;
          await enviarMensaje(from, mensaje);
        }
      } else {
        const { total, cantidad } = await totalDelDia();
        if (cantidad === 0) {
          await enviarMensaje(from, '📊 No hay pagos verificados hoy todavía.');
        } else {
          const mensaje =
            `💰 *Total del día*\n\n` +
            `✅ Pagos confirmados: ${cantidad}\n` +
            `💵 Total recibido: $${total.toLocaleString('es-CO')}`;
          await enviarMensaje(from, mensaje);
        }
      }
    } catch (err) {
      console.error('[Total] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude calcular el total. Intenta de nuevo.');
    }
    return true;
  }

  // ─── Exportar (solo admin) ────────────────────────────
  if (body === 'exportar') {
    if (!esAdmin(from)) return true;
    try {
      const pagos = await obtenerPagosExportables();
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
    if (!esAdmin(from)) return true;
    await enviarReporteDiario();
    return true;
  }

  // ─── Buscar cliente (solo admin) ──────────────────────
  if (body.startsWith('buscar ')) {
    if (!esAdmin(from)) return true;
    const nombreBuscado = body.replace('buscar ', '').trim();
    if (!nombreBuscado) {
      await enviarMensaje(from, 'Escribe el nombre a buscar. Ejemplo: buscar kevin');
      return true;
    }
    try {
      const pagos = await buscarPorCliente(nombreBuscado);
      if (pagos.length === 0) {
        await enviarMensaje(from, `🔍 No encontré pagos de "${nombreBuscado}".`);
      } else {
        const lista = pagos.map((p, i) =>
          `${i + 1}. $${p.monto.toLocaleString('es-CO')} — ${p.fecha} ${p.hora}`
        ).join('\n');

        const totalCliente = pagos.reduce((suma, p) => suma + p.monto, 0);

        const mensaje =
          `🔍 *Pagos de ${pagos[0].nombre_cliente}*\n\n` +
          `${lista}\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `📊 ${pagos.length} pago(s) — Total: $${totalCliente.toLocaleString('es-CO')}`;

        await enviarMensaje(from, mensaje);
      }
    } catch (err) {
      console.error('[Buscar] Error:', err.message);
      await enviarMensaje(from, '⚠️ No pude hacer la búsqueda. Intenta de nuevo.');
    }
    return true;
  }

  // ─── Verificación nocturna manual (solo admin) ────────
  if (body === 'nocturna') {
    if (!esAdmin(from)) return true;
    await verificacionNocturna(1);
    return true;
  }

  // ─── Estado ───────────────────────────────────────────
  if (body === 'estado') {
    const uptime = Math.floor(process.uptime() / 60);
    const ultimaVerificacion = historialPagos.length > 0
      ? historialPagos[historialPagos.length - 1].hora
      : 'Sin verificaciones aún';

    const estado = `
🤖 *Estado ${NEGOCIO}*

✅ Bot conectado
📊 Pagos verificados hoy: ${historialPagos.length}
⏱️ Uptime: ${uptime} minutos
🔄 Última verificación: ${ultimaVerificacion}
🟢 Gmail API: conectado
📧 Gmail API: verificando pagos
⚡ API OPEN BANK: en proceso...

Todo está funcionando correctamente. 😊
  `.trim();

    await enviarMensaje(from, estado);
    return true;
  }

  // ─── Debug (solo admin) ───────────────────────────────
  if (body === 'debug') {
    if (!esAdmin(from)) return true;
    const uptime = Math.floor(process.uptime() / 60);
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const { comprobantesUsados } = require('../verificador');

    const debug = `
🔧 *DEBUG ${NEGOCIO}*

⏱️ Uptime: ${uptime}m
💾 Memoria: ${memUsage}MB
🔐 Comprobantes únicos: ${comprobantesUsados.size}
📊 Total verificados hoy: ${historialPagos.length}

Sistema operativo ✅
  `.trim();

    await enviarMensaje(from, debug);
    return true;
  }

  // Comando no reconocido → false para que manejarlo aguas abajo
  return false;
}

module.exports = { handleTextEvent, esAdmin, ADMIN, EMPLEADOS, NUMEROS_AUTORIZADOS };
