// api.js — Endpoints del dashboard (API) con soporte multi-negocio
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const { verificarToken, soloAdmin, limitarLogin } = require('../auth');
const {
  db,
  totalDelDia,
  totalUltimos30Dias,
  buscarPorCliente,
  crearNegocio,
  obtenerNegocio,
  listarNegocios,
  contarComprobantesDelMes,
  guardarTokenGmail,
  obtenerTokenGmail,
} = require('../db');

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════

router.post('/login', limitarLogin, (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ ok: false, error: 'Faltan datos' });

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

    // negocio_id incluido en el token
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol, negocio_id: user.negocio_id || 1 },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, nombre: user.nombre, rol: user.rol, negocio_id: user.negocio_id || 1 }
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  NEGOCIOS (solo admin)
// ═══════════════════════════════════════════════════════════

router.get('/negocios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const negocios = await listarNegocios();
    res.json({ ok: true, negocios });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/negocios/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const negocio = await obtenerNegocio(req.params.id);
    if (!negocio) return res.status(404).json({ ok: false, error: 'Negocio no encontrado' });
    const usados = await contarComprobantesDelMes(negocio.id);
    res.json({ ok: true, negocio: { ...negocio, comprobantes_usados: usados } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/negocios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, whatsapp, plan } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    const negocio = await crearNegocio({ nombre, whatsapp, plan });
    res.status(201).json({ ok: true, negocio });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/negocios/:id', verificarToken, soloAdmin, (req, res) => {
  const { nombre, whatsapp, plan, activo } = req.body;
  const sets = []; const vals = [];
  if (nombre) { sets.push('nombre=?'); vals.push(nombre); }
  if (whatsapp !== undefined) { sets.push('whatsapp=?'); vals.push(whatsapp); }
  if (plan) {
    const limites = { basico: 300, premium: 1000, empresarial: 999999 };
    if (!limites[plan]) return res.status(400).json({ ok: false, error: 'Plan inválido' });
    sets.push('plan=?', 'limite_comprobantes=?');
    vals.push(plan, limites[plan]);
  }
  if (activo !== undefined) { sets.push('activo=?'); vals.push(activo); }
  if (!sets.length) return res.json({ ok: false, error: 'Nada que actualizar' });
  vals.push(req.params.id);

  db.run(`UPDATE negocios SET ${sets.join(',')} WHERE id=?`, vals, function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, mensaje: 'Negocio actualizado' });
  });
});

