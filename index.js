// index.js — Bot verificador de pagos 
// WhatsApp via OpenWA (local) + OCR + Verificación bancaria
// base de datos local con Sqlocal

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const pagosPendientes = [];
const { leerComprobante } = require('./ocr');
const { verificarPago, comprobantesUsados } = require('./verificador');
const { verificarPorGmail } = require('./gmail');
const fs = require('fs');
const path = require('path');
const { guardarPago, buscarDuplicadoReciente, totalDelDia, buscarPorCliente, resumenDelDia, totalUltimos30Dias, obtenerPagosExportables } = require('./db.js');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));
app.use('/comprobantes', express.static(path.join(__dirname, 'comprobantes'))); // para ver los comprobantes

const NEGOCIO = process.env.NEGOCIO_NOMBRE || 'VINSON PAGOS IA';

// ─── Config OpenWA ────────────────────────────────────────
const OPENWA_URL     = process.env.OPENWA_URL     || 'http://localhost:2785';
const OPENWA_KEY     = process.env.OPENWA_API_KEY || 'dev-admin-key';
const OPENWA_SESSION = process.env.OPENWA_SESSION || 'vinson';

// ─── Mensajes del bot ─────────────────────────────────────
const MENSAJES = {
  bienvenida: `💵 *${NEGOCIO}* — Verificador de Pagos\n\nHola! Soy el asistente de verificación de pagos impulsado por IA.\n\nEnvíame la *foto del comprobante* de transferencia y te digo en segundos si el pago es real.`,
  procesando: `⏳ Verificando el pago... un momento.`,
  sinFoto: `Por favor envía la *foto del comprobante*, no texto.`,
  errorLectura: `No pude leer bien ese comprobante. Asegúrate de que la imagen sea clara y completa.`,
  ayuda: `Comandos disponibles:\n• Escribe *cerrar* para terminar la conversacion\n• Envía una *foto* del comprobante para verificar\n• Escribe *historial* para ver los últimos pagos\n• Escribe *hola* para reiniciar`,
};

// ─── Base de pagos recibidos por SMS ─────────────────────
const pagosRecibidos = new Map();
const historialPagos = [];

// ─── Envia mensaje WhatsApp via OpenWA ───────────────────
async function enviarMensaje(to, body) {
  try {
    const numero = to.replace('@lid', '').replace('@c.us', '');
    const chatId = `${numero}@c.us`;

    const res = await fetch(
      `${OPENWA_URL}/api/sessions/${OPENWA_SESSION}/messages/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_KEY,
        },
        body: JSON.stringify({ chatId, text: body }),
      }
    );
    const data = await res.json();
    console.log('[Bot] Mensaje enviado a', chatId, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot] Error enviando mensaje:', err.message);
  }
}
// ─── Enviar imagen WhatsApp via OpenWA ────────────────────
async function enviarImagen(to, rutaFoto, caption) {
  try {
    const numero = to.replace('@lid', '').replace('@c.us', '');
    const chatId = `${numero}@c.us`;

    // Leer la imagen del disco y convertirla a base64
    const imagenBuffer = fs.readFileSync(rutaFoto);
    const imagenBase64 = imagenBuffer.toString('base64');

    const res = await fetch(
      `${OPENWA_URL}/api/sessions/${OPENWA_SESSION}/messages/send-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_KEY,
        },
        body: JSON.stringify({
          chatId,
          base64: imagenBase64,
          mimetype: 'image/jpeg',
          caption: caption || '',
        }),
      }
    );
    const data = await res.json();
    console.log('[Bot] Imagen enviada a', chatId, ':', JSON.stringify(data));
  } catch (err) {
    console.error('[Bot] Error enviando imagen:', err.message);
  }
}


// Carpeta donde se guardan los comprobantes
const CARPETA_COMPROBANTES = './comprobantes';
if (!fs.existsSync(CARPETA_COMPROBANTES)) {
  fs.mkdirSync(CARPETA_COMPROBANTES);
}

