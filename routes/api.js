// api.js — Endpoints del dashboard (API) con soporte multi-negocio
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { google } = require('googleapis');

// Mínimo 8 caracteres, al menos una mayúscula y una minúscula
const PASSWORD_VALIDA = /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
const PASSWORD_ERROR = 'La contraseña debe tener mínimo 8 caracteres, con mayúsculas y minúsculas';

const config = require('../config');
const { verificarToken, soloAdmin, soloSuperAdmin, limitarLogin } = require('../auth');
const {
  db,
  totalDelDia,
  totalUltimos30Dias,
  buscarPorCliente,
  crearNegocio,
  obtenerNegocio,
  listarNegocios,
  actualizarHorarioNegocio,
  parsearHoraCierre,
  LIMITES_PLAN,
  contarComprobantesDelMes,
  verificarTrialActivo,
  guardarTokenGmail,
  obtenerTokenGmail,
  crearCierreCaja,
  obtenerCierreDelDia,
  listarCierres,
  resumenSemanal,
  totalTransferenciasDia,
  registrarGasto,
  listarGastos,
  totalGastosDia,
  gastosPorCategoria,
  eliminarGasto,
} = require('../db');

// ─── Google OAuth config ────────────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
let oAuth2Config = null;

function getOAuth2Client(redirectUri) {
  if (!oAuth2Config) {
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    oAuth2Config = creds.installed || creds.web;
  }
  return new google.auth.OAuth2(
    oAuth2Config.client_id,
    oAuth2Config.client_secret,
    redirectUri
  );
}

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════

