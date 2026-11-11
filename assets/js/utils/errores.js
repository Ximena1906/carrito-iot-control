/** Errores de la aplicación con mensajes comprensibles (sin trazas internas). */
export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, tipo = 'http' } = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.tipo = tipo; // http | red | timeout | formato | cancelado
  }
}

const MENSAJES_HTTP = {
  400: 'Solicitud no válida.',
  401: 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.',
  403: 'Tu usuario no tiene permiso para esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'La acción no es posible en este momento.',
  422: 'Los datos enviados no son válidos.',
  500: 'Error interno del servidor.',
  502: 'El servidor no está disponible (proxy).',
  503: 'Servicio temporalmente no disponible.',
};

/** Usa el "detail" de la API si es texto; si no, un mensaje genérico por código. */
export function mensajeHttp(status, cuerpo) {
  const detalle = cuerpo && typeof cuerpo.detail === 'string' ? cuerpo.detail : null;
  if (detalle && status !== 500) return detalle.slice(0, 200);
  return MENSAJES_HTTP[status] || `Error HTTP ${status}.`;
}

export function mensajeDeError(error) {
  if (error instanceof ErrorApi) return error.message;
  return 'Ocurrió un error inesperado.';
}
