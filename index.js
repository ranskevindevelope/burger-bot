// index.js — Punto de entrada del servidor: arranca Express, monta rutas y programas jobs.
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { verificarToken, soloAdmin } = require('./auth');
const { obtenerPagosExportables } = require('./db');
const { verificacionNocturna } = require('./bot/reportes');
const { enviarReporteDiario } = require('./bot/reportes');

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

// ─── Endpoint retirado: MacroDroid y la app Android ya no se usan
app.post('/pago-recibido', (req, res) => {
  res.status(410).json({ ok: false, error: 'Este endpoint ya no está disponible' });
});

// ─── Webhook de OpenWA ────────────────────────────────────
app.use('/webhook', webhookRouter);

// ─── API del dashboard ────────────────────────────────────
app.use('/api', apiRouter);

// ─── Ruta para descargar el Excel (CSV) ───────────────────
app.get('/exportar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const pagos = await obtenerPagosExportables();

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

// ─── Programar reportes y verificaciones según el día ─────
setInterval(async () => {
  const ahora = new Date();
  const dia = ahora.getDay();       // 0=domingo, ..., 4=jueves, 5=viernes, 6=sábado
  const hora = ahora.getHours();
  const minuto = ahora.getMinutes();

  let debeEnviar = false;

  // Verificación nocturna - 1ra revisión a las 21:00
  if (hora === 21 && minuto === 0) {
    console.log('[asincronica] Ejecutando 1ra revisión...');
    await verificacionNocturna(1);
  }

  // Verificación nocturna - 2da revisión a las 22:00
  if (hora === 22 && minuto === 0) {
    console.log('[asincronica] Ejecutando 2da revisión...');
    await verificacionNocturna(2);
  }

  // Jueves (4) a las 22:00
  if (dia === 4 && hora === 22 && minuto === 0) debeEnviar = true;

  // Viernes (5) a las 22:30
  if (dia === 5 && hora === 22 && minuto === 30) debeEnviar = true;

  // Sábado (6) a las 22:30
  if (dia === 6 && hora === 22 && minuto === 30) debeEnviar = true;

  // Domingo (0) a las 22:00
  if (dia === 0 && hora === 22 && minuto === 0) debeEnviar = true;

  if (debeEnviar) {
    console.log('[Reporte] Ejecutando reporte diario...');
    await enviarReporteDiario();
  }
}, 60000); // revisa cada minuto

// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍔 Bot ${config.NEGOCIO_NOMBRE} corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`🔗 se configura OpenWA Dashboard para apuntar a este webhook\n`);
});
