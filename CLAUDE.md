# CLAUDE.md

Guía rápida para trabajar en este repo con Claude Code. La documentación completa (flujo, endpoints, esquema de datos, configuración) está en [README.md](README.md) — léelo ahí antes de pedir que se explore el proyecto desde cero.

## Qué es

**FlashPago**: plataforma de verificación automática de pagos, no un bot — usa WhatsApp (vía OpenWA) como canal de entrada de comprobantes. Esta instancia está desplegada para Vinson Burgers: recibe comprobantes de pago, los procesa con Claude (OCR), los verifica contra Gmail/Prometeo y los registra en SQLite (`vinsonbot.db`). Incluye un dashboard React servido por el mismo backend Express.

## Dónde vive el código

- Backend: raíz del repo — `index.js` (entrypoint), `config.js`, `auth.js`, `db.js`, `ocr.js`, `gmail.js`, `verificador.js`.
- Rutas: `routes/api.js` (dashboard/API), `routes/webhook.js` (WhatsApp).
- Lógica del bot: `bot/` (`comandos.js`, `reportes.js`, `festivos.js`, `state.js`, `openwa.js`, `utils.js`).
- Frontend: `dashboard/` (React, con su propio `package.json`).

## Comandos

```bash
node index.js              # backend (raíz)
cd dashboard && npm start  # dashboard en desarrollo
cd dashboard && npm run build  # build servido por el backend en /panel
```

No hay suite de pruebas automatizada configurada.

## Cosas a tener en cuenta

- **Sin migraciones formales**: el esquema de `pagos` y `usuarios` se crea directamente en `db.js`. Cambios de esquema van ahí.
- **Verificación de pagos**: Gmail exige monto exacto; Prometeo (`verificador.js`) permite coincidencia por referencia o diferencia de hasta 100 pesos — revisar ese archivo antes de tocar la lógica de matching.
- **Festivos/fines de semana**: `bot/festivos.js` aplica la Ley Emiliani colombiana; `index.js` decide si corren verificaciones nocturnas (21:00/22:00) y el reporte diario según las variables `HABILITAR_*` del `.env`.
- **Endpoint legado**: `/pago-recibido` está retirado (responde 410); no reintroducir lógica de MacroDroid/SMS/Android.
- **Lista de autorizados**: el webhook solo procesa remitentes definidos en `bot/comandos.js`.

## Seguridad y datos sensibles

- `vinsonbot.db` contiene pagos y datos de clientes reales — no lo leas/imprimas salvo que sea necesario para depurar un bug puntual, y nunca lo subas ni lo incluyas en salidas.
- `.env`, `credentials.json`, `token.json` y `comprobantes/` contienen secretos/material sensible (ya están en `.gitignore`). No los muestres en texto plano ni los uses fuera del propio proceso local.
- `JWT_SECRET` es obligatorio; el servidor no arranca sin él.

## Nota sobre la carpeta

Este repo (`.git`) vive en `burger-bot-openwa/burger-bot-openwa/`. La carpeta padre `burger-bot-openwa/` también contiene `burger-bot-openwa-backup/` (copia de respaldo, no es el repo activo) y `OpenWA/` (proyecto externo de la librería). Trabaja siempre dentro de esta carpeta, no en la de backup.
