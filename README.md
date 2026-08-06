# VINSON PAGOS IA — Verificador de Pagos

Bot de WhatsApp para Vinson Burgers que verifica si un pago llegó realmente a la cuenta de Bancolombia antes de que el empleado entregue el pedido. Combina lectura de SMS, lectura de correo y análisis de comprobantes con IA.

La idea nació de un problema real del negocio: comprobantes falsos o editados que algunos clientes mandaban para que les entregaran el pedido sin haber pagado y tambien debido a los retrasos que conlleva verificar las transferencias de manera manual.

## Cómo funciona

1. El cliente paga y manda la foto del comprobante
2. El empleado reenvía esa foto al bot por WhatsApp
3. El bot lee el comprobante con Claude (OCR + análisis)
4. En paralelo, busca si ese pago realmente llegó:
   - Primero revisa si llegó el SMS de Bancolombia (vía app Android)
   - Si no llegó el SMS, revisa el correo de notificaciones de Bancolombia (Gmail API)
   - Si ninguno confirma, intenta con la API bancaria (actualmente en modo demo, pendiente credenciales de producción)
5. Responde al empleado con el resultado

```
Cliente paga y manda foto del comprobante
        ↓
Empleado reenvía la foto al bot de WhatsApp
        ↓
Bot analiza el comprobante con IA (Claude API)
        ↓
Busca confirmación real: SMS → Gmail → API bancaria
        ↓
"Pago verificado, puedes finalizar el pedido"
"No pude verificar este pago, revisa al final del turno"
```

La verificación es por **monto exacto**, sin tolerancia. Si el comprobante dice $150 y el banco confirmó $105, no hace match — son pagos distintos y así se tratan.

## Por qué dos fuentes de verificación (SMS + Gmail)

El SMS de Bancolombia no siempre llega a tiempo al celular — depende de señal, y en algunos dispositivos android y ultimas versiones el sistema mata la app en segundo plano y se pierden notificaciones. El correo de Bancolombia es más confiable porque no depende de la red celular ni de que el celular esté encendido. Por eso el bot intenta primero por SMS (es casi instantáneo) y si no lo encuentra, recurre al correo como respaldo.

## Arrancar el proyecto

```bash
git clone https://github.com/ranskevindevelope/burger-bot.git
cd burger-bot
npm install
cp .env.example .env
node index.js
```

En otra terminal, si necesitas exponerlo a internet para pruebas:
```bash
npx ngrok http 3000
```

Sin credenciales reales el bot corre en modo demo — útil para probar el flujo de mensajes sin tener todo conectado.

## WhatsApp (OpenWA)

```bash
npm install @open-wa/wa-automate
```

Al correr el bot aparece un QR en la terminal. Se escanea con el WhatsApp del negocio y queda conectado escuchando mensajes en `/webhook`.

## Verificación por Gmail

Para que el bot pueda leer las notificaciones de Bancolombia desde el correo:

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com) con el mismo correo donde llegan las notificaciones del banco
2. Habilitar la Gmail API
3. Crear credenciales OAuth (tipo "Aplicación de escritorio") y descargar `credentials.json` en la raíz del proyecto
4. Correr una sola vez:
   ```bash
   node generar-token.js
   ```
   Esto abre una URL para autenticarte con el correo del negocio y genera `token.json`
5. Listo — `gmail.js` ya queda funcionando como respaldo automático

El filtro busca correos de `alertasynotificaciones@an.notificacionesbancolombia.com` — si el banco cambia ese remitente en algún momento, hay que actualizarlo en `gmail.js`.

**Nota:** el token actual tiene permisos de leer los correos y marcarlos (`gmail.modify`), si modifica y marca correos como leídos. como conclusion final se dejo que lea los correos y marque el leido  ,dado que es prueba cada 7 dias hay que regenerar el token con el scope `gmail.modify`.

## App Android — SMS de Bancolombia

La app lee los SMS reales de Bancolombia desde el celular del negocio y los manda al bot apenas llegan. Como la cuenta destino es Bancolombia, el SMS siempre lo manda Bancolombia sin importar si el cliente pagó desde Nequi, Daviplata, Nubank o cualquier otro banco — por eso no hace falta soportar cada banco por separado.

**Requisitos:**
- Android 8.0 o superior
- Permisos de SMS, notificaciones y batería sin restricciones

**Configuración:**
1. Instalar el APK en el celular del negocio
2. Aceptar todos los permisos
3. Desactivar la optimización de batería para la app (se lo pide automáticamente al instalar)
4. Ingresar la URL del bot y guardar

en algunos dispositivo la app en android no puede funcionar efectivamente ya que traen restrincciones agresivas de bateria asi que si no funciona bien se opta por verificar GMAIL o API bancaria".

## Verificación con IA (Claude)

```env
ANTHROPIC_API_KEY=tu_api_key
```

Sin esa clave el bot usa datos simulados (modo demo). Claude analiza la imagen del comprobante y extrae banco, monto, referencia y fecha, además de marcar si la imagen parece editada o sospechosa — aunque esa bandera (`parece_falso`) es informativa, la decisión final depende de si el banco confirmó el pago, no de cómo se vea el comprobante.

## Estructura del proyecto

```
burger-bot/
├── index.js              — servidor principal y lógica del bot
├── gmail.js               — verificación de pagos vía correo de Bancolombia
├── ocr.js                 — análisis de comprobantes con Claude API
├── verificador.js          — verificación con API bancaria (pendiente) + modo demo
├── generar-token.js        — script de autenticación de Gmail (se corre una sola vez)
├── .env.example
├── package.json
└── android-app/
    ├── SmsForegroundService.kt
    ├── SmsReceiver.kt
    ├── BootReceiver.kt
    └── MainActivity.kt
```

## Estado del proyecto

**Funcionando:**
- Bot de WhatsApp con OpenWA
- Análisis de comprobantes con Claude
- App Android leyendo SMS de Bancolombia en tiempo real
- Verificación por Gmail Principal respaldo SMS app android
- comparacion de montos exacta 
- base de datos local con SQLITE

**En progreso:**
- Estabilidad del servicio en segundo plano en algunos dispositivos
- Acceso a API bancaria de producción (evaluando Prometeo, Belvo y Passport Fintech para Bre-B)

**Pendiente:**
- usar API gmail en produccion (lleva costos)
- pasar la base de datos local SQLITE a produccion con PostgreSQL (subirla al a nube costos)
- Base de datos para cada negocio (ya teniendo varios clientes pagando)
- Dashboard web para ver el historial de pagos - generar recibos -
revisar lista de clientes - (lleva dominio hosting costos)
- Despliegue en VPS para que corra 24/7 sin depender del PC local (llevas costos)



---

Proyecto en desarrollo activo como etapa productiva (ADSO — SENA), aplicado directamente a las necesidades reales de Vinson Burgers.

producto final- sera un software para comercializar.