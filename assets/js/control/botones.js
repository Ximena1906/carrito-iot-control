/**
 * Botones generados a partir del catálogo REAL de la API.
 * - sostenido: mantener presionado (pointer o Espacio/Enter); al soltar, DETENER.
 * - pulso: un toque.
 * Todos usan el mismo coordinador de comandos que el joystick.
 */
import { PRESENTACION } from '../config.js';
import { crear, icono, iconoSeguro } from '../utils/dom.js';
import { iniciarSostenido, pulso, terminarSostenido } from './comandos.js';

/**
 * Lugar de cada comando en el control tipo gamepad:
 * gatillos (LT/RT) = giros, bumpers (LB/RB) = garra, A B X Y = funciones.
 * Solo cambia la posición visual; el comando que se envía es el mismo.
 */
const POSICION = Object.freeze({
  GIRAR_IZQUIERDA: 'LT', SUBIR_BRAZO: 'LB', BAJAR_BRAZO: 'RB', GIRAR_DERECHA: 'RT',
  BOCINA: 'A', DEMO_CONTROL: 'B', VELOCIDAD: 'X', LUCES: 'Y',
});

function crearBoton(comando, tipo) {
  const p = PRESENTACION[comando.nombre] || {};
  const etiqueta = p.texto || comando.nombre;
  const atajo = p.tecla ? p.tecla.toUpperCase() : null;
  const posicion = POSICION[comando.nombre] || null;
  const boton = crear('button', {
    clase: `btn btn-comando ${tipo}`,
    atributos: {
      type: 'button',
      'data-comando': comando.nombre,
      'data-pos': posicion,
      title: `${comando.descripcion || etiqueta}${atajo ? ` (tecla ${atajo})` : ''}`,
      'aria-keyshortcuts': atajo,
    },
  }, [
    posicion ? crear('b', { clase: 'pos', texto: posicion, atributos: { 'aria-hidden': 'true' } }) : null,
    icono(iconoSeguro(p.icono || 'bi-circle')),
    crear('span', { clase: 'nombre', texto: etiqueta }),
  ].filter(Boolean));
  if (atajo) boton.append(crear('kbd', { texto: atajo, atributos: { 'aria-hidden': 'true' } }));
  return boton;
}

function enlazarSostenido(boton, nombre) {
  let puntero = null;
  const iniciar = () => { boton.classList.add('presionado'); iniciarSostenido(nombre); };
  const terminar = () => { boton.classList.remove('presionado'); terminarSostenido(nombre); };

  boton.addEventListener('pointerdown', (e) => {
    if (boton.disabled || puntero !== null) return;
    e.preventDefault();
    puntero = e.pointerId;
    boton.setPointerCapture(e.pointerId);
    iniciar();
  });
  for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    boton.addEventListener(tipo, (e) => {
      if (e.pointerId !== puntero) return;
      puntero = null;
      terminar();
    });
  }
  boton.addEventListener('contextmenu', (e) => e.preventDefault());
  boton.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !boton.disabled) { e.preventDefault(); iniciar(); }
  });
  boton.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); terminar(); }
  });
  boton.addEventListener('blur', () => { if (boton.classList.contains('presionado')) terminar(); });
  boton.addEventListener('click', (e) => e.preventDefault());
}

export function renderizarBotones(comandos, contSostenidos, contPulsos) {
  contSostenidos.replaceChildren();
  contPulsos.replaceChildren();
  for (const comando of comandos.values()) {
    const tipo = PRESENTACION[comando.nombre]?.tipo;
    if (tipo === 'sostenido') {
      const b = crearBoton(comando, 'sostenido');
      enlazarSostenido(b, comando.nombre);
      contSostenidos.append(b);
    } else if (tipo === 'pulso') {
      const b = crearBoton(comando, 'pulso');
      b.addEventListener('click', () => {
        b.classList.add('presionado');
        setTimeout(() => b.classList.remove('presionado'), 180);
        pulso(comando.nombre);
      });
      contPulsos.append(b);
    }
  }
  if (!contSostenidos.children.length) contSostenidos.append(crear('p', { clase: 'cargando', texto: 'Sin movimientos adicionales en el catálogo.' }));
  if (!contPulsos.children.length) contPulsos.append(crear('p', { clase: 'cargando', texto: 'Sin funciones adicionales en el catálogo.' }));
}

export function habilitarBotones(si, ...contenedores) {
  for (const c of contenedores) for (const b of c.querySelectorAll('button')) b.disabled = !si;
}
