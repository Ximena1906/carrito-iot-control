# 🎮 Carrito IoT · Aplicación de CONTROL

Aplicación web con diseño de **control tipo gamepad** (oscuro con brillos rosa neón) para manejar desde
el navegador un **carrito RC con garra** controlado por un **ESP32**, y vigilar en tiempo real lo que hace.
Tiene dos vistas en el mismo sitio: **CONTROL** (práctica 4.1) y **MONITOREO** (práctica 4.2). Cada botón llama a una
**API FastAPI en AWS**, que guarda la orden en **Amazon RDS** con Stored Procedures y la envía en tiempo
real al carrito por **WebSocket seguro (WSS)**.

| | |
|---|---|
| 🌐 **Sitio publicado** | https://ximena1906.github.io/carrito-iot-control/ |
| 🎮 **Vista CONTROL** | https://ximena1906.github.io/carrito-iot-control/#/control |
| 📊 **Vista MONITOREO** | https://ximena1906.github.io/carrito-iot-control/#/monitoreo |
| 📘 **API (Swagger UI)** | https://carrito-ximena.duckdns.org/docs |
| 🗂️ **Repositorio de la API** | https://github.com/Ximena1906/carrito-iot-api |
| 👩‍💻 **Desarrollado por** | Ximena Nava Escamilla |

---

