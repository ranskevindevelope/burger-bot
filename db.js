// db.js — Base de datos SQLite con soporte multi-negocio
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./vinsonbot.db', (err) => {
  if (err) {
    console.error('[DB] Error al conectar:', err.message);
  } else {
    console.log('[DB] Conectado a la base de datos SQLite');
  }
});

// WAL: lectores y escritores no se bloquean entre sí.
// busy_timeout: si hay un lock momentáneo, reintenta hasta 5s en vez de fallar al instante.
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA busy_timeout = 5000');

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
      VALUES (1, 'Mi Negocio', NULL, 'basico', 300)
    `);
    // Migración: agregar trial_fin si no existe
    db.run(`ALTER TABLE negocios ADD COLUMN trial_fin TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('[DB] Error migrando trial_fin:', err.message);
      }
    });
    db.run(`ALTER TABLE negocios ADD COLUMN pagado INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('[DB] Error migrando pagado:', err.message);
      }
    });
    // Migración: horario del negocio (hora de cierre + días que opera)
    db.run(`ALTER TABLE negocios ADD COLUMN hora_cierre TEXT DEFAULT '21:00'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('[DB] Error migrando hora_cierre:', err.message);
      }
    });
    db.run(`ALTER TABLE negocios ADD COLUMN dias_operacion TEXT DEFAULT '[0,1,2,3,4,5,6]'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('[DB] Error migrando dias_operacion:', err.message);
      }
    });
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

// ─── Pagos de suscripción a FlashPago (Wompi) ──────────────
db.run(`
  CREATE TABLE IF NOT EXISTS pagos_plataforma (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    referencia TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    monto INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','ERROR')),
    wompi_transaction_id TEXT,
    creado_en TEXT DEFAULT (datetime('now','localtime')),
    actualizado_en TEXT,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (err) console.error('[DB] Error creando tabla pagos_plataforma:', err.message);
  else {
    console.log('[DB] Tabla "pagos_plataforma" lista');
    db.run('CREATE INDEX IF NOT EXISTS idx_pagos_plataforma_negocio ON pagos_plataforma (negocio_id)');
  }
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
    // Migración: agregar email si la tabla ya existía sin ella (recuperación de contraseña)
    db.run(`ALTER TABLE usuarios ADD COLUMN email TEXT`, (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column')) {
        console.error('[DB] Error migrando email en usuarios:', alterErr.message);
      } else {
        console.log('[DB] Columna email en usuarios: OK');
      }
    });
  }
});

// ─── Códigos de verificación (registro) ───────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS codigos_verificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    codigo TEXT NOT NULL,
    datos TEXT NOT NULL,
    intentos INTEGER DEFAULT 0,
    usado INTEGER DEFAULT 0,
    expira_en TEXT NOT NULL,
    creado_en TEXT DEFAULT (datetime('now','localtime'))
  )
`, (err) => {
  if (!err) console.log('[DB] Tabla "codigos_verificacion" lista');
});
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

function crearNegocio({ nombre, whatsapp, plan, limite_comprobantes, ciudad, banco }) {
  const limite = limite_comprobantes || LIMITES_PLAN[plan] || 300;
  // Trial de 15 días desde hoy
  const trial = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO negocios (nombre, whatsapp, plan, limite_comprobantes, trial_fin, pagado, ciudad, banco) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [nombre, whatsapp || null, plan || 'basico', limite, trial, ciudad || null, banco || null],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, nombre, plan: plan || 'basico', limite, trial_fin: trial });
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

// hora_cierre puede ser un string legado "HH:MM" (mismo horario todos los días)
// o un JSON { "0": "HH:MM", ..., "6": "HH:MM" } con horario distinto por día.
function parsearHoraCierre(horaCierreRaw) {
  if (!horaCierreRaw) return null;
  try {
    const obj = JSON.parse(horaCierreRaw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch {
    // no era JSON — es el formato viejo, un string plano "HH:MM"
  }
  return null;
}

function horaCierreDelDia(horaCierreRaw, dia) {
  const porDia = parsearHoraCierre(horaCierreRaw);
  if (porDia) return porDia[String(dia)] || porDia.default || '21:00';
  return horaCierreRaw || '21:00';
}

function actualizarHorarioNegocio(id, { hora_cierre, dias_operacion }) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE negocios SET hora_cierre = ?, dias_operacion = ? WHERE id = ?`,
      [hora_cierre, JSON.stringify(dias_operacion), id],
      function (err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error('Negocio no encontrado'));
        else resolve();
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — PAGOS DE SUSCRIPCIÓN (Wompi)
// ═══════════════════════════════════════════════════════════

