require('dotenv').config();

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
};

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_SECRET || required('JWT_SECRET'),
  INBOUND_WEBHOOK_SECRET: process.env.INBOUND_WEBHOOK_SECRET || null,
  OPENWA_URL: process.env.OPENWA_URL || 'http://localhost:2785',
  OPENWA_SESSION: process.env.OPENWA_SESSION || 'vinson',
  OPENWA_KEY: process.env.OPENWA_API_KEY || 'dev-admin-key',
  NEGOCIO_NOMBRE: process.env.NEGOCIO_NOMBRE || 'Flash Pago',

  // Proveedor de WhatsApp: 'openwa' (por defecto, no oficial) o 'meta' (API
  // oficial de Meta, de respaldo por si banean el número de open-wa).
  WA_PROVIDER: process.env.WA_PROVIDER || 'openwa',
  META_API_VERSION: process.env.META_API_VERSION || 'v20.0',
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID || '',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_APP_SECRET: process.env.META_APP_SECRET || '',
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || '',

  // Wompi (pasarela de pagos de suscripción de FlashPago)
  WOMPI_AMBIENTE: process.env.WOMPI_AMBIENTE || 'test', // 'test' | 'prod'
  WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY || '',
  WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY || '',
  WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET || '',
  WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET || '',
  get WOMPI_API_URL() {
    return this.WOMPI_AMBIENTE === 'prod' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
  },

  // Cuenta bancaria para pagos de suscripción por transferencia manual
  CUENTA_BANCO: process.env.CUENTA_BANCO || '',
  CUENTA_TIPO: process.env.CUENTA_TIPO || '',
  CUENTA_NUMERO: process.env.CUENTA_NUMERO || '',
  CUENTA_TITULAR: process.env.CUENTA_TITULAR || '',
  CUENTA_NIT: process.env.CUENTA_NIT || '',
  FLASHPAGO_WHATSAPP: process.env.FLASHPAGO_WHATSAPP || '573167064671',
  // negocio_id cuyo Gmail conectado se usa para verificar los pagos de
  // suscripción a FlashPago (transferencia manual) contra la notificación
  // real del banco. Por defecto el negocio 1 (Mi Negocio / vinsonburgers).
  NEGOCIO_ID_SUSCRIPCION: parseInt(process.env.NEGOCIO_ID_SUSCRIPCION || '1', 10),
  // A quién le llega la alerta de "pago de suscripción sin confirmar por el
  // banco" (routes/webhook.js, procesarPagoPlataforma). Separado de
  // FLASHPAGO_WHATSAPP porque ese es el número público que ve el cliente;
  // este es el tuyo, solo para revisión interna.
  ADMIN_SUSCRIPCION_WHATSAPP: process.env.ADMIN_SUSCRIPCION_WHATSAPP || process.env.FLASHPAGO_WHATSAPP || '573167064671',
};