router.post('/login', limitarLogin, (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  db.get('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1', [usuario.trim().toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ ok: false, error: 'Error del servidor' });
    // Ejecutar el mismo cómputo PBKDF2 y comparar en tiempo constante en ambos
    // casos (usuario existente o no) para no revelar la existencia por timing.
    const DUMMY_SALT =
      '0000000000000000000000000000000000000000000000000000000000000000';

    let hashOk = false;
    if (user) {
      const provided = Buffer.from(
        crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex'),
        'hex'
      );
      const expected = Buffer.from(user.password_hash, 'hex');
      hashOk =
        provided.length === expected.length &&
        crypto.timingSafeEqual(provided, expected);
    } else {
      // Igualar el costo computacional (10k iteraciones) con un salt fijo.
      crypto.pbkdf2Sync(password, DUMMY_SALT, 10000, 64, 'sha512');
    }

    if (!hashOk) {
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

function formatearWhatsapp(num) {
  if (!num) return null;
  let limpio = num.replace(/[\s\-\+\(\)]/g, '');
  if (limpio.includes('@')) return limpio;
  if (limpio.startsWith('3') && limpio.length === 10) limpio = '57' + limpio;
  return limpio + '@c.us';
}

// ═══════════════════════════════════════════════════════════
//  REGISTRO (público, sin auth)
// ═══════════════════════════════════════════════════════════

const { enviarCodigoVerificacion, enviarBienvenida, enviarCodigoRecuperacion } = require('../mailer');
const { generarCodigo, guardarCodigoVerificacion, verificarCodigo } = require('../db');

// Paso 1: Enviar código de verificación
router.post('/registro/enviar-codigo', limitarLogin, async (req, res) => {
  try {
    const { email, nombre_negocio, plan, ciudad, whatsapp_negocio, banco, nombre, usuario, password } = req.body;

    // Validaciones
    if (!email || !nombre_negocio || !nombre || !usuario || !password) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }
    if (!PASSWORD_VALIDA.test(password)) {
      return res.status(400).json({ ok: false, error: PASSWORD_ERROR });
    }
    if (!['basico', 'premium', 'empresarial'].includes(plan)) {
      return res.status(400).json({ ok: false, error: 'Plan no válido' });
    }

    // Verificar que el usuario no exista
    const existeUsuario = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM usuarios WHERE usuario = ?', [usuario.trim().toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (existeUsuario) {
      return res.status(409).json({ ok: false, error: 'Ese usuario ya existe. Elige otro.' });
    }

    // Verificar que el email no esté registrado
    const existeEmail = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (existeEmail) {
      return res.status(409).json({ ok: false, error: 'Ese email ya está registrado. Usa "Recuperar contraseña" si es tu cuenta.' });
    }

    // Generar y guardar código
    const codigo = generarCodigo();
    await guardarCodigoVerificacion(email, codigo, {
      email, nombre_negocio, plan, ciudad, whatsapp_negocio, banco, nombre, usuario, password,
    });

    // Enviar correo
    await enviarCodigoVerificacion(email, codigo, nombre_negocio);

    res.json({ ok: true, mensaje: 'Código enviado', email });
  } catch (err) {
    console.error('[Registro] Error enviando código:', err.message);
    res.status(500).json({ ok: false, error: 'Error enviando el código. Intenta de nuevo.' });
  }
});

// Paso 2: Verificar código y crear cuenta
router.post('/registro/verificar', limitarLogin, async (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }

    const datos = await verificarCodigo(email, codigo);
    if (!datos) {
      return res.status(400).json({ ok: false, error: 'Código incorrecto o expirado' });
    }

    // Crear negocio — durante el trial gratis el límite siempre es el del plan Básico
    // (300 comprobantes), sin importar qué plan haya elegido. El límite real de su
    // plan se activa recién cuando paga (ver marcarNegocioPagado).
    const LIMITE_TRIAL = 300;
    const negocio = await crearNegocio({
      nombre: datos.nombre_negocio,
      whatsapp: datos.whatsapp_negocio || null,
      plan: datos.plan,
      limite_comprobantes: LIMITE_TRIAL,
      ciudad: datos.ciudad,
      banco: datos.banco,
    });

    // Crear usuario admin
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(datos.password, salt, 10000, 64, 'sha512').toString('hex');

    const userId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol, whatsapp, negocio_id, email)
         VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`,
        [datos.usuario.trim().toLowerCase(), hash, salt, datos.nombre, formatearWhatsapp(datos.whatsapp_negocio), negocio.id, datos.email],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Enviar email de bienvenida
    try {
      await enviarBienvenida(datos.email, datos.nombre, datos.usuario);
    } catch (e) {
      console.error('[Registro] Error enviando bienvenida:', e.message);
    }

    // Generar token JWT para auto-login
    const token = jwt.sign(
      { id: userId, usuario: datos.usuario, rol: 'admin', negocio_id: negocio.id },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Registro] Nuevo negocio: ${datos.nombre_negocio} (${datos.plan}) — ${datos.email}`);

    res.status(201).json({
      ok: true,
      token,
      user: { id: userId, nombre: datos.nombre, rol: 'admin', negocio_id: negocio.id },
      negocio: { id: negocio.id, nombre: datos.nombre_negocio, plan: datos.plan },
    });
  } catch (err) {
    console.error('[Registro] Error verificando:', err.message);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Ese usuario ya existe' });
    }
    res.status(500).json({ ok: false, error: 'Error creando la cuenta' });
  }
});

// Reenviar código
router.post('/registro/reenviar', limitarLogin, async (req, res) => {
  try {
    const { email, nombre_negocio } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: 'Falta el email' });

    const codigo = generarCodigo();

    // Buscar datos del último código para este email
    const ultimo = await new Promise((resolve, reject) => {
      db.get(
        `SELECT datos FROM codigos_verificacion WHERE email = ? ORDER BY id DESC LIMIT 1`,
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? JSON.parse(row.datos) : null);
        }
      );
    });

    if (!ultimo) {
      return res.status(404).json({ ok: false, error: 'No hay registro pendiente para este email' });
    }

    await guardarCodigoVerificacion(email, codigo, ultimo);
    await enviarCodigoVerificacion(email, codigo, nombre_negocio || ultimo.nombre_negocio);

    res.json({ ok: true, mensaje: 'Código reenviado' });
  } catch (err) {
    console.error('[Registro] Error reenviando:', err.message);
    res.status(500).json({ ok: false, error: 'Error reenviando el código' });
  }
});

// ─── Verificación de WhatsApp ───────────────────────────
const codigosWhatsapp = new Map(); // { numero: { codigo, expira, intentos } }

