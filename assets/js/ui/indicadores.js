/**
 * Tres indicadores independientes:
 *  1. WebSocket WSS: estado real de la sesión del navegador.
 *  2. Servidor AWS: GET /health periódico (solo prueba que el servicio responde).
 *  3. Amazon RDS: GET /health/db (diagnóstico seguro del backend). Si no se
 *     puede consultar, se muestra «Sin verificar»; nunca se supone disponible.
 */
import { CONFIG } from '../config.js';
import { api } from '../api/cliente.js';
import { actualizar, obtener, suscribir } from '../estado.js';
import { crear, icono } from '../utils/dom.js';
import { registrar } from './mensajes.js';

const VISTA = {
  ws: {
    conectando: ['bi-hourglass-split', 'Conectando…'],
    reconectando: ['bi-arrow-repeat', 'Reconectando…'],
    en_linea: ['bi-check-circle-fill', 'En línea'],
    desconectado: ['bi-x-circle-fill', 'Desconectado'],
  },
  api: {
    comprobando: ['bi-hourglass-split', 'Comprobando…'],
    disponible: ['bi-check-circle-fill', 'Disponible'],
    no_disponible: ['bi-x-circle-fill', 'No disponible'],
  },
  rds: {
    disponible: ['bi-check-circle-fill', 'Disponible'],
    no_disponible: ['bi-x-circle-fill', 'No disponible'],
    sin_verificar: ['bi-question-circle-fill', 'Sin verificar'],
  },
};

function pintar(id, estado, textoExtra = '') {
  const el = document.getElementById(id);
  const [ico, texto] = VISTA[id.replace('ind-', '')][estado];
  el.dataset.estado = estado;
  el.querySelector('.ind-valor').replaceChildren(icono(ico), crear('span', { texto: texto + textoExtra }));
}

async function comprobarApi() {
  if (document.hidden) return;
  if (obtener('api') !== 'disponible') actualizar('api', 'comprobando');
  try {
    const r = await api.salud();
    actualizar('api', r?.estado === 'disponible' ? 'disponible' : 'no_disponible');
  } catch {
    actualizar('api', 'no_disponible');
  }
}

async function comprobarRds() {
  if (document.hidden) return;
  if (obtener('api') === 'no_disponible') {
    actualizar('rds', { estado: 'sin_verificar', latencia: null });
    return;
  }
  try {
    const { status, datos } = await api.saludBD();
    if (status === 200 && datos?.estado === 'disponible') {
      actualizar('rds', { estado: 'disponible', latencia: Number(datos.latencia_ms) || null });
    } else if (status === 503) {
      actualizar('rds', { estado: 'no_disponible', latencia: null });
    } else {
      actualizar('rds', { estado: 'sin_verificar', latencia: null });
    }
  } catch {
    actualizar('rds', { estado: 'sin_verificar', latencia: null });
  }
}

export function iniciarIndicadores() {
  let anterior = {};
  const anunciar = (clave, valor, texto) => {
    if (anterior[clave] && anterior[clave] !== valor) registrar(texto, valor === 'disponible' || valor === 'en_linea' ? 'ok' : 'error');
    anterior[clave] = valor;
  };

  suscribir('ws', (v) => { pintar('ind-ws', v); anunciar('ws', v, `WebSocket: ${VISTA.ws[v][1]}`); });
  suscribir('api', (v) => { pintar('ind-api', v); anunciar('api', v, `Servidor AWS: ${VISTA.api[v][1]}`); });
  suscribir('rds', (v) => {
    pintar('ind-rds', v.estado, v.estado === 'disponible' && v.latencia ? ` · ${Math.round(v.latencia)} ms` : '');
    anunciar('rds', v.estado, `Amazon RDS: ${VISTA.rds[v.estado][1]}`);
  });

  const ciclo = async () => { await comprobarApi(); await comprobarRds(); };
  ciclo();
  setInterval(comprobarApi, CONFIG.INTERVALO_SALUD_API);
  setInterval(comprobarRds, CONFIG.INTERVALO_SALUD_RDS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  window.addEventListener('online', ciclo);
  window.addEventListener('offline', () => {
    actualizar('api', 'no_disponible');
    actualizar('rds', { estado: 'sin_verificar', latencia: null });
  });
}
