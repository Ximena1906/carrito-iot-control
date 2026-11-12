/**
 * Navegación entre CONTROL y MONITOREO dentro de la MISMA página.
 * Usa el hash (#/control, #/monitoreo), compatible con GitHub Pages, y no
 * recarga el documento: así se conserva una sola conexión WSS compartida.
 */
import { actualizar } from '../estado.js';

const VISTAS = ['control', 'monitoreo'];

function vistaDesdeHash() {
  const v = location.hash.replace(/^#\/?/, '');
  return VISTAS.includes(v) ? v : 'control';
}

function mostrar(vista) {
  document.body.dataset.vista = vista;
  for (const v of VISTAS) {
    const seccion = document.getElementById(`vista-${v}`);
    if (seccion) seccion.hidden = v !== vista;
    for (const enlace of document.querySelectorAll(`.vista-enlace[data-vista="${v}"]`)) {
      if (v === vista) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    }
  }
  document.title = `${document.title.split(' · ')[0]} · ${vista === 'control' ? 'Control' : 'Monitoreo'}`;
  actualizar('vista', vista);
}

export function iniciarNavegacion() {
  window.addEventListener('hashchange', () => mostrar(vistaDesdeHash()));
  mostrar(vistaDesdeHash());
}