// ─── Envia reporte diario al dueño ───────────────────────
async function enviarReporteDiario() {
  try {
    const { total, cantidad, pagoMasAlto } = await resumenDelDia();
    const fecha = new Date().toLocaleDateString('es-CO');

    let mensaje;
    if (cantidad === 0) {
      mensaje = `📊 *Cierre del día — ${fecha}*\n\nHoy no se registraron pagos.`;
    } else {
      mensaje =
        `📊 *Cierre del día — ${fecha}*\n\n` +
        `✅ Pagos confirmados: ${cantidad}\n` +
        `💵 Total recibido: $${total.toLocaleString('es-CO')}\n`;
      
      if (pagoMasAlto) {
        mensaje += `🏆 Pago más alto: $${pagoMasAlto.monto.toLocaleString('es-CO')}`;
        if (pagoMasAlto.nombre_cliente) {
          mensaje += ` (${pagoMasAlto.nombre_cliente})`;
        }
        mensaje += `\n`;
      }
      
      mensaje += `\n¡Buen trabajo hoy! 🍔`;
    }

    // Enviar solo al administrador 
   const numerosReporte = [
  '573044372639@c.us',
  '573045530381@c.us',
  
];
for (const numero of numerosReporte) {
  await enviarMensaje(numero, mensaje);
}
    console.log('[Reporte] Reporte diario enviado');
  } catch (err) {
    console.error('[Reporte] Error:', err.message);
  }
}

// ─── Verificación nocturna de pagos pendientes ────────────
async function verificacionNocturna(revision) {
  if (pagosPendientes.length === 0) {
    console.log('[Nocturna] No hay pagos pendientes');
    return;
  }

  console.log(`[Nocturna] Revisión ${revision}: verificando ${pagosPendientes.length} pago(s) pendiente(s)...`);

  const verificados = [];
  const noEncontrados = [];

  for (let i = pagosPendientes.length - 1; i >= 0; i--) {
    const pago = pagosPendientes[i];
    try {
      const resultado = await verificarPorGmail(pago.monto, { intentos: 1, esperaMs: 0 });

      if (resultado) {
        await guardarPago({
          monto: pago.monto,
          referencia: pago.referencia,
          banco: pago.banco,
          fecha: pago.fecha,
          hora: pago.hora,
          estado: 'REAL',
          fuente: 'gmail_nocturna',
          nombre_cliente: resultado.nombre || null,
          verificado_por: pago.empleado,
          negocio_id: 1,
          foto: pago.foto,
        });

        verificados.push({
          monto: pago.monto,
          nombre: resultado.nombre || 'Sin nombre',
          referencia: pago.referencia || 'Sin ref',
        });

        pagosPendientes.splice(i, 1);
        console.log(`[Nocturna] ✅ Pago de $${pago.monto} verificado`);
      } else {
        noEncontrados.push(pago);
      }
    } catch (err) {
      console.error(`[Nocturna] Error verificando $${pago.monto}:`, err.message);
    }
  }

  const numerosReporte = [
    '573044372639@c.us',
    '573045530381@c.us',
  ];

  if (verificados.length > 0) {
    const totalRecuperado = verificados.reduce((s, p) => s + p.monto, 0);
    const lista = verificados.map(p =>
      `✅ $${p.monto.toLocaleString('es-CO')} — ${p.nombre} (Ref: ${p.referencia})`
    ).join('\n');

    const mensaje =
      `🔔 *FlashPago — Verificación nocturna${revision === 2 ? ' (2da revisión)' : ''}*\n\n` +
      `${lista}\n\n` +
      `📊 ${verificados.length} pago(s) verificado(s) y guardado(s)\n` +
      `💵 Total recuperado: $${totalRecuperado.toLocaleString('es-CO')}`;

    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }
  }

  if (revision === 2 && noEncontrados.length > 0) {
    const lista = noEncontrados.map(p =>
      `• $${p.monto.toLocaleString('es-CO')} — Ref: ${p.referencia || 'Sin ref'} — ${p.hora}`
    ).join('\n');

    const mensaje =
      `⚠️ *FlashPago — Pagos no confirmados*\n\n` +
      `Se revisaron ${noEncontrados.length} pago(s) pendientes.\n` +
      `No se encontraron en las notificaciones del banco:\n\n` +
      `${lista}\n\n` +
      `Revisa manualmente en la app del banco si es necesario.`;

    for (const numero of numerosReporte) {
      await enviarMensaje(numero, mensaje);
    }

    pagosPendientes.length = 0;
    console.log('[Nocturna] Pendientes limpiados');
  }

  console.log(`[Nocturna] Revisión ${revision} completada. Verificados: ${verificados.length}, Pendientes: ${pagosPendientes.length}`);
}

