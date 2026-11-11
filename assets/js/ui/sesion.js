/**
 * Inicio de sesión del operador contra POST /auth/login.
 * El token se guarda solo en sessionStorage (se borra al cerrar la pestaña)
 * y nunca se incluye en el código ni en el repositorio.
 */
import { api, configurarAutenticacion } from '../api/cliente.js';
import { actualizar, obtener } from '../estado.js';
import { mensajeDeError } from '../utils/errores.js';
import { avisar } from './mensajes.js';

const CLAVE = 'carrito_iot_sesion';

function leerGuardada() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    if (s && typeof s.token === 'string' && s.expira > Date.now()) return s;
  } catch { /* almacenamiento no disponible */ }
  return null;
}

function guardar(s) {
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE);
  } catch { /* modo privado: la sesión dura mientras la página esté abierta */ }
}

export function cerrarSesion(motivo) {
  guardar(null);
  actualizar('sesion', null);
  if (motivo) avisar(motivo, 'error');
}

export function iniciarSesionUI({ alCambiar }) {
  const dialogo = document.getElementById('dialogo-sesion');
  const form = document.getElementById('form-sesion');
  const error = document.getElementById('sesion-error');
  const btnEntrar = document.getElementById('btn-sesion-entrar');
  const btnSesion = document.getElementById('btn-sesion');
  const chip = document.getElementById('sesion-estado');

  configurarAutenticacion({
    token: () => {
      const s = obtener('sesion');
      if (s && s.expira <= Date.now()) { cerrarSesion('La sesión expiró. Inicia sesión de nuevo.'); return null; }
      return s?.token || null;
    },
    noAutorizado: () => cerrarSesion('La sesión expiró o no es válida. Inicia sesión de nuevo.'),
  });

  const abrir = () => {
    error.textContent = '';
    form.password.value = '';
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
    form.password.focus();
  };
  const cerrar = () => (typeof dialogo.close === 'function' ? dialogo.close() : dialogo.removeAttribute('open'));

  btnSesion.addEventListener('click', () => {
    if (obtener('sesion')) cerrarSesion();
    else abrir();
  });
  document.getElementById('btn-sesion-cerrar').addEventListener('click', cerrar);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = form.username.value.trim();
    const password = form.password.value;
    if (!usuario || !password) { error.textContent = 'Escribe usuario y contraseña.'; return; }
    btnEntrar.disabled = true;
    btnEntrar.textContent = 'Entrando…';
    try {
      const r = await api.login(usuario, password);
      if (!r || typeof r.access_token !== 'string') throw new Error('Respuesta inválida');
      const sesion = {
        usuario, rol: String(r.rol || ''), token: r.access_token,
        expira: Date.now() + (Number(r.expira_en_segundos) || 3600) * 1000 - 30000,
      };
      guardar(sesion);
      actualizar('sesion', sesion);
      cerrar();
      avisar(`Sesión iniciada como ${usuario}`, 'ok');
    } catch (err) {
      error.textContent = err?.status === 401 ? 'Usuario o contraseña incorrectos.' : mensajeDeError(err);
    } finally {
      form.password.value = '';
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar';
    }
  });

  const pintar = (s) => {
    chip.hidden = !s;
    document.getElementById('sesion-usuario').textContent = s ? s.usuario : '';
    btnSesion.replaceChildren();
    const ico = document.createElement('i');
    ico.className = `bi ${s ? 'bi-box-arrow-right' : 'bi-box-arrow-in-right'}`;
    ico.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = s ? 'Salir' : 'Iniciar sesión';
    btnSesion.append(ico, txt);
    alCambiar(s);
  };

  const guardada = leerGuardada();
  actualizar('sesion', guardada);
  return pintar;
}
