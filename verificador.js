// verificador.js — Verifica pagos con Prometeo API (multi-negocio)
const fetch = require('node-fetch');

const PROMETEO_BASE = process.env.PROMETEO_ENV === 'production'
  ? 'https://api.prometeoapi.com'
  : 'https://banking.sandbox.prometeoapi.com';

const PROMETEO_KEY = process.env.PROMETEO_API_KEY;

// ─── Anti-duplicados (key: "negocio_id:referencia") ──────
const comprobantesUsados = new Map();

function dupKey(referencia, negocio_id) {
  return `${negocio_id || 1}:${referencia}`;
}

// ─── Verificar pago ───────────────────────────────────────
async function verificarPago({ monto, referencia, banco, fecha, negocio_id }) {

  const nid = negocio_id || 1;

  // 1. Duplicado
  if (referencia && comprobantesUsados.has(dupKey(referencia, nid))) {
    const anterior = comprobantesUsados.get(dupKey(referencia, nid));
    return {
      estado: 'DUPLICADO',
      mensaje: `⚠️ DUPLICADO: Este comprobante ya fue usado el ${anterior.fecha} por $${anterior.monto}`,
    };
  }

  // 2. Datos incompletos
  if (!monto )  {
    return {
      estado: 'INCOMPLETO',
      mensaje: '⚠️ No pude leer bien el comprobante. Pide al cliente otro pantallazo más claro.',
    };
  }

  // 3. Sin API key → modo demo
  if (!PROMETEO_KEY || PROMETEO_KEY.includes('xxx')) {
    return verificarDemo({ monto, referencia, banco, fecha, negocio_id: nid });
  }

  // 4. Verificación real con Prometeo
  try {
    const loginRes = await fetch(`${PROMETEO_BASE}/login/`, {
      method: 'POST',
      headers: {
        'X-API-Key': PROMETEO_KEY.trim(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        provider: 'test',
        username: '12345',
        password: 'gfdsa',
      }),
    });

    const loginData = await loginRes.json();

    if (!loginData.key) {
      console.error('[Prometeo] Error login:', loginData);
      return verificarDemo({ monto, referencia, banco, fecha, negocio_id: nid });
    }

    const sessionKey = loginData.key;

    const ahora  = new Date();
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const formatFecha = (d) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const hoy       = formatFecha(ahora);
    const hace30dias = formatFecha(hace30);

    const cuentasRes = await fetch(
      `${PROMETEO_BASE}/account/?key=${sessionKey}`,
      { headers: { 'X-API-Key': PROMETEO_KEY.trim() } }
    );
    const cuentasData = await cuentasRes.json();
    const cuenta = cuentasData.accounts?.[0];
    console.log('[Prometeo] Cuenta seleccionada:', JSON.stringify(cuenta));

    if (!cuenta) {
      console.log('[Prometeo] Sin cuentas encontradas');
      return verificarDemo({ monto, referencia, banco, fecha, negocio_id: nid });
    }

    const txRes = await fetch(
      `${PROMETEO_BASE}/movement/?key=${sessionKey}&account=${cuenta.number}&currency=${cuenta.currency}&date_start=${hace30dias}&date_end=${hoy}`,
      { headers: { 'X-API-Key': PROMETEO_KEY.trim() } }
    );
    const txData = await txRes.json();
    const movimientos = txData.movements || txData.data || [];

    const montoComprobante = parseFloat(monto);
    const txn = movimientos.find(m =>
      (m.reference && m.reference.includes(referencia)) ||
      Math.abs(Math.abs(m.amount) - montoComprobante) < 100
    );

    await fetch(`${PROMETEO_BASE}/logout/?key=${sessionKey}`, {
      headers: { 'X-API-Key': PROMETEO_KEY },
    });

    if (!txn) {
      return {
        estado: 'NO_ENCONTRADO',
        mensaje: '❌ FALSO: No encontré esta transacción en el banco. No entregues el pedido.',
      };
    }

    const montoReal  = Math.abs(txn.amount);
    const diferencia = Math.abs(montoReal - montoComprobante);

    if (diferencia > 100) {
      return {
        estado: 'MONTO_INCORRECTO',
        mensaje: `⚠️ ALERTA: El banco muestra $${montoReal.toLocaleString('es-CO')} pero el comprobante dice $${montoComprobante.toLocaleString('es-CO')}. No entregues.`,
      };
    }

    comprobantesUsados.set(dupKey(referencia, nid), { monto, fecha, banco });

    return {
      estado: 'REAL',
      mensaje: `✅ PAGO REAL: $${montoReal.toLocaleString('es-CO')} via ${banco} — Ref: ${referencia}`,
    };

  } catch (err) {
    console.error('[Prometeo] Error:', err.message);
    return {
      estado: 'ERROR',
      mensaje: '⚠️ No pude verificar con el banco. contacta al dueño.',
    };
  }
}

// ─── Modo demo ────────────────────────────────────────────
function verificarDemo({ monto, referencia, banco, negocio_id }) {
  console.log('[Verificador] Modo demo activo');
  const nid = negocio_id || 1;

  if (referencia && comprobantesUsados.has(dupKey(referencia, nid))) {
    const ant = comprobantesUsados.get(dupKey(referencia, nid));
    return {
      estado: 'DUPLICADO',
      mensaje: `⚠️ DUPLICADO: Este comprobante ya fue usado. Monto: $${ant.monto}`,
    };
  }

  return {
    estado: 'NO_ENCONTRADO',
    mensaje: `⚠️ ADVERTENCIA: No encontré esta transacción. intenta de nuevo.`,
  };
}

module.exports = { verificarPago, comprobantesUsados };