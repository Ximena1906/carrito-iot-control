/**
 * MONITOREO · sincronización de datos (sin DOM).
 *
 * Fuentes de verdad:
 *  - REST  GET /vehiculos/{id}/estado     → último estado PERSISTIDO en RDS.
 *  - REST  GET /vehiculos/{id}/historial  → máx. 10 movimientos INDIVIDUALES persistidos
 *                                           (la API ya ordena del más reciente al más antiguo
 *                                           y nunca incluye pasos de DEMO).
 *  - WSS   eventos del vehículo           → disparan la actualización en tiempo real.
 *
 * Reglas que se cumplen aquí:
 *  - Un evento `movimiento` actualiza el panel al instante y DISPARA la
 *    resincronización del historial por REST (no se agrega la fila a mano: la
 *    tabla solo muestra lo que RDS confirma).
 *  - `demo_paso` actualiza el panel, pero NO toca el historial.
 *  - Duplicados: se descartan eventos con un `id_evento` ya visto y filas con
 *    `id_historial` repetido.
 *  - Otro vehículo: se ignora cualquier evento o fila con otro `id_vehiculo`.
 *  - Fuera de orden / respuestas tardías: el panel solo acepta un dato si su marca
 *    temporal no es anterior a la que ya muestra; el historial se consulta de uno en
 *    uno y una respuesta vieja (de una solicitud superada) se descarta.
 *  - Sin polling: se consulta al entrar a MONITOREO, al recibir eventos, al
 *    reconectar el WSS y con el botón «Actualizar».
 */
import { CONFIG } from '../config.js';
import { api } from '../api/cliente.js';
import { actualizar, obtener, suscribir } from '../estado.js';
import { mensajeDeError } from '../utils/errores.js';
import { parsearFechaApi } from '../utils/fechas.js';

const LIMITE = 10;
const ESPERA_RAFAGA_MS = 300;        // agrupa varios eventos seguidos en una sola consulta
const REINTENTO_PERSISTENCIA_MS = 1200;

const vistos = new Set();            // id_evento procesados
let marcaPanel = -Infinity;          // ms del dato que muestra el panel
let secEstado = 0;
let secHistorial = 0;
let historialEnCurso = false;
let historialPendiente = null;       // motivo de una consulta pedida mientras otra estaba en curso
let temporizadorHistorial = null;
let reintentos = 0;
let esperaPersistencia = null;       // Date del último movimiento que aún no aparece en la tabla
let pendienteAlVolver = false;       // hubo eventos mientras la vista no estaba abierta

const esVehiculo = (id) => Number(id) === CONFIG.ID_VEHICULO;
const enMonitoreo = () => obtener('vista') === 'monitoreo';
const texto = (v, max = 60) => (typeof v === 'string' ? v.slice(0, max) : null);
const entero = (v) => (Number.isInteger(v) ? v : null);

/** Aplica un dato al panel solo si no es más antiguo que el que ya se muestra. */
function aplicarPanel(dato) {
  const marca = dato.fecha ? dato.fecha.getTime() : -Infinity;
  if (marca < marcaPanel) return false;
  marcaPanel = marca;
  actualizar('monUltimo', dato);
  return true;
}

function desdeEstado(e, fuente) {
  return {
    fuente,                                    // rest | wss-inicial
    tipo: 'estado',
    comando: texto(e.comando),
    codigo: entero(e.codigo),
    vehiculo: texto(e.vehiculo, 80) || obtener('vehiculo')?.nombre || null,
    fecha: parsearFechaApi(e.fecha_actualizacion),
    origen: null,
    id_evento: null,
  };
}

// ------------------------------------------------------------- estado (REST)
export async function cargarEstado(motivo = 'consulta') {
  const mia = ++secEstado;
  if (!obtener('monUltimo')) actualizar('monCargaEstado', { estado: 'cargando', mensaje: '' });
  try {
    const e = await api.estado();
    if (mia !== secEstado) return;                         // llegó una solicitud más nueva
    if (!e || typeof e !== 'object' || !esVehiculo(e.id_vehiculo)) throw new Error('formato');
    const dato = desdeEstado(e, 'rest');
    if (dato.comando) aplicarPanel(dato);
    else if (!obtener('monUltimo')) actualizar('monUltimo', { ...dato, vacio: true });
    actualizar('monCargaEstado', { estado: 'listo', mensaje: '', actualizado: new Date(), motivo });
  } catch (error) {
    if (mia !== secEstado) return;
    actualizar('monCargaEstado', {
      estado: 'error',
      mensaje: error?.message === 'formato' ? 'La respuesta del estado no es válida.' : mensajeDeError(error),
    });
  }
}

// ---------------------------------------------------------- historial (REST)
function normalizarHistorial(filas) {
  if (!Array.isArray(filas)) throw new Error('formato');
  const ids = new Set();
  const limpias = [];
  for (const f of filas) {
    if (!f || !esVehiculo(f.id_vehiculo) || !Number.isInteger(f.id_historial) || ids.has(f.id_historial)) continue;
    const fecha = parsearFechaApi(f.fecha_hora);
    if (!fecha) continue;                                   // sin fecha confiable no se muestra
    ids.add(f.id_historial);
    limpias.push({
      id: f.id_historial,
      comando: texto(f.comando) || 'Comando eliminado',
      codigo: entero(f.codigo),
      origen: texto(f.origen, 30),
      fecha,
    });
  }
  // Orden confiable del backend: fecha_hora DESC y, en empate, id_historial DESC.
  limpias.sort((a, b) => b.fecha - a.fecha || b.id - a.id);
  return limpias.slice(0, LIMITE);
}

