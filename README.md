# FlashPago

Sistema de verificacion automatica de pagos. No es un bot: es una plataforma
de verificacion de pagos que usa WhatsApp (mediante OpenWA) como canal de
entrada. El proyecto recibe comprobantes por WhatsApp, extrae sus datos con
Claude, comprueba el pago mediante Gmail y registra el resultado en SQLite.
Tambien incluye un dashboard web con login, reportes y administracion de
usuarios. Esta instancia esta configurada para Vinson Burgers, pero la
suscripcion y el cobro son a FlashPago (ver seccion Wompi).

El codigo esta organizado en modulos separados por responsabilidad, de modo
que `index.js` actua solo como punto de entrada del servidor y el resto de la
logica vive en las carpetas `routes/` y `bot/`.

## Flujo principal

1. Un empleado reenvia al bot la imagen del comprobante por WhatsApp.
2. OpenWA envia el evento a `POST /webhook`.
3. El servidor valida el secreto del webhook y que el remitente este autorizado.
4. Claude extrae banco, monto, referencia y fecha del comprobante.
5. Gmail busca una notificacion reciente de Bancolombia con el mismo monto.
6. Si Gmail no confirma el pago, se usa el verificador bancario configurado.
7. El resultado se guarda en la tabla `pagos` y se responde por WhatsApp.

La comprobacion de Gmail usa el monto exacto. El verificador bancario de
Prometeo puede usar coincidencia por referencia o una diferencia maxima de
100 pesos, segun la configuracion actual de `verificador.js`.

## Funcionalidades

- Bot de WhatsApp integrado con OpenWA.
- Lectura de comprobantes con Claude API o modo local de demostracion.
- Verificacion de pagos por Gmail API.
- Verificacion opcional con Prometeo en sandbox o produccion.
- Deteccion de comprobantes duplicados durante los ultimos siete dias.
- Registro de pagos y comprobantes en SQLite.
- Login del dashboard con JWT.
- Contraseñas de usuarios almacenadas con PBKDF2 y salt aleatorio.
- Roles `admin` y `empleado`.
- Dashboard React servido por el mismo servidor Express.
- Totales diarios, estadisticas, pagos pendientes y duplicados.
- Busqueda de pagos por nombre del cliente.
- Exportacion CSV de los ultimos treinta dias.
- Gestion de usuarios para administradores.
- Reportes automaticos por WhatsApp segun el horario configurado en `index.js`.

## Estructura

```text
flashpago-backend/
├── index.js              # Arranca el servidor, monta rutas y programa reportes
├── config.js             # Variables de entorno centralizadas
├── auth.js               # Middlewares de autenticacion: JWT, roles, login
├── db.js                 # Conexion SQLite, esquema y consultas
├── ocr.js                # Extraccion de datos con Claude o patrones locales
├── gmail.js              # Busqueda y confirmacion por Gmail API
├── verificador.js        # Verificacion Prometeo y modo demo
├── generar-token.js      # Autorizacion inicial de Gmail
├── routes/
│   ├── api.js            # Endpoints del dashboard (login, usuarios, reportes...)
│   └── webhook.js        # Procesamiento de mensajes de WhatsApp
├── bot/
│   ├── comandos.js       # Comandos de texto del bot (hola, total, buscar...)
│   ├── reportes.js       # Reporte diario y verificacion nocturna
│   ├── state.js          # Estado en memoria (pendientes e historial)
│   ├── openwa.js         # Envio de mensajes e imagenes por OpenWA
│   └── utils.js          # Utilidades (formatear resultado, guardar foto)
├── package.json          # Dependencias del backend
├── vinsonbot.db          # Base SQLite local; no debe subirse al repositorio
├── comprobantes/         # Imagenes guardadas localmente
└── dashboard/
    ├── src/              # Aplicacion React
    ├── public/
    └── package.json      # Dependencias y scripts del frontend
```

## Requisitos

- Node.js 20 o una version compatible con las dependencias instaladas.
- Una instancia de OpenWA accesible desde el backend.
- Una cuenta de Gmail con las notificaciones bancarias, si se usa Gmail.
- Una clave de Claude, si se desea OCR con IA.
- Credenciales de Prometeo, si se desea verificacion bancaria real.

## Instalacion

Desde la raiz:

```bash
npm install
cd dashboard
npm install
npm run build
cd ..
node index.js
```

El backend sirve el dashboard compilado desde `dashboard/build`. En desarrollo
del frontend se puede usar:

