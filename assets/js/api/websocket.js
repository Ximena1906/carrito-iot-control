/**
 * Sesión WebSocket (WSS) real del navegador con el servidor de AWS.
 * - Estados: conectando -> en_linea -> reconectando/desconectado.
 * - Reconexión con espera exponencial y aleatoria.
 * - Latido: envía {"tipo":"ping"} y espera "pong"; si no llega, reconecta.
 * Esta conexión NO representa al carrito físico.
 */
import { CONFIG, RUTAS } from '../config.js';
import { actualizar } from '../estado.js';

export class ClienteWebSocket {
  constructor(alEvento) {
    this.alEvento = alEvento;
    this.ws = null;
    this.intentos = 0;
    this.temporizadorReconexion = null;
    this.temporizadorPing = null;
    this.temporizadorPong = null;
    this.activo = false;
  }

  iniciar() {
    this.activo = true;
    window.addEventListener('online', () => this.reconectarYa());
    window.addEventListener('offline', () => {
      actualizar('ws', 'desconectado');
      this.ws?.close();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (!this.ws || this.ws.readyState > WebSocket.OPEN)) this.reconectarYa();
    });
    this.conectar();
  }

  conectar() {
    clearTimeout(this.temporizadorReconexion);
    if (!navigator.onLine) {
      actualizar('ws', 'desconectado');
      return;
    }
    actualizar('ws', this.intentos === 0 ? 'conectando' : 'reconectando');
    let ws;
    try {
      ws = new WebSocket(CONFIG.WS_BASE_URL + RUTAS.websocket(CONFIG.ID_VEHICULO));
    } catch {
      this.programarReconexion();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      if (ws !== this.ws) return;
      this.intentos = 0;
      actualizar('ws', 'en_linea');
      this.iniciarLatido();
    });

    ws.addEventListener('message', (e) => {
      if (ws !== this.ws) return;
      clearTimeout(this.temporizadorPong);
      let datos;
      try { datos = JSON.parse(e.data); } catch { return; }
      if (!datos || typeof datos.tipo !== 'string') return;
      if (datos.tipo === 'pong') return;
      this.alEvento(datos);
    });

    ws.addEventListener('close', () => {
      if (ws !== this.ws) return;
      this.detenerLatido();
      actualizar('ws', 'desconectado');
      if (this.activo) this.programarReconexion();
    });

    ws.addEventListener('error', () => { /* el evento close gestiona la reconexión */ });
  }

  programarReconexion() {
    this.intentos += 1;
    const base = Math.min(CONFIG.WS_RECONEXION_MAX, CONFIG.WS_RECONEXION_MIN * 2 ** (this.intentos - 1));
    const espera = base / 2 + Math.random() * (base / 2);
    clearTimeout(this.temporizadorReconexion);
    this.temporizadorReconexion = setTimeout(() => this.conectar(), espera);
    setTimeout(() => { if (this.ws?.readyState !== WebSocket.OPEN) actualizar('ws', 'reconectando'); }, 600);
  }

  reconectarYa() {
    this.intentos = 0;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.conectar();
  }

  iniciarLatido() {
    this.detenerLatido();
    this.temporizadorPing = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify({ tipo: 'ping' }));
      clearTimeout(this.temporizadorPong);
      this.temporizadorPong = setTimeout(() => this.ws?.close(), CONFIG.WS_ESPERA_PONG);
    }, CONFIG.WS_PING);
  }

  detenerLatido() {
    clearInterval(this.temporizadorPing);
    clearTimeout(this.temporizadorPong);
  }
}