// ─── Formatear resultado de verificación ─────────────────
function formatearResultado(datos, verificacion) {
  const lineas = [verificacion.mensaje, ''];
  if (datos.banco)      lineas.push(`🏦 Banco: ${datos.banco}`);
  if (datos.monto)      lineas.push(`💵 Monto: $${parseFloat(datos.monto).toLocaleString('es-CO')}`);
  if (datos.referencia) lineas.push(`🔑 Referencia: ${datos.referencia}`);
  if (datos.fecha)      lineas.push(`📅 Fecha: ${datos.fecha}`);
  lineas.push('');
  if (verificacion.estado === 'REAL')                 lineas.push('✅ Puedes finalizar el pedido.');
  else if (verificacion.estado === 'DUPLICADO')        lineas.push('🚫 Por favor verifica. Comprobante ya utilizado.');
  else if (verificacion.estado === 'NO_ENCONTRADO')    lineas.push('⚠️ No pude verificar este pago automáticamente. Revisa la transferencia al final del turno.');
  else if (verificacion.estado === 'MONTO_INCORRECTO') lineas.push('🚫 No vemos coincidencia. Montos no coinciden.');
  return lineas.join('\n');
}

// Guarda la imagen del comprobante y devuelve el nombre del archivo
function guardarFoto(base64, referencia) {
  try {
    const nombreArchivo = `${referencia || 'sinref'}_${Date.now()}.jpg`;
    const rutaCompleta = path.join(CARPETA_COMPROBANTES, nombreArchivo);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(rutaCompleta, buffer);
    console.log('[Foto] Comprobante guardado:', nombreArchivo);
    return nombreArchivo;
  } catch (err) {
    console.error('[Foto] Error guardando imagen:', err.message);
    return null;
  }
}

