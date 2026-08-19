const { resumenDelDia } = require('../db');
const { verificarPorGmail } = require('../gmail');
const { enviarMensaje } = require('./openwa');
const { db: database } = require('../db');
const { pagosPendientes } = require('./state');

async function enviarReporteDiario() {
  try {
    const { total, cantidad, pagoMasAlto } = await resumenDelDia();
    const fecha = new Date().toLocaleDateString('es-CO');

    let mensaje;
    if (cantidad === 0) {
      mensaje = `📊 *Cierre del día — ${fecha}*\n\nHoy no se registraron pagos.`;
    } else {
      mensaje =
        `📊 *Cierre del día — ${fecha}*\n\n` +
        `✅ Pagos confirmados: ${cantidad}\n` +
        `💵 Total recibido: $${total.toLocaleString('es-CO')}\n`;

      if (pagoMasAlto) {
        mensaje += `🏆 Pago más alto: $${pagoMasAlto.monto.toLocaleString('es-CO')}`;
        if (pagoMasAlto.nombre_cliente) {
          mensaje += ` (${pagoMasAlto.nombre_cliente})`;
        }
        mensaje += `\n`;
      }

      mensaje += `\n¡Buen trabajo hoy! 🍔`;
    }

    const numerosReporte = [
      '573044372639@c.us',
      '573045530381@c.us',
    ];
    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }
    console.log('[Reporte] Reporte diario enviado');
  } catch (err) {
    console.error('[Reporte] Error:', err.message);
  }
}

async function verificacionNocturna(revision) {
  if (pagosPendientes.length === 0) {
    console.log('[asincronica] No hay pagos pendientes');
    return;
  }

  console.log(`[asincronica] Revisión ${revision}: verificando ${pagosPendientes.length} pago(s) pendiente(s)...`);

  const verificados = [];
  const noEncontrados = [];

  const { db } = require('../db');

  for (let i = pagosPendientes.length - 1; i >= 0; i--) {
    const pago = pagosPendientes[i];
    try {
      const resultado = await verificarPorGmail(pago.monto, { intentos: 1, esperaMs: 0 });

      if (resultado) {
        db.run(
          `UPDATE pagos SET estado = 'REAL', fuente = 'gmail_asincronica', nombre_cliente = ? WHERE referencia = ? AND estado = 'NO_ENCONTRADO'`,
          [resultado.nombre || null, pago.referencia],
          function(err) {
            if (err) console.error('[Asincronica] Error actualizando:', err.message);
            else console.log('[Asincronica] ✅ Pago actualizado a REAL:', pago.referencia);
          }
        );

        verificados.push({
          monto: pago.monto,
          nombre: resultado.nombre || 'Sin nombre',
          referencia: pago.referencia || 'Sin ref',
        });

        pagosPendientes.splice(i, 1);
        console.log(`[asincronica] ✅ Pago de $${pago.monto} verificado`);
      } else {
        noEncontrados.push(pago);
      }
    } catch (err) {
      console.error(`[asincronica] Error verificando $${pago.monto}:`, err.message);
    }
  }

  const numerosReporte = ['573044372639@c.us','573045530381@c.us'];

  if (verificados.length > 0) {
    const totalRecuperado = verificados.reduce((s, p) => s + p.monto, 0);
    const lista = verificados.map(p => `✅ $${p.monto.toLocaleString('es-CO')} — ${p.nombre} (Ref: ${p.referencia})`).join('\n');

    const mensaje =
      `🔔 *FlashPago — Verificación nocturna${revision === 2 ? ' (2da revisión)' : ''}*\n\n` +
      `${lista}\n\n` +
      `📊 ${verificados.length} pago(s) verificado(s) y guardado(s)\n` +
      `💵 Total recuperado: $${totalRecuperado.toLocaleString('es-CO')}`;

    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }
  }

  if (revision === 2 && noEncontrados.length > 0) {
    const lista = noEncontrados.map(p => `• $${p.monto.toLocaleString('es-CO')} — Ref: ${p.referencia || 'Sin ref'} — ${p.hora}`).join('\n');

    const mensaje =
      `⚠️ *FlashPago — Pagos no confirmados*\n\n` +
      `Se revisaron ${noEncontrados.length} pago(s) pendientes.\n` +
      `No se encontraron en las notificaciones del banco:\n\n` +
      `${lista}\n\n` +
      `Revisa manualmente en la app del banco si es necesario.`;

    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }

    pagosPendientes.length = 0;
    console.log('[asincronica] Pendientes limpiados');
  }

  console.log(`[asincronica] Revisión ${revision} completada. Verificados: ${verificados.length}, Pendientes: ${pagosPendientes.length}`);
}

module.exports = { enviarReporteDiario, verificacionNocturna };
