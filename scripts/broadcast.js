// scripts/broadcast.js — Mandar un aviso por WhatsApp al admin de cada negocio activo.
//
// Uso:
//   node scripts/broadcast.js            (modo prueba: solo muestra a quién le llegaría)
//   node scripts/broadcast.js --enviar   (lo manda de verdad)

require('dotenv').config();
const { listarNegocios } = require('../db');
const { obtenerAdminsNegocio } = require('../bot/reportes');
const { enviarMensaje } = require('../bot/openwa');

const MENSAJE = `⚡ *FlashPago — Update Agosto 2026*

Hemos estado construyendo sin parar. Esto es lo que hay nuevo:

🏢 *Multi-negocio*
Un solo bot, múltiples negocios. Cada cliente tiene sus datos aislados.

📋 *Planes con trial gratis*
Básico ($39.900), Premium ($79.900), Empresarial ($149.900). 15 días gratis para probar.

📧 *Conexión bancaria*
Cada negocio conecta con su banco para recibir notificaciones de pagos automáticamente.

💰 *Módulo de ventas*
Cierre de caja, gastos por categoría, resumen semanal, historial mensual.

📊 *Dashboard mejorado*
Filtro por mes, estadísticas por banco, barra de uso del plan, alertas en vivo.

🔊 *Notificación de voz*
Anuncio de voz cuando llega un pago verificado, con selector de voz en Configuración.

🏦 *Más bancos*
Ahora también verifica pagos de Nequi, no solo Bancolombia.

🔒 *Seguridad*
HTTPS, JWT, rate limiting, vulnerabilidades corregidas.

🏗️ *Lo que viene*
Dominio propio, más bancos soportados.

🔗 https://flashpago.duckdns.org

_FlashPago — Verificación de pagos con IA_ 🚀`;

async function main() {
  const enviar = process.argv.includes('--enviar');
  const negocios = await listarNegocios();

  let totalDestinatarios = 0;

  for (const neg of negocios) {
    const admins = await obtenerAdminsNegocio(neg.id);
    for (const whatsapp of admins) {
      totalDestinatarios++;
      console.log(`${enviar ? '[ENVIANDO]' : '[PRUEBA]'} ${neg.nombre} (negocio ${neg.id}) -> ${whatsapp}`);
      if (enviar) {
        await enviarMensaje(whatsapp, MENSAJE);
      }
    }
  }

  console.log(`\nTotal de destinatarios: ${totalDestinatarios}`);
  if (!enviar) {
    console.log('\nEsto fue solo una prueba, no se mandó nada. Para enviarlo de verdad:');
    console.log('  node scripts/broadcast.js --enviar');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