// ─── Uso del plan (barra de progreso) ───────────────────
router.get('/negocios/uso/plan', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const negocio = await obtenerNegocio(nid);
    if (!negocio) return res.status(404).json({ ok: false, error: 'Negocio no encontrado' });
    const usados = await contarComprobantesDelMes(nid);
    res.json({
      ok: true,
      plan: negocio.plan,
      limite: negocio.limite_comprobantes,
      usados,
      porcentaje: Math.round((usados / negocio.limite_comprobantes) * 100),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  GMAIL TOKENS POR NEGOCIO
// ═══════════════════════════════════════════════════════════

router.post('/gmail/token', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { access_token, refresh_token, expiry_date, email } = req.body;
    if (!access_token) return res.status(400).json({ ok: false, error: 'Falta access_token' });
    await guardarTokenGmail(req.user.negocio_id, { access_token, refresh_token, expiry_date, email });
    res.json({ ok: true, mensaje: 'Token Gmail guardado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/gmail/estado', verificarToken, async (req, res) => {
  try {
    const token = await obtenerTokenGmail(req.user.negocio_id);
    res.json({ ok: true, conectado: !!token, email: token?.email || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — todo filtrado por negocio_id del token
// ═══════════════════════════════════════════════════════════

router.get('/dashboard/totales', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const dia = await totalDelDia(nid);
    const mes = await totalUltimos30Dias(nid);
    res.json({
      dia: { total: dia.total, cantidad: dia.cantidad },
      mes: { total: mes.total, cantidad: mes.cantidad }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/comprobantes/:foto', verificarToken, (req, res) => {
  const foto = req.params.foto.replace(/[^a-zA-Z0-9._-]/g, '');
  const ruta = path.join(__dirname, '..', 'comprobantes', foto);
  if (fs.existsSync(ruta)) {
    res.sendFile(ruta);
  } else {
    res.status(404).json({ ok: false, error: 'Foto no encontrada' });
  }
});

router.get('/dashboard/duplicados', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const estado = typeof req.query.estado === 'string' ? req.query.estado.toUpperCase() : 'TODOS';
    const estadosPermitidos = ['TODOS', 'PENDIENTE', 'DUPLICADO', 'LEGITIMO', 'ARCHIVADO'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado de duplicado inválido' });
    }

    const filtroEstado = estado === 'TODOS'
      ? `AND (COALESCE(r.estado, 'PENDIENTE') = 'PENDIENTE'
          OR r.revisado_en >= datetime('now', '-30 days', 'localtime'))`
      : 'AND COALESCE(r.estado, \'PENDIENTE\') = ?';
    const parametros = estado === 'TODOS' ? [nid] : [nid, estado];

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
       WHERE p.estado = 'DUPLICADO' AND p.negocio_id = ? ${filtroEstado}
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

router.post('/dashboard/duplicados/:pagoId/revision', verificarToken, soloAdmin, (req, res) => {
  const pagoId = Number.parseInt(req.params.pagoId, 10);
  const estado = typeof req.body.estado === 'string' ? req.body.estado.toUpperCase() : '';
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  const estadosPermitidos = ['DUPLICADO', 'LEGITIMO', 'ARCHIVADO'];
  const nid = req.user.negocio_id;

  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return res.status(400).json({ ok: false, error: 'Pago inválido' });
  }
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Decisión inválida' });
  }
  if (motivo.length < 3 || motivo.length > 500) {
    return res.status(400).json({ ok: false, error: 'El motivo debe tener entre 3 y 500 caracteres' });
  }

  // Verificar que el pago pertenece al negocio del usuario
  db.get('SELECT id FROM pagos WHERE id = ? AND estado = \'DUPLICADO\' AND negocio_id = ?', [pagoId, nid], (findErr, pago) => {
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

router.get('/dashboard/pendientes', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    db.get(
      `SELECT COUNT(*) as cantidad, COALESCE(SUM(monto),0) as total 
       FROM pagos WHERE estado = 'NO_ENCONTRADO' AND negocio_id = ?
       AND date(creado_en) = date('now', 'localtime')`,
      [nid],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/pagos', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const limite = parseInt(req.query.limite) || 20;
    db.all(
      'SELECT * FROM pagos WHERE estado = ? AND negocio_id = ? ORDER BY id DESC LIMIT ?',
      ['REAL', nid, limite],
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pagos/:id/estado', verificarToken, soloAdmin, (req, res) => {
  const { estado } = req.body;
  const nid = req.user.negocio_id;
  if (!['REAL', 'NO_ENCONTRADO', 'DUPLICADO', 'FALSO'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Estado no válido' });
  }
  // Solo puede cambiar pagos de su negocio
  db.run('UPDATE pagos SET estado = ?, fuente = ? WHERE id = ? AND negocio_id = ?',
    [estado, 'manual_admin', req.params.id, nid],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
      res.json({ ok: true, mensaje: 'Estado actualizado' });
    }
  );
});

router.get('/dashboard/stats', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const dias = Math.min(parseInt(req.query.dias) || 30, 365);
    db.all(
      `SELECT fecha, COUNT(*) as cantidad, SUM(monto) as total 
       FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
       AND creado_en >= datetime('now', '-' || ? || ' days', 'localtime')
       GROUP BY fecha ORDER BY fecha ASC`,
      [nid, dias],
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/buscar/:nombre', verificarToken, async (req, res) => {
  try {
    const pagos = await buscarPorCliente(req.params.nombre, req.user.negocio_id);
    res.json(pagos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  USUARIOS — filtrados por negocio_id
// ═══════════════════════════════════════════════════════════

router.get('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const nid = req.user.negocio_id;
  db.all(
    'SELECT id, usuario, nombre, rol, whatsapp, negocio_id, activo, ultimo_login, creado_en FROM usuarios WHERE negocio_id = ? ORDER BY id',
    [nid],
    (err, filas) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, usuarios: filas });
    }
  );
});

router.post('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const { usuario, password, nombre, rol, whatsapp } = req.body;
  const nid = req.user.negocio_id;
  if (!usuario || !password || !nombre) return res.status(400).json({ ok: false, error: 'Faltan campos' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Contraseña mínimo 6 caracteres' });

  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  db.run(
    'INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol, whatsapp, negocio_id) VALUES (?,?,?,?,?,?,?)',
    [usuario.trim().toLowerCase(), hash, salt, nombre.trim(), rol || 'empleado', whatsapp || null, nid],
    function (err) {
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
  const nid = req.user.negocio_id;
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
  vals.push(req.params.id, nid);
  // Solo puede editar usuarios de su negocio
  db.run(`UPDATE usuarios SET ${sets.join(',')} WHERE id=? AND negocio_id=?`, vals, function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, mensaje: 'Usuario actualizado' });
  });
});

router.delete('/usuarios/:id', verificarToken, soloAdmin, (req, res) => {
  const nid = req.user.negocio_id;
  db.run('UPDATE usuarios SET activo=0 WHERE id=? AND negocio_id=?', [req.params.id, nid], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, mensaje: 'Usuario desactivado' });
  });
});

// ─── Exportar (filtrado por negocio) ────────────────────
router.get('/exportar', verificarToken, soloAdmin, (req, res) => {
  const nid = req.user.negocio_id;
  db.all(
    `SELECT id, monto, referencia, banco, fecha, hora, estado, fuente, nombre_cliente, verificado_por, creado_en 
     FROM pagos 
     WHERE estado = 'REAL' AND negocio_id = ?
     AND creado_en >= datetime('now', '-30 days', 'localtime')
     ORDER BY id DESC`,
    [nid],
    (err, filas) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(filas);
    }
  );
});

module.exports = router;