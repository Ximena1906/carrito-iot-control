/**
 * Fechas y horas de la API.
 *
 * - Los eventos WSS traen `timestamp` en ISO 8601 con zona (UTC, "+00:00").
 * - RDS guarda TIMESTAMP en UTC y la API los devuelve SIN zona
 *   (p. ej. "2026-11-11T22:12:33"). Por eso una fecha sin zona se interpreta
 *   como UTC. Nunca se inventa una fecha: si falta o no es válida, se devuelve null.
 * - Se muestran en la zona horaria del navegador (en México: America/Mexico_City).
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

export function parsearFechaApi(valor) {
  if (typeof valor !== 'string' || !ISO.test(valor)) return null;
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/.test(valor) ? valor : `${valor}Z`;
  const fecha = new Date(conZona);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FORMATO_HORA = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const formatearFecha = (fecha) => (fecha ? FORMATO_FECHA.format(fecha) : '—');
export const formatearHora = (fecha) => (fecha ? FORMATO_HORA.format(fecha) : '—');

/** Ej.: "America/Mexico_City (UTC−06:00)". */
export function zonaHoraria() {
  const nombre = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const minutos = -new Date().getTimezoneOffset();
  const signo = minutos >= 0 ? '+' : '−';
  const abs = Math.abs(minutos);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${nombre} (UTC${signo}${hh}:${mm})`;
}
