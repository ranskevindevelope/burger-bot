// db.js — Base de datos SQLite con soporte multi-negocio
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./vinsonbot.db', (err) => {
  if (err) {
    console.error('[DB] Error al conectar:', err.message);
  } else {
    console.log('[DB] Conectado a la base de datos SQLite');
  }
});

// ═══════════════════════════════════════════════════════════
//  TABLAS
// ═══════════════════════════════════════════════════════════

// ─── Negocios ─────────────────────────────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS negocios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    whatsapp TEXT,
    plan TEXT DEFAULT 'basico' CHECK (plan IN ('basico', 'premium', 'empresarial')),
    limite_comprobantes INTEGER DEFAULT 300,
    activo INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT (datetime('now','localtime'))
  )
`, (err) => {
  if (err) {
    console.error('[DB] Error creando tabla negocios:', err.message);
  } else {
    console.log('[DB] Tabla "negocios" lista');
    // Insertar negocio por defecto si no existe
    db.run(`
      INSERT OR IGNORE INTO negocios (id, nombre, whatsapp, plan, limite_comprobantes)
      VALUES (1, 'Flash Pago', NULL, 'basico', 300)
    `);
  }
});

// ─── Tokens Gmail por negocio ─────────────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS tokens_gmail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER,
    email TEXT,
    actualizado_en TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (err) console.error('[DB] Error creando tabla tokens_gmail:', err.message);
  else console.log('[DB] Tabla "tokens_gmail" lista');
});

// ─── Pagos ────────────────────────────────────────────────
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
    creado_en TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (err) console.error('[DB] Error creando tabla pagos:', err.message);
  else {
    console.log('[DB] Tabla "pagos" lista');
    db.run('CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON pagos (negocio_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pagos_referencia ON pagos (referencia)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos (estado, creado_en)');
  }
});

// ─── Usuarios (ahora con negocio_id) ─────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'empleado',
    whatsapp TEXT,
    negocio_id INTEGER DEFAULT 1,
    activo INTEGER DEFAULT 1,
    ultimo_login TEXT,
    creado_en TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (err) {
    console.error('[DB] Error creando tabla usuarios:', err.message);
  } else {
    console.log('[DB] Tabla "usuarios" lista');
    // Migración: agregar negocio_id si la tabla ya existía sin ella
    db.run(`ALTER TABLE usuarios ADD COLUMN negocio_id INTEGER DEFAULT 1`, (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column')) {
        console.error('[DB] Error migrando usuarios:', alterErr.message);
      } else {
        console.log('[DB] Columna negocio_id en usuarios: OK');
      }
    });
  }
});

// ─── Historial de revisiones de duplicados ────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS duplicate_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pago_id INTEGER NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'DUPLICADO', 'LEGITIMO', 'ARCHIVADO')),
    motivo TEXT,
    revisado_por TEXT NOT NULL,
    revisado_en TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pago_id) REFERENCES pagos(id)
  )
`, (err) => {
  if (!err) {
    db.run('CREATE INDEX IF NOT EXISTS idx_duplicate_reviews_pago ON duplicate_reviews (pago_id, id DESC)');
  }
});

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — NEGOCIOS
// ═══════════════════════════════════════════════════════════

function crearNegocio({ nombre, whatsapp, plan, limite_comprobantes }) {
  const limites = { basico: 300, premium: 1000, empresarial: 999999 };
  const limite = limite_comprobantes || limites[plan] || 300;
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO negocios (nombre, whatsapp, plan, limite_comprobantes) VALUES (?, ?, ?, ?)`,
      [nombre, whatsapp || null, plan || 'basico', limite],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, nombre, plan: plan || 'basico', limite });
      }
    );
  });
}

function obtenerNegocio(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM negocios WHERE id = ? AND activo = 1`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function listarNegocios() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM negocios WHERE activo = 1 ORDER BY id`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function contarComprobantesDelMes(negocio_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as total FROM pagos
       WHERE negocio_id = ?
       AND creado_en >= date('now', 'start of month', 'localtime')`,
      [negocio_id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — TOKENS GMAIL
// ═══════════════════════════════════════════════════════════

function guardarTokenGmail(negocio_id, tokens) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tokens_gmail (negocio_id, access_token, refresh_token, expiry_date, email)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(negocio_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, tokens_gmail.refresh_token),
         expiry_date = excluded.expiry_date,
         email = COALESCE(excluded.email, tokens_gmail.email),
         actualizado_en = datetime('now','localtime')`,
      [negocio_id, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null, tokens.email || null],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

function obtenerTokenGmail(negocio_id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM tokens_gmail WHERE negocio_id = ?`, [negocio_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — PAGOS (filtradas por negocio_id)
// ═══════════════════════════════════════════════════════════

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

function buscarPorReferencia(referencia, negocio_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pagos WHERE referencia = ? AND negocio_id = ?`,
      [referencia, negocio_id || 1],
      (err, fila) => {
        if (err) reject(err);
        else resolve(fila);
      }
    );
  });
}

function buscarDuplicadoReciente(referencia, negocio_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pagos 
       WHERE referencia = ? AND negocio_id = ?
       AND creado_en >= datetime('now', '-7 days', 'localtime')`,
      [referencia, negocio_id || 1],
      (err, fila) => {
        if (err) reject(err);
        else resolve(fila);
      }
    );
  });
}

function totalDelDia(negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' AND negocio_id = ?
       AND date(creado_en) = date('now', 'localtime')`,
      [negocio_id || 1],
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

function buscarPorCliente(nombre, negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' AND negocio_id = ?
       AND nombre_cliente LIKE ?
       ORDER BY id DESC LIMIT 10`,
      [negocio_id || 1, `%${nombre}%`],
      (err, filas) => {
        if (err) reject(err);
        else resolve(filas);
      }
    );
  });
}

function resumenDelDia(negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' AND negocio_id = ?
       AND date(creado_en) = date('now', 'localtime')
       ORDER BY monto DESC`,
      [negocio_id || 1],
      (err, filas) => {
        if (err) reject(err);
        else {
          const total = filas.reduce((suma, p) => suma + p.monto, 0);
          const pagoMasAlto = filas[0] || null;
          resolve({ total, cantidad: filas.length, pagoMasAlto });
        }
      }
    );
  });
}

function totalUltimos30Dias(negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM pagos 
       WHERE estado = 'REAL' AND negocio_id = ?
       AND creado_en >= datetime('now', '-30 days', 'localtime')`,
      [negocio_id || 1],
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

function obtenerPagosExportables(negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente, verificado_por, creado_en 
       FROM pagos 
       WHERE estado = 'REAL' AND negocio_id = ?
       AND creado_en >= datetime('now', '-30 days', 'localtime')
       ORDER BY id DESC`,
      [negocio_id || 1],
      (err, filas) => {
        if (err) reject(err);
        else resolve(filas);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  db,
  // Negocios
  crearNegocio,
  obtenerNegocio,
  listarNegocios,
  contarComprobantesDelMes,
  // Gmail tokens
  guardarTokenGmail,
  obtenerTokenGmail,
  // Pagos
  guardarPago,
  buscarPorReferencia,
  buscarDuplicadoReciente,
  totalDelDia,
  buscarPorCliente,
  resumenDelDia,
  totalUltimos30Dias,
  obtenerPagosExportables,
};