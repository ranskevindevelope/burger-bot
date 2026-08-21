const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('./config');

function verificarToken(req, res, next) {
  let token = null;
  const header = req.headers.authorization || req.headers.Authorization;
  if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ ok: false, error: 'No autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (!req.user || (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')) {
    return res.status(403).json({ ok: false, error: 'Solo administradores' });
  }
  next();
}

function soloSuperAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'Solo superadmin' });
  }
  next();
}

// Rate limiter para login
const loginIntentos = new Map();
function limitarLogin(req, res, next) {
  const ip = req.ip;
  const ahora = Date.now();
  const datos = loginIntentos.get(ip);

  if (datos && ahora - datos.inicio < 60000 && datos.intentos >= 5) {
    const segundosRestantes = Math.ceil((60000 - (ahora - datos.inicio)) / 1000);
    return res.status(429).json({ ok: false, error: `Demasiados intentos. Espera ${segundosRestantes} segundos.` });
  }

  if (!datos || ahora - datos.inicio > 60000) {
    loginIntentos.set(ip, { intentos: 1, inicio: ahora });
  } else {
    datos.intentos++;
  }

  const restantes = 5 - (loginIntentos.get(ip).intentos);
  if (restantes <= 2 && restantes > 0) {
    res.locals.advertencia = `Te quedan ${restantes} intento(s)`;
  }
  next();
}

// limpiar cada 5 minutos
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, datos] of loginIntentos) {
    if (ahora - datos.inicio > 300000) loginIntentos.delete(ip);
  }
}, 300000);

module.exports = { verificarToken, soloAdmin, soloSuperAdmin, limitarLogin };