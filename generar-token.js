// generar-token.js — COMANDO SE USA SOLO 1 VEZ PARA INTEGRAR API DE GMAIL
// Uso: node generar-token.js

const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

function main() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n========================================');
  console.log('1. Abre esta URL en tu navegador:');
  console.log('========================================\n');
  console.log(authUrl);
  console.log('\n========================================');
  console.log('2. Inicia sesión con el correo del NEGOCIO');
  console.log('   (el que recibe los correos de Bancolombia)');
  console.log('3. Acepta los permisos');
  console.log('4. Te va a redirigir a una URL que empieza con');
  console.log('   http://localhost/?code=XXXXX');
  console.log('   Copia SOLO el valor que está después de "code="');
  console.log('   y antes de cualquier "&"');
  console.log('========================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Pega aquí el código: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code.trim(), (err, token) => {
      if (err) {
        console.error('\n❌ Error obteniendo el token:', err.message);
        return;
      }
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('\n✅ Token guardado exitosamente en:', TOKEN_PATH);
      console.log('Ya puedes usar Gmail API en tu bot.\n');
    });
  });
}

main();