# Carrito IoT · Aplicación de CONTROL

Aplicación web **Mobile First** para controlar el Carrito IoT (ESP32 + 2× 74HC595) a través de la
API FastAPI desplegada en AWS. Publicada en **GitHub Pages**.

- **Sitio:** https://ximena1906.github.io/carrito-iot-control/
- **API (Swagger):** https://carrito-ximena.duckdns.org/docs
- **Repositorio de la API:** https://github.com/Ximena1906/carrito-iot-api

```
GitHub Pages (HTML5 + CSS3 + Bootstrap 5 + JS modular)
   │  Fetch + async/await (HTTPS)              │  WebSocket nativo (WSS)
   ▼                                           ▼
API FastAPI en AWS EC2 (Caddy HTTPS/WSS) ──► Stored Procedures ──► Amazon RDS
```

## Funciones
| Elemento | Detalle |
|---|---|
| Joystick | Pointer Events (mouse, táctil, lápiz) y flechas del teclado. Arriba `AVANZAR`, abajo `RETROCEDER`, izquierda `MOVER_IZQUIERDA`, derecha `MOVER_DERECHA`. Zona neutral, histéresis y retorno al centro. Envía **un solo POST por cambio de dirección**; al soltar envía `DETENER`. |
| Botones | Generados con el **catálogo real** (`GET /vehiculos/1/comandos`). Sostenidos: giros y garra (mantener presionado). Funciones de un toque: luces, bocina, velocidad, demo del control. |
| DETENER | Prioridad máxima: reemplaza cualquier pendiente, cancela renovaciones y funciona durante una DEMO (la cancela). |
| DEMO | Lista las DEMO existentes, inicia (`POST .../demos/{id}/iniciar`) y cancela (`POST .../demos/cancelar`). Progreso por eventos WebSocket. Sin CRUD. |
| Indicadores | **WebSocket WSS** (En línea / Conectando-Reconectando / Desconectado), **Servidor AWS · API 21 servicios** (`GET /health`) y **Amazon RDS** (`GET /health/db`; «Sin verificar» si no se puede consultar). |
| Última acción | Solicitado → Aceptado por API (HTTP 200) → Evento recibido (mismo `id_evento` por WebSocket). Ninguna etapa significa ejecución física comprobada. |
| Teclado | Igual que el firmware original: `W A S D`, `Q` detiene, `1`–`8` funciones. |

## Estructura
```
carrito-iot-control/
├── index.html               # Estructura semántica
└── assets/
    ├── css/estilos.css      # Tema rosa, Mobile First, horizontal y escritorio
    ├── img/                 # Favicon propio (SVG + PNG + apple-touch-icon)
    └── js/
        ├── app.js               # Arranque y enlace de vistas (sin reglas de negocio)
        ├── config.js            # URL base, WSS, vehículo, rutas y presentación (sin secretos)
        ├── estado.js            # Estado operacional con suscripciones
        ├── api/cliente.js       # Cliente REST: Fetch, timeout, errores HTTP y JSON
        ├── api/websocket.js     # Sesión WSS real: reconexión exponencial y latido ping/pong
        ├── control/comandos.js  # Coordinador ÚNICO de comandos (cola, prioridad DETENER)
        ├── control/joystick.js  # Joystick táctil/mouse/teclado
        ├── control/botones.js   # Botones del catálogo
        ├── control/teclado.js   # Atajos W A S D / Q / 1-8
        ├── demo/demos.js        # Selección, inicio, cancelación y progreso de DEMO
        ├── ui/indicadores.js    # Tres indicadores independientes
        ├── ui/sesion.js         # Inicio de sesión del operador
        ├── ui/mensajes.js       # Avisos y mensajes recientes
        └── utils/               # dom.js (inserción segura), errores.js
```

## Seguridad
- Sin secretos en el repositorio. La contraseña del **operador** se escribe en el formulario; el token
  JWT de corta duración se guarda solo en `sessionStorage` y se descarta al cerrar la pestaña o ante un 401.
- Todo el tráfico va por **HTTPS/WSS** (sin contenido mixto). El backend solo acepta por CORS los orígenes
  autorizados. CORS no es autenticación: las acciones exigen el token.
- Los datos de la API se insertan con `textContent` (nunca `innerHTML`).
- Sin acceso del navegador a MySQL/RDS: la base solo se verifica con `GET /health/db` del backend.

## Ejecución local
1. Abre la carpeta en VS Code y usa la extensión **Live Server** (puerto 5500), o
   `python -m http.server 5500` y visita `http://127.0.0.1:5500`.
2. El backend debe permitir el origen `http://127.0.0.1:5500` en `CORS_ORIGENES`.

## Publicación en GitHub Pages
*Settings → Pages → Source: Deploy from a branch → main / (root)*. Todas las rutas son relativas,
por lo que funcionan en la subruta `/carrito-iot-control/`.

## Verificación independiente del WebSocket
Conecta un cliente externo (Thunder Client / Postman / extensión de Chrome) a
`wss://carrito-ximena.duckdns.org/ws/vehiculos/1`. Cada acción de la página produce un evento
`movimiento` con `id_vehiculo`, `comando`, `codigo`, `id_evento` y `timestamp`; la DEMO produce
`demo_inicio`, N × `demo_paso`, y `demo_fin` o `demo_cancelada`. Un evento WebSocket confirma que el
backend publicó la orden, **no** que los motores se movieron.
