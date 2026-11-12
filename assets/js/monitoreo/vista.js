/**
 * MONITOREO · vista: tarjeta del último movimiento y tabla de 10 movimientos.
 * Solo pinta lo que hay en el estado (monitoreo/sincronizador.js); todo el texto
 * se inserta con textContent.
 */
import { PRESENTACION } from '../config.js';
import { obtener, suscribir } from '../estado.js';
import { crear, icono, iconoSeguro } from '../utils/dom.js';
import { formatearFecha, formatearHora, zonaHoraria } from '../utils/fechas.js';
import { resincronizar } from './sincronizador.js';

const $ = (id) => document.getElementById(id);

const FUENTES = {
  wss: { texto: 'En vivo · WSS', icono: 'bi-broadcast', clase: 'vivo' },
  rest: { texto: 'Persistido · RDS', icono: 'bi-database-check', clase: 'persistido' },
  'wss-inicial': { texto: 'Persistido · RDS', icono: 'bi-database-check', clase: 'persistido' },
};

function nombreComando(comando) {
  return PRESENTACION[comando]?.texto || comando || '—';
}

// ---------------------------------------------------------- tarjeta
function pintarTarjeta() {
  const dato = obtener('monUltimo');
  const carga = obtener('monCargaEstado');
  const ws = obtener('ws');
  const tarjeta = $('mon-tarjeta');

  const conDato = Boolean(dato && dato.comando);
  tarjeta.dataset.estado = conDato ? 'dato' : carga.estado === 'error' ? 'error' : dato?.vacio ? 'vacio' : 'cargando';

  $('mon-comando').textContent = conDato ? nombreComando(dato.comando)
    : carga.estado === 'error' ? 'Sin datos' : dato?.vacio ? 'Sin movimientos' : 'Cargando…';
  $('mon-comando-icono').className = `bi ${conDato ? iconoSeguro(PRESENTACION[dato.comando]?.icono || 'bi-joystick') : 'bi-hourglass-split'}`;
  $('mon-comando-clave').textContent = conDato ? dato.comando : '';

  // Etiqueta de origen del dato
  const insignia = $('mon-fuente');
  if (conDato && dato.tipo === 'demo_paso') {
    insignia.dataset.clase = 'demo';
    insignia.replaceChildren(icono('bi-play-circle-fill'),
      crear('span', { texto: `DEMO · paso ${dato.paso ?? '?'} de ${dato.total_pasos ?? '?'}` }));
  } else if (conDato) {
    const f = FUENTES[dato.fuente] || FUENTES.rest;
    insignia.dataset.clase = f.clase;
    insignia.replaceChildren(icono(f.icono), crear('span', { texto: f.texto }));
  } else {
    insignia.dataset.clase = '';
    insignia.replaceChildren();
  }

  $('mon-vehiculo').textContent = dato?.vehiculo || obtener('vehiculo')?.nombre || '—';
  $('mon-codigo').textContent = conDato && dato.codigo !== null ? String(dato.codigo) : '—';
  $('mon-origen').textContent = conDato && dato.origen ? dato.origen : '—';
  $('mon-fecha').textContent = conDato ? formatearFecha(dato.fecha) : '—';
  $('mon-hora').textContent = conDato ? formatearHora(dato.fecha) : '—';

  // Avisos: DEMO, conexión y errores (con texto, no solo color)
  const aviso = $('mon-aviso');
  let mensaje = '';
  let tipo = 'info';
  if (conDato && dato.tipo === 'demo_paso') {
    mensaje = 'Paso interno de DEMO: actualiza el último estado, pero no se guarda en el historial individual.';
  } else if (ws !== 'en_linea' && conDato) {
    mensaje = ws === 'desconectado'
      ? 'Desconectado: sin datos actualizados. Se muestra el último valor conocido.'
      : 'Reconectando: se muestra el último valor conocido.';
    tipo = 'alerta';
  } else if (carga.estado === 'error') {
    mensaje = `No se pudo consultar el estado: ${carga.mensaje}`;
    tipo = 'error';
  }
  aviso.hidden = !mensaje;
  aviso.dataset.tipo = tipo;
  aviso.textContent = mensaje;

  const demo = obtener('monDemo');
  $('mon-demo').hidden = !demo;
  if (demo) $('mon-demo-texto').textContent = `DEMO en curso: «${demo.nombre || 'DEMO'}» · paso ${demo.paso || 0} de ${demo.total_pasos ?? '?'}`;
}

