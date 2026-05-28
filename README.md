VinsonBot — Verificador de Pagos para Vinson Burgers
Bot de WhatsApp que verifica si un pago llegó realmente a la cuenta de Bancolombia, combinando lectura automática de SMS bancarios con análisis de comprobantes por inteligencia artificial.

Como funciona
El empleado recibe la foto del comprobante del cliente y la reenvía al bot de WhatsApp. El bot analiza la imagen con IA y espera la confirmacion del SMS real de Bancolombia antes de dar el visto bueno.
Cliente paga y manda foto del comprobante
        ↓
Empleado reenvía la foto al bot de WhatsApp
        ↓
Bot analiza el comprobante con IA (Claude API)
        ↓
App Android detecta el SMS real de Bancolombia
        ↓
"Pago verificado, prepara el pedido"
"Comprobante sospechoso, no prepares nada"

Arrancar el proyecto
bash# Clonar el repositorio
git clone https://github.com/ranskevindevelope/burger-bot.git
cd burger-bot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Arrancar el bot
node index.js

# En otra terminal, exponer al internet
npx ngrok http 3000
El bot tiene un modo demo que funciona sin credenciales reales, util para probar el flujo antes de conectar los servicios.

Configurar WhatsApp con OpenWA

Instalar la dependencia de OpenWA:

bash   npm install @open-wa/wa-automate

Ejecutar el bot — aparece un QR en la terminal
Escanear el QR con el WhatsApp del negocio
El bot queda conectado y escuchando mensajes


App Android — VinsonBot SMS
La app Android lee los SMS reales de Bancolombia directamente desde el celular y los envia al bot de forma automatica. Esto reemplaza la necesidad de una API bancaria externa.
Requisitos

Celular Android con la cuenta de Bancolombia activa
Android 8.0 o superior
Permisos de SMS, notificaciones y bateria sin restricciones

Configuracion inicial

Instalar el APK en el celular del negocio
Abrir la app y aceptar todos los permisos que solicita
Aceptar la solicitud de desactivar optimizacion de bateria
Ingresar la URL del bot y tocar Guardar

Bancos de origen compatibles
Dado que la cuenta destino es Bancolombia, el SMS siempre lo genera Bancolombia sin importar desde donde pague el cliente:

Nequi
Daviplata
Nubank
Cualquier banco colombiano

Componentes de la app
ComponenteFuncionSmsForegroundServiceServicio activo en segundo plano, procesa SMS y envia al botSmsReceiverCaptura SMS entrantes y los delega al servicioBootReceiverArranca el servicio automaticamente al reiniciar el celularMainActivityPantalla de configuracion de la URL del bot
JSON que envia la app al bot
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
La app incluye un boton de simulacion para hacer pruebas sin necesidad de transferencias reales.

Verificacion con IA

Crear cuenta en platform.anthropic.com
Generar una API Key
Agregarla al archivo .env:

   ANTHROPIC_API_KEY=tu_api_key
Sin API key el bot usa modo demo con datos simulados.

Estructura del proyecto
burger-bot/
├── index.js          — Servidor principal y bot de WhatsApp
├── ocr.js            — Analisis de comprobantes con Claude API
├── verificador.js    — Logica de verificacion de pagos
├── .env.example      — Variables de entorno de ejemplo
├── package.json
└── android-app/
    ├── SmsForegroundService.kt
    ├── SmsReceiver.kt
    ├── BootReceiver.kt
    └── MainActivity.kt

Como lo usan los empleados
Cliente paga y manda foto del comprobante al empleado
Empleado reenvía la foto al numero del bot

Bot responde:

Pago verificado
Monto: $50.000
De: Juan Perez
Fecha: 28/05/2026 12:55
Confirmado por SMS de Bancolombia

Puedes preparar el pedido.

Estado del proyecto
Completado

Bot de WhatsApp con OpenWA
Analisis de comprobantes con Claude API
App Android que lee SMS de Bancolombia en tiempo real
Servicio en segundo plano con ForegroundService
Arranque automatico al reiniciar el celular

En progreso

Estabilidad en segundo plano en dispositivos Infinix
Documentacion tecnica completa

Pendiente

Base de datos con historial de pagos (Supabase)
Dashboard web para ver pagos en tiempo real
Deteccion de pagos duplicados
Multi-sede para varias sucursales
Reportes automaticos diarios
Integracion con API bancaria directa (Prometeo/Belvo)
Pruebas de carga y seguridad


Nota sobre dispositivos Infinix
Los dispositivos Infinix con XOS tienen una gestion de bateria agresiva que puede interferir con el servicio en segundo plano. Para garantizar el funcionamiento correcto ir a Ajustes, Aplicaciones, VinsonBot SMS, Bateria y seleccionar Sin restricciones. La app solicita este permiso automaticamente al instalarse.

Integracion futura con API bancaria
Cuando este disponible el acceso a Prometeo o Belvo, el sistema hara doble verificacion: el SMS de Bancolombia como confirmacion rapida y la consulta directa al banco como verificacion definitiva.

Este proyecto esta en desarrollo activo como practica profesional aplicada a una empresa real.