```bash
cd dashboard
npm start
```

El proxy del dashboard apunta a `http://localhost:3000`.

## Configuracion `.env`

Crea un archivo `.env` en la raiz. Nunca subas sus valores al repositorio.

```env
# Servidor y negocio
PORT=3000
NEGOCIO_NOMBRE=VINSON PAGOS IA

# OpenWA
OPENWA_URL=http://localhost:2785
OPENWA_API_KEY=tu_clave_de_openwa
OPENWA_SESSION=tu_sesion

# Seguridad del dashboard
JWT_SECRET=un_secreto_largo_y_aleatorio

# Seguridad de entradas de OpenWA
INBOUND_WEBHOOK_SECRET=otro_secreto_largo_y_aleatorio

# Integraciones opcionales
CLAUDE_API_KEY=tu_clave_de_claude
PROMETEO_ENV=sandbox
PROMETEO_API_KEY=tu_clave_de_prometeo
MY_WHATSAPP=573000000000@c.us

# Wompi (pasarela de pagos de la suscripción de FlashPago)
WOMPI_AMBIENTE=test
WOMPI_PUBLIC_KEY=pub_test_xxx
WOMPI_PRIVATE_KEY=prv_test_xxx
WOMPI_INTEGRITY_SECRET=tu_secreto_de_integridad
WOMPI_EVENTS_SECRET=tu_secreto_de_eventos

# Control de reportes y verificaciones en festivos / fin de semana (true/false)
HABILITAR_VERIFICACION_FESTIVOS=true
HABILITAR_VERIFICACION_FIN_SEMANA=true
HABILITAR_REPORTE_FESTIVOS=true
HABILITAR_REPORTE_FIN_SEMANA=true
```

`JWT_SECRET` es obligatorio: el servidor no inicia sin el. El login del
dashboard no usa credenciales fijas; los usuarios y sus contraseñas se
almacenan en la tabla `usuarios` de la base de datos y se gestionan desde el
dashboard por un administrador. `MY_WHATSAPP` recibe las alertas de pagos que
requieren revision manual.

Las variables `HABILITAR_*` permiten decidir si el bot ejecuta las
verificaciones nocturnas y el reporte diario en días festivos o fines de
semana. Si se ponen en `false`, esos procesos se omiten los días
correspondientes (por ejemplo, si en un festivo el negocio no opera y no hay
movimientos que revisar).

## Configurar Gmail

1. Habilita Gmail API en Google Cloud.
2. Crea credenciales OAuth de tipo aplicacion de escritorio.
3. Guarda el archivo descargado como `credentials.json` en la raiz.
4. Ejecuta una sola vez:

   ```bash
   node generar-token.js
   ```

5. Completa el flujo de autorizacion. Se generara `token.json`.

El filtro actual busca mensajes no leidos recientes de dominios de
Bancolombia. Cuando encuentra una coincidencia, marca el correo como leido.
`credentials.json` y `token.json` contienen material sensible y estan
excluidos por `.gitignore`.

## Configurar Wompi

Se usa para cobrar automáticamente la suscripción de cada negocio a FlashPago (no los pagos de los clientes de cada negocio, eso sigue siendo por Gmail/Prometeo).

