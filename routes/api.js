// api.js — Endpoints del dashboard (API)
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const { verificarToken, soloAdmin, limitarLogin } = require('../auth');
const { totalDelDia, totalUltimos30Dias, buscarPorCliente } = require('../db');

// ─── Login ───────────────────────────────────────────────
router.post('/login', limitarLogin, (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  const { db } = require('../db.js');
  db.get('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1', [usuario.trim().toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ ok: false, error: 'Error del servidor' });
    if (!user) return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });

    const hash = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
    if (hash !== user.password_hash) {
      const msg = res.locals.advertencia
        ? `Usuario o contraseña incorrectos. ${res.locals.advertencia}`
        : 'Usuario o contraseña incorrectos';
      return res.status(401).json({ ok: false, error: msg });
    }

    db.run('UPDATE usuarios SET ultimo_login = datetime("now","localtime") WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, nombre: user.nombre, rol: user.rol }
    });
  });
});

// ─── Totales del día y mes ──────────────────────────────
router.get('/dashboard/totales', verificarToken, async (req, res) => {
  try {
    const dia = await totalDelDia();
    const mes = await totalUltimos30Dias();
    res.json({
      dia: { total: dia.total, cantidad: dia.cantidad },
      mes: { total: mes.total, cantidad: mes.cantidad }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Servir comprobantes (fotos) ────────────────────────
router.get('/comprobantes/:foto', verificarToken, (req, res) => {
  const foto = req.params.foto.replace(/[^a-zA-Z0-9._-]/g, '');
  const ruta = path.join(__dirname, '..', 'comprobantes', foto);
  if (fs.existsSync(ruta)) {
    res.sendFile(ruta);
  } else {
    res.status(404).json({ ok: false, error: 'Foto no encontrada' });
  }
});

// ─── Lista de duplicados ────────────────────────────────
router.get('/dashboard/duplicados', verificarToken, async (req, res) => {
  try {
    const { db } = require('../db.js');
    const estado = typeof req.query.estado === 'string' ? req.query.estado.toUpperCase() : 'TODOS';
    const estadosPermitidos = ['TODOS', 'PENDIENTE', 'DUPLICADO', 'LEGITIMO', 'ARCHIVADO'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado de duplicado inválido' });
    }

    const filtroEstado = estado === 'TODOS'
      ? `AND (COALESCE(r.estado, 'PENDIENTE') = 'PENDIENTE'
          OR r.revisado_en >= datetime('now', '-30 days', 'localtime'))`
      : 'AND COALESCE(r.estado, \'PENDIENTE\') = ?';
    const parametros = estado === 'TODOS' ? [] : [estado];
    db.all(
      `SELECT p.id, p.referencia, p.monto, p.banco, p.fecha, p.hora,
              p.verificado_por, p.creado_en, p.foto, p.nombre_cliente,
              COALESCE(r.estado, 'PENDIENTE') AS revision_estado,
              r.motivo AS revision_motivo, r.revisado_por, r.revisado_en
       FROM pagos p
       LEFT JOIN duplicate_reviews r ON r.id = (
         SELECT latest.id FROM duplicate_reviews latest
         WHERE latest.pago_id = p.id ORDER BY latest.id DESC LIMIT 1
       )
       WHERE p.estado = 'DUPLICADO' ${filtroEstado}
       ORDER BY p.id DESC LIMIT 50`,
      parametros,
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Revisar un duplicado (admin) ───────────────────────
router.post('/dashboard/duplicados/:pagoId/revision', verificarToken, soloAdmin, (req, res) => {
  const pagoId = Number.parseInt(req.params.pagoId, 10);
  const estado = typeof req.body.estado === 'string' ? req.body.estado.toUpperCase() : '';
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  const estadosPermitidos = ['DUPLICADO', 'LEGITIMO', 'ARCHIVADO'];

  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return res.status(400).json({ ok: false, error: 'Pago inválido' });
  }
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Decisión inválida' });
  }
  if (motivo.length < 3 || motivo.length > 500) {
    return res.status(400).json({ ok: false, error: 'El motivo debe tener entre 3 y 500 caracteres' });
  }

  const { db } = require('../db.js');
  db.get('SELECT id FROM pagos WHERE id = ? AND estado = \'DUPLICADO\'', [pagoId], (findErr, pago) => {
    if (findErr) return res.status(500).json({ ok: false, error: findErr.message });
    if (!pago) return res.status(404).json({ ok: false, error: 'Duplicado no encontrado' });

    db.run(
      `INSERT INTO duplicate_reviews (pago_id, estado, motivo, revisado_por)
       VALUES (?, ?, ?, ?)`,
      [pagoId, estado, motivo, req.user.usuario],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ ok: false, error: insertErr.message });
        res.json({
          ok: true,
          revision: {
            id: this.lastID,
            pago_id: pagoId,
            estado,
            motivo,
            revisado_por: req.user.usuario,
          },
        });
      }
    );
  });
});

// ─── Pendientes (hoy) ───────────────────────────────────
router.get('/dashboard/pendientes', verificarToken, async (req, res) => {
  try {
    const { db } = require('../db.js');
    db.get(
      `SELECT COUNT(*) as cantidad, COALESCE(SUM(monto),0) as total 
       FROM pagos WHERE estado = 'NO_ENCONTRADO' AND date(creado_en) = date('now', 'localtime')`,
      [],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Lista de pagos reales ──────────────────────────────
router.get('/dashboard/pagos', verificarToken, async (req, res) => {
  try {
    const { db } = require('../db.js');
    const limite = parseInt(req.query.limite) || 20;
    db.all(
      'SELECT * FROM pagos WHERE estado = ? ORDER BY id DESC LIMIT ?',
      ['REAL', limite],
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cambiar estado de un pago (admin) ─────────────────
router.put('/pagos/:id/estado', verificarToken, soloAdmin, (req, res) => {
  const { estado } = req.body;
  if (!['REAL', 'NO_ENCONTRADO', 'DUPLICADO', 'FALSO'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Estado no válido' });
  }
  const { db } = require('../db.js');
  db.run('UPDATE pagos SET estado = ?, fuente = ? WHERE id = ?', 
    [estado, 'manual_admin', req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, mensaje: 'Estado actualizado' });
    }
  );
});

// ─── Estadísticas por día ───────────────────────────────
router.get('/dashboard/stats', verificarToken, async (req, res) => {
  try {
    const { db } = require('../db.js');
    const dias = parseInt(req.query.dias) || 30;
    db.all(
      `SELECT fecha, COUNT(*) as cantidad, SUM(monto) as total 
       FROM pagos WHERE estado = 'REAL' 
       AND creado_en >= datetime('now', '-' || ? || ' days', 'localtime')
       GROUP BY fecha ORDER BY fecha ASC`,
      [Math.min(parseInt(dias) || 30, 365)],
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Buscar por cliente ─────────────────────────────────
router.get('/dashboard/buscar/:nombre', verificarToken, async (req, res) => {
  try {
    const pagos = await buscarPorCliente(req.params.nombre);
    res.json(pagos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Usuarios ───────────────────────────────────────────
router.get('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const { db } = require('../db.js');
  db.all('SELECT id, usuario, nombre, rol, whatsapp, activo, ultimo_login, creado_en FROM usuarios ORDER BY id', [], (err, filas) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, usuarios: filas });
  });
});

router.post('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const { usuario, password, nombre, rol, whatsapp } = req.body;
  if (!usuario || !password || !nombre) return res.status(400).json({ ok: false, error: 'Faltan campos' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Contraseña mínimo 6 caracteres' });

  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  const { db } = require('../db.js');
  db.run(
    'INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol, whatsapp) VALUES (?,?,?,?,?,?)',
    [usuario.trim().toLowerCase(), hash, salt, nombre.trim(), rol || 'empleado', whatsapp || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ ok: false, error: 'Ese usuario ya existe' });
        return res.status(500).json({ ok: false, error: err.message });
      }
      res.status(201).json({ ok: true, id: this.lastID, mensaje: 'Usuario creado' });
    }
  );
});

router.put('/usuarios/:id', verificarToken, soloAdmin, (req, res) => {
  const { nombre, rol, whatsapp, activo, password } = req.body;
  const sets = []; const vals = [];
  if (nombre) { sets.push('nombre=?'); vals.push(nombre); }
  if (rol) { sets.push('rol=?'); vals.push(rol); }
  if (whatsapp !== undefined) { sets.push('whatsapp=?'); vals.push(whatsapp); }
  if (activo !== undefined) { sets.push('activo=?'); vals.push(activo); }
  if (password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    sets.push('password_hash=?', 'salt=?'); vals.push(hash, salt);
  }
  if (!sets.length) return res.json({ ok: false, error: 'Nada que actualizar' });
  vals.push(req.params.id);
  const { db } = require('../db.js');
  db.run(`UPDATE usuarios SET ${sets.join(',')} WHERE id=?`, vals, function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, mensaje: 'Usuario actualizado' });
  });
});

router.delete('/usuarios/:id', verificarToken, soloAdmin, (req, res) => {
  const { db } = require('../db.js');
  db.run('UPDATE usuarios SET activo=0 WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, mensaje: 'Usuario desactivado' });
  });
});

module.exports = router;