router.post('/registro/verificar-whatsapp', limitarLogin, async (req, res) => {
  try {
    const { whatsapp } = req.body;
    if (!whatsapp) return res.status(400).json({ ok: false, error: 'Falta el número' });

    const wppLimpio = whatsapp.replace(/\D/g, '');
    if (wppLimpio.length !== 10 && wppLimpio.length !== 12) {
      return res.status(400).json({ ok: false, error: 'Número no válido (10 o 12 dígitos)' });
    }

    const numero = wppLimpio.startsWith('3') && wppLimpio.length === 10 ? '57' + wppLimpio : wppLimpio;
    const codigo = generarCodigo();

    codigosWhatsapp.set(numero, {
      codigo,
      expira: Date.now() + 5 * 60 * 1000, // 5 minutos
      intentos: 0,
    });

    // Enviar código por WhatsApp usando el bot
    const { enviarMensaje } = require('../bot/openwa');
    await enviarMensaje(`${numero}@c.us`,
      `🔐 *FlashPago — Verificación*\n\nTu código de verificación es:\n\n*${codigo}*\n\nExpira en 5 minutos.`
    );

    console.log(`[Registro] Código WhatsApp enviado a ${numero}`);
    res.json({ ok: true, mensaje: 'Código enviado por WhatsApp' });
  } catch (err) {
    console.error('[Registro] Error enviando WhatsApp:', err.message);
    res.status(500).json({ ok: false, error: 'Error enviando el código. Verifica que el número tenga WhatsApp.' });
  }
});

router.post('/registro/confirmar-whatsapp', limitarLogin, (req, res) => {
  const { whatsapp, codigo } = req.body;
  if (!whatsapp || !codigo) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  const wppLimpio = whatsapp.replace(/\D/g, '');
  const numero = wppLimpio.startsWith('3') && wppLimpio.length === 10 ? '57' + wppLimpio : wppLimpio;

  const datos = codigosWhatsapp.get(numero);
  if (!datos) return res.status(400).json({ ok: false, error: 'No hay código pendiente para este número' });

  if (Date.now() > datos.expira) {
    codigosWhatsapp.delete(numero);
    return res.status(400).json({ ok: false, error: 'Código expirado. Solicita uno nuevo.' });
  }

  if (datos.intentos >= 5) {
    codigosWhatsapp.delete(numero);
    return res.status(400).json({ ok: false, error: 'Demasiados intentos. Solicita un nuevo código.' });
  }

  if (datos.codigo !== codigo) {
    datos.intentos++;
    return res.status(400).json({ ok: false, error: 'Código incorrecto' });
  }

  codigosWhatsapp.delete(numero);
  console.log(`[Registro] WhatsApp verificado: ${numero}`);
  res.json({ ok: true, mensaje: 'WhatsApp verificado' });
});

// ═══════════════════════════════════════════════════════════
//  RECUPERAR CONTRASEÑA (público, sin auth)
// ═══════════════════════════════════════════════════════════

router.post('/recuperar/solicitar', limitarLogin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: 'Falta el email' });

    const emailLimpio = email.trim().toLowerCase();
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, nombre FROM usuarios WHERE LOWER(email) = ? AND activo = 1',
        [emailLimpio],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    // Respuesta genérica siempre, para no revelar si el email existe o no
    if (user) {
      const codigo = generarCodigo();
      await guardarCodigoVerificacion(emailLimpio, codigo, { usuario_id: user.id });
      try {
        await enviarCodigoRecuperacion(emailLimpio, codigo, user.nombre);
      } catch (e) {
        console.error('[Recuperar] Error enviando correo:', e.message);
      }
    }

    res.json({ ok: true, mensaje: 'Si el email está registrado, recibirás un código en unos minutos' });
  } catch (err) {
    console.error('[Recuperar] Error solicitando:', err.message);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

router.post('/recuperar/verificar', limitarLogin, async (req, res) => {
  try {
    const { email, codigo, password } = req.body;
    if (!email || !codigo || !password) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }
    if (!PASSWORD_VALIDA.test(password)) {
      return res.status(400).json({ ok: false, error: PASSWORD_ERROR });
    }

    const emailLimpio = email.trim().toLowerCase();
    const datos = await verificarCodigo(emailLimpio, codigo);
    if (!datos) {
      return res.status(400).json({ ok: false, error: 'Código incorrecto o expirado' });
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE usuarios SET password_hash = ?, salt = ? WHERE id = ?',
        [hash, salt, datos.usuario_id],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Usuario no encontrado'));
          else resolve();
        }
      );
    });

    res.json({ ok: true, mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error('[Recuperar] Error verificando:', err.message);
    res.status(500).json({ ok: false, error: 'Error actualizando la contraseña' });
  }
});