// ─── Endpoint que es obsoleto
app.post('/pago-recibido', (req, res) => {
  res.sendStatus(200);

  let nombre, monto, fecha;

  if (req.body.sms_completo) {
    // Viene de MacroDroid
    const sms = req.body.sms_completo;
    const match =
      sms.match(/de (.+?) por \$([0-9,.]+)/i) ||
      sms.match(/Recibiste \$([0-9,.]+) de (.+?)[\.,]/i);

    if (!match) {
      console.log('[SMS] No se pudo parsear el SMS:', sms);
      return;
    }

    if (sms.match(/Recibiste \$/i)) {
      monto = match[1].replace(/[,.]/g, '');
      nombre = match[2].trim();
    } else {
      nombre = match[1].trim();
      monto = match[2].replace(/[,.]/g, '');
    }
    fecha = new Date().toLocaleString('es-CO');

  } else {
    // Viene de la app Android
    ({ nombre, monto, fecha } = req.body);
    console.log('[DEBUG] Monto recibido de la app:', monto);
    monto = monto.toString().replace('.00', '').replace(',00', '').replace('.', '').replace(',', '');
    console.log('[DEBUG] Monto limpio:', monto);
  }

  if (!monto) return;

  const key = `${monto}-${new Date().toLocaleDateString('es-CO')}`;
  pagosRecibidos.set(key, { nombre, monto, fecha, hora: new Date().toLocaleTimeString('es-CO') });
  console.log(`[SMS] ✅ Pago recibido: $${monto} de ${nombre}`);
});
// ─── Ruta para descargar el Excel (CSV) ───────────────────
app.get('/exportar/:token', async (req, res) => {
  try {
    if (req.params.token !== 'flashpago2026') {
      return res.status(403).send('No autorizado');
    }

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

// ─── Webhook — OpenWA envía los mensajes aquí ─────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const evento = req.body;
  console.log('[Webhook] Evento completo:', JSON.stringify(evento).slice(0, 500));

  if (evento.event === 'test') {
    console.log('[Webhook] Evento de prueba ignorado');
    return;
  }

  const data = evento.data || evento;

  const lidMap = {

    '234668473466924@lid': '573045530381@c.us',
    '61856135819279@lid': '573013411244@c.us',
    '165369796944036@lid':'573167064671@c.us',
    '241759531581483@c.us':'573044372639@c.us',
    
  };
  const rawId = data.chatId || data.from || '';
  const from = lidMap[rawId] || rawId;

  const body        = (data.body || data.text || data.content || data.message?.conversation || '').trim().toLowerCase();
  const mediaUrl    = data.mediaUrl || data.media?.url || data.message?.imageMessage?.url || '';
  const mediaBase64 = data.media?.data || '';
  const mediaType   = data.mimetype || data.media?.mimetype || data.message?.imageMessage?.mimetype || '';
  const isMedia     = data.hasMedia || data.type === 'image' || mediaUrl !== '';

  console.log('[Webhook] from:', from, '| body:', body, '| isMedia:', isMedia);

  if (!from) {
    console.log('[Webhook] Sin remitente, ignorando');
    return;
  }

 if (data.fromMe || data.key?.fromMe) {
    console.log('[Webhook] Mensaje propio ignorado');
    return;
  }

  // ─── Lista blanca: solo empleados autorizados ──────────────
  const ADMIN = [
  
  '573045530381@c.us',
  '573044372639@c.us',
];

const EMPLEADOS = [
  
  '573013411244@c.us',
  '573167064671@c.us', 
];

const NUMEROS_AUTORIZADOS = [...ADMIN, ...EMPLEADOS];

function esAdmin(numero) {
  return ADMIN.includes(numero);
}
  console.log(`[Bot] Mensaje de ${from}: ${body || '[imagen]'}`);

  if (isMedia) {
    if (mediaType && !mediaType.startsWith('image/')) {
      await enviarMensaje(from, '⚠️ Solo acepto imágenes de comprobantes. Envía una foto.');
      return;
    }

    await enviarMensaje(from, MENSAJES.procesando);

    try {
      const datos = await leerComprobante(mediaUrl, mediaBase64);
      if (datos.error) {
        await enviarMensaje(from, MENSAJES.errorLectura);
        return;
      }

      if (!datos.monto || datos.monto === 'null' || isNaN(parseFloat(datos.monto))) {
        await enviarMensaje(from, '⚠️ Esta imagen no parece un comprobante de pago. Por favor envía la captura de pantalla de la transferencia.');
        return;
      }

      const montoNum = parseInt(datos.monto);

      // ─── Verificar duplicado en la base de datos (últimos 7 días) ──
if (datos.referencia) {
  const duplicado = await buscarDuplicadoReciente(datos.referencia);
  if (duplicado) {
    await enviarMensaje(from,
      `🚫 DUPLICADO: Este comprobante (Ref: ${datos.referencia}) ya fue verificado el ${duplicado.fecha} a las ${duplicado.hora}.\n\n` +
      `👤 Cliente: ${duplicado.nombre_cliente || 'No registrado'}\n` +
      `💵 Monto: $${duplicado.monto.toLocaleString('es-CO')}\n\n` +
      `No puedes usarlo de nuevo.`
    );
    return;
  }
}

      // ─── Buscar pago por SMS (match exacto) ────────────
      let pagoSMS = null;
      for (const [key, pago] of pagosRecibidos.entries()) {
        if (parseInt(pago.monto) === montoNum) {
          pagoSMS = pago;
          pagosRecibidos.delete(key);
          break;
        }
      }

      // ─── Si no hay SMS, buscar por Gmail ──────────────
      console.log('[DEBUG] pagoSMS encontrado:', pagoSMS);
      let pagoGmail = null;
      if (!pagoSMS) {
        console.log(`[DEBUG] Verificando en Gmail $${montoNum}...`);
        pagoGmail = await verificarPorGmail(datos.monto);
        console.log('[DEBUG] Resultado de Gmail:', pagoGmail);
      }

      // ─── Determinar resultado final ────────────────────
      const verificacion = pagoSMS
        ? { estado: 'REAL', mensaje: `✅ PAGO CONFIRMADO: $${montoNum.toLocaleString('es-CO')} recibido de ${pagoSMS.nombre} a las ${pagoSMS.hora}` } //SMS PAGOS
        : pagoGmail
        ? { estado: 'REAL', mensaje: `✅ PAGO CONFIRMADO: $${pagoGmail.monto.toLocaleString('es-CO')}  este pago es confirmado en Bancolombia` } //GMAIL PAGOS
        : await verificarPago(datos);

      
      // ─── Guardar el pago REAL en la base de datos ───────────
      if (verificacion.estado === 'REAL') {
        try { 
          const nombreFoto = mediaBase64 ? guardarFoto(mediaBase64, datos.referencia) : null;
          await guardarPago({
          monto: montoNum,
          referencia: datos.referencia || null,
          banco: datos.banco || null,
          fecha: new Date().toLocaleDateString('es-CO'),
          hora: new Date().toLocaleTimeString('es-CO'),
          estado: 'REAL',
          fuente: pagoSMS ? 'sms' : (pagoGmail ? 'gmail' : 'otro'),
          nombre_cliente: pagoGmail?.nombre || null,   // el nombre que extrae Gmail
          verificado_por: from,                         // el número del empleado
          negocio_id: 1,                                // id  del negocio
          foto: nombreFoto,                             // guarda nombre foto                  
          });
          console.log('[DB] Pago guardado en base de datos');
        } catch (err) {
          console.error('[DB] Error guardando pago:', err.message);
        }
      }

      historialPagos.push({
        estado:     verificacion.estado,
        monto:      datos.monto      || '?',
        banco:      datos.banco      || '?',
        referencia: datos.referencia || '?',
        hora:       new Date().toLocaleTimeString('es-CO'),
        empleado:   from,
      });

      const respuesta = formatearResultado(datos, verificacion);
      await enviarMensaje(from, respuesta);

    if (['NO_ENCONTRADO', 'DUPLICADO', 'MONTO_INCORRECTO'].includes(verificacion.estado)) {
        const alerta = `🚨 *ALERTA — ${NEGOCIO}*\n\n${verificacion.mensaje}\n\nEmpleado: ${from}\nHora: ${new Date().toLocaleTimeString('es-CO')}`;
        await enviarMensaje(process.env.MY_WHATSAPP, alerta);

        // Guardar pago no encontrado para verificación nocturna
        if (verificacion.estado === 'NO_ENCONTRADO') {
          pagosPendientes.push({
            monto: montoNum,
            referencia: datos.referencia || null,
            banco: datos.banco || null,
            fecha: new Date().toLocaleDateString('es-CO'),
            hora: new Date().toLocaleTimeString('es-CO'),
            empleado: from,
            foto: mediaBase64 ? guardarFoto(mediaBase64, datos.referencia) : null,
          });
          console.log(`[Pendientes] Pago de $${montoNum} guardado para verificación nocturna. Total pendientes: ${pagosPendientes.length}`);
        }
      }

    } catch (err) {
      console.error('[Bot] Error procesando imagen:', err);
      await enviarMensaje(from, '⚠️ Error interno. Intenta de nuevo o llama al dueño.');
    }
    return;
  }

  if (['hola', 'inicio', 'start', 'hi'].includes(body)) {
    await enviarMensaje(from, MENSAJES.bienvenida);
    return;
  }

  if (body === 'historial') {
    if (historialPagos.length === 0) {
      await enviarMensaje(from, 'No hay pagos verificados aún hoy.');
    } else {
      const lista = historialPagos.slice(-5).map((p, i) =>
        `${i + 1}. ${p.estado} — $${p.monto} — ${p.banco} — ${p.hora}`
      ).join('\n');
     
      // suma de pagos verificados REAL
      const TotalHoy = historialPagos
      .filter(p => p.estado === 'REAL')
      .reduce((suma, p) => suma + parseInt(p.monto || 0), 0);

    const cantidadReales = historialPagos.filter(p => p.estado == 'REAL').length;

    const mensaje = ` Ultimos pagos verficados:\n\n${lista}\n\n` +
    `━━━━━━━━━━━━━━━\n` + 
    `💰 Total hoy: $${TotalHoy.toLocaleString('es-CO')}\n\n` +
    `✅ Pagos confirmados: ${cantidadReales}` ;

    await enviarMensaje(from, mensaje);
    }
    return;
  }

  if (body === 'cerrar') {
    await enviarMensaje(from, '👋 Conversación cerrada. Felices ventas!!😁. Escribe *hola* para volver a empezar.');
    return;
  }

  if (body === 'testfoto') {
  const rutaFoto = './comprobantes/M17020259_1783636383643.jpg';  // ← pon aquí el nombre real de una foto
  await enviarImagen(from, rutaFoto, '📸 Prueba de envío de foto');
  return;
}

if (body.startsWith('enviar ')) {
  if (!esAdmin(from)) return;

  const mensaje = body.replace('enviar ', '').trim();

  if (!mensaje) {
    await enviarMensaje(from, 'Escribe el mensaje después de enviar. Ejemplo: enviar Hola a todos');
    return;
  }

  // Envia a todos numeros los autorizados
  let enviados = 0;
  for (const numero of NUMEROS_AUTORIZADOS) {
    if (numero !== from) {  // no me lo envio a mi mismo
      await enviarMensaje(numero, `📢 *Aviso Importante*\n\n${mensaje}`);
      enviados++;
    }
  }

  await enviarMensaje(from, `✅ Mensaje enviado a ${enviados} persona(s).`);
  return;
}


if (['ayuda', 'help', '?'].includes(body)) {
  if (esAdmin(from)) {
    await enviarMensaje(from,
      `📋 *${NEGOCIO}* — Administrador\n\n` +
      `Para verificar un pago:\n` +
      `📸 Envía la *foto del comprobante*\n\n` +
      `Consultas:\n` +
      `• *total* — Ventas del día\n` +
      `• *buscar [nombre]* — Pagos de un cliente\n` +
      `   Ejemplo: buscar kevin\n\n` +
      `• *historial* — Últimos pagos\n` +
      `• *ayuda* — Ver este menú\n\n` +
      `📊 El *reporte de cierre* llega automático jue, vie, sáb y dom.`
    );
  } else {
    await enviarMensaje(from,
      `📋 *${NEGOCIO}*\n\n` +
      `Para verificar un pago:\n` +
      `📸 Envía la *foto del comprobante* y te confirmo si el pago es real.\n\n` +
      `Comandos:\n` +
      `• *historial* — Últimos pagos\n` +
      `• *ayuda* — Ver este menú\n\n` +
      `¿Dudas? Contacta al administrador. 😊`
    );
  }
  return;
}
if (body === 'total' || body === 'total mes') {
  if (!esAdmin(from)) return;
  try {
    if (body === 'total mes') {
      const { total, cantidad } = await totalUltimos30Dias();
      if (cantidad === 0) {
        await enviarMensaje(from, '📊 No hay pagos en los últimos 30 días.');
      } else {
        const mensaje = 
          `📅 *Total últimos 30 días*\n\n` +
          `✅ Pagos confirmados: ${cantidad}\n` +
          `💵 Total recibido: $${total.toLocaleString('es-CO')}`;
        await enviarMensaje(from, mensaje);
      }
    } else {
      const { total, cantidad } = await totalDelDia();
      if (cantidad === 0) {
        await enviarMensaje(from, '📊 No hay pagos verificados hoy todavía.');
      } else {
        const mensaje = 
          `💰 *Total del día*\n\n` +
          `✅ Pagos confirmados: ${cantidad}\n` +
          `💵 Total recibido: $${total.toLocaleString('es-CO')}`;
        await enviarMensaje(from, mensaje);
      }
    }
  } catch (err) {
    console.error('[Total] Error:', err.message);
    await enviarMensaje(from, '⚠️ No pude calcular el total. Intenta de nuevo.');
  }
  return;
}

if (body === 'exportar') {
  if (!esAdmin(from)) return;
  try {
    const pagos = await obtenerPagosExportables();
    if (pagos.length === 0) {
      await enviarMensaje(from, '📊 No hay pagos para exportar en los últimos 30 días.');
    } else {
      const link = `http://45.77.82.77:3000/exportar/flashpago2026`;
      await enviarMensaje(from,
        `📥 *Exportar pagos a Excel*\n\n` +
        `📊 ${pagos.length} pagos de los últimos 30 días\n\n` +
        `Descarga tu archivo aquí:\n${link}\n\n` +
        `Abre el link desde tu celular o PC y se descarga el archivo que puedes abrir en Excel.`
      );
    }
  } catch (err) {
    console.error('[Exportar] Error:', err.message);
    await enviarMensaje(from, '⚠️ No pude generar el archivo. Intenta de nuevo.');
  }
  return;
}

if (body === 'reporte') {
  if (!esAdmin(from)) return;
  await enviarReporteDiario();
  return;
}

if (body.startsWith('buscar ')) {
  // Si no es admin, ignora (no responde)
  if (!esAdmin(from)) {
    return;
  }

  const nombreBuscado = body.replace('buscar ', '').trim();

  if (!nombreBuscado) {
    await enviarMensaje(from, 'Escribe el nombre a buscar. Ejemplo: buscar kevin');
    return;
  }

  try {
    const pagos = await buscarPorCliente(nombreBuscado);

    if (pagos.length === 0) {
      await enviarMensaje(from, `🔍 No encontré pagos de "${nombreBuscado}".`);
    } else {
      const lista = pagos.map((p, i) =>
        `${i + 1}. $${p.monto.toLocaleString('es-CO')} — ${p.fecha} ${p.hora}`
      ).join('\n');

      const totalCliente = pagos.reduce((suma, p) => suma + p.monto, 0);

      const mensaje =
        `🔍 *Pagos de ${pagos[0].nombre_cliente}*\n\n` +
        `${lista}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📊 ${pagos.length} pago(s) — Total: $${totalCliente.toLocaleString('es-CO')}`;

      await enviarMensaje(from, mensaje);
    }
  } catch (err) {
    console.error('[Buscar] Error:', err.message);
    await enviarMensaje(from, '⚠️ No pude hacer la búsqueda. Intenta de nuevo.');
  }
  return;
}

if (body === 'nocturna') {
  if (!esAdmin(from)) return;
  await verificacionNocturna(1);
  return;
}


// comando (estado) ///
if (body === 'estado') {
  const uptime = Math.floor(process.uptime() / 60);
  const ultimaVerificacion = historialPagos.length > 0 
    ? historialPagos[historialPagos.length - 1].hora 
    : 'Sin verificaciones aún';
  
  const estado = `
🤖 *Estado ${NEGOCIO}*

✅ Bot conectado
📊 Pagos verificados hoy: ${historialPagos.length}
⏱️ Uptime: ${uptime} minutos
🔄 Última verificación: ${ultimaVerificacion}
🟢 Gmail API: conectado
📱 SMS: escuchando
⚡ API OPEN BANK: en proceso...

Todo está funcionando correctamente. 😊
  `.trim();
  
  await enviarMensaje(from, estado);
  return;
}

// ─── Comando DEBUG ───────────────────────────────────────
if (body === 'debug') {
   if (!esAdmin(from)) return;
  const uptime = Math.floor(process.uptime() / 60);
  const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const pagosEnCola = pagosRecibidos.size;
  const comprobantesUnicos = comprobantesUsados.size;
  
  const debug = `
🔧 *DEBUG ${NEGOCIO}*

⏱️ Uptime: ${uptime}m
💾 Memoria: ${memUsage}MB
📋 Pagos en cola (SMS): ${pagosEnCola}
🔐 Comprobantes únicos: ${comprobantesUnicos}
📊 Total verificados hoy: ${historialPagos.length}

Sistema operativo ✅
  `.trim();
  
  await enviarMensaje(from, debug);
  return;
}

await enviarMensaje(from, MENSAJES.sinFoto);
  }


);

// ─── API para el Dashboard ────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ ok: false });

  const crypto = require('crypto');
  const { db } = require('./db.js');

  db.get('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1', [usuario.trim().toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ ok: false, error: 'Error del servidor' });
    if (!user) return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });

    const hash = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
    if (hash !== user.password_hash) {
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    db.run('UPDATE usuarios SET ultimo_login = datetime("now","localtime") WHERE id = ?', [user.id]);

    res.json({
      ok: true,
      token: 'fp_' + Date.now(),
      user: { id: user.id, nombre: user.nombre, rol: user.rol }
    });
  });
});

