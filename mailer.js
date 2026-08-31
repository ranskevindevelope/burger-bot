// mailer.js — Envío de correos con Nodemailer
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.porkbun.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // STARTTLS en el puerto 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
async function enviarCodigoVerificacion(email, codigo, nombreNegocio) {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 48px; height: 48px; background: #F57C00; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: #fff; font-size: 24px; font-weight: bold;">$</span>
        </div>
        <h2 style="color: #1A1A2E; margin: 0.75rem 0 0; font-size: 20px;">FlashPago</h2>
      </div>
      <h3 style="color: #1A1A2E; font-size: 18px; margin-bottom: 0.5rem;">Tu código de verificación</h3>
      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Hola, usa este código para verificar tu cuenta de <strong>${nombreNegocio}</strong> en FlashPago:
      </p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 1.25rem; text-align: center; margin: 1.25rem 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1A2E;">${codigo}</span>
      </div>
      <p style="color: #999; font-size: 12px; line-height: 1.5;">
        Este código expira en 10 minutos. Si no solicitaste esta verificación, ignora este correo.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #bbb; font-size: 11px; text-align: center;">
        FlashPago — Verificación de pagos con IA
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"FlashPago" <${process.env.MAIL_USER}>`,
    to: email,
    subject: `${codigo} — Tu código de verificación de FlashPago`,
    html,
  });

  console.log(`[Mailer] Código enviado a ${email}`);
}

async function enviarBienvenida(email, nombre, usuario) {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <img src="https://flashpago.co/logo.png" alt="FlashPago" style="width: 48px; height: 48px; border-radius: 12px;" />
        </div>
        <h2 style="color: #1A1A2E; margin: 0.75rem 0 0; font-size: 20px;">FlashPago</h2>
      </div>
      <h3 style="color: #1A1A2E; font-size: 18px;">¡Bienvenido, ${nombre}!</h3>
      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Tu cuenta está lista. Para empezar a verificar comprobantes:
      </p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 1rem; margin: 1rem 0;">
        <p style="margin: 0.4rem 0; font-size: 13px; color: #333;"><strong>1.</strong> Conecta tu Gmail desde el dashboard</p>
        <p style="margin: 0.4rem 0; font-size: 13px; color: #333;"><strong>2.</strong> Agrega tus empleados con su WhatsApp</p>
        <p style="margin: 0.4rem 0; font-size: 13px; color: #333;"><strong>3.</strong> Dales el número del bot y listo</p>
      </div>
      <p style="color: #666; font-size: 13px;">
        Tu usuario: <strong>${usuario}</strong>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #bbb; font-size: 11px; text-align: center;">
        FlashPago — Verificación de pagos con IA
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"FlashPago" <${process.env.MAIL_USER}>`,
    to: email,
    subject: `¡Bienvenido a FlashPago, ${nombre}!`,
    html,
  });

  console.log(`[Mailer] Bienvenida enviada a ${email}`);
}

async function enviarCodigoRecuperacion(email, codigo, nombre) {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 48px; height: 48px; background: #F57C00; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: #fff; font-size: 24px; font-weight: bold;">$</span>
        </div>
        <h2 style="color: #1A1A2E; margin: 0.75rem 0 0; font-size: 20px;">FlashPago</h2>
      </div>
      <h3 style="color: #1A1A2E; font-size: 18px; margin-bottom: 0.5rem;">Recupera tu contraseña</h3>
      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Hola${nombre ? ` ${nombre}` : ''}, usa este código para crear una nueva contraseña en FlashPago:
      </p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 1.25rem; text-align: center; margin: 1.25rem 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1A2E;">${codigo}</span>
      </div>
      <p style="color: #999; font-size: 12px; line-height: 1.5;">
        Este código expira en 10 minutos. Si no solicitaste este cambio, ignora este correo y tu contraseña seguirá igual.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #bbb; font-size: 11px; text-align: center;">
        FlashPago — Verificación de pagos con IA
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"FlashPago" <${process.env.MAIL_USER}>`,
    to: email,
    subject: `${codigo} — Recupera tu contraseña de FlashPago`,
    html,
  });

  console.log(`[Mailer] Código de recuperación enviado a ${email}`);
}

module.exports = { enviarCodigoVerificacion, enviarBienvenida, enviarCodigoRecuperacion };