// ═══════════════════════════════════════════════════════════
//  NEGOCIOS (superadmin ve todos, admin ve solo el suyo)
// ═══════════════════════════════════════════════════════════

router.get('/negocios', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const negocios = await listarNegocios();
    // Agregar uso de comprobantes a cada negocio
    const negociosConUso = await Promise.all(negocios.map(async (n) => {
      const usados = await contarComprobantesDelMes(n.id);
      const tokenGmail = await obtenerTokenGmail(n.id);
      return { ...n, comprobantes_usados: usados, gmail_conectado: !!tokenGmail, gmail_email: tokenGmail?.email || null };
    }));
    res.json({ ok: true, negocios: negociosConUso });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/negocios/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    if (req.user.rol !== 'superadmin' && Number(req.params.id) !== Number(req.user.negocio_id)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para ver este negocio' });
    }
    const negocio = await obtenerNegocio(req.params.id);
    if (!negocio) return res.status(404).json({ ok: false, error: 'Negocio no encontrado' });
    const usados = await contarComprobantesDelMes(negocio.id);
    res.json({ ok: true, negocio: { ...negocio, comprobantes_usados: usados } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/negocios', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, whatsapp, plan } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    const negocio = await crearNegocio({ nombre, whatsapp, plan });
    res.status(201).json({ ok: true, negocio });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/negocios/:id', verificarToken, soloSuperAdmin, (req, res) => {
  const { nombre, whatsapp, plan, activo } = req.body;
  const sets = []; const vals = [];
  if (nombre) { sets.push('nombre=?'); vals.push(nombre); }
  if (whatsapp !== undefined) { sets.push('whatsapp=?'); vals.push(whatsapp); }
  if (plan) {
    if (!LIMITES_PLAN[plan]) return res.status(400).json({ ok: false, error: 'Plan inválido' });
    sets.push('plan=?', 'limite_comprobantes=?');
    vals.push(plan, LIMITES_PLAN[plan]);
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
    const trial = await verificarTrialActivo(nid);
    res.json({
      ok: true,
      nombre: negocio.nombre,
      plan: negocio.plan,
      limite: negocio.limite_comprobantes,
      usados,
      porcentaje: Math.round((usados / negocio.limite_comprobantes) * 100),
      trial: {
        activo: trial.activo,
        pagado: trial.pagado || false,
        dias: trial.dias || 0,
        trial_fin: trial.trial_fin || null,
        razon: trial.razon || null,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  GMAIL OAuth POR NEGOCIO
// ═══════════════════════════════════════════════════════════

// Estado de conexión
router.get('/gmail/estado', verificarToken, async (req, res) => {
  try {
    const token = await obtenerTokenGmail(req.user.negocio_id);
    res.json({ ok: true, conectado: !!token, email: token?.email || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Paso 1: Generar URL de autorización de Google
router.get('/gmail/auth-url', verificarToken, soloAdmin, (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/gmail/callback`;
    const oAuth2Client = getOAuth2Client(redirectUri);

    // Guardar negocio_id + token JWT en el state para recuperarlo en el callback
    const state = Buffer.from(JSON.stringify({
      negocio_id: req.user.negocio_id,
      token: req.query.token || req.headers.authorization?.split(' ')[1],
    })).toString('base64');

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.modify'],
      state,
    });

    res.json({ ok: true, url: authUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Paso 2: Google redirige aquí con el código
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Faltan parámetros de Google');
    }

    // Decodificar state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return res.status(400).send('State inválido');
    }

    const { negocio_id, token } = stateData;

    // Verificar JWT
    const jwt = require('jsonwebtoken');
    try {
      jwt.verify(token, config.JWT_SECRET);
    } catch (e) {
      return res.status(401).send('Sesión expirada. Vuelve al dashboard e intenta de nuevo.');
    }

    // Intercambiar código por tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/api/gmail/callback`;
    const oAuth2Client = getOAuth2Client(redirectUri);
    const { tokens } = await oAuth2Client.getToken(code);

    // Obtener email del usuario
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    // Guardar en BD
    await guardarTokenGmail(negocio_id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      email,
    });

    console.log(`[Gmail] OAuth completado para negocio ${negocio_id}: ${email}`);

    // Redirigir al dashboard con mensaje de éxito
    res.redirect('/panel?seccion=panel&gmail=conectado');
  } catch (err) {
    console.error('[Gmail] Error en callback:', err.message);
    res.redirect('/panel?seccion=panel&gmail=error');
  }
});

// Desconectar Gmail
router.delete('/gmail/desconectar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    db.run('DELETE FROM tokens_gmail WHERE negocio_id = ?', [nid], function (err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      console.log(`[Gmail] Desconectado para negocio ${nid}`);
      res.json({ ok: true, mensaje: 'Gmail desconectado' });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Guardar token manualmente (superadmin)
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

// ─── Ventas de hoy por hora (sparkline del panel) ───────
router.get('/dashboard/ventas-hoy-por-hora', verificarToken, (req, res) => {
  const nid = req.user.negocio_id;
  db.all(
    `SELECT CAST(strftime('%H', creado_en) AS INTEGER) AS hora, SUM(monto) AS total, COUNT(*) AS cantidad
     FROM pagos
     WHERE negocio_id = ? AND estado = 'REAL' AND date(creado_en) = date('now','localtime')
     GROUP BY hora
     ORDER BY hora`,
    [nid],
    (err, filas) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });

      const horaActual = new Date().getHours();
      const porHora = {};
      filas.forEach((f) => { porHora[f.hora] = { total: f.total, cantidad: f.cantidad }; });

      const datos = [];
      for (let h = 0; h <= horaActual; h++) {
        datos.push({
          hora: h,
          etiqueta: `${String(h).padStart(2, '0')}:00`,
          total: porHora[h]?.total || 0,
          cantidad: porHora[h]?.cantidad || 0,
        });
      }
      res.json({ ok: true, datos });
    }
  );
});

router.get('/comprobantes/:foto', verificarToken, (req, res) => {
  const foto = req.params.foto.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!foto) return res.status(404).json({ ok: false, error: 'Foto no encontrada' });
  const nid = req.user.negocio_id;
  const esSuper = req.user.rol === 'superadmin';
  const where = esSuper ? 'WHERE foto = ?' : 'WHERE foto = ? AND negocio_id = ?';
  const params = esSuper ? [foto] : [foto, nid];
  // Comprobante solo legible si una fila de pago de este mismo negocio lo referencia
  db.get('SELECT id FROM pagos ' + where + ' ORDER BY id DESC LIMIT 1', params, (err, fila) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!fila) return res.status(403).json({ ok: false, error: 'No autorizado para ver este comprobante' });
    const ruta = path.join(__dirname, '..', 'comprobantes', foto);
    if (fs.existsSync(ruta)) {
      res.sendFile(ruta);
    } else {
      res.status(404).json({ ok: false, error: 'Foto no encontrada' });
    }
  });
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
    const limite = parseInt(req.query.limite) || 50;
    const { mes, anio } = req.query;

    let query, params;
    if (mes && anio) {
      const fechaInicio = `${anio}-${mes.padStart(2, '0')}-01`;
      const fechaFin = `${anio}-${mes.padStart(2, '0')}-31 23:59:59`;
      query = `SELECT * FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
               AND creado_en >= ? AND creado_en <= ?
               ORDER BY id DESC LIMIT ?`;
      params = [nid, fechaInicio, fechaFin, limite];
    } else {
      query = 'SELECT * FROM pagos WHERE estado = ? AND negocio_id = ? ORDER BY id DESC LIMIT ?';
      params = ['REAL', nid, limite];
    }

    db.all(query, params, (err, filas) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(filas);
    });
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
    const { mes, anio, dias } = req.query;

    let query, params;
    if (mes && anio) {
      const fechaInicio = `${anio}-${mes.padStart(2, '0')}-01`;
      const fechaFin = `${anio}-${mes.padStart(2, '0')}-31 23:59:59`;
      query = `SELECT date(creado_en) as fecha, COUNT(*) as cantidad, SUM(monto) as total 
               FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
               AND creado_en >= ? AND creado_en <= ?
               GROUP BY date(creado_en) ORDER BY date(creado_en) ASC`;
      params = [nid, fechaInicio, fechaFin];
    } else {
      const d = Math.min(parseInt(dias) || 30, 365);
      query = `SELECT fecha, COUNT(*) as cantidad, SUM(monto) as total 
               FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
               AND creado_en >= datetime('now', '-' || ? || ' days', 'localtime')
               GROUP BY fecha ORDER BY fecha ASC`;
      params = [nid, d];
    }

    db.all(query, params, (err, filas) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(filas);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Resumen por periodo (mes específico) ───────────────
router.get('/dashboard/resumen-periodo', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const { mes, anio } = req.query;

    if (!mes || !anio) {
      return res.status(400).json({ ok: false, error: 'Falta mes o anio' });
    }

    const fechaInicio = `${anio}-${mes.padStart(2, '0')}-01`;
    const fechaFin = `${anio}-${mes.padStart(2, '0')}-31 23:59:59`;

    db.get(
      `SELECT COUNT(*) as cantidad, COALESCE(SUM(monto), 0) as total,
              MAX(monto) as pago_mas_alto, MIN(monto) as pago_mas_bajo
       FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
       AND creado_en >= ? AND creado_en <= ?`,
      [nid, fechaInicio, fechaFin],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(
          `SELECT COUNT(DISTINCT date(creado_en)) as dias_con_ventas
           FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
           AND creado_en >= ? AND creado_en <= ?`,
          [nid, fechaInicio, fechaFin],
          (err2, diasRow) => {
            if (err2) return res.status(500).json({ error: err2.message });

            db.all(
              `SELECT banco, COUNT(*) as cantidad, SUM(monto) as total
               FROM pagos WHERE estado = 'REAL' AND negocio_id = ?
               AND creado_en >= ? AND creado_en <= ?
               GROUP BY banco ORDER BY cantidad DESC LIMIT 5`,
              [nid, fechaInicio, fechaFin],
              (err3, bancos) => {
                if (err3) return res.status(500).json({ error: err3.message });

                res.json({
                  ok: true,
                  periodo: { mes: parseInt(mes), anio: parseInt(anio) },
                  total: row.total,
                  cantidad: row.cantidad,
                  pago_mas_alto: row.pago_mas_alto || 0,
                  pago_mas_bajo: row.pago_mas_bajo || 0,
                  ticket_promedio: row.cantidad > 0 ? Math.round(row.total / row.cantidad) : 0,
                  dias_con_ventas: diasRow.dias_con_ventas,
                  bancos: bancos || [],
                });
              }
            );
          }
        );
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
//  CONFIGURACIÓN DEL NEGOCIO (horario)
// ═══════════════════════════════════════════════════════════

const DIA_VALIDO = (d) => Number.isInteger(d) && d >= 0 && d <= 6;
const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

router.get('/negocio/configuracion', verificarToken, soloAdmin, async (req, res) => {
  try {
    const negocio = await obtenerNegocio(req.user.negocio_id);
    if (!negocio) return res.status(404).json({ ok: false, error: 'Negocio no encontrado' });

    let dias_operacion;
    try {
      dias_operacion = JSON.parse(negocio.dias_operacion);
    } catch {
      dias_operacion = [0, 1, 2, 3, 4, 5, 6];
    }

    // Normaliza a un objeto { "0": "HH:MM", ... } con una entrada por día operativo,
    // aunque el negocio todavía tenga el formato viejo (un solo string para todos los días).
    const porDia = parsearHoraCierre(negocio.hora_cierre);
    const legado = !porDia ? (negocio.hora_cierre || '21:00') : null;
    const hora_cierre = {};
    for (const d of dias_operacion) {
      hora_cierre[d] = porDia ? (porDia[String(d)] || porDia.default || '21:00') : legado;
    }

    res.json({
      ok: true,
      hora_cierre,
      dias_operacion,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/negocio/configuracion', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { hora_cierre, dias_operacion } = req.body;

    if (!Array.isArray(dias_operacion) || dias_operacion.length === 0 || !dias_operacion.every(DIA_VALIDO)) {
      return res.status(400).json({ ok: false, error: 'Selecciona al menos un día de operación' });
    }
    if (!hora_cierre || typeof hora_cierre !== 'object' || Array.isArray(hora_cierre)) {
      return res.status(400).json({ ok: false, error: 'Formato de horario inválido' });
    }
    for (const d of dias_operacion) {
      if (!HORA_VALIDA.test(hora_cierre[String(d)] || '')) {
        return res.status(400).json({ ok: false, error: `Hora de cierre inválida para el día ${d} (formato HH:MM)` });
      }
    }

    await actualizarHorarioNegocio(req.user.negocio_id, { hora_cierre: JSON.stringify(hora_cierre), dias_operacion });
    res.json({ ok: true, mensaje: 'Configuración actualizada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/negocio', verificarToken, soloAdmin, async (req, res) => {
  const nid = req.user.negocio_id;
  try {
    await new Promise((resolve, reject) => {
      db.run('UPDATE negocios SET activo = 0 WHERE id = ?', [nid], (err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET activo = 0 WHERE negocio_id = ?', [nid], (err) => (err ? reject(err) : resolve()));
    });
    db.run('DELETE FROM tokens_gmail WHERE negocio_id = ?', [nid]);
    console.log(`[Negocio] Cuenta desactivada por su propio admin: negocio ${nid}`);
    res.json({ ok: true, mensaje: 'Cuenta desactivada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  USUARIOS — filtrados por negocio_id
// ═══════════════════════════════════════════════════════════

router.get('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const nid = req.user.negocio_id;
  db.all(
    'SELECT id, usuario, nombre, rol, whatsapp, email, negocio_id, activo, ultimo_login, creado_en FROM usuarios WHERE negocio_id = ? ORDER BY id',
    [nid],
    (err, filas) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, usuarios: filas });
    }
  );
});

const ROLES_ASIGNABLES = ['admin', 'empleado'];

router.post('/usuarios', verificarToken, soloAdmin, (req, res) => {
  const { usuario, password, nombre, rol, whatsapp, email } = req.body;
  const nid = req.user.negocio_id;
  if (!usuario || !password || !nombre) return res.status(400).json({ ok: false, error: 'Faltan campos' });
  if (!PASSWORD_VALIDA.test(password)) return res.status(400).json({ ok: false, error: PASSWORD_ERROR });
  if (rol && !ROLES_ASIGNABLES.includes(rol)) return res.status(400).json({ ok: false, error: 'Rol no válido' });

  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  db.run(
    'INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol, whatsapp, negocio_id, email) VALUES (?,?,?,?,?,?,?,?)',
    [usuario.trim().toLowerCase(), hash, salt, nombre.trim(), rol || 'empleado', whatsapp || null, nid, email ? email.trim().toLowerCase() : null],
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
  const { nombre, rol, whatsapp, email, activo, password } = req.body;
  const nid = req.user.negocio_id;
  if (rol && !ROLES_ASIGNABLES.includes(rol)) return res.status(400).json({ ok: false, error: 'Rol no válido' });
  const sets = []; const vals = [];
  if (nombre) { sets.push('nombre=?'); vals.push(nombre); }
  if (rol) { sets.push('rol=?'); vals.push(rol); }
  if (whatsapp !== undefined) { sets.push('whatsapp=?'); vals.push(whatsapp); }
  if (email !== undefined) { sets.push('email=?'); vals.push(email ? email.trim().toLowerCase() : null); }
  if (activo !== undefined) { sets.push('activo=?'); vals.push(activo); }
  if (password) {
    if (!PASSWORD_VALIDA.test(password)) return res.status(400).json({ ok: false, error: PASSWORD_ERROR });
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

// ═══════════════════════════════════════════════════════════
//  VENTAS — Cierre de caja + Gastos
// ═══════════════════════════════════════════════════════════

// ─── Crear cierre de caja ───────────────────────────────
router.post('/ventas/cierre', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const { total_ventas, nota, foto } = req.body;

    if (!total_ventas || total_ventas <= 0) {
      return res.status(400).json({ ok: false, error: 'El total de ventas es obligatorio' });
    }

    const fecha = new Date().toLocaleDateString('es-CO');

    // Verificar si ya hay cierre hoy
    const existente = await obtenerCierreDelDia(nid, fecha);
    if (existente) {
      return res.status(409).json({ ok: false, error: 'Ya existe un cierre para hoy. Edítalo si necesitas cambiar el total.' });
    }

    // Calcular transferencias verificadas del día
    const transferencias = await totalTransferenciasDia(nid, fecha);

    // Calcular gastos del día
    const gastos = await totalGastosDia(nid, fecha);

    // Efectivo = Total ventas - Transferencias verificadas
    const total_efectivo = total_ventas - transferencias.total;

    const cierre = await crearCierreCaja({
      negocio_id: nid,
      fecha,
      total_ventas,
      total_transferencias: transferencias.total,
      total_efectivo: Math.max(total_efectivo, 0),
      total_gastos: gastos.total,
      nota,
      cerrado_por: req.user.usuario,
      foto,
    });

    res.status(201).json({
      ok: true,
      cierre: {
        ...cierre,
        fecha,
        total_ventas,
        total_transferencias: transferencias.total,
        total_efectivo: Math.max(total_efectivo, 0),
        total_gastos: gastos.total,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Obtener cierre del día ─────────────────────────────
router.get('/ventas/cierre/hoy', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const fecha = new Date().toLocaleDateString('es-CO');

    const cierre = await obtenerCierreDelDia(nid, fecha);
    const transferencias = await totalTransferenciasDia(nid, fecha);
    const gastos = await totalGastosDia(nid, fecha);

    res.json({
      ok: true,
      cierre: cierre || null,
      transferencias_hoy: transferencias,
      gastos_hoy: gastos,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Historial de cierres ───────────────────────────────
router.get('/ventas/cierres', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const dias = parseInt(req.query.dias) || 30;
    const cierres = await listarCierres(nid, dias);
    res.json({ ok: true, cierres });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Resumen semanal ────────────────────────────────────
router.get('/ventas/semanal', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const resumen = await resumenSemanal(nid);
    res.json({ ok: true, ...resumen });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Resumen del día (sin cierre, datos en vivo) ────────
router.get('/ventas/resumen', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const fecha = req.query.fecha || new Date().toLocaleDateString('es-CO');

    const transferencias = await totalTransferenciasDia(nid, fecha);
    const gastos = await totalGastosDia(nid, fecha);
    const gastosLista = await listarGastos(nid, fecha);
    const cierre = await obtenerCierreDelDia(nid, fecha);

    res.json({
      ok: true,
      fecha,
      transferencias,
      gastos: { total: gastos.total, cantidad: gastos.cantidad, lista: gastosLista },
      cierre: cierre || null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Registrar gasto ────────────────────────────────────
router.post('/ventas/gasto', verificarToken, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const { monto, categoria, descripcion } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ ok: false, error: 'El monto es obligatorio' });
    }
    if (!descripcion || descripcion.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'La descripción es obligatoria' });
    }

    const categoriasPermitidas = ['general', 'insumos', 'nomina', 'servicios', 'arriendo', 'transporte', 'otro'];
    const cat = categoriasPermitidas.includes(categoria) ? categoria : 'general';

    const fecha = new Date().toLocaleDateString('es-CO');
    const gasto = await registrarGasto({
      negocio_id: nid,
      fecha,
      monto,
      categoria: cat,
      descripcion: descripcion.trim(),
      registrado_por: req.user.usuario,
    });

    res.status(201).json({ ok: true, gasto: { ...gasto, monto, categoria: cat, descripcion: descripcion.trim(), fecha } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Eliminar gasto ─────────────────────────────────────
router.delete('/ventas/gasto/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const changes = await eliminarGasto(req.params.id, nid);
    if (changes === 0) return res.status(404).json({ ok: false, error: 'Gasto no encontrado' });
    res.json({ ok: true, mensaje: 'Gasto eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Gastos por categoría ───────────────────────────────
router.get('/ventas/gastos/categorias', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nid = req.user.negocio_id;
    const dias = parseInt(req.query.dias) || 30;
    const categorias = await gastosPorCategoria(nid, dias);
    res.json({ ok: true, categorias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;