// ---------------------------------------------------------- tabla
function filaNueva(registro) {
  const tr = crear('tr', { atributos: { 'data-id': registro.id } });
  tr.append(
    crear('th', { clase: 'col-num', atributos: { scope: 'row' } }),
    crear('td', { clase: 'col-mov' }, [
      icono(iconoSeguro(PRESENTACION[registro.comando]?.icono || 'bi-joystick')),
      crear('span', { clase: 'mov-nombre', texto: nombreComando(registro.comando) }),
      crear('small', { clase: 'mov-clave', texto: registro.comando }),
    ]),
    crear('td', { clase: 'col-cod', texto: registro.codigo ?? '—' }),
    crear('td', { clase: 'col-origen', texto: registro.origen || '—' }),
    crear('td', { clase: 'col-fecha', texto: formatearFecha(registro.fecha) }),
    crear('td', { clase: 'col-hora', texto: formatearHora(registro.fecha) }),
    crear('td', { clase: 'col-id', texto: `#${registro.id}` }),
  );
  return tr;
}

let primeraVez = true;
function pintarTabla() {
  const filas = obtener('monHistorial');
  const carga = obtener('monCargaHistorial');
  const cuerpo = $('mon-tabla-cuerpo');

  // Estado de la tabla (texto + icono, no solo color)
  const estado = $('mon-tabla-estado');
  estado.dataset.estado = carga.estado;
  const textos = {
    cargando: ['bi-hourglass-split', 'Cargando movimientos…'],
    sincronizando: ['bi-arrow-repeat', 'Sincronizando con RDS…'],
    listo: ['bi-check-circle-fill', carga.actualizado
      ? `Actualizado ${formatearHora(carga.actualizado)} · ${carga.motivo || 'consulta'}` : 'Actualizado'],
    error: ['bi-exclamation-triangle-fill', `Error: ${carga.mensaje || 'no se pudo consultar el historial'}`],
  };
  const [ico, txt] = textos[carga.estado] || textos.cargando;
  estado.replaceChildren(icono(ico), crear('span', { texto: txt }));
  $('mon-cuenta').textContent = Array.isArray(filas) ? `${filas.length} de 10` : '';

  if (!Array.isArray(filas)) {                                   // aún sin datos
    if (!cuerpo.querySelector('.fila-mensaje')) {
      cuerpo.replaceChildren(crear('tr', { clase: 'fila-mensaje' }, [
        crear('td', { atributos: { colspan: '7' }, texto: carga.estado === 'error' ? 'No se pudo cargar el historial.' : 'Cargando…' }),
      ]));
    } else {
      cuerpo.querySelector('.fila-mensaje td').textContent = carga.estado === 'error' ? 'No se pudo cargar el historial.' : 'Cargando…';
    }
    return;
  }
  if (!filas.length) {
    cuerpo.replaceChildren(crear('tr', { clase: 'fila-mensaje' }, [
      crear('td', { atributos: { colspan: '7' }, texto: 'Sin movimientos registrados para este vehículo.' }),
    ]));
    return;
  }

  // Actualización por clave (id_historial): reutiliza las filas existentes y solo
  // crea las nuevas; las que salen de las 10 se quitan de la PANTALLA (no de RDS).
  const existentes = new Map([...cuerpo.querySelectorAll('tr[data-id]')].map((tr) => [Number(tr.dataset.id), tr]));
  const orden = filas.map((r, i) => {
    let tr = existentes.get(r.id);
    if (!tr) {
      tr = filaNueva(r);
      if (!primeraVez) tr.classList.add('nueva');
    }
    tr.querySelector('.col-num').textContent = String(i + 1);
    return tr;
  });
  const enUso = new Set(orden);
  for (const tr of [...cuerpo.children]) if (!enUso.has(tr)) tr.remove();   // copia: la colección es viva
  orden.forEach((tr, i) => { if (cuerpo.children[i] !== tr) cuerpo.insertBefore(tr, cuerpo.children[i] || null); });
  primeraVez = false;
}

export function iniciarVistaMonitoreo() {
  $('mon-zona').textContent = zonaHoraria();
  $('mon-actualizar').addEventListener('click', () => resincronizar('botón Actualizar'));
  for (const clave of ['monUltimo', 'monCargaEstado', 'monDemo', 'ws', 'vehiculo']) suscribir(clave, pintarTarjeta);
  for (const clave of ['monHistorial', 'monCargaHistorial']) suscribir(clave, pintarTabla);
}
