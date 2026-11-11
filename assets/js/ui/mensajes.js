/** Avisos breves (toast accesible). */
import { crear, icono } from '../utils/dom.js';

const ICONOS = { ok: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill', ws: 'bi-broadcast' };
let temporizador = null;

export function avisar(texto, tipo = 'info') {
  const el = document.getElementById('aviso');
  if (!el) return;
  el.dataset.tipo = tipo;
  el.replaceChildren(icono(ICONOS[tipo] || ICONOS.info), crear('span', { texto }));
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.hidden = true; }, tipo === 'error' ? 4500 : 2500);
}
