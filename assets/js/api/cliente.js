/**
 * Cliente REST: centraliza URL base, encabezados, tiempo de espera,
 * validación de respuestas JSON y traducción de errores.
 */
import { CONFIG, RUTAS } from '../config.js';
import { ErrorApi, mensajeHttp } from '../utils/errores.js';

let obtenerToken = () => null;
let alNoAutorizado = () => {};

/** La capa de sesión registra cómo obtener el token y qué hacer ante 401. */
export function configurarAutenticacion({ token, noAutorizado }) {
  obtenerToken = token;
  alNoAutorizado = noAutorizado;
}

async function solicitar(ruta, { metodo = 'GET', json, formulario, autenticado = false, timeout = CONFIG.TIMEOUT_HTTP, senal } = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort('timeout'), timeout);
  if (senal) senal.addEventListener('abort', () => controlador.abort('cancelado'), { once: true });

  const encabezados = { Accept: 'application/json' };
  let cuerpo;
  if (json !== undefined) {
    encabezados['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(json);
  } else if (formulario) {
    cuerpo = new URLSearchParams(formulario);
  }
  if (autenticado) {
    const token = obtenerToken();
    if (!token) throw new ErrorApi('Inicia sesión para realizar esta acción.', { status: 401 });
    encabezados.Authorization = `Bearer ${token}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(CONFIG.API_BASE_URL + ruta, {
      method: metodo, headers: encabezados, body: cuerpo, signal: controlador.signal, cache: 'no-store',
    });
  } catch (error) {
    if (controlador.signal.aborted) {
      const motivo = controlador.signal.reason;
      if (motivo === 'cancelado') throw new ErrorApi('Solicitud cancelada.', { tipo: 'cancelado' });
      throw new ErrorApi('El servidor tardó demasiado en responder.', { tipo: 'timeout' });
    }
    throw new ErrorApi('No hay conexión con el servidor de AWS.', { tipo: 'red' });
  } finally {
    clearTimeout(temporizador);
  }

  let datos = null;
  const texto = await respuesta.text();
  if (texto) {
    try { datos = JSON.parse(texto); } catch {
      throw new ErrorApi('La respuesta del servidor no es válida.', { status: respuesta.status, tipo: 'formato' });
    }
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && autenticado) alNoAutorizado();
    throw new ErrorApi(mensajeHttp(respuesta.status, datos), { status: respuesta.status });
  }
  return datos;
}

const V = () => CONFIG.ID_VEHICULO;

export const api = {
  salud: (opts) => solicitar(RUTAS.salud(), { timeout: 6000, ...opts }),

  /** Devuelve { status, datos } sin lanzar error en 503 (RDS no disponible). */
  async saludBD() {
    try {
      return { status: 200, datos: await solicitar(RUTAS.saludBD(), { timeout: 8000 }) };
    } catch (e) {
      if (e instanceof ErrorApi && e.status) return { status: e.status, datos: null };
      throw e;
    }
  },

  login: (usuario, password) =>
    solicitar(RUTAS.login(), { metodo: 'POST', formulario: { username: usuario, password } }),

  vehiculo: () => solicitar(RUTAS.vehiculo(V())),
  comandos: () => solicitar(RUTAS.comandos(V())),
  estado: (opts) => solicitar(RUTAS.estado(V()), opts),
  /** Últimos movimientos INDIVIDUALES guardados en RDS (la API devuelve máximo 10, del más reciente al más antiguo). */
  historial: (limite = 10, opts) => solicitar(RUTAS.historial(V(), limite), opts),
  demos: () => solicitar(RUTAS.demos(V())),
  demoEnCurso: () => solicitar(RUTAS.demoEnCurso(V())),

  ejecutarMovimiento: (comando, duracionMs, senal) =>
    solicitar(RUTAS.movimiento(V()), {
      metodo: 'POST', autenticado: true, senal,
      json: { comando, duracion_ms: duracionMs, origen: 'WEB' },
    }),

  iniciarDemo: (idDemo) =>
    solicitar(RUTAS.iniciarDemo(V(), idDemo), { metodo: 'POST', autenticado: true, json: { origen: 'WEB' } }),

  cancelarDemo: () => solicitar(RUTAS.cancelarDemo(V()), { metodo: 'POST', autenticado: true }),
};
