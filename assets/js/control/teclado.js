/**
 * Atajos de teclado iguales a los del firmware original (Carrito.ino):
 * W/S/A/D movimiento, Q detener, 1-8 funciones. Las teclas de movimiento se
 * mantienen presionadas; al soltarlas se envía DETENER.
 * En la vista MONITOREO solo funciona Q (DETENER); el resto se ignora para
 * no mover el carrito sin ver los controles.
 */
import { PRESENTACION } from '../config.js';
import { obtener, puedeMover } from '../estado.js';
import { detener, iniciarSostenido, pulso, terminarSostenido } from './comandos.js';

const PORTECLA = new Map(
  Object.entries(PRESENTACION).filter(([, p]) => p.tecla).map(([nombre, p]) => [p.tecla, { nombre, tipo: p.tipo }]),
);

function escribiendo(e) {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement ||
    t?.isContentEditable || t?.closest?.('dialog[open]');
}

export function activarTeclado() {
  const presionadas = new Set();

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || escribiendo(e)) return;
    const accion = PORTECLA.get(e.key.toLowerCase());
    if (!accion || e.repeat) return;
    if (accion.tipo === 'detener') { e.preventDefault(); detener(); return; }
    if (obtener('vista') !== 'control') return;
    if (!obtener('comandos').has(accion.nombre) || !puedeMover()) return;
    e.preventDefault();
    if (accion.tipo === 'pulso') pulso(accion.nombre);
    else { presionadas.add(accion.nombre); iniciarSostenido(accion.nombre); }
  });

  document.addEventListener('keyup', (e) => {
    const accion = PORTECLA.get(e.key.toLowerCase());
    if (!accion || !presionadas.has(accion.nombre)) return;
    presionadas.delete(accion.nombre);
    terminarSostenido(accion.nombre);
  });

  window.addEventListener('blur', () => {
    for (const nombre of presionadas) terminarSostenido(nombre);
    presionadas.clear();
  });
}
