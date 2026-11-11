/**
 * Estado de luces y bocina mostrado en la página.
 *
 * El control remoto del carrito no informa si las luces o la bocina están
 * prendidas: cada comando solo "presiona" su botón y el carrito cambia al
 * estado contrario. Por eso este estado es SUPUESTO y vive solo en esta página:
 *  - Empieza en ON, porque así arranca el carrito al encenderlo.
 *  - Cambia únicamente cuando el ESP32 confirma por WebSocket que presionó
 *    el botón (ack «ejecutado»). Si el carrito no está conectado, no cambia.
 *  - Al recargar la página vuelve a ON.
 *  - El chip de cada uno permite corregirlo a mano SIN enviar ningún comando
 *    (por ejemplo, si se apagó y prendió el carrito o se usó el control físico).
 */
import { crear, icono } from '../utils/dom.js';

const ACCESORIOS = Object.freeze({
  LUCES: { texto: 'Luces', icono: 'bi-lightbulb-fill', on: 'encendidas', off: 'apagadas' },
  BOCINA: { texto: 'Bocina', icono: 'bi-megaphone-fill', on: 'encendida', off: 'apagada' },
});

const encendido = { LUCES: true, BOCINA: true };
const pendientes = new Map();   // id_evento -> comando, a la espera de la confirmación del ESP32
const chips = {};

function pintar() {
  for (const [nombre, info] of Object.entries(ACCESORIOS)) {
    const on = encendido[nombre];
    const chip = chips[nombre];
    if (chip) {
      chip.dataset.encendido = String(on);
      chip.querySelector('.texto').textContent = `${info.texto} ${on ? 'ON' : 'OFF'}`;
      chip.setAttribute('aria-label',
        `${info.texto}: ${on ? info.on : info.off}. Pulsa para corregir el indicador; no envía ningún comando.`);
    }
    for (const boton of document.querySelectorAll(`.btn-comando[data-comando="${nombre}"]`)) {
      boton.dataset.encendido = String(on);
      let marca = boton.querySelector('.estado');
      if (!marca) {
        marca = crear('small', { clase: 'estado', atributos: { 'aria-hidden': 'true' } });
        boton.append(marca);
      }
      marca.textContent = on ? 'ON' : 'OFF';
    }
  }
}

export function iniciarAccesorios() {
  const contenedor = document.getElementById('accesorios');
  for (const [nombre, info] of Object.entries(ACCESORIOS)) {
    const chip = crear('button', {
      clase: 'chip-accesorio',
      atributos: { type: 'button', title: 'Corregir el indicador (no envía comando al carrito)' },
    }, [icono(info.icono), crear('span', { clase: 'texto' }), icono('bi-arrow-repeat')]);
    chip.addEventListener('click', () => { encendido[nombre] = !encendido[nombre]; pintar(); });
    chips[nombre] = chip;
    contenedor.append(chip);
  }
  pintar();
}

/** Se llama después de dibujar los botones del catálogo. */
export function pintarAccesorios() {
  pintar();
}

/** Evento «movimiento»: recuerda los de luces y bocina para esperar su confirmación. */
export function registrarMovimiento(evento) {
  if (!(evento.comando in ACCESORIOS) || !evento.id_evento) return;
  pendientes.set(evento.id_evento, evento.comando);
  if (pendientes.size > 20) pendientes.delete(pendientes.keys().next().value);
}

/** Evento «ack_dispositivo»: el ESP32 confirma que presionó el botón. */
export function confirmarDispositivo(evento) {
  const nombre = pendientes.get(evento.id_evento_ref);
  if (!nombre) return;
  pendientes.delete(evento.id_evento_ref);
  if (evento.resultado !== 'ejecutado') return;
  encendido[nombre] = !encendido[nombre];
  pintar();
}