## Contenido
1. [Capturas](#1-capturas)
2. [Arquitectura](#2-arquitectura)
   - [Ampliación 4.2 · MONITOREO](#ampliación-42--monitoreo)
3. [Cómo usar la aplicación](#3-cómo-usar-la-aplicación)
4. [Mapa de controles](#4-mapa-de-controles)
5. [Cómo viaja un comando](#5-cómo-viaja-un-comando)
6. [Indicadores de conexión](#6-indicadores-de-conexión)
7. [DEMO](#7-demo)
8. [Luces y bocina (ON/OFF)](#8-luces-y-bocina-onoff)
9. [Diseño estático y responsivo](#9-diseño-estático-y-responsivo)
10. [Tecnologías](#10-tecnologías)
11. [Estructura del proyecto](#11-estructura-del-proyecto)
12. [Seguridad](#12-seguridad)
13. [Ejecución local](#13-ejecución-local)
14. [Publicación en GitHub Pages](#14-publicación-en-github-pages)
15. [Pruebas realizadas](#15-pruebas-realizadas)
16. [Solución de problemas](#16-solución-de-problemas)

---

## 1. Capturas

**Computadora**

![Control en computadora](docs/capturas/escritorio.png)

| Celular (vertical) | Celular (horizontal) |
|---|---|
| <img src="docs/capturas/celular.png" alt="Control en celular vertical" width="300"> | <img src="docs/capturas/celular-horizontal.png" alt="Control en celular horizontal" width="520"> |

**MONITOREO**

| Computadora | Celular |
|---|---|
| <img src="docs/capturas/monitoreo-escritorio.png" alt="Monitoreo en computadora" width="560"> | <img src="docs/capturas/monitoreo-celular.png" alt="Monitoreo en celular" width="260"> |

---

## 2. Arquitectura

```mermaid
flowchart LR
    U["👩 Operadora<br/>(compu o celular)"] --> W["GitHub Pages<br/>HTML5 + CSS3 + Bootstrap 5<br/>JavaScript modular"]
    W -- "HTTPS · Fetch + JWT" --> C["Caddy<br/>HTTPS/WSS · Let's Encrypt<br/>carrito-ximena.duckdns.org"]
    W <-- "WSS · eventos" --> C
    C --> A["API FastAPI<br/>AWS EC2 · Windows Server"]
    A -- "CALL sp_..." --> D[("Amazon RDS · MySQL<br/>carrito_iot<br/>21 Stored Procedures")]
    A <-- "WSS · eventos + ack" --> E["ESP32<br/>2× 74HC595 + PC817"]
    E --> R["🎮 Control remoto<br/>del carrito RC"]
```

- La página **nunca** se conecta a la base de datos: todo pasa por la API.
- La API solo usa **Stored Procedures** (el usuario `api_carrito` tiene únicamente permiso `EXECUTE`).
- El ESP32 "presiona" los botones del control remoto del carrito a través de los optoacopladores PC817.

---

## Ampliación 4.2 · MONITOREO

MONITOREO **amplía** la aplicación de CONTROL sin reemplazarla: las dos vistas viven en el mismo
`index.html`, en el mismo repositorio y en el mismo GitHub Pages. Se cambia de vista con las pestañas
**CONTROL | MONITOREO** (enlaces `#/control` y `#/monitoreo`) **sin recargar la página**, por lo que
ambas comparten **una sola conexión WSS**, los tres indicadores, el favicon y los créditos.

### Qué muestra
- **Último movimiento reportado:** nombre, comando, código, vehículo, origen, fecha y hora. Una etiqueta
  indica de dónde viene el dato: **En vivo · WSS** (evento), **Persistido · RDS** (consulta REST) o
  **DEMO · paso N de M**. También muestra si el ESP32 está conectado al servidor.
- **Últimos 10 movimientos:** tabla con **#, Movimiento, Fecha y Hora** (en pantallas amplias también
  Código, Origen e ID de RDS), del más reciente al más antiguo.
- Mensajes de **Cargando**, **Sin movimientos**, **Sincronizando**, **Desconectado/Reconectando** y
  **Error**, con texto e icono (no solo color).

### Contratos reales de la API (Swagger)

| Uso | Contrato |
|---|---|
| Último estado | `GET /vehiculos/1/estado` → `id_vehiculo`, `vehiculo`, `comando`, `codigo`, `conectado`, `fecha_actualizacion`, `demo_en_curso` (SP `sp_obtener_estado`) |
| Historial | `GET /vehiculos/1/historial?limite=10` → lista de `id_historial`, `id_vehiculo`, `comando`, `codigo`, `fecha_hora`, `origen`; máximo 10, del más reciente al más antiguo; **nunca incluye pasos de DEMO** (SP `sp_obtener_historial`) |
| Salud API | `GET /health` |
| Diagnóstico RDS | `GET /health/db` |
| Tiempo real | `wss://carrito-ximena.duckdns.org/ws/vehiculos/1` → `estado_inicial`, `movimiento`, `demo_inicio`, `demo_paso`, `demo_fin`, `demo_cancelada`, `dispositivo`, `ack_dispositivo` (todos con `id_evento`, `id_vehiculo` y `timestamp` UTC) |

Las consultas de MONITOREO son de solo lectura y no requieren token; enviar comandos sí lo requiere.

### Cómo se sincroniza

```mermaid
sequenceDiagram
    participant M as MONITOREO
    participant A as API FastAPI
    participant D as Amazon RDS
    Note over M: Al abrir la vista
    M->>A: GET /estado y GET /historial?limite=10
    A->>D: sp_obtener_estado · sp_obtener_historial
    A-->>M: estado + 10 registros
    Note over M: CONTROL, otra pestaña o un cliente externo mandan un comando
    A--)M: WSS «movimiento» (ya guardado en RDS)
    M->>M: Actualiza la tarjeta al instante
    M->>A: GET /historial?limite=10 (una sola vez por ráfaga)
    A-->>M: 10 registros confirmados
    M->>M: Actualiza solo las filas que cambian
```

- **WSS dispara, REST confirma:** el evento actualiza la tarjeta al instante, pero la tabla **solo**
  muestra lo que devuelve la API desde RDS; nunca se agrega una fila "a mano".
- **Sin polling:** el historial se consulta al abrir MONITOREO, al recibir un evento `movimiento`, al
  reconectar el WSS y con el botón **Actualizar**. Varios eventos seguidos se agrupan en una sola consulta.
- **Reconexión:** cuando el WSS vuelve a estar **En línea** se consultan otra vez el estado y los
  10 movimientos, para recuperar lo que haya pasado mientras no había conexión.
- **DEMO:** los `demo_paso` actualizan la tarjeta (etiqueta **DEMO · paso N de M**) pero **no** la tabla,
  porque el servidor no guarda los pasos de una DEMO en el historial individual.
- **Duplicados y orden:** se descartan eventos con `id_evento` repetido, eventos de otro vehículo y
  filas con `id_historial` repetido. La tarjeta solo acepta un dato si su fecha no es anterior a la que
  ya muestra, y las respuestas REST de una consulta superada se descartan (contador de solicitudes).
- **Fechas:** la API devuelve las fechas de RDS en UTC sin zona (`2026-11-11T23:57:58`) y los eventos
  WSS en UTC con zona. Se interpretan como UTC y se muestran en la zona horaria del navegador
  (en México, `America/Mexico_City`, UTC−06:00). Si falta una fecha, se muestra «—»: nunca se inventa.

> **Evento recibido ≠ registro persistido ≠ ejecución física.** Un evento WSS confirma que el servidor
> publicó la orden; la tabla confirma que quedó guardada en RDS; ninguno de los dos comprueba que el
> carrito se haya movido.

### Mapa de módulos de la ampliación

| Archivo | Responsabilidad |
|---|---|
| `assets/js/ui/navegacion.js` | Pestañas CONTROL/MONITOREO con `#/control` y `#/monitoreo`, sin recargar |
| `assets/js/monitoreo/sincronizador.js` | Datos de MONITOREO (sin DOM): carga REST, eventos WSS, deduplicación, orden y reconexión |
| `assets/js/monitoreo/vista.js` | Tarjeta del último movimiento y tabla de 10 filas (todo con `textContent`) |
| `assets/js/utils/fechas.js` | Lectura de fechas de la API en UTC y formato local de fecha y hora |
| `assets/js/api/cliente.js` | Se agregó `historial()`; el resto del cliente REST es el de CONTROL |
| `assets/js/estado.js` | Se agregaron las claves de la vista y de MONITOREO |
| `assets/js/app.js` | Reparte los eventos de la **única** conexión WSS a CONTROL y a MONITOREO |

---

## 3. Cómo usar la aplicación

1. Abre el sitio. Los tres indicadores de arriba deben ponerse en **verde**.
2. Presiona **Iniciar sesión** y entra con la cuenta de **operador**. Sin sesión, los controles se ven
   bloqueados y aparece el aviso *«Inicia sesión como operador para controlar el carrito»*.
3. Revisa el chip **ESP32**: si dice **conectado**, el carrito físico recibirá las órdenes.
4. Usa el joystick, los gatillos, los botones A B X Y o el teclado.
5. Para parar todo en cualquier momento: botón rojo **DETENER** o tecla **Q** (la tecla Q funciona en
   las dos vistas; las demás teclas solo en CONTROL).
6. Abre la pestaña **MONITOREO** para ver el último movimiento y los 10 más recientes. Se actualiza solo,
   también con comandos enviados desde otra pestaña, otro dispositivo o Swagger.
7. Al terminar, presiona **Salir**. El token se borra también al cerrar la pestaña.

---

## 4. Mapa de controles

Los botones se generan con el **catálogo real** de la API (`GET /vehiculos/1/comandos`): si un comando
no existe o está inactivo, su botón no aparece.

| Control en pantalla | Comando | Código | Tipo | Tecla |
|---|---|:---:|---|:---:|
| Joystick ↑ | `AVANZAR` | 1 | Mantener | W |
| Joystick ↓ | `RETROCEDER` | 2 | Mantener | S |
| Joystick ← | `MOVER_IZQUIERDA` | 7 | Mantener | A |
| Joystick → | `MOVER_DERECHA` | 8 | Mantener | D |
| **LT** · Giro izquierdo | `GIRAR_IZQUIERDA` | 3 | Mantener | 5 |
| **RT** · Giro derecho | `GIRAR_DERECHA` | 4 | Mantener | 6 |
| **LB** · Garra arriba | `SUBIR_BRAZO` | 5 | Mantener | 1 |
| **RB** · Garra abajo | `BAJAR_BRAZO` | 6 | Mantener | 2 |
| **Y** · Luces | `LUCES` | 10 | Un toque (ON/OFF) | 8 |
| **A** · Bocina | `BOCINA` | 11 | Un toque (ON/OFF) | 4 |
| **X** · Velocidad | `VELOCIDAD` | 12 | Un toque | 7 |
| **B** · Demo del control | `DEMO_CONTROL` | 13 | Un toque | 3 |
| **DETENER** | `DETENER` | 9 | Inmediato | Q |

- **Mantener:** el movimiento dura mientras mantienes presionado. La página lo envía con 10 s de
  duración máxima y lo renueva cada 8 s; al soltar envía `DETENER`.
- **Un toque:** el ESP32 presiona el botón del control remoto durante 150 ms.
- **Joystick:** tiene zona neutral e histéresis, y envía **un solo POST por cambio de dirección**
  (no uno por cada píxel que se mueve el dedo).
- **DETENER** tiene prioridad máxima: reemplaza cualquier orden pendiente y, si hay una DEMO en curso,
  la cancela.
- *«Demo del control» (B)* es la rutina de fábrica del juguete; es distinta de la **DEMO almacenada**
  (sección 7).

---

## 5. Cómo viaja un comando

```mermaid
sequenceDiagram
    autonumber
    participant P as Página
    participant A as API FastAPI
    participant D as Amazon RDS
    participant E as ESP32
    P->>A: POST /vehiculos/1/movimientos (JWT)
    A->>D: CALL sp_actualizar_estado + sp_registrar_historial (una transacción)
    D-->>A: COMMIT
    A-->>P: HTTP 200 · id_evento
    A--)P: WSS evento «movimiento»
    A--)E: WSS evento «movimiento»
    E->>E: Activa la salida del 74HC595
    E--)A: ack «ejecutado»
    A--)P: WSS «ack_dispositivo»
```

El recuadro **Última acción** muestra las tres etapas de cada orden:

| Etapa | Significa |
|---|---|
| **Solicitado** | La página envió la orden a la API. |
| **Aceptado por API** | La API respondió HTTP 200 y la guardó en RDS. |
| **Evento recibido** | Llegó por WebSocket el evento con el mismo `id_evento`. |

> Ninguna etapa comprueba que los motores se movieron: confirman que la orden llegó y se publicó.

---

## 6. Indicadores de conexión

| Indicador | Cómo se comprueba | Estados |
|---|---|---|
| **WebSocket WSS** | Sesión WebSocket real del navegador, con latido *ping/pong* | 🟢 En línea · 🟡 Conectando / Reconectando · 🔴 Desconectado |
| **Servidor AWS · API 21 servicios** | `GET /health` cada 15 s | 🟢 Disponible · 🟡 Comprobando · 🔴 No disponible |
| **Amazon RDS** | `GET /health/db` cada 30 s (muestra la latencia) | 🟢 Disponible · 🔴 No disponible · ⚪ Sin verificar |
| **Chip ESP32** | Evento `dispositivo` del WebSocket | 🟢 conectado · ⚪ sin señal |

*«En línea»* indica la conexión **de este navegador** con el servidor; no confirma por sí solo que el
carrito físico esté conectado (para eso está el chip **ESP32**). Si se pierde la conexión, el WebSocket
se reconecta solo, con espera exponencial de 1 s hasta 15 s.

---

## 7. DEMO

La **DEMO almacenada** («Demo principal») está guardada en RDS y la ejecuta el **servidor**, no la página.

| Paso | Movimiento | Duración |
|:---:|---|---|
| 1 | Avanzar | 2 s |
| 2 | Retroceder | 2 s |
| 3 | Girar a la izquierda | 1 s |
| 4 | Girar a la derecha | 1 s |
| 5 | Desplazarse a la izquierda | 1.2 s |
| 6 | Desplazarse a la derecha | 1.2 s |
| 7 | Garra arriba | 1.5 s |
| 8 | Garra abajo | 1.5 s |

- **▶** inicia (`POST /vehiculos/1/demos/{id}/iniciar`) y **✕** cancela (`POST /vehiculos/1/demos/cancelar`).
- El avance se muestra con los eventos `demo_inicio`, `demo_paso`, `demo_fin` o `demo_cancelada`.
- Mientras corre, los demás controles se bloquean; **DETENER** sigue funcionando y cancela la DEMO.

---

## 8. Luces y bocina (ON/OFF)

El carrito **arranca con las luces y la bocina encendidas**, y cada toque de su botón en el control
remoto cambia al estado contrario. El control **no informa** su estado real, así que la página lleva
la cuenta:

- Los botones **Y** (luces) y **A** (bocina) se ven **prendidos** (rosa neón, etiqueta **ON**) o
  **apagados** (oscuros, etiqueta **OFF**).
- Arriba del control, los letreros **Luces ON/OFF** y **Bocina ON/OFF** muestran lo mismo (solo informan).
- Empiezan en **ON** y cambian cada vez que la API acepta el comando (evento `movimiento`).
- Si la página está abierta en varios dispositivos, todos cambian a la vez.
- Al recargar la página vuelven a **ON**. Si se desfasan (por ejemplo, porque se usó el control
  físico), recarga la página con el carrito recién encendido.

---

## 9. Diseño estático y responsivo

- La página **no se desplaza**: todo el control cabe en una sola pantalla, como una app.
- Todo el gamepad se escala con una sola unidad CSS (`--u`) calculada con *container queries*, según el
  espacio disponible a lo ancho y a lo alto.
- **Computadora y celular acostado:** gamepad horizontal con empuñaduras.
- **Celular vertical:** gatillos arriba, joystick y A B X Y en medio, DETENER y DEMO abajo.
- En celulares se evita que un botón se quede "iluminado" después de tocarlo (`@media (hover: hover)`).
- **MONITOREO** tampoco mueve la página: si la tabla no cabe, se desplaza solo el contenido de la vista,
  y en celular la tabla muestra las columnas esenciales (#, Movimiento, Fecha, Hora) sin desbordarse.

---

## 10. Tecnologías

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico, accesible (roles ARIA, foco visible, `aria-live`) |
| Estilos | CSS3 (variables, grid, container queries) + Bootstrap 5.3.3 + Bootstrap Icons 1.11.3 (con SRI) |
| Lógica | JavaScript ES Modules, sin frameworks: Fetch + `async/await`, WebSocket nativo, Pointer Events |
| Publicación | GitHub Pages |
| Backend | FastAPI (Python) en AWS EC2 · Caddy · Amazon RDS MySQL |

---

## 11. Estructura del proyecto

```
carrito-iot-control/
├── index.html                   # Estructura de la página (encabezado, gamepad, diálogo de sesión)
├── README.md
├── docs/capturas/               # Imágenes de este README (CONTROL y MONITOREO)
└── assets/
    ├── css/estilos.css          # Gamepad oscuro rosa neón, sin scroll en celular y escritorio
    ├── img/                     # Favicon propio (SVG + PNG + apple-touch-icon)
    └── js/
        ├── app.js               # Arranque y enlace de vistas (sin reglas de negocio)
        ├── config.js            # URL de la API, WSS, vehículo, rutas y presentación (sin secretos)
        ├── estado.js            # Estado de la aplicación con suscripciones
        ├── api/cliente.js       # Cliente REST: Fetch, timeout, errores HTTP y JSON
        ├── api/websocket.js     # Sesión WSS: reconexión exponencial y latido ping/pong
        ├── control/comandos.js  # Coordinador ÚNICO de comandos (cola, prioridad de DETENER)
        ├── control/joystick.js  # Joystick táctil, mouse y flechas del teclado
        ├── control/botones.js   # Botones del catálogo y su lugar en el gamepad
        ├── control/teclado.js   # Atajos W A S D / Q / 1–8
        ├── demo/demos.js        # Selección, inicio, cancelación y progreso de la DEMO
        ├── monitoreo/sincronizador.js # MONITOREO: REST + WSS, deduplicación, orden y reconexión
        ├── monitoreo/vista.js   # MONITOREO: tarjeta del último movimiento y tabla de 10
        ├── ui/indicadores.js    # Indicadores de WebSocket, servidor AWS y RDS
        ├── ui/sesion.js         # Inicio y cierre de sesión del operador
        ├── ui/mensajes.js       # Avisos breves (toast)
        ├── ui/accesorios.js     # Luces y bocina prendidas/apagadas (ON/OFF)
        ├── ui/navegacion.js     # Pestañas CONTROL | MONITOREO (#/control, #/monitoreo)
        └── utils/               # dom.js (inserción segura), errores.js, fechas.js
```

---

## 12. Seguridad

- **Sin secretos en el repositorio.** La contraseña del operador se escribe en el formulario; el token
  JWT de corta duración vive solo en `sessionStorage` y se descarta al cerrar la pestaña o ante un 401.
- **Todo el tráfico va por HTTPS/WSS** (sin contenido mixto). El backend solo acepta por CORS los
  orígenes autorizados; CORS no es autenticación: cada acción exige el token.
- **Sin inyección de HTML:** los datos de la API se insertan con `textContent`, nunca con `innerHTML`.
- **Sin acceso directo a la base de datos** desde el navegador: RDS solo se verifica con `GET /health/db`.
- Las librerías del CDN se cargan con **Subresource Integrity (SRI)**.

---

## 13. Ejecución local

1. Abre la carpeta en VS Code y usa la extensión **Live Server** (puerto 5500), o ejecuta
   `python -m http.server 5500` y visita `http://127.0.0.1:5500`.
2. Para usar una API local, cambia `API_BASE_URL` y `WS_BASE_URL` en `assets/js/config.js`
   (por ejemplo `http://127.0.0.1:8000` y `ws://127.0.0.1:8000`).
3. El backend debe permitir el origen `http://127.0.0.1:5500` en `CORS_ORIGENES` de su `.env`.

---

## 14. Publicación en GitHub Pages

1. *Settings → Pages → Source: Deploy from a branch → `main` / `(root)`*.
2. Cada `git push` a `main` lanza **pages build and deployment** en la pestaña **Actions**; cuando queda
   con palomita verde, el sitio ya está actualizado.
3. Todas las rutas son relativas, por lo que funcionan en la subruta `/carrito-iot-control/`.
4. El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll.

---

## 15. Pruebas realizadas

Pruebas automáticas en navegador (Chrome) contra la API:

- **Funcionamiento (28 pruebas):** indicadores, catálogo de botones, inicio de sesión correcto e
  incorrecto, token solo en `sessionStorage`, joystick (un POST por dirección y `DETENER` al soltar),
  ráfagas rápidas sin órdenes duplicadas, botones de mantener y de un toque, teclado, DEMO
  (inicio, pasos, cancelación y `DETENER`) y recuperación tras una caída de la API.
- **Luces y bocina (10 pruebas):** inicio en ON, cambio con Y, A y tecla 8, letreros sincronizados,
  sincronización entre pestañas y regreso a ON al recargar.
- **MONITOREO (25 pruebas, casos A–E de la práctica 4.2):**
  - **A · Carga inicial:** al abrir `#/monitoreo` se hacen `GET /estado` y `GET /historial?limite=10`;
    la tabla coincide fila por fila con la API y la tarjeta con el estado de RDS.
  - **B · Evento en vivo:** AVANZAR, MOVER_DERECHA y DETENER enviados desde **otro cliente** cambian la
    tarjeta al instante (etiqueta *En vivo · WSS*) y la tabla queda en orden DETENER, MOVER_DERECHA,
    AVANZAR con **una sola** consulta al historial y **una sola** conexión WSS.
  - **C · Límite:** después de 12 movimientos más, la tabla muestra exactamente los 10 más recientes,
    numerados del 1 al 10 y sin duplicados. Se ignoran eventos de otro vehículo y eventos atrasados.
  - **D · Reconexión:** al caer la API el indicador WSS pasa a *Desconectado* y la tarjeta avisa que
    muestra el último valor conocido; al volver, el WSS queda *En línea*, se repite la consulta REST y la
    tabla coincide con RDS.
  - **E · DEMO:** la tarjeta muestra *DEMO · paso N de M* y la tabla queda **igual** antes y después.
- **Diseño:** CONTROL sin desplazamiento y con todos los botones visibles y tocables; MONITOREO sin
  desplazamiento horizontal y con las columnas esenciales visibles. Probado en computadora
  (1920×960, 1366×768, 1280×640), tablet (820×1100), iPhone 14, iPhone SE, Android y celular horizontal.
- **Verificación independiente del WebSocket:** con un cliente externo (Thunder Client, Postman o una
  extensión de VS Code/Chrome) conectado a `wss://carrito-ximena.duckdns.org/ws/vehiculos/1`, cada acción
  de la página produce un evento `movimiento` con `id_vehiculo`, `comando`, `codigo`, `id_evento` y
  `timestamp`; la DEMO produce `demo_inicio`, 8 × `demo_paso` y `demo_fin` o `demo_cancelada`.

---

## 16. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Los indicadores dicen **No disponible** y la página de `/health` muestra *FortiGuard … Dynamic DNS* | La red (escuela o trabajo) bloquea los dominios de DuckDNS | Usa datos móviles o comparte internet desde el celular |
| **No disponible** en cualquier red | La sesión del Learner Lab terminó y EC2 se apagó | *Start Lab*, inicia la instancia **Server2** y revisa que RDS esté *Disponible*; la IP elástica y los servicios arrancan solos |
| Se sigue viendo el diseño anterior | Caché del navegador o publicación pendiente | Revisa **Actions** (palomita verde) y abre la página en incógnito o con **Ctrl+Shift+R** |
| *pages build and deployment* con X roja o *Startup failure* | Falla temporal de GitHub | Revisa https://www.githubstatus.com y usa **Re-run all jobs** cuando se recupere |
| Chip **ESP32: sin señal** | El carrito está apagado o en una red que bloquea DuckDNS | Enciende el carrito y conéctalo al punto de acceso del celular |
| «La sesión expiró» | El token JWT caducó | Vuelve a iniciar sesión |
| La hora de MONITOREO no coincide con el reloj | La base no guarda en UTC | Las fechas se leen como UTC (zona por defecto de RDS); compara la hora de un movimiento recién enviado con la del celular |

---

<p align="center">Desarrollado por <b>Ximena Nava Escamilla</b> · 2026</p>
