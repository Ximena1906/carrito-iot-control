/**
 * DEMO: listar las existentes, iniciar y cancelar. La secuencia, el orden
 * y los tiempos los ejecuta el BACKEND; aquí solo se muestran los eventos.
 */
import { api } from '../api/cliente.js';
import { actualizar, obtener, suscribir } from '../estado.js';
import { crear } from '../utils/dom.js';
import { mensajeDeError } from '../utils/errores.js';
import { PRESENTACION } from '../config.js';
import { avisar, registrar } from '../ui/mensajes.js';

const $ = (id) => document.getElementById(id);
let ocupado = false;

function textoComando(nombre) {
  return PRESENTACION[nombre]?.texto || nombre;
}

function pintar() {
  const demo = obtener('demoEnCurso');
  const sesion = obtener('sesion');
  const lista = obtener('demos');
  const select = $('demo-select');
  const insignia = $('demo-insignia');
  const barra = $('demo-barra');
  const detalle = $('demo-detalle');

  select.disabled = Boolean(demo) || !lista.length || ocupado;
  $('btn-demo-iniciar').disabled = !sesion || Boolean(demo) || !lista.length || ocupado;
  $('btn-demo-cancelar').disabled = !sesion || !demo || ocupado;

  if (demo) {
    const avance = demo.total_pasos ? Math.round(((demo.paso || 0) / demo.total_pasos) * 100) : 0;
    insignia.dataset.estado = 'activa';
    insignia.textContent = 'En curso';
    barra.style.width = `${avance}%`;
    barra.parentElement.setAttribute('aria-valuenow', String(avance));
    detalle.textContent = demo.paso
      ? `Paso ${demo.paso} de ${demo.total_pasos}: ${textoComando(demo.comando)} · ${demo.duracion_ms} ms + pausa ${demo.pausa_ms} ms`
      : `Iniciando «${demo.nombre}» (${demo.total_pasos} pasos)…`;
  } else {
    insignia.dataset.estado = 'inactiva';
    insignia.textContent = 'Inactiva';
  }
}

export async function cargarDemos() {
  const select = $('demo-select');
  try {
    const demos = (await api.demos()).filter((d) => d && d.activo && Number.isInteger(d.id_demo));
    actualizar('demos', demos);
    select.replaceChildren(...(demos.length
      ? demos.map((d) => crear('option', { texto: d.nombre, atributos: { value: d.id_demo, title: d.descripcion || '' } }))
      : [crear('option', { texto: 'No hay DEMO registradas' })]));
  } catch (e) {
    actualizar('demos', []);
    select.replaceChildren(crear('option', { texto: 'No se pudieron cargar las DEMO' }));
    registrar(`DEMO: ${mensajeDeError(e)}`, 'error');
  }
  try {
    const r = await api.demoEnCurso();
    if (r?.estado === 'en_curso') actualizar('demoEnCurso', { ...r, paso: 0 });
  } catch { /* sin información: se actualizará por WebSocket */ }
  pintar();
}

async function iniciar() {
  const id = Number($('demo-select').value);
  if (!Number.isInteger(id) || obtener('demoEnCurso')) return;
  ocupado = true; pintar();
  try {
    const r = await api.iniciarDemo(id);
    if (!obtener('demoEnCurso')) actualizar('demoEnCurso', { ...r, paso: 0 });
    registrar(`API aceptó DEMO «${r.nombre}» (${r.total_pasos} pasos) · HTTP 202`, 'ok');
  } catch (e) {
    avisar(`DEMO: ${mensajeDeError(e)}`, 'error');
    registrar(`DEMO: ${mensajeDeError(e)}`, 'error');
  } finally { ocupado = false; pintar(); }
}

async function cancelar() {
  ocupado = true; pintar();
  try {
    const r = await api.cancelarDemo();
    registrar(r.estado === 'cancelada' ? 'Cancelación de DEMO aceptada por la API' : 'No había DEMO en curso', 'info');
    if (r.estado === 'sin_demo') actualizar('demoEnCurso', null);
  } catch (e) {
    avisar(`Cancelar: ${mensajeDeError(e)}`, 'error');
  } finally { ocupado = false; pintar(); }
}

/** Eventos WebSocket de DEMO publicados por el backend. */
export function eventoDemo(ev) {
  const actual = obtener('demoEnCurso');
  switch (ev.tipo) {
    case 'demo_inicio':
      actualizar('demoEnCurso', { id_demo: ev.id_demo, nombre: ev.nombre, total_pasos: ev.total_pasos, paso: 0 });
      registrar(`WS: inicio de DEMO «${ev.nombre}» (${ev.total_pasos} pasos)`, 'ws');
      break;
    case 'demo_paso':
      actualizar('demoEnCurso', { ...(actual || { id_demo: ev.id_demo, nombre: '' }), ...ev });
      registrar(`WS: paso ${ev.paso}/${ev.total_pasos} ${textoComando(ev.comando)} (código ${ev.codigo})`, 'ws');
      break;
    case 'demo_fin':
    case 'demo_cancelada': {
      const fin = ev.tipo === 'demo_fin';
      actualizar('demoEnCurso', null);
      $('demo-barra').style.width = fin ? '100%' : '0%';
      $('demo-detalle').textContent = fin
        ? `«${ev.nombre}» terminó: ${ev.total_pasos} pasos ejecutados por el servidor.`
        : `«${ev.nombre}» cancelada (${String(ev.motivo || '').replaceAll('_', ' ').toLowerCase()}).`;
      registrar(`WS: DEMO ${fin ? 'finalizada' : 'cancelada'}`, 'ws');
      break;
    }
    default:
  }
  pintar();
}

export function iniciarDemos() {
  $('btn-demo-iniciar').addEventListener('click', iniciar);
  $('btn-demo-cancelar').addEventListener('click', cancelar);
  suscribir('sesion', pintar);
  suscribir('demoEnCurso', pintar);
}
