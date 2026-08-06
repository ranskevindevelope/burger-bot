// db.js — Configuración de la base de datos SQLite
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./vinsonbot.db', (err) => {
  if (err) {
    console.error('[DB] Error al conectar:', err.message);
  } else {
    console.log('[DB] Conectado a la base de datos SQLite');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monto INTEGER NOT NULL,
    referencia TEXT,
    banco TEXT,
    fecha TEXT,
    hora TEXT,
    estado TEXT,
    fuente TEXT,
    nombre_cliente TEXT,
    verificado_por TEXT,
    negocio_id INTEGER DEFAULT 1,
    foto TEXT,
    creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    
  )
  
  
`, (err) => {
  if (err) {
    console.error('[DB] Error creando tabla pagos:', err.message);
  } else {
    console.log('[DB] Tabla "pagos" lista');
  }
});
// ─── Función 1: Guardar un pago ───────────────────────────
function guardarPago(pago) {
  return new Promise((resolve, reject) => {
    const { monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente, verificado_por, negocio_id, foto } = pago;
    db.run(
      `INSERT INTO pagos (monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente, verificado_por, negocio_id, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente || null, verificado_por || null, negocio_id || 1, foto || null],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// ─── Función 2: Buscar un pago por referencia ─────────────
function buscarPorReferencia(referencia) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pagos WHERE referencia = ?`,
      [referencia],
      (err, fila) => {
        if (err) reject(err);
        else resolve(fila); // devuelve el pago si existe, o undefined si no
      }
    );
  });
}
// ─── Busca duplicado SOLO en los últimos 7 días ──────────
function buscarDuplicadoReciente(referencia) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pagos 
       WHERE referencia = ? 
       AND creado_en >= datetime('now', '-7 days', 'localtime')`,
      [referencia],
      (err, fila) => {
        if (err) reject(err);
        else resolve(fila);
      }
    );
  });
}
// ─── Total de pagos REALES del día de hoy ─────────────────
function totalDelDia() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' 
       AND date(creado_en) = date('now', 'localtime')`,
      [],
      (err, filas) => {
        if (err) reject(err);
        else {
          const total = filas.reduce((suma, p) => suma + p.monto, 0);
          resolve({ total, cantidad: filas.length, pagos: filas });
        }
      }
    );
  });
}
//////// crear usuarios en dashboard////
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'empleado',
    whatsapp TEXT,
    activo INTEGER DEFAULT 1,
    ultimo_login TEXT,
    creado_en TEXT DEFAULT (datetime('now','localtime'))
  )
`);

// ─── Buscar pagos por nombre de cliente ───────────────────
function buscarPorCliente(nombre) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' 
       AND nombre_cliente LIKE ?
       ORDER BY id DESC 
       LIMIT 10`,
      [`%${nombre}%`],
      (err, filas) => {
        if (err) reject(err);
        else resolve(filas);
      }
    );
  });
}
// ─── Resumen completo del día para el reporte ─────────────
function resumenDelDia() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' 
       AND date(creado_en) = date('now', 'localtime')
       ORDER BY monto DESC`,
      [],
      (err, filas) => {
        if (err) reject(err);
        else {
          const total = filas.reduce((suma, p) => suma + p.monto, 0);
          const pagoMasAlto = filas[0] || null;  // el primero (ya ordenado por monto DESC)
          resolve({
            total,
            cantidad: filas.length,
            pagoMasAlto,
          });
        }
      }
    );
  });
}


// ─── Total de pagos REALES de los últimos 30 días ─────────
function totalUltimos30Dias() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' 
       AND creado_en >= datetime('now', '-30 days', 'localtime')`,
      [],
      (err, filas) => {
        if (err) reject(err);
        else {
          const total = filas.reduce((suma, p) => suma + p.monto, 0);
          resolve({ total, cantidad: filas.length });
        }
      }
    );
  });
}
// ─── Obtener pagos para exportar (últimos 30 días) ────────
function obtenerPagosExportables() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente, verificado_por, creado_en 
       FROM pagos 
       WHERE estado = 'REAL' 
       AND creado_en >= datetime('now', '-30 days', 'localtime')
       ORDER BY id DESC`,
      [],
      (err, filas) => {
        if (err) reject(err);
        else resolve(filas);
      }
    );
  });
}

module.exports = { db, guardarPago, buscarPorReferencia, buscarDuplicadoReciente, totalDelDia, buscarPorCliente, resumenDelDia, totalUltimos30Dias, obtenerPagosExportables };