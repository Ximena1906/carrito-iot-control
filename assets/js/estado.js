/**
 * Estado operacional de la interfaz con suscripción por clave.
 * Las vistas se suscriben; los servicios solo llaman a actualizar().
 */
const estado = {
  sesion: null,              // { usuario, rol, token, expira }
  vehiculo: null,            // datos de GET /vehiculos/{id}
  comandos: new Map(),       // nombre -> comando activo del catálogo
  demos: [],
  demoEnCurso: null,         // { id_demo, nombre, total_pasos, paso, comando }
  ws: 'conectando',          // conectando | en_linea | reconectando | desconectado
  api: 'comprobando',        // comprobando | disponible | no_disponible
  rds: { estado: 'sin_verificar', latencia: null }, // disponible | no_disponible | sin_verificar
  dispositivo: false,        // señal real del ESP32 (evento "dispositivo")
  ultimaAccion: null,        // { id, comando, etapa, idEvento, detalle }
};

const suscriptores = new Map();

export function obtener(clave) {
  return estado[clave];
}

export function actualizar(clave, valor) {
  estado[clave] = valor;
  for (const fn of suscriptores.get(clave) || []) {
    try { fn(valor); } catch (e) { console.error(e); }
  }
}

export function suscribir(clave, fn) {
  if (!suscriptores.has(clave)) suscriptores.set(clave, new Set());
  suscriptores.get(clave).add(fn);
  fn(estado[clave]);
  return () => suscriptores.get(clave).delete(fn);
}

/** ¿Se pueden enviar movimientos? (sesión iniciada y sin DEMO en curso) */
export function puedeMover() {
  return Boolean(estado.sesion) && !estado.demoEnCurso;
}
