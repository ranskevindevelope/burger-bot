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
  NEGOCIO_NOMBRE: process.env.NEGOCIO_NOMBRE || 'VINSON PAGOS IA',
};
