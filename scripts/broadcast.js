// scripts/broadcast.js — Mandar un aviso por WhatsApp al admin de cada negocio activo.
//
// Uso:
//   node scripts/broadcast.js            (modo prueba: solo muestra a quién le llegaría)
//   node scripts/broadcast.js --enviar   (lo manda de verdad)

require('dotenv').config();
const { listarNegocios } = require('../db');
const { obtenerAdminsNegocio } = require('../bot/reportes');
const { enviarMensaje } = require('../bot/openwa');

const MENSAJE = `⚡ *Actualización de FlashPago*

(Escribe aquí el mensaje que quieres mandar antes de correr con --enviar)`;

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
