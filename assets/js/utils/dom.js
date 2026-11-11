/**
 * Utilidades de DOM seguras: el contenido recibido de la API se inserta
 * siempre con textContent, nunca con innerHTML.
 */
export const $ = (selector, raiz = document) => raiz.querySelector(selector);

/** Crea un elemento con atributos y texto. Los hijos pueden ser nodos o texto. */
export function crear(etiqueta, { clase, texto, atributos = {} } = {}, hijos = []) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined && texto !== null) el.textContent = String(texto);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v === null || v === undefined) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos) el.append(h instanceof Node ? h : document.createTextNode(String(h)));
  return el;
}

export function icono(clase) {
  return crear('i', { clase: `bi ${clase}`, atributos: { 'aria-hidden': 'true' } });
}

export function horaCorta(fecha = new Date()) {
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Solo permite clases de icono conocidas (defensa ante datos inesperados). */
export function iconoSeguro(clase) {
  return /^bi-[a-z0-9-]+$/.test(clase) ? clase : 'bi-circle';
}
