// verificador.js — Verifica pagos con Prometeo API
// Sin cambios respecto al original

const fetch = require('node-fetch');

const PROMETEO_BASE = process.env.PROMETEO_ENV === 'production'
  ? 'https://api.prometeoapi.com'
  : 'https://banking.sandbox.prometeoapi.com';

const PROMETEO_KEY = process.env.PROMETEO_API_KEY;

// ─── Anti-duplicados ──────────────────────────────────────
const comprobantesUsados = new Map();

// ─── Verificar pago ───────────────────────────────────────
async function verificarPago({ monto, referencia, banco, fecha }) {

  // 1. Duplicado
  if (referencia && comprobantesUsados.has(referencia)) {
    const anterior = comprobantesUsados.get(referencia);
    return {
      estado: 'DUPLICADO',
      mensaje: `⚠️ DUPLICADO: Este comprobante ya fue usado el ${anterior.fecha} por $${anterior.monto}`,
    };
  }

  // 2. Datos incompletos
  if (!monto || !referencia) {
    return {
      estado: 'INCOMPLETO',
      mensaje: '⚠️ No pude leer bien el comprobante. Pide al cliente otro pantallazo más claro.',
    };
  }

  // 3. Sin API key → modo demo
  if (!PROMETEO_KEY || PROMETEO_KEY.includes('xxx')) {
    return verificarDemo({ monto, referencia, banco, fecha });
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
      return verificarDemo({ monto, referencia, banco, fecha });
    }

    const sessionKey = loginData.key;

    const ahora  = new Date();
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const formatFecha = (d) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const hoy       = formatFecha(ahora);
    const hace30dias = formatFecha(hace30);

    // Obtener cuentas
    const cuentasRes = await fetch(
      `${PROMETEO_BASE}/account/?key=${sessionKey}`,
      { headers: { 'X-API-Key': PROMETEO_KEY.trim() } }
    );
    const cuentasData = await cuentasRes.json();
    const cuenta = cuentasData.accounts?.[0];
    console.log('[Prometeo] Cuenta seleccionada:', JSON.stringify(cuenta));

    if (!cuenta) {
      console.log('[Prometeo] Sin cuentas encontradas');
      return verificarDemo({ monto, referencia, banco, fecha });
    }

    // Obtener movimientos
    const txRes = await fetch(
      `${PROMETEO_BASE}/movement/?key=${sessionKey}&account=${cuenta.number}&currency=${cuenta.currency}&date_start=${hace30dias}&date_end=${hoy}`,
      { headers: { 'X-API-Key': PROMETEO_KEY.trim() } }
    );
    const txData = await txRes.json();
    const movimientos = txData.movements || txData.data || [];

    // Buscar por referencia o monto
    const montoComprobante = parseFloat(monto);
    const txn = movimientos.find(m =>
      (m.reference && m.reference.includes(referencia)) ||
      Math.abs(Math.abs(m.amount) - montoComprobante) < 100
    );

    // Cerrar sesión
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

    comprobantesUsados.set(referencia, { monto, fecha, banco });

    return {
      estado: 'REAL',
      mensaje: `✅ PAGO REAL: $${montoReal.toLocaleString('es-CO')} via ${banco} — Ref: ${referencia}`,
    };

  } catch (err) {
    console.error('[Prometeo] Error:', err.message);
    return {
      estado: 'ERROR',
      mensaje: '⚠️ No pude verificar con el banco. Llama al dueño.',
    };
  }
}

// ─── Modo demo ────────────────────────────────────────────
function verificarDemo({ monto, referencia, banco }) {
  console.log('[Verificador] Modo demo activo');

  if (comprobantesUsados.has(referencia)) {
    const ant = comprobantesUsados.get(referencia);
    return {
      estado: 'DUPLICADO',
      mensaje: `⚠️ DUPLICADO: Este comprobante ya fue usado. Monto: $${ant.monto}`,
    };
  }

  const esReal = Math.random() > 0.3;

  if (esReal) {
    comprobantesUsados.set(referencia, { monto, fecha: new Date().toLocaleDateString('es-CO'), banco });
    return {
      estado: 'REAL',
      mensaje: `✅ PAGO REAL: $${parseFloat(monto).toLocaleString('es-CO')} via ${banco || 'transferencia'} — Ref: ${referencia}`,
    };
  } else {
    return {
      estado: 'NO_ENCONTRADO',
      mensaje: `❌ FALSO: No encontré esta transacción. No entregues el pedido.`,
    };
  }
}

module.exports = { verificarPago };
