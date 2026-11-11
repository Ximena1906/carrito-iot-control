/**
 * Joystick circular con Pointer Events (mouse, táctil y lápiz) y teclado.
 * Solo emite un comando cuando cambia la dirección efectiva; nunca por píxel.
 */
import { JOYSTICK } from '../config.js';
import { obtener } from '../estado.js';
import { iniciarSostenido, terminarSostenido } from './comandos.js';

const ZONA_NEUTRAL = 0.32;     // fracción del radio
const HISTERESIS = 12;         // grados extra para conservar la dirección actual
const CENTROS = { derecha: 0, abajo: 90, izquierda: 180, arriba: 270 };
const TEXTO = { arriba: 'Avanzar', abajo: 'Retroceder', izquierda: 'Izquierda', derecha: 'Derecha' };
const TECLAS = { ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha' };

function diferenciaAngular(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function crearJoystick(base, perilla, etiqueta) {
  let puntero = null;
  let direccion = null;
  let cuadro = null;
  let pendienteDibujo = null;

  const disponible = (dir) => {
    const nombre = JOYSTICK[dir];
    return obtener('comandos').has(nombre);
  };

  function dibujar(x, y) {
    pendienteDibujo = { x, y };
    requestAnimationFrame(() => {
      if (!pendienteDibujo) return;
      perilla.style.transform = `translate(calc(-50% + ${pendienteDibujo.x}px), calc(-50% + ${pendienteDibujo.y}px))`;
      pendienteDibujo = null;
    });
  }

  function fijarDireccion(nueva) {
    if (nueva === direccion) return;
    const anterior = direccion;
    direccion = nueva;
    base.dataset.direccion = nueva || '';
    etiqueta.textContent = nueva ? TEXTO[nueva] : 'Neutral';
    if (nueva) iniciarSostenido(JOYSTICK[nueva]);
    else if (anterior) terminarSostenido(JOYSTICK[anterior]);
  }

  function calcular(evento) {
    const radio = cuadro.width / 2;
    let dx = evento.clientX - (cuadro.left + radio);
    let dy = evento.clientY - (cuadro.top + radio);
    const distancia = Math.hypot(dx, dy);
    const maximo = radio * 0.62;
    if (distancia > maximo) { dx = (dx / distancia) * maximo; dy = (dy / distancia) * maximo; }
    dibujar(dx, dy);

    if (distancia < radio * ZONA_NEUTRAL) return fijarDireccion(null);
    const angulo = (Math.atan2(dy, dx) * 180) / Math.PI + 360;
    if (direccion && diferenciaAngular(angulo, CENTROS[direccion]) <= 45 + HISTERESIS) return; // estable
    let mejor = null;
    for (const [dir, centro] of Object.entries(CENTROS)) {
      if (diferenciaAngular(angulo, centro) <= 45 && disponible(dir)) mejor = dir;
    }
    fijarDireccion(mejor);
  }

  function soltar() {
    puntero = null;
    base.classList.remove('activo');
    dibujar(0, 0);
    fijarDireccion(null);
  }

  base.addEventListener('pointerdown', (e) => {
    if (base.getAttribute('aria-disabled') === 'true' || puntero !== null) return;
    e.preventDefault();
    puntero = e.pointerId;
    cuadro = base.getBoundingClientRect();
    base.setPointerCapture(e.pointerId);
    base.classList.add('activo');
    calcular(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === puntero) calcular(e); });
  for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    base.addEventListener(tipo, (e) => { if (e.pointerId === puntero) soltar(); });
  }
  base.addEventListener('contextmenu', (e) => e.preventDefault());

  // Teclado: flechas mientras el joystick tiene el foco.
  base.addEventListener('keydown', (e) => {
    const dir = TECLAS[e.key];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat || base.getAttribute('aria-disabled') === 'true' || !disponible(dir)) return;
    const paso = 0.5 * base.getBoundingClientRect().width * 0.62;
    dibujar(dir === 'izquierda' ? -paso : dir === 'derecha' ? paso : 0, dir === 'arriba' ? -paso : dir === 'abajo' ? paso : 0);
    fijarDireccion(dir);
  });
  base.addEventListener('keyup', (e) => {
    if (TECLAS[e.key] && TECLAS[e.key] === direccion) { dibujar(0, 0); fijarDireccion(null); }
  });
  base.addEventListener('blur', () => { if (direccion && puntero === null) { dibujar(0, 0); fijarDireccion(null); } });

  return {
    habilitar(si) {
      base.setAttribute('aria-disabled', String(!si));
      if (!si && (puntero !== null || direccion)) {
        // Se deshabilita sin enviar DETENER (lo gestiona quien deshabilita).
        puntero = null;
        direccion = null;
        base.dataset.direccion = '';
        base.classList.remove('activo');
        etiqueta.textContent = 'Neutral';
        dibujar(0, 0);
      }
    },
    neutral() { soltar(); },
  };
}
