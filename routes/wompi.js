// wompi.js — Pasarela de pagos para la suscripción de FlashPago
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const config = require('../config');
const { verificarToken, soloAdmin } = require('../auth');
const {
  crearPagoPlataforma,
  obtenerPagoPlataforma,
  actualizarPagoPlataforma,
  marcarNegocioPagado,
  PRECIOS_CENTAVOS,
} = require('../db');

// ─── Configuración pública para el widget ──────────────────
router.get('/config', verificarToken, soloAdmin, (req, res) => {
  if (!config.WOMPI_PUBLIC_KEY) {
    return res.status(503).json({ ok: false, error: 'Wompi no está configurado todavía' });
  }
  res.json({ ok: true, publicKey: config.WOMPI_PUBLIC_KEY, ambiente: config.WOMPI_AMBIENTE });
});

// ─── Generar referencia + firma de integridad para abrir el widget ──
router.post('/iniciar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PRECIOS_CENTAVOS[plan]) {
      return res.status(400).json({ ok: false, error: 'Plan no válido' });
    }
    if (!config.WOMPI_PUBLIC_KEY || !config.WOMPI_INTEGRITY_SECRET) {
      return res.status(503).json({ ok: false, error: 'Wompi no está configurado todavía' });
    }

    const negocio_id = req.user.negocio_id;
    const monto = PRECIOS_CENTAVOS[plan]; // en centavos, el monto lo decide el servidor, nunca el cliente
    const referencia = `FP-${negocio_id}-${Date.now()}`;
    const currency = 'COP';

    const cadena = `${referencia}${monto}${currency}${config.WOMPI_INTEGRITY_SECRET}`;
    const signature = crypto.createHash('sha256').update(cadena).digest('hex');

    await crearPagoPlataforma({ negocio_id, referencia, plan, monto });

    res.json({
      ok: true,
      referencia,
      amountInCents: monto,
      currency,
      signature,
      publicKey: config.WOMPI_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('[Wompi] Error iniciando pago:', err.message);
    res.status(500).json({ ok: false, error: 'Error iniciando el pago' });
  }
});

// ─── Consultar el estado de un pago (para el frontend, tras cerrar el widget) ──
router.get('/estado/:referencia', verificarToken, async (req, res) => {
  try {
    const pago = await obtenerPagoPlataforma(req.params.referencia);
    if (!pago || pago.negocio_id !== req.user.negocio_id) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }
    res.json({ ok: true, estado: pago.estado, plan: pago.plan });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Webhook de Wompi (público, verificado por checksum) ───
router.post('/webhook', async (req, res) => {
  try {
    const { event, data, signature, timestamp } = req.body || {};
    if (!event || !data || !signature || !timestamp) {
      return res.status(400).json({ ok: false, error: 'Payload inválido' });
    }
    if (!config.WOMPI_EVENTS_SECRET) {
      console.error('[Wompi] Webhook recibido pero WOMPI_EVENTS_SECRET no está configurado');
      return res.status(503).json({ ok: false, error: 'No configurado' });
    }

    // Verificar checksum: valores de las propiedades indicadas + timestamp + secreto de eventos
    const valores = (signature.properties || [])
      .map((ruta) => ruta.split('.').reduce((obj, key) => (obj ? obj[key] : undefined), data))
      .join('');
    const cadena = `${valores}${timestamp}${config.WOMPI_EVENTS_SECRET}`;
    const checksumCalculado = crypto.createHash('sha256').update(cadena).digest('hex').toUpperCase();

    if (checksumCalculado !== String(signature.checksum || '').toUpperCase()) {
      console.error('[Wompi] Checksum inválido en webhook — evento ignorado');
      return res.status(400).json({ ok: false, error: 'Firma inválida' });
    }

    if (event === 'transaction.updated' && data.transaction) {
      const { status, reference, id: wompiId } = data.transaction;
      const pago = await obtenerPagoPlataforma(reference);

      if (!pago) {
        console.error(`[Wompi] Webhook: referencia desconocida ${reference}`);
        return res.sendStatus(200);
      }

      if (status === 'APPROVED') {
        await actualizarPagoPlataforma(reference, { estado: 'APROBADO', wompi_transaction_id: wompiId });
        await marcarNegocioPagado(pago.negocio_id, pago.plan);
        console.log(`[Wompi] Pago aprobado: negocio ${pago.negocio_id}, plan ${pago.plan}, ref ${reference}`);
      } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(status)) {
        await actualizarPagoPlataforma(reference, { estado: status === 'DECLINED' ? 'RECHAZADO' : 'ERROR', wompi_transaction_id: wompiId });
        console.log(`[Wompi] Pago ${status}: negocio ${pago.negocio_id}, ref ${reference}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Wompi] Error procesando webhook:', err.message);
    res.sendStatus(200); // se responde 200 igual para que Wompi no reintente en bucle por un error nuestro
  }
});

module.exports = router;
