/**
 * Punto de entrada: carga datos del vehículo, enlaza vistas, controles,
 * WebSocket e indicadores. No contiene reglas de negocio de comandos.
 */
import { CONFIG, PRESENTACION } from './config.js';
import { api } from './api/cliente.js';
import { ClienteWebSocket } from './api/websocket.js';
import { actualizar, obtener, puedeMover, suscribir } from './estado.js';
import { detener, eventoMovimiento, liberarSostenido } from './control/comandos.js';
import { crearJoystick } from './control/joystick.js';
import { habilitarBotones, renderizarBotones } from './control/botones.js';
import { activarTeclado } from './control/teclado.js';
import { cargarDemos, eventoDemo, iniciarDemos } from './demo/demos.js';
import { iniciarIndicadores } from './ui/indicadores.js';
import { iniciarSesionUI } from './ui/sesion.js';
import { avisar, registrar } from './ui/mensajes.js';
import { mensajeDeError } from './utils/errores.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------- créditos
$('credito-nombre').textContent = CONFIG.DESARROLLADOR;
$('credito-anio').textContent = String(new Date().getFullYear());

// ------------------------------------------------------------- controles
const joystick = crearJoystick($('joystick'), $('joystick-perilla'), $('joystick-dir'));
const contSostenidos = $('botones-sostenidos');
const contPulsos = $('botones-pulso');

$('btn-detener').addEventListener('click', () => detener());

function aplicarDisponibilidad() {
  const sesion = Boolean(obtener('sesion'));
  const mover = puedeMover();
  joystick.habilitar(mover);
  habilitarBotones(mover, contSostenidos, contPulsos);
  $('btn-detener').disabled = !sesion;
  $('aviso-sesion').hidden = sesion;
  $('control').classList.toggle('bloqueado', !mover);
}

// ------------------------------------------------------------- última acción
const ORDEN_ETAPAS = ['solicitado', 'aceptado', 'evento'];
suscribir('ultimaAccion', (ua) => {
  const cont = document.querySelector('.ultima-accion');
  cont.dataset.etapa = ua?.etapa || '';
  $('ua-comando').textContent = ua ? (PRESENTACION[ua.comando]?.texto || ua.comando) : '—';
  $('ua-detalle').textContent = ua?.detalle || 'Aún no se ha enviado ningún comando.';
  const nivel = ua ? ORDEN_ETAPAS.indexOf(ua.etapa) : -1;
  ORDEN_ETAPAS.forEach((etapa, i) => {
    const li = $(`etapa-${etapa}`);
    li.classList.toggle('hecho', nivel >= i);
    li.classList.toggle('error', ua?.etapa === 'error' && i === 1);
  });
});

// ------------------------------------------------------------- dispositivo
suscribir('dispositivo', (conectado) => {
  const chip = $('dispositivo-estado');
  chip.dataset.conectado = String(conectado);
  chip.querySelector('span').textContent = conectado ? 'ESP32: conectado' : 'ESP32: sin señal';
});

// ------------------------------------------------------------- WebSocket
function alEventoWs(ev) {
  if (Number(ev.id_vehiculo) !== CONFIG.ID_VEHICULO) return;
  switch (ev.tipo) {
    case 'estado_inicial':
      actualizar('dispositivo', Boolean(ev.dispositivo_conectado));
      registrar(`WS: estado inicial · último comando ${ev.comando || 'ninguno'}`, 'ws');
      if (!ev.demo_en_curso && obtener('demoEnCurso')) actualizar('demoEnCurso', null);
      break;
    case 'movimiento':
      eventoMovimiento(ev);
      registrar(`WS: ${PRESENTACION[ev.comando]?.texto || ev.comando} (código ${ev.codigo}) · origen ${ev.origen}`, 'ws');
      break;
    case 'dispositivo':
      actualizar('dispositivo', Boolean(ev.conectado));
      registrar(`WS: ESP32 ${ev.conectado ? 'conectado' : 'desconectado'}`, 'ws');
      break;
    case 'ack_dispositivo':
      registrar(`WS: ESP32 confirmó recepción (${ev.resultado || 'sin detalle'})`, 'ws');
      break;
    case 'error':
      registrar(`WS: ${ev.mensaje || 'error del servidor'}`, 'error');
      break;
    default:
      if (ev.tipo.startsWith('demo_')) eventoDemo(ev);
  }
}

// ------------------------------------------------------------- carga inicial
async function cargarVehiculo() {
  try {
    const [vehiculo, comandos] = await Promise.all([api.vehiculo(), api.comandos()]);
    actualizar('vehiculo', vehiculo);
    $('vehiculo-nombre').textContent = vehiculo.nombre || 'Vehículo';
    $('vehiculo-detalle').textContent =
      [vehiculo.modelo, vehiculo.microcontrolador, `ID ${vehiculo.id_vehiculo}`].filter(Boolean).join(' · ');
    document.title = `${vehiculo.nombre} · Control`;

    const activos = new Map(
      (Array.isArray(comandos) ? comandos : [])
        .filter((c) => c && c.activo && typeof c.nombre === 'string')
        .map((c) => [c.nombre, c]),
    );
    actualizar('comandos', activos);
    renderizarBotones(activos, contSostenidos, contPulsos);
    aplicarDisponibilidad();
    return true;
  } catch (e) {
    $('vehiculo-detalle').textContent = 'No se pudo cargar el vehículo';
    registrar(`Vehículo: ${mensajeDeError(e)}`, 'error');
    return false;
  }
}

async function cargarTodo() {
  const ok = await cargarVehiculo();
  if (ok) await cargarDemos();
  return ok;
}

// ------------------------------------------------------------- arranque
iniciarIndicadores();
const pintarSesion = iniciarSesionUI({ alCambiar: aplicarDisponibilidad });
suscribir('sesion', pintarSesion);
iniciarDemos();
activarTeclado();

suscribir('demoEnCurso', (demo) => {
  if (demo) liberarSostenido();
  aplicarDisponibilidad();
});

new ClienteWebSocket(alEventoWs).iniciar();

cargarTodo().then((ok) => {
  if (!ok) {
    // Reintento controlado si la API no estaba disponible al abrir la página.
    const reintentar = suscribir('api', async (v) => {
      if (v === 'disponible' && !obtener('vehiculo')) {
        if (await cargarTodo()) { reintentar(); avisar('Datos del vehículo cargados', 'ok'); }
      }
    });
  }
});
