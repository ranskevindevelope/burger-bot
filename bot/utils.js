const fs = require('fs');
const path = require('path');

const CARPETA_COMPROBANTES = './comprobantes';

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

function guardarFoto(base64, referencia) {
  try {
    if (!fs.existsSync(CARPETA_COMPROBANTES)) fs.mkdirSync(CARPETA_COMPROBANTES);
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

module.exports = { formatearResultado, guardarFoto };