1. Crea una cuenta de comercio en [Wompi](https://wompi.co) (persona natural o jurídica, con RUT).
2. En el panel de Wompi (Desarrolladores), copia la llave pública, la llave privada, el secreto de integridad y el secreto de eventos, y ponlos en tu `.env`.
3. Registra la URL del webhook en el panel de Wompi: `https://tu-dominio.com/api/wompi/webhook`.
4. Mientras esperas la aprobación de tu cuenta, puedes usar las llaves de `WOMPI_AMBIENTE=test` (sandbox) sin restricciones.

El monto de cada plan lo decide el servidor (`db.js`, `PRECIOS_CENTAVOS`), nunca el navegador — así nadie puede manipular el precio antes de pagar. La verificación del webhook usa un checksum SHA256 con el secreto de eventos; una petición sin ese secreto correcto se rechaza.

## Configurar OpenWA

Configura OpenWA para enviar los eventos a:

```text
POST http://localhost:3000/webhook
```

Cada solicitud debe incluir:

```text
X-Webhook-Secret: el_mismo_valor_de_INBOUND_WEBHOOK_SECRET
```

El webhook tambien aplica una lista de numeros autorizados definida en
`bot/comandos.js`. Los eventos de remitentes que no esten en esa lista se
ignoran. El endpoint legado `/pago-recibido` esta retirado y responde `410
Gone`; ya no se usan MacroDroid, SMS ni una aplicacion Android para recibir
pagos.

## Festivos y horarios

El servidor detecta automaticamente los dias festivos de Colombia aplicando
la Ley Emiliani (los festivos movibles se trasladan al lunes siguiente,
excepto Año Nuevo, Día del Trabajo, Independencia, Batalla de Boyacá y
Navidad). Tambien calcula los dias que son fin de semana.

La logica vive en `bot/festivos.js` y se usa en `index.js` para decidir si se
ejecutan las verificaciones nocturnas (21:00 y 22:00) y el reporte diario.
Con las variables `HABILITAR_*_FESTIVOS` y `HABILITAR_*_FIN_SEMANA` del `.env`
(por defecto `true`) puedes activar o desactivar estos procesos en festivos o
fines de semana. En dias laborables siempre se ejecutan.

Al iniciar o cada minuto, el log muestra la configuracion vigente del dia
(por ejemplo: `[Festivos] Hoy es festivo. Configuracion: verificacion=SI,
reporte=NO`).

## Dashboard y API

Con el servidor iniciado, abre:

```text
http://localhost:3000/panel
```

El dashboard ofrece:

- Inicio de sesion.
- Resumen diario y mensual.
- Grafica de pagos por dias.
- Lista de pagos reales.
- Pagos duplicados y pendientes.
- Busqueda por cliente.
- Descarga CSV.
- Gestion de usuarios para administradores.

Rutas principales:

| Metodo | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/login` | Publico |
| GET | `/api/dashboard/totales` | JWT |
| GET | `/api/dashboard/pagos` | JWT |
| GET | `/api/dashboard/stats` | JWT |
| GET | `/api/dashboard/duplicados` | JWT |
| GET | `/api/dashboard/pendientes` | JWT |
| GET | `/api/dashboard/buscar/:nombre` | JWT |
| GET | `/exportar` | Solo administrador |
| GET/POST/PUT/DELETE | `/api/usuarios` | Solo administrador |
| GET | `/api/comprobantes/:foto` | JWT |
| POST | `/webhook` | Secreto de webhook |
| POST | `/pago-recibido` | Retirado, responde 410 |

Las rutas protegidas reciben el token como `Authorization: Bearer <token>`.

## Base de datos

La aplicacion crea automaticamente `vinsonbot.db` y las tablas:

- `pagos`: monto, referencia, banco, fecha, estado, fuente, cliente,
  empleado que verifico y comprobante.
- `usuarios`: usuario, hash, salt, nombre, rol, WhatsApp, estado y ultimo
  inicio de sesion.

La base de datos y las imagenes de `comprobantes/` son datos locales de la
operacion. Realiza copias de seguridad y no las publiques.

## Seguridad

- Usa secretos largos y aleatorios para JWT y el webhook.
- Rota cualquier clave que haya sido compartida o expuesta.
- No subas `.env`, `credentials.json`, `token.json`, `vinsonbot.db` ni
  `comprobantes/`.
- Expone el webhook solo mediante HTTPS y, si es posible, restringe el acceso
  por red o proxy.
- Cambia las credenciales iniciales y crea usuarios desde el dashboard.
- El modo demo no confirma pagos reales; para produccion configura una
  integracion bancaria verificable.
- Se ha ejecutado una auditoria de seguridad automatizada con Strix en modo
  profundo que no reporto vulnerabilidades. Sus resultados quedan en la
  carpeta `strix_runs/`, que es generada por la herramienta y no forma parte
  del codigo de la aplicacion.

## Scripts

Backend:

```bash
node index.js
```

Dashboard:

```bash
npm start
npm run build
npm test
```

El backend actualmente no tiene una suite de pruebas automatizadas configurada
en `package.json`.

## Estado actual

Implementado:

- Bot OpenWA.
- OCR de comprobantes.
- Verificacion Gmail.
- Verificacion opcional Prometeo.
- Persistencia SQLite.
- Login JWT y roles.
- Dashboard React.
- Reportes, busqueda, exportacion y gestion de usuarios.

Pendiente o dependiente de despliegue:

- Configurar credenciales de produccion del banco.
- Desplegar el backend con HTTPS y proceso persistente.
- Migrar SQLite a una base de datos gestionada si se requiere escalar.
- Separar datos por negocio para una instalacion multiempresa.
