// reportes.js — Reportes y verificación nocturna (multi-negocio)
const { db, resumenDelDia, obtenerNegocio } = require('../db');
const { verificarPorGmail } = require('../gmail');
const { enviarMensaje } = require('./openwa');
const { pagosPendientes } = require('./state');

// ─── Obtener admins de un negocio ───────────────────────
function obtenerAdminsNegocio(negocio_id) {
  return new Promise((resolve) => {
    db.all(
      `SELECT whatsapp FROM usuarios WHERE negocio_id = ? AND rol = 'admin' AND activo = 1 AND whatsapp IS NOT NULL`,
      [negocio_id],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          // Fallback: lista vieja
          resolve(['573044372639@c.us', '573045530381@c.us']);
          return;
        }
        resolve(rows.map(r => r.whatsapp.includes('@') ? r.whatsapp : `${r.whatsapp}@c.us`));
      }
    );
  });
}

async function enviarReporteDiario(negocio_id = 1) {
  try {
    const { total, cantidad, pagoMasAlto } = await resumenDelDia(negocio_id);
    const fecha = new Date().toLocaleDateString('es-CO');

    let negocioNombre = 'FlashPago';
    try {
      const neg = await obtenerNegocio(negocio_id);
      if (neg) negocioNombre = neg.nombre;
    } catch (_) {}

    let mensaje;
    if (cantidad === 0) {
      mensaje = `📊 *Cierre del día — ${negocioNombre} — ${fecha}*\n\nHoy no se registraron pagos.`;
    } else {
      mensaje =
        `📊 *Cierre del día — ${negocioNombre} — ${fecha}*\n\n` +
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

    const numerosReporte = await obtenerAdminsNegocio(negocio_id);
    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }
    console.log(`[Reporte] Reporte diario enviado (negocio ${negocio_id})`);
  } catch (err) {
    console.error('[Reporte] Error:', err.message);
  }
}

async function verificacionNocturna(revision, negocio_id) {
  // Filtrar pendientes de este negocio
  const pendientesNegocio = negocio_id
    ? pagosPendientes.filter(p => (p.negocio_id || 1) === negocio_id)
    : pagosPendientes;

  if (pendientesNegocio.length === 0) {
    console.log(`[Asincronica] No hay pagos pendientes (negocio ${negocio_id || 'todos'})`);
    return;
  }

  console.log(`[Asincronica] Revisión ${revision}: verificando ${pendientesNegocio.length} pago(s) pendiente(s) (negocio ${negocio_id || 'todos'})...`);

  const verificados = [];
  const noEncontrados = [];

  for (let i = pagosPendientes.length - 1; i >= 0; i--) {
    const pago = pagosPendientes[i];
    const pagoNegocioId = pago.negocio_id || 1;

    // Si se especificó negocio, solo verificar los de ese negocio
    if (negocio_id && pagoNegocioId !== negocio_id) continue;

    try {
      const resultado = await verificarPorGmail(pago.monto, pagoNegocioId, { intentos: 1, esperaMs: 0 });

      if (resultado) {
        db.run(
          `UPDATE pagos SET estado = 'REAL', fuente = 'gmail_asincronica', nombre_cliente = ? WHERE referencia = ? AND negocio_id = ? AND estado = 'NO_ENCONTRADO'`,
          [resultado.nombre || null, pago.referencia, pagoNegocioId],
          function (err) {
            if (err) console.error('[Asincronica] Error actualizando:', err.message);
            else console.log(`[Asincronica] ✅ Pago actualizado a REAL: ${pago.referencia} (negocio ${pagoNegocioId})`);
          }
        );

        verificados.push({
          monto: pago.monto,
          nombre: resultado.nombre || 'Sin nombre',
          referencia: pago.referencia || 'Sin ref',
          negocio_id: pagoNegocioId,
        });

        pagosPendientes.splice(i, 1);
      } else {
        noEncontrados.push(pago);
      }
    } catch (err) {
      console.error(`[Asincronica] Error verificando $${pago.monto}:`, err.message);
    }
  }

  // Enviar reportes agrupados por negocio
  const negociosAfectados = [...new Set([
    ...verificados.map(p => p.negocio_id),
    ...(revision === 2 ? noEncontrados.map(p => p.negocio_id || 1) : []),
  ])];

  for (const nid of negociosAfectados) {
    const numerosReporte = await obtenerAdminsNegocio(nid);
    let negocioNombre = 'FlashPago';
    try {
      const neg = await obtenerNegocio(nid);
      if (neg) negocioNombre = neg.nombre;
    } catch (_) {}

    const verificadosNeg = verificados.filter(p => p.negocio_id === nid);
    if (verificadosNeg.length > 0) {
      const totalRecuperado = verificadosNeg.reduce((s, p) => s + p.monto, 0);
      const lista = verificadosNeg.map(p => `✅ $${p.monto.toLocaleString('es-CO')} — ${p.nombre} (Ref: ${p.referencia})`).join('\n');

      const mensaje =
        `🔔 *${negocioNombre} — Verificación nocturna${revision === 2 ? ' (2da revisión)' : ''}*\n\n` +
        `${lista}\n\n` +
        `📊 ${verificadosNeg.length} pago(s) verificado(s) y guardado(s)\n` +
        `💵 Total recuperado: $${totalRecuperado.toLocaleString('es-CO')}`;

      for (const numero of numerosReporte) {
        await enviarMensaje(numero, mensaje);
      }
    }

    if (revision === 2) {
      const noEncontradosNeg = noEncontrados.filter(p => (p.negocio_id || 1) === nid);
      if (noEncontradosNeg.length > 0) {
        const lista = noEncontradosNeg.map(p => `• $${p.monto.toLocaleString('es-CO')} — Ref: ${p.referencia || 'Sin ref'} — ${p.hora}`).join('\n');

        const mensaje =
          `⚠️ *${negocioNombre} — Pagos no confirmados*\n\n` +
          `Se revisaron ${noEncontradosNeg.length} pago(s) pendientes.\n` +
          `No se encontraron en las notificaciones del banco:\n\n` +
          `${lista}\n\n` +
          `Revisa manualmente en la app del banco si es necesario.`;

        for (const numero of numerosReporte) {
          await enviarMensaje(numero, mensaje);
        }
      }
    }
  }

  // Limpiar pendientes verificados del negocio en la 2da revisión
  if (revision === 2 && negocio_id) {
    for (let i = pagosPendientes.length - 1; i >= 0; i--) {
      if ((pagosPendientes[i].negocio_id || 1) === negocio_id) {
        pagosPendientes.splice(i, 1);
      }
    }
    console.log(`[Asincronica] Pendientes limpiados (negocio ${negocio_id})`);
  } else if (revision === 2 && !negocio_id) {
    pagosPendientes.length = 0;
    console.log('[Asincronica] Todos los pendientes limpiados');
  }

  console.log(`[Asincronica] Revisión ${revision} completada. Verificados: ${verificados.length}, Pendientes restantes: ${pagosPendientes.length}`);
}

module.exports = { enviarReporteDiario, verificacionNocturna };