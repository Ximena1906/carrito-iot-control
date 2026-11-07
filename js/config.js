/**
 * Configuración pública de la aplicación. NO contiene secretos:
 * la contraseña del operador se escribe en el formulario y el token
 * solo vive en sessionStorage mientras la pestaña está abierta.
 */
export const CONFIG = Object.freeze({
  API_BASE_URL: 'https://carrito-ximena.duckdns.org',
  WS_BASE_URL: 'wss://carrito-ximena.duckdns.org',
  ID_VEHICULO: 1,

  DESARROLLADOR: 'Ximena Nava Escamilla',

  // Tiempos (ms)
  TIMEOUT_HTTP: 8000,
  INTERVALO_SALUD_API: 15000,
  INTERVALO_SALUD_RDS: 30000,
  WS_PING: 25000,
  WS_ESPERA_PONG: 10000,
  WS_RECONEXION_MIN: 1000,
  WS_RECONEXION_MAX: 15000,

  // Un movimiento sostenido se envía con este tiempo máximo y se renueva
  // mientras el control siga presionado. Al soltar se envía DETENER.
  DURACION_SOSTENIDO: 10000,
  RENOVAR_SOSTENIDO: 8000,
});

/** Endpoints reales de la API (ver Swagger: /docs). */
export const RUTAS = Object.freeze({
  salud: () => '/health',
  saludBD: () => '/health/db',
  login: () => '/auth/login',
  vehiculo: (v) => `/vehiculos/${v}`,
  comandos: (v) => `/vehiculos/${v}/comandos`,
  estado: (v) => `/vehiculos/${v}/estado`,
  demos: (v) => `/vehiculos/${v}/demos`,
  movimiento: (v) => `/vehiculos/${v}/movimientos`,
  iniciarDemo: (v, d) => `/vehiculos/${v}/demos/${d}/iniciar`,
  cancelarDemo: (v) => `/vehiculos/${v}/demos/cancelar`,
  demoEnCurso: (v) => `/vehiculos/${v}/demos/en-curso`,
  websocket: (v) => `/ws/vehiculos/${v}`,
});

/**
 * Presentación de los comandos del catálogo. Solo se muestran los que la API
 * devuelve como existentes y activos; aquí únicamente se elige icono, texto
 * y tipo de interacción (sostenido = mantener presionado, pulso = un toque).
 */
export const PRESENTACION = Object.freeze({
  AVANZAR: { texto: 'Avanzar', icono: 'bi-arrow-up', tipo: 'joystick', tecla: 'w' },
  RETROCEDER: { texto: 'Retroceder', icono: 'bi-arrow-down', tipo: 'joystick', tecla: 's' },
  MOVER_IZQUIERDA: { texto: 'Izquierda', icono: 'bi-arrow-left', tipo: 'joystick', tecla: 'a' },
  MOVER_DERECHA: { texto: 'Derecha', icono: 'bi-arrow-right', tipo: 'joystick', tecla: 'd' },
  GIRAR_IZQUIERDA: { texto: 'Giro izquierdo', icono: 'bi-arrow-counterclockwise', tipo: 'sostenido', tecla: '5' },
  GIRAR_DERECHA: { texto: 'Giro derecho', icono: 'bi-arrow-clockwise', tipo: 'sostenido', tecla: '6' },
  SUBIR_BRAZO: { texto: 'Garra arriba', icono: 'bi-chevron-double-up', tipo: 'sostenido', tecla: '1' },
  BAJAR_BRAZO: { texto: 'Garra abajo', icono: 'bi-chevron-double-down', tipo: 'sostenido', tecla: '2' },
  LUCES: { texto: 'Luces', icono: 'bi-lightbulb-fill', tipo: 'pulso', tecla: '8' },
  BOCINA: { texto: 'Bocina', icono: 'bi-megaphone-fill', tipo: 'pulso', tecla: '4' },
  VELOCIDAD: { texto: 'Velocidad', icono: 'bi-speedometer2', tipo: 'pulso', tecla: '7' },
  DEMO_CONTROL: { texto: 'Demo del control', icono: 'bi-controller', tipo: 'pulso', tecla: '3' },
  DETENER: { texto: 'Detener', icono: 'bi-stop-circle-fill', tipo: 'detener', tecla: 'q' },
});

export const COMANDO_DETENER = 'DETENER';

/** Dirección del joystick -> comando del catálogo. */
export const JOYSTICK = Object.freeze({
  arriba: 'AVANZAR',
  abajo: 'RETROCEDER',
  izquierda: 'MOVER_IZQUIERDA',
  derecha: 'MOVER_DERECHA',
});
