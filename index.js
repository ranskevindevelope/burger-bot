// index.js — Punto de entrada del servidor (multi-negocio)
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { verificarToken, soloAdmin } = require('./auth');
const { obtenerPagosExportables, listarNegocios } = require('./db');
const { verificacionNocturna, enviarReporteDiario, buscarIngresosSinComprobante } = require('./bot/reportes');
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

// ─── Horario propio de cada negocio ────────────────────────
function sumarMinutos(horaStr, minutosASumar) {
  const [h, m] = (horaStr || '21:00').split(':').map(Number);
  const total = (h * 60 + m + minutosASumar + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseDiasOperacion(json) {
  try {
    const dias = JSON.parse(json);
    if (Array.isArray(dias) && dias.length) return dias;
  } catch {
    // valor viejo/corrupto: opera todos los días por defecto
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

// ─── Programar reportes y verificaciones (por negocio) ────
setInterval(async () => {
  const ahora = new Date();
  const dia = ahora.getDay();
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  const verificOk = verificarPermitidaHoy();
  const reporteOk = reportePermitidoHoy();

  let negocios;
  try {
    negocios = await listarNegocios();
  } catch (err) {
    console.error('[Scheduler] Error listando negocios:', err.message);
    return;
  }

  for (const neg of negocios) {
    const diasOperacion = parseDiasOperacion(neg.dias_operacion);
    if (!diasOperacion.includes(dia)) continue; // el negocio no opera hoy

    const horaCierre = neg.hora_cierre || '21:00';
    const horaVerificacion2 = sumarMinutos(horaCierre, 60);

    if (horaActual === horaCierre) {
      if (verificOk) {
        console.log(`[Asincronica] 1ra revisión — ${neg.nombre}`);
        try { await verificacionNocturna(1, neg.id); }
        catch (err) { console.error(`[Scheduler] Error en negocio ${neg.id} (${neg.nombre}):`, err.message); }
      } else {
        console.log(`[Asincronica] 1ra revisión omitida (festivo/fin de semana) — ${neg.nombre}`);
      }
    }

    if (horaActual === horaVerificacion2) {
      if (verificOk) {
        console.log(`[Asincronica] 2da revisión — ${neg.nombre}`);
        try { await verificacionNocturna(2, neg.id); }
        catch (err) { console.error(`[Scheduler] Error en negocio ${neg.id} (${neg.nombre}):`, err.message); }
      } else {
        console.log(`[Asincronica] 2da revisión omitida (festivo/fin de semana) — ${neg.nombre}`);
      }

      if (reporteOk) {
        console.log(`[Reporte] Buscando ingresos sin comprobante y enviando reporte — ${neg.nombre}`);
        try {
          await buscarIngresosSinComprobante(neg.id);
          await enviarReporteDiario(neg.id);
        } catch (err) {
          console.error(`[Scheduler] Error en reporte del negocio ${neg.id} (${neg.nombre}):`, err.message);
        }
      } else {
        console.log(`[Reporte] Omitido (festivo/fin de semana) — ${neg.nombre}`);
      }
    }
  }
}, 60000);

// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚡ FlashPago corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/panel\n`);
});