const LIMITES_PLAN = { basico: 300, premium: 1000, empresarial: 999999 };
const PRECIOS_CENTAVOS = { basico: 3990000, premium: 7990000, empresarial: 14990000 };

function crearPagoPlataforma({ negocio_id, referencia, plan, monto }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO pagos_plataforma (negocio_id, referencia, plan, monto) VALUES (?, ?, ?, ?)`,
      [negocio_id, referencia, plan, monto],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function obtenerPagoPlataforma(referencia) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM pagos_plataforma WHERE referencia = ?`, [referencia], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function actualizarPagoPlataforma(referencia, { estado, wompi_transaction_id }) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE pagos_plataforma SET estado = ?, wompi_transaction_id = ?, actualizado_en = datetime('now','localtime') WHERE referencia = ?`,
      [estado, wompi_transaction_id || null, referencia],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

function marcarNegocioPagado(negocio_id, plan) {
  const limite = LIMITES_PLAN[plan] || 300;
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE negocios SET pagado = 1, plan = ?, limite_comprobantes = ? WHERE id = ?`,
      [plan, limite, negocio_id],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
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

function verificarTrialActivo(negocio_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT trial_fin, pagado, plan FROM negocios WHERE id = ? AND activo = 1`,
      [negocio_id],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ activo: false, razon: 'negocio_no_encontrado' });

        // Si ya pagó, siempre activo
        if (row.pagado) return resolve({ activo: true, pagado: true, plan: row.plan });

        // Si no tiene trial_fin (negocio viejo), está activo
        if (!row.trial_fin) return resolve({ activo: true, pagado: false, plan: row.plan });

        const hoy = new Date().toISOString().split('T')[0];
        const diasRestantes = Math.ceil((new Date(row.trial_fin) - new Date(hoy)) / (1000 * 60 * 60 * 24));

        if (diasRestantes <= 0) {
          return resolve({ activo: false, razon: 'trial_expirado', trial_fin: row.trial_fin, dias: 0, plan: row.plan });
        }

        resolve({ activo: true, pagado: false, trial_fin: row.trial_fin, dias: diasRestantes, plan: row.plan });
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
//  TABLAS — VENTAS (cierre de caja + gastos)
// ═══════════════════════════════════════════════════════════

db.run(`
  CREATE TABLE IF NOT EXISTS cierres_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    total_ventas INTEGER NOT NULL DEFAULT 0,
    total_transferencias INTEGER NOT NULL DEFAULT 0,
    total_efectivo INTEGER NOT NULL DEFAULT 0,
    total_gastos INTEGER NOT NULL DEFAULT 0,
    nota TEXT,
    cerrado_por TEXT,
    foto TEXT,
    creado_en TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (!err) {
    console.log('[DB] Tabla "cierres_caja" lista');
    db.run('CREATE INDEX IF NOT EXISTS idx_cierres_negocio_fecha ON cierres_caja (negocio_id, fecha)');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    monto INTEGER NOT NULL,
    categoria TEXT DEFAULT 'general',
    descripcion TEXT,
    registrado_por TEXT,
    creado_en TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
  )
`, (err) => {
  if (!err) {
    console.log('[DB] Tabla "gastos" lista');
    db.run('CREATE INDEX IF NOT EXISTS idx_gastos_negocio_fecha ON gastos (negocio_id, fecha)');
  }
});

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — CIERRES DE CAJA
// ═══════════════════════════════════════════════════════════

function crearCierreCaja(cierre) {
  return new Promise((resolve, reject) => {
    const { negocio_id, fecha, total_ventas, total_transferencias, total_efectivo, total_gastos, nota, cerrado_por, foto } = cierre;
    db.run(
      `INSERT INTO cierres_caja (negocio_id, fecha, total_ventas, total_transferencias, total_efectivo, total_gastos, nota, cerrado_por, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [negocio_id, fecha, total_ventas || 0, total_transferencias || 0, total_efectivo || 0, total_gastos || 0, nota || null, cerrado_por || null, foto || null],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function obtenerCierreDelDia(negocio_id, fecha) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM cierres_caja WHERE negocio_id = ? AND fecha = ?`,
      [negocio_id, fecha],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function listarCierres(negocio_id, dias = 30) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM cierres_caja
       WHERE negocio_id = ?
       AND creado_en >= datetime('now', '-' || ? || ' days', 'localtime')
       ORDER BY fecha DESC`,
      [negocio_id, dias],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function resumenSemanal(negocio_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT fecha, total_ventas, total_transferencias, total_efectivo, total_gastos
       FROM cierres_caja
       WHERE negocio_id = ?
       AND creado_en >= datetime('now', '-7 days', 'localtime')
       ORDER BY fecha ASC`,
      [negocio_id],
      (err, rows) => {
        if (err) reject(err);
        else {
          const totales = rows.reduce((acc, r) => ({
            ventas: acc.ventas + r.total_ventas,
            transferencias: acc.transferencias + r.total_transferencias,
            efectivo: acc.efectivo + r.total_efectivo,
            gastos: acc.gastos + r.total_gastos,
          }), { ventas: 0, transferencias: 0, efectivo: 0, gastos: 0 });
          resolve({ dias: rows, totales });
        }
      }
    );
  });
}

// ─── Calcular transferencias del día desde pagos REAL ───
function totalTransferenciasDia(negocio_id, fecha) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COALESCE(SUM(monto), 0) as total, COUNT(*) as cantidad
       FROM pagos
       WHERE estado = 'REAL' AND negocio_id = ? AND fecha = ?`,
      [negocio_id, fecha],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — GASTOS
// ═══════════════════════════════════════════════════════════

function registrarGasto(gasto) {
  return new Promise((resolve, reject) => {
    const { negocio_id, fecha, monto, categoria, descripcion, registrado_por } = gasto;
    db.run(
      `INSERT INTO gastos (negocio_id, fecha, monto, categoria, descripcion, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [negocio_id, fecha, monto, categoria || 'general', descripcion || null, registrado_por || null],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function listarGastos(negocio_id, fecha) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM gastos WHERE negocio_id = ? AND fecha = ? ORDER BY id DESC`,
      [negocio_id, fecha],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function totalGastosDia(negocio_id, fecha) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COALESCE(SUM(monto), 0) as total, COUNT(*) as cantidad
       FROM gastos WHERE negocio_id = ? AND fecha = ?`,
      [negocio_id, fecha],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function gastosPorCategoria(negocio_id, dias = 30) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT categoria, SUM(monto) as total, COUNT(*) as cantidad
       FROM gastos
       WHERE negocio_id = ?
       AND creado_en >= datetime('now', '-' || ? || ' days', 'localtime')
       GROUP BY categoria
       ORDER BY total DESC`,
      [negocio_id, dias],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function eliminarGasto(id, negocio_id) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM gastos WHERE id = ? AND negocio_id = ?`,
      [id, negocio_id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES — CÓDIGOS DE VERIFICACIÓN
// ═══════════════════════════════════════════════════════════

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function guardarCodigoVerificacion(email, codigo, datos) {
  return new Promise((resolve, reject) => {
    // Invalidar códigos anteriores del mismo email
    db.run(`UPDATE codigos_verificacion SET usado = 1 WHERE email = ? AND usado = 0`, [email], () => {
      const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos
      db.run(
        `INSERT INTO codigos_verificacion (email, codigo, datos, expira_en) VALUES (?, ?, ?, ?)`,
        [email, codigo, JSON.stringify(datos), expira],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, codigo });
        }
      );
    });
  });
}

function verificarCodigo(email, codigo) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM codigos_verificacion
       WHERE email = ? AND codigo = ? AND usado = 0 AND intentos < 5
       AND expira_en > datetime('now')
       ORDER BY id DESC LIMIT 1`,
      [email, codigo],
      (err, row) => {
        if (err) return reject(err);
        if (!row) {
          // Incrementar intentos del último código (SQLite no soporta ORDER BY/LIMIT en UPDATE)
          db.run(
            `UPDATE codigos_verificacion SET intentos = intentos + 1
             WHERE id = (SELECT id FROM codigos_verificacion WHERE email = ? AND usado = 0 ORDER BY id DESC LIMIT 1)`,
            [email],
            (updateErr) => {
              if (updateErr) console.error('[DB] Error incrementando intentos:', updateErr.message);
            }
          );
          return resolve(null);
        }
        // Marcar como usado
        db.run(`UPDATE codigos_verificacion SET usado = 1 WHERE id = ?`, [row.id]);
        resolve(JSON.parse(row.datos));
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
  actualizarHorarioNegocio,
  parsearHoraCierre,
  horaCierreDelDia,
  contarComprobantesDelMes,
  verificarTrialActivo,
  // Pagos de suscripción (Wompi)
  crearPagoPlataforma,
  obtenerPagoPlataforma,
  actualizarPagoPlataforma,
  marcarNegocioPagado,
  PRECIOS_CENTAVOS,
  LIMITES_PLAN,
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
  // Cierres de caja
  crearCierreCaja,
  obtenerCierreDelDia,
  listarCierres,
  resumenSemanal,
  totalTransferenciasDia,
  // Gastos
  registrarGasto,
  listarGastos,
  totalGastosDia,
  gastosPorCategoria,
  eliminarGasto,
  // Verificación
  generarCodigo,
  guardarCodigoVerificacion,
  verificarCodigo,
};