app.get('/api/dashboard/totales', async (req, res) => {
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

app.get('/api/dashboard/pagos', async (req, res) => {
  try {
    const { db } = require('./db.js');
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

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { db } = require('./db.js');
    const dias = parseInt(req.query.dias) || 30;
    db.all(
      `SELECT fecha, COUNT(*) as cantidad, SUM(monto) as total 
       FROM pagos WHERE estado = 'REAL' 
       AND creado_en >= datetime('now', '-${dias} days', 'localtime')
       GROUP BY fecha ORDER BY fecha ASC`,
      [],
      (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(filas);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/buscar/:nombre', async (req, res) => {
  try {
    const pagos = await buscarPorCliente(req.params.nombre);
    res.json(pagos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── API Usuarios ─────────────────────────────────────────
app.get('/api/usuarios', (req, res) => {
  const { db } = require('./db.js');
  db.all('SELECT id, usuario, nombre, rol, whatsapp, activo, ultimo_login, creado_en FROM usuarios ORDER BY id', [], (err, filas) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, usuarios: filas });
  });
});

app.post('/api/usuarios', (req, res) => {
  const { usuario, password, nombre, rol, whatsapp } = req.body;
  if (!usuario || !password || !nombre) return res.status(400).json({ ok: false, error: 'Faltan campos' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Contraseña mínimo 6 caracteres' });

  const crypto = require('crypto');
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  const { db } = require('./db.js');
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

app.put('/api/usuarios/:id', (req, res) => {
  const { nombre, rol, whatsapp, activo, password } = req.body;
  const sets = []; const vals = [];
  if (nombre) { sets.push('nombre=?'); vals.push(nombre); }
  if (rol) { sets.push('rol=?'); vals.push(rol); }
  if (whatsapp !== undefined) { sets.push('whatsapp=?'); vals.push(whatsapp); }
  if (activo !== undefined) { sets.push('activo=?'); vals.push(activo); }
  if (password) {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    sets.push('password_hash=?', 'salt=?'); vals.push(hash, salt);
  }
  if (!sets.length) return res.json({ ok: false, error: 'Nada que actualizar' });
  vals.push(req.params.id);
  const { db } = require('./db.js');
  db.run(`UPDATE usuarios SET ${sets.join(',')} WHERE id=?`, vals, function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, mensaje: 'Usuario actualizado' });
  });
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { db } = require('./db.js');
  db.run('UPDATE usuarios SET activo=0 WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, mensaje: 'Usuario desactivado' });
  });
});


// ─── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    negocio: NEGOCIO,
    pagosVerificados: historialPagos.length,
    hora: new Date().toLocaleString('es-CO'),
  });
});


// ─── Programar el reporte diario según el día ─────────────
setInterval(async () => {
  const ahora = new Date();
  const dia = ahora.getDay();       // 0=domingo, 1=lunes, ... 4=jueves, 5=viernes, 6=sábado
  const hora = ahora.getHours();
  const minuto = ahora.getMinutes();

  let debeEnviar = false;

  // Verificación nocturna - 1ra revisión a las 21:00
  if (hora === 21 && minuto === 0) {
    console.log('[Nocturna] Ejecutando 1ra revisión...');
    await verificacionNocturna(1);
  }

  // Verificación nocturna - 2da revisión a las 22:00
  if (hora === 22 && minuto === 0) {
    console.log('[Nocturna] Ejecutando 2da revisión...');
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
}, 60000);  // revisa cada minuto


// ─── Iniciar servidor ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍔 Bot ${NEGOCIO} corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`🔗 se configura OpenWA Dashboard para apuntar a este webhook\n`);
});