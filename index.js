// index.js — Punto de entrada del servidor (multi-negocio)
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { verificarToken, soloAdmin } = require('./auth');
const { obtenerPagosExportables, listarNegocios } = require('./db');
const { verificacionNocturna, enviarReporteDiario } = require('./bot/reportes');
const { esFestivo, esFinDeSemana } = require('./bot/festivos');

// ─── Opciones según festivos / fin de semana ──────────────
const HABILITAR_REPORTE_FESTIVOS =
  (process.env.HABILITAR_REPORTE_FESTIVOS || 'true').toLowerCase() === 'true';
const HABILITAR_REPORTE_FIN_SEMANA =
  (process.env.HABILITAR_REPORTE_FIN_SEMANA || 'true').toLowerCase() === 'true';
const HABILITAR_VERIFICACION_FESTIVOS =
  (process.env.HABILITAR_VERIFICACION_FESTIVOS || 'true').toLowerCase() === 'true';
const HABILITAR_VERIFICACION_FIN_SEMANA =
  (process.env.HABILITAR_VERIFICACION_FIN_SEMANA || 'true').toLowerCase() === 'true';

function verificarPermitidaHoy() {
  if (esFestivo()) return HABILITAR_VERIFICACION_FESTIVOS;
  if (esFinDeSemana()) return HABILITAR_VERIFICACION_FIN_SEMANA;
  return true;
}

function reportePermitidoHoy() {
  if (esFestivo()) return HABILITAR_REPORTE_FESTIVOS;
  if (esFinDeSemana()) return HABILITAR_REPORTE_FIN_SEMANA;
  return true;
}

// ─── Rutas ────────────────────────────────────────────────
const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');

const app = express();

// ─── Headers de seguridad ─────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// ─── CORS ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const originsPermitidos = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://45.77.82.77:3000'
  ];
  const origin = req.headers.origin;
  if (originsPermitidos.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Body parsers ─────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

// ─── Carpeta de comprobantes ──────────────────────────────
const CARPETA_COMPROBANTES = path.join(__dirname, 'comprobantes');
if (!fs.existsSync(CARPETA_COMPROBANTES)) {
  fs.mkdirSync(CARPETA_COMPROBANTES);
}

// ─── Endpoint retirado ────────────────────────────────────
app.post('/pago-recibido', (req, res) => {
  res.status(410).json({ ok: false, error: 'Este endpoint ya no está disponible' });
});

// ─── Webhook de OpenWA ────────────────────────────────────
app.use('/webhook', webhookRouter);

// ─── API del dashboard ────────────────────────────────────
app.use('/api', apiRouter);

// ─── Exportar CSV (filtrado por negocio del token) ────────
app.get('/exportar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const pagos = await obtenerPagosExportables(req.user.negocio_id);

    let csv = 'ID,Monto,Referencia,Banco,Fecha,Hora,Estado,Fuente,Cliente,Verificado Por,Creado\n';

    for (const p of pagos) {
      csv += `${p.id},${p.monto},"${p.referencia || ''}","${p.banco || ''}","${p.fecha || ''}","${p.hora || ''}","${p.estado}","${p.fuente || ''}","${p.nombre_cliente || ''}","${p.verificado_por || ''}","${p.creado_en || ''}"\n`;
    }

    const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pagos_${fecha}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[Exportar] Error:', err.message);
    res.status(500).send('Error generando el archivo');
  }
});

// ─── Dashboard estático ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'dashboard/build')));
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/build', 'index.html'));
});

// ─── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    negocio: config.NEGOCIO_NOMBRE,
    hora: new Date().toLocaleString('es-CO'),
  });
});

// ─── Ejecutar para TODOS los negocios activos ─────────────
async function ejecutarParaTodosLosNegocios(fn) {
  try {
    const negocios = await listarNegocios();
    for (const neg of negocios) {
      try {
        await fn(neg.id);
      } catch (err) {
        console.error(`[Scheduler] Error en negocio ${neg.id} (${neg.nombre}):`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error listando negocios:', err.message);
  }
}

// ─── Programar reportes y verificaciones ──────────────────
setInterval(async () => {
  const ahora = new Date();
  const dia = ahora.getDay();
  const hora = ahora.getHours();
  const minuto = ahora.getMinutes();

  const verificOk = verificarPermitidaHoy();
  const reporteOk = reportePermitidoHoy();

  // Verificación nocturna - 1ra revisión a las 21:00
  if (hora === 21 && minuto === 0) {
    if (verificOk) {
      console.log('[Asincronica] Ejecutando 1ra revisión para todos los negocios...');
      await ejecutarParaTodosLosNegocios((nid) => verificacionNocturna(1, nid));
    } else {
      console.log('[Asincronica] Verificación 1ra omitida (festivo/fin de semana deshabilitado).');
    }
  }

  // Verificación nocturna - 2da revisión a las 22:00
  if (hora === 22 && minuto === 0) {
    if (verificOk) {
      console.log('[Asincronica] Ejecutando 2da revisión para todos los negocios...');
      await ejecutarParaTodosLosNegocios((nid) => verificacionNocturna(2, nid));
    } else {
      console.log('[Asincronica] Verificación 2da omitida (festivo/fin de semana deshabilitado).');
    }
  }

  // Reporte diario
  const esHorarioReporte =
    (dia === 4 && hora === 22 && minuto === 0) ||
    ((dia === 5 || dia === 6) && hora === 22 && minuto === 30) ||
    (dia === 0 && hora === 22 && minuto === 0);

  if (esHorarioReporte && reporteOk) {
    console.log('[Reporte] Ejecutando reporte diario para todos los negocios...');
    await ejecutarParaTodosLosNegocios(enviarReporteDiario);
  } else if (esHorarioReporte) {
    console.log('[Reporte] Reporte omitido (festivo/fin de semana deshabilitado).');
  }
}, 60000);

// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚡ FlashPago corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/panel\n`);
});