🤖 VinsonBot — Verificador de Pagos con IA para Vinson Burgers 🍔
Bot de WhatsApp que verifica en segundos si un pago llegó realmente a la cuenta de Bancolombia, combinando lectura automática de SMS bancarios con análisis de comprobantes por IA.

🧠 ¿Cómo funciona?
Cliente compra hamburguesa
        ↓
Cliente paga y manda foto del comprobante al empleado por WhatsApp
        ↓
Empleado reenvía la foto al bot
        ↓
Bot analiza el comprobante con IA (Claude API)
        ↓
App Android VinsonBot SMS detecta el SMS real de Bancolombia
        ↓
✅ "Pago verificado — prepara el pedido"
❌ "Comprobante sospechoso — no prepares nada"

⚡ Arrancar en 15 minutos (modo demo)
bash# 1. Clonar/descargar el proyecto
cd vinson-bot

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env

# 4. Arrancar el bot
node index.js

# 5. En otra terminal, exponer al internet
npx ngrok http 3000
El bot funciona en modo demo sin necesidad de credenciales reales.
Perfecto para probar el flujo completo antes de conectar bancos reales.

📱 Configurar WhatsApp con OpenWA

Instalar dependencias de OpenWA:

bash   npm install @open-wa/wa-automate

Ejecutar el bot — se abre un QR en la terminal
Escanear el QR con el WhatsApp del negocio
El bot queda conectado y escuchando mensajes


📲 App Android — VinsonBot SMS
La app Android reemplaza la dependencia de APIs bancarias externas.
Lee los SMS reales de Bancolombia directamente desde el celular y los envía al bot automáticamente.
Requisitos

Celular Android con la cuenta de Bancolombia activa
Android 8.0 o superior
La app debe tener permisos de SMS y notificaciones

Permisos necesarios
xml<uses-permission android:name="android.permission.RECEIVE_SMS"/>
<uses-permission android:name="android.permission.READ_SMS"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
Configuración inicial

Instalar el APK en el celular del negocio
Abrir la app — aparecen diálogos pidiendo permisos de SMS y notificaciones — aceptar todos
La app pide desactivar la optimización de batería — aceptar (necesario para funcionar en segundo plano)
Ingresar la URL del bot en el campo de texto
Tocar Guardar URL
El servicio queda activo en segundo plano

Números de Bancolombia reconocidos
85540, 87400, 85784, 892445, 87460
También reconoce mensajes que empiecen con Bancolombia:.
Funciona con cualquier banco origen
Dado que la cuenta destino es Bancolombia, el SMS siempre lo genera Bancolombia sin importar si el cliente paga desde:

✅ Nequi
✅ Daviplata
✅ Nubank
✅ Otro banco colombiano

Componentes de la app
ComponenteFunciónSmsForegroundServiceServicio activo en segundo plano, procesa SMS y envía al botSmsReceiverCaptura SMS entrantes y los delega al servicioBootReceiverArranca el servicio automáticamente al reiniciar el celularMainActivityPantalla de configuración de URL del bot
Flujo técnico del SMS
SMS de Bancolombia llega al celular
        ↓
SmsReceiver.onReceive() lo captura
        ↓
Verifica que sea de Bancolombia (número o prefijo)
        ↓
Delega al SmsForegroundService vía Intent
        ↓
El servicio parsea nombre y monto con Regex
        ↓
Envía JSON al bot por HTTP POST
Formato del JSON enviado al bot
json{
  "nombre": "Juan Perez",
  "monto": "50000",
  "sms_completo": "Bancolombia: recibiste una transferencia de Juan Perez por $50.000",
  "fecha": "28/05/2026 12:55"
}
Patrones de SMS reconocidos
"recibiste una transferencia de [nombre] por $[monto]"
"recibiste un pago de [nombre] por $[monto]"
"Recibiste $[monto] de [nombre]"
Botón de prueba (sin transferencia real)
La app incluye un botón "Simular pago de prueba" que envía un SMS falso al bot para probar sin hacer transferencias reales.

🔍 Verificación con IA (Claude API)

Ir a platform.anthropic.com
Crear una API Key
Agregar al .env:

   ANTHROPIC_API_KEY=tu_api_key
Sin API key el bot usa modo demo con datos simulados.

📁 Estructura del proyecto
vinson-bot/
├── index.js              ← Servidor principal + bot WhatsApp (OpenWA)
├── ocr.js                ← Analiza comprobantes con Claude API
├── verificador.js        ← Lógica de verificación de pagos
├── .env.example          ← Variables de entorno (copiar a .env)
├── package.json
└── android-app/          ← App Android VinsonBot SMS
    ├── SmsForegroundService.kt
    ├── SmsReceiver.kt
    ├── BootReceiver.kt
    └── MainActivity.kt

💬 Cómo lo usan los empleados
Cliente paga → manda foto del comprobante al empleado
Empleado reenvía la foto al número del bot de WhatsApp

Bot responde en segundos:

✅ PAGO VERIFICADO
💵 Monto: $50.000
👤 De: Juan Perez
📅 Fecha: 28/05/2026 12:55
🏦 Confirmado por SMS de Bancolombia

✅ Puedes preparar el pedido.

🚨 Alertas automáticas al dueño
Si detecta un comprobante falso o duplicado, el bot avisa
automáticamente por WhatsApp al número configurado en MY_WHATSAPP.

🛣️ Hoja de ruta
✅ Completado

 Bot WhatsApp con OpenWA
 Análisis de comprobantes con Claude API
 App Android que lee SMS de Bancolombia en tiempo real
 Servicio en segundo plano (ForegroundService)
 Arranque automático al reiniciar el celular

🔄 En progreso

 Estabilidad en segundo plano en dispositivos Infinix/XOS
 Documentación completa

📋 Pendiente

 Base de datos (Supabase) — historial de pagos
 Dashboard web — ver pagos en tiempo real
 Detección de pagos duplicados
 Multi-sede (varias sucursales)
 Autenticación por negocio
 Reportes automáticos diarios por WhatsApp
 Integración con Prometeo/Belvo (verificación bancaria directa) (pendiente acceso API)
 Pruebas de carga y seguridad


🔮 Integración futura con Prometeo/Belvo
Cuando esté disponible el acceso a la API bancaria, el flujo de verificación será:
SMS llega → App Android captura → Bot notifica (verificación rápida)
        ↓
Prometeo/Belvo consulta directo al banco (verificación definitiva)
        ↓
✅ Pago 100% confirmado desde la fuente bancaria
Esto permitirá doble verificación:
SMS de Bancolombia + consulta directa a la cuenta bancaria.

⚠️ Nota importante — Dispositivos Infinix/XOS
Los dispositivos Infinix con XOS tienen gestión de batería agresiva.
Para garantizar que la app funcione en segundo plano:

Ir a Ajustes → Aplicaciones → VinsonBot SMS → Batería
Seleccionar Sin restricciones

La app también lo pide automáticamente al instalarse por primera vez.


NOTA: Este proyecto está en fase de desarrollo activo como proyecto aplicado para una empresa real. Actualmente en pruebas con el negocio Vinson Burgers.