export async function sincronizarHistorial(motivo = 'consulta') {
  if (historialEnCurso) { historialPendiente = motivo; return; }
  historialEnCurso = true;
  const mia = ++secHistorial;
  actualizar('monCargaHistorial', {
    ...obtener('monCargaHistorial'),
    estado: obtener('monHistorial') ? 'sincronizando' : 'cargando',
    mensaje: '',
  });
  try {
    const filas = normalizarHistorial(await api.historial(LIMITE));
    if (mia !== secHistorial) return;
    actualizar('monHistorial', filas);
    actualizar('monCargaHistorial', { estado: 'listo', mensaje: '', actualizado: new Date(), motivo });

    // ¿Ya aparece en RDS el movimiento anunciado por WSS? Si no, se vuelve a consultar
    // una sola vez más tarde (no se agrega la fila por cuenta propia).
    if (esperaPersistencia) {
      const masNueva = filas[0]?.fecha?.getTime() ?? -Infinity;
      if (masNueva >= esperaPersistencia.getTime() - 2000) { esperaPersistencia = null; reintentos = 0; }
      else if (reintentos < 2) { reintentos += 1; programarHistorial('confirmar persistencia', REINTENTO_PERSISTENCIA_MS); }
      else { esperaPersistencia = null; reintentos = 0; }
    }
  } catch (error) {
    actualizar('monCargaHistorial', {
      ...obtener('monCargaHistorial'),
      estado: 'error',
      mensaje: error?.message === 'formato' ? 'La respuesta del historial no es válida.' : mensajeDeError(error),
    });
  } finally {
    historialEnCurso = false;
    if (historialPendiente) {
      const siguiente = historialPendiente;
      historialPendiente = null;
      sincronizarHistorial(siguiente);
    }
  }
}

function programarHistorial(motivo, espera = ESPERA_RAFAGA_MS) {
  if (!enMonitoreo()) { pendienteAlVolver = true; return; }  // se sincroniza al abrir la vista
  clearTimeout(temporizadorHistorial);
  temporizadorHistorial = setTimeout(() => sincronizarHistorial(motivo), espera);
}

/** Carga completa por REST: estado + historial. */
export function resincronizar(motivo) {
  pendienteAlVolver = false;
  clearTimeout(temporizadorHistorial);
  cargarEstado(motivo);
  sincronizarHistorial(motivo);
}

// ------------------------------------------------------------- eventos WSS
export function eventoMonitoreo(ev) {
  if (!ev || !esVehiculo(ev.id_vehiculo) || typeof ev.id_evento !== 'string') return;
  if (vistos.has(ev.id_evento)) return;                    // duplicado
  vistos.add(ev.id_evento);
  if (vistos.size > 200) vistos.delete(vistos.values().next().value);

  const fecha = parsearFechaApi(ev.timestamp);
  switch (ev.tipo) {
    case 'movimiento': {
      if (!texto(ev.comando) || !fecha) return;
      aplicarPanel({
        fuente: 'wss', tipo: 'movimiento', comando: texto(ev.comando), codigo: entero(ev.codigo),
        vehiculo: obtener('vehiculo')?.nombre || null, fecha, origen: texto(ev.origen, 30), id_evento: ev.id_evento,
      });
      esperaPersistencia = fecha;
      reintentos = 0;
      programarHistorial('evento WSS');
      break;
    }
    case 'demo_inicio':
      actualizar('monDemo', { nombre: texto(ev.nombre, 80), paso: 0, total_pasos: entero(ev.total_pasos) });
      break;
    case 'demo_paso': {
      if (!texto(ev.comando) || !fecha) return;
      actualizar('monDemo', { ...(obtener('monDemo') || {}), paso: entero(ev.paso), total_pasos: entero(ev.total_pasos) });
      // Solo el panel: los pasos de DEMO no se guardan en el historial individual.
      aplicarPanel({
        fuente: 'wss', tipo: 'demo_paso', comando: texto(ev.comando), codigo: entero(ev.codigo),
        vehiculo: obtener('vehiculo')?.nombre || null, fecha, origen: 'DEMO', id_evento: ev.id_evento,
        paso: entero(ev.paso), total_pasos: entero(ev.total_pasos),
      });
      break;
    }
    case 'demo_fin':
    case 'demo_cancelada':
      actualizar('monDemo', null);
      cargarEstado('fin de DEMO');                       // el servidor deja el estado en DETENER
      break;
    case 'estado_inicial': {
      // Llega al (re)conectar el WSS: es el estado persistido en RDS.
      const dato = desdeEstado(ev, 'wss-inicial');
      if (dato.comando) aplicarPanel(dato);
      break;
    }
    default:
  }
}

// ------------------------------------------------------------- arranque
export function iniciarSincronizador() {
  let wsAnterior = obtener('ws');
  let conectadoAntes = false;
  suscribir('ws', (v) => {
    // Tras una reconexión WSS se vuelve a consultar todo por REST para recuperar
    // lo que se haya perdido mientras no había conexión.
    if (v === 'en_linea' && wsAnterior !== 'en_linea') {
      if (conectadoAntes) {
        if (enMonitoreo()) resincronizar('reconexión WSS');
        else pendienteAlVolver = true;
      }
      conectadoAntes = true;
    }
    wsAnterior = v;
  });

  suscribir('vista', (v) => {
    if (v === 'monitoreo') resincronizar('abrir MONITOREO');
  });

  // Carga inicial del panel aunque se abra primero CONTROL (no genera tráfico continuo).
  if (!enMonitoreo()) cargarEstado('carga inicial');
  return { pendiente: () => pendienteAlVolver };
}
