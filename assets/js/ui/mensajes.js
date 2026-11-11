/** Avisos breves (toast accesible) y lista de mensajes recientes. */
import { crear, horaCorta, icono } from '../utils/dom.js';

const MAX_MENSAJES = 8;
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

export function registrar(texto, tipo = 'info') {
  const lista = document.getElementById('actividad');
  if (!lista) return;
  const item = crear('li', { atributos: { 'data-tipo': tipo } }, [
    icono(ICONOS[tipo] || ICONOS.info),
    crear('span', { clase: 'act-texto', texto }),
    crear('time', { clase: 'act-hora', texto: horaCorta() }),
  ]);
  lista.prepend(item);
  while (lista.children.length > MAX_MENSAJES) lista.lastElementChild.remove();
}
