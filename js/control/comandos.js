/**
 * Coordinador ÚNICO de comandos. Joystick, botones y teclado lo usan por igual.
 *
 * Reglas:
 *  - Solo una solicitud en vuelo. Si llegan más, se conserva solo la última
 *    (sin ráfagas ni duplicados); así el último comando pedido es el último
 *    que procesa el servidor.
 *  - DETENER tiene prioridad: cancela renovaciones, reemplaza cualquier
 *    pendiente y se acepta aunque haya una DEMO en curso.
 *  - Respuestas tardías de comandos anteriores no cambian la vista.
 *  - Etapas visibles: solicitado -> aceptado por API -> evento recibido.
 */
import { CONFIG, COMANDO_DETENER, PRESENTACION } from '../config.js';
import { api } from '../api/cliente.js';
import { actualizar, obtener, puedeMover } from '../estado.js';
import { mensajeDeError } from '../utils/errores.js';
import { avisar, registrar } from '../ui/mensajes.js';

let secuencia = 0;
let enVuelo = null;          // acción enviada y sin respuesta
let pendiente = null;        // siguiente acción a enviar
let sostenido = null;        // { nombre, temporizador }
const eventosRecibidos = new Map(); // id_evento -> instante

function texto(nombre) {
  return PRESENTACION[nombre]?.texto || nombre;
}

function pintar(accion, cambios) {
  const actual = obtener('ultimaAccion');
  if (!actual || actual.id !== accion.id) return; // respuesta tardía: se ignora en la vista
  actualizar('ultimaAccion', { ...actual, ...cambios });
}

async function enviar(accion) {
  enVuelo = accion;
  try {
    const r = await api.ejecutarMovimiento(accion.nombre, accion.duracion);
    accion.idEvento = r.id_evento;
    const yaLlego = eventosRecibidos.has(r.id_evento);
    pintar(accion, {
      etapa: yaLlego ? 'evento' : 'aceptado',
      idEvento: r.id_evento,
      detalle: `HTTP 200 · ${r.comando} (código ${r.codigo}) · ${r.duracion_ms} ms` +
        (r.demo_cancelada ? ' · DEMO cancelada' : ''),
    });
    if (!accion.renovacion) registrar(`API aceptó ${texto(r.comando)}`, 'ok');
  } catch (error) {
    pintar(accion, { etapa: 'error', detalle: mensajeDeError(error) });
    if (accion.nombre !== COMANDO_DETENER) soltarSostenido(false);
    avisar(`${texto(accion.nombre)}: ${mensajeDeError(error)}`, 'error');
    registrar(`Error en ${texto(accion.nombre)}: ${mensajeDeError(error)}`, 'error');
  } finally {
    enVuelo = null;
    if (pendiente) {
      const siguiente = pendiente;
      pendiente = null;
      enviar(siguiente);
    }
  }
}

function encolar(nombre, { renovacion = false } = {}) {
  const comando = obtener('comandos').get(nombre);
  if (!comando) {
    avisar(`El comando ${nombre} no está en el catálogo del vehículo.`, 'error');
    return false;
  }
  const esDetener = nombre === COMANDO_DETENER;
  if (!obtener('sesion')) {
    avisar('Inicia sesión como operador para controlar el carrito.', 'error');
    return false;
  }
  if (!esDetener && !puedeMover()) {
    avisar('Hay una DEMO en ejecución: usa DETENER o Cancelar.', 'error');
    return false;
  }
  const accion = {
    id: ++secuencia,
    nombre,
    duracion: esDetener ? 500 : CONFIG.DURACION_SOSTENIDO,
    renovacion,
  };
  if (!renovacion) {
    actualizar('ultimaAccion', {
      id: accion.id, comando: nombre, etapa: 'solicitado', idEvento: null,
      detalle: `Solicitud enviada a la API · ${new Date().toLocaleTimeString('es-MX')}`,
    });
  } else {
    // La renovación de un sostenido conserva la misma tarjeta de "última acción".
    const ua = obtener('ultimaAccion');
    if (ua) ua.id = accion.id;
  }
  if (enVuelo) pendiente = accion; // la más reciente reemplaza a cualquier pendiente
  else enviar(accion);
  return true;
}

function soltarSostenido(enviarDetener = true) {
  if (!sostenido) return;
  clearInterval(sostenido.temporizador);
  sostenido = null;
  if (enviarDetener) detener();
}

/** Inicia un movimiento que se mantiene mientras el control siga presionado. */
export function iniciarSostenido(nombre) {
  if (sostenido?.nombre === nombre) return;
  if (sostenido) clearInterval(sostenido.temporizador);
  sostenido = null;
  if (!encolar(nombre)) return;
  sostenido = {
    nombre,
    temporizador: setInterval(() => {
      if (!puedeMover()) return soltarSostenido(false);
      encolar(nombre, { renovacion: true });
    }, CONFIG.RENOVAR_SOSTENIDO),
  };
}

/** Termina el movimiento sostenido indicado y solicita DETENER. */
export function terminarSostenido(nombre) {
  if (sostenido && (!nombre || sostenido.nombre === nombre)) soltarSostenido(true);
}

/** Comando de un toque (luces, bocina, etc.). */
export function pulso(nombre) {
  encolar(nombre);
}

/** DETENER: prioridad máxima. */
export function detener() {
  if (sostenido) {
    clearInterval(sostenido.temporizador);
    sostenido = null;
  }
  encolar(COMANDO_DETENER);
}

/** El WebSocket informa los eventos de movimiento publicados por el backend. */
export function eventoMovimiento(evento) {
  eventosRecibidos.set(evento.id_evento, Date.now());
  if (eventosRecibidos.size > 50) eventosRecibidos.delete(eventosRecibidos.keys().next().value);
  const ua = obtener('ultimaAccion');
  if (ua && ua.idEvento && ua.idEvento === evento.id_evento) {
    actualizar('ultimaAccion', { ...ua, etapa: 'evento' });
  }
}

/** Libera el sostenido SIN enviar DETENER (p. ej. al iniciar una DEMO). */
export function liberarSostenido() {
  soltarSostenido(false);
}

export function haySostenido() {
  return Boolean(sostenido);
}
