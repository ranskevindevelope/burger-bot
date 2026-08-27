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
const wompiRouter = require('./routes/wompi');

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
app.use('/api/wompi', wompiRouter);

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

// ─── Páginas de error con la marca de FlashPago ───────────
// Logo embebido en base64 (no depende de dashboard/build, que puede faltar en el 503)
const LOGO_BASE64 = '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';

const MASCOTA_RAYO_SVG = `
<svg class="mascota" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rayo confundido, sin encontrar la página">
  <ellipse cx="100" cy="205" rx="42" ry="9" fill="rgba(0,0,0,0.25)" />
  <text class="spark s1" x="18" y="70" font-size="22" fill="#FFB74D">&#10022;</text>
  <text class="spark s2" x="168" y="100" font-size="16" fill="#F57C00">&#10022;</text>
  <text class="spark s3" x="150" y="35" font-size="14" fill="#FFB74D">&#10022;</text>
  <g class="float">
    <polygon points="118,8 55,100 98,100 68,208 152,88 108,88" fill="#F57C00" />
    <circle cx="88" cy="98" r="12" fill="#fff" />
    <circle cx="84" cy="93" r="4.5" fill="#1A1A2E" />
    <line x1="76" y1="80" x2="93" y2="76" stroke="#1A1A2E" stroke-width="4" stroke-linecap="round" />
    <ellipse cx="118" cy="96" rx="11" ry="6.5" fill="#fff" />
    <ellipse cx="118" cy="98" rx="5.5" ry="2" fill="#1A1A2E" />
    <line x1="108" y1="83" x2="128" y2="86" stroke="#1A1A2E" stroke-width="4" stroke-linecap="round" />
    <path d="M82,118 Q96,130 108,119 T128,122" fill="none" stroke="#1A1A2E" stroke-width="4" stroke-linecap="round" />
  </g>
  <text class="q q1" x="14" y="30" font-size="24" fill="#F57C00">?</text>
  <text class="q q2" x="175" y="55" font-size="18" fill="#fff" opacity="0.5">?</text>
</svg>`.replace(/\n\s*/g, '');

const MASCOTA_CSS =
  '.mascota{width:150px;height:165px;overflow:visible;margin-bottom:0.5rem;font-family:\'Space Grotesk\',sans-serif;font-weight:700;}' +
  '.mascota .float{animation:mzap 1.7s cubic-bezier(.36,.07,.19,.97) infinite;transform-box:fill-box;transform-origin:center;}' +
  '@keyframes mzap{0%{transform:translateY(0) rotate(0deg) scale(1);}12%{transform:translateY(-9px) rotate(-4deg) scale(1.02);}' +
  '24%{transform:translateY(-2px) rotate(3deg) scale(.99);}36%{transform:translateY(-11px) rotate(-2deg) scale(1.03);}' +
  '50%{transform:translateY(0) rotate(2deg) scale(1);}64%{transform:translateY(-7px) rotate(-3deg) scale(1.01);}' +
  '78%{transform:translateY(-1px) rotate(1deg) scale(1);}100%{transform:translateY(0) rotate(0deg) scale(1);}}' +
  '.mascota .q{animation:mbob 1.3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}' +
  '.mascota .q2{animation-delay:.3s;}' +
  '@keyframes mbob{0%,100%{transform:translateY(0) scale(1);opacity:.9;}50%{transform:translateY(-7px) scale(1.15);opacity:.3;}}' +
  '.mascota .spark{animation:mflicker .9s steps(2,jump-none) infinite;transform-box:fill-box;transform-origin:center;}' +
  '.mascota .s2{animation-delay:.3s;}.mascota .s3{animation-delay:.55s;}' +
  '@keyframes mflicker{0%,100%{opacity:1;}50%{opacity:.15;}}' +
  '@media(prefers-reduced-motion:reduce){.mascota .float,.mascota .q,.mascota .spark{animation:none;}}';

function paginaError(codigo, titulo, mensaje, opts = {}) {
  const usarMascota = !!opts.mascota;
  return (
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>FlashPago</title><style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:linear-gradient(135deg,#1A1A2E 0%,#16213E 100%);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#fff;}' +
    '.card{text-align:center;padding:2rem;max-width:420px;}' +
    '.logo{width:64px;height:64px;border-radius:16px;margin-bottom:1.75rem;}' +
    '.codigo{font-size:4rem;font-weight:700;color:#F57C00;margin:0;line-height:1;}' +
    'h1{font-size:1.3rem;margin:0.75rem 0 0.5rem;}' +
    'p{color:#b0b0c8;font-size:0.95rem;line-height:1.6;margin:0 0 1.75rem;}' +
    'a{display:inline-block;background:#F57C00;color:#fff;text-decoration:none;font-weight:600;' +
    'padding:0.75rem 1.75rem;border-radius:10px;font-size:0.9rem;}' +
    (usarMascota ? MASCOTA_CSS : '') +
    '</style></head><body><div class="card">' +
    (usarMascota
      ? MASCOTA_RAYO_SVG
      : `<img class="logo" src="data:image/png;base64,${LOGO_BASE64}" alt="FlashPago" />`) +
    `<p class="codigo">${codigo}</p>` +
    `<h1>${titulo}</h1>` +
    `<p>${mensaje}</p>` +
    '<a href="/panel">Ir al panel</a>' +
    '</div></body></html>'
  );
}

// ─── Dashboard estático ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'dashboard/build')));
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/build', 'index.html'), (err) => {
    if (err) {
      console.error('[Dashboard] No se pudo servir index.html:', err.message);
      res.status(503).send(paginaError(503, 'Estamos actualizando FlashPago', 'Vuelve a intentarlo en un minuto.'));
    }
  });
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

// ─── 404 (cualquier ruta no encontrada) ────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
  }
  res.status(404).send(paginaError(404, 'Página no encontrada', 'La página que buscas no existe o fue movida.', { mascota: true }));
});

// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚡ FlashPago corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/panel\n`);
});