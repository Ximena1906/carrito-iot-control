/**
 * Luces (botón Y) y bocina (botón A) se ven ENCENDIDOS u APAGADOS.
 *
 * El control remoto del carrito no informa si están prendidas: cada comando
 * solo "presiona" su botón y el carrito cambia al estado contrario. Por eso la
 * página lleva la cuenta:
 *  - Empiezan encendidos, porque así arranca el carrito al prenderlo.
 *  - Cada vez que la API acepta LUCES o BOCINA (evento «movimiento» por
 *    WebSocket), el botón cambia: si estaba encendido se apaga y al revés.
 *    Así cambian igual todas las pestañas abiertas (compu y celular).
 *  - Al recargar la página vuelven a encendidos.
 */
import { crear } from '../utils/dom.js';

const ACCESORIOS = ['LUCES', 'BOCINA'];
const encendido = { LUCES: true, BOCINA: true };
const vistos = new Set();   // id_evento ya contados (evita cambiar dos veces por el mismo evento)

function pintar() {
  for (const nombre of ACCESORIOS) {
    const on = encendido[nombre];
    for (const boton of document.querySelectorAll(`.btn-comando[data-comando="${nombre}"]`)) {
      boton.dataset.encendido = String(on);
      boton.setAttribute('aria-pressed', String(on));
      let marca = boton.querySelector('.estado');
      if (!marca) {
        marca = crear('small', { clase: 'estado', atributos: { 'aria-hidden': 'true' } });
        boton.append(marca);
      }
      marca.textContent = on ? 'ON' : 'OFF';
    }
  }
}

/** Se llama después de dibujar los botones del catálogo. */
export function pintarAccesorios() {
  pintar();
}

/** Evento «movimiento»: si fue LUCES o BOCINA, el botón cambia de estado. */
export function registrarMovimiento(evento) {
  if (!ACCESORIOS.includes(evento.comando) || !evento.id_evento || vistos.has(evento.id_evento)) return;
  vistos.add(evento.id_evento);
  if (vistos.size > 50) vistos.delete(vistos.values().next().value);
  encendido[evento.comando] = !encendido[evento.comando];
  pintar();
}
