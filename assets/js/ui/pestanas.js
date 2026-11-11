/**
 * Pestañas del modo celular: muestran una sección a la vez (Controles, DEMO,
 * Mensajes) para que toda la interfaz quepa en una pantalla sin desplazarse.
 * En pantallas grandes las secciones se ven todas y las pestañas se ocultan.
 */
import { suscribir } from '../estado.js';

export function iniciarPestanas() {
  const columna = document.getElementById('columna');
  const botones = [...columna.querySelectorAll('.pestanas [role="tab"]')];

  const activar = (panel, enfocar = false) => {
    columna.dataset.activo = panel;
    for (const b of botones) {
      const activo = b.dataset.panel === panel;
      b.setAttribute('aria-selected', String(activo));
      b.tabIndex = activo ? 0 : -1;
      if (activo && enfocar) b.focus();
    }
  };

  botones.forEach((b, i) => {
    b.addEventListener('click', () => activar(b.dataset.panel));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const siguiente = botones[(i + (e.key === 'ArrowRight' ? 1 : botones.length - 1)) % botones.length];
      activar(siguiente.dataset.panel, true);
    });
  });

  // Indicador en la pestaña DEMO mientras hay una en curso.
  suscribir('demoEnCurso', (demo) => {
    document.getElementById('tab-demo-punto').hidden = !demo;
  });

  activar('controles');
}
