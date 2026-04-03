// Single clean realtimeService implementation
type Role = 'PATIENT' | 'CAREGIVER' | 'FAMILY';
const isDev = import.meta.env.DEV;
const MAX_QUEUE_SIZE = 300;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

type IncomingMessage = { type: string; payload?: any };
type StatusCb = (connected: boolean) => void;
type ActionCb = (action: any) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private statusCbs: StatusCb[] = [];
  private actionCbs: ActionCb[] = [];
  private sendQueue: IncomingMessage[] = [];
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private onlineListenerBound = false;

  private readonly handleOnline = () => {
    if (this.manualDisconnect || !this.url) return;
    this.connect(this.url);
  };

  private readonly handleOffline = () => {
    this.statusCbs.forEach((cb) => cb(false));
  };

  private ensureNetworkListeners() {
    if (this.onlineListenerBound) return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.onlineListenerBound = true;
  }

  private removeNetworkListeners() {
    if (!this.onlineListenerBound) return;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.onlineListenerBound = false;
  }

  isConnected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  connect(url?: string) {
    this.manualDisconnect = false;
    this.ensureNetworkListeners();
    const target = url || (window as any).__DEMO_REALTIME_URL || this.url;
    if (!target) throw new Error('No realtime URL provided');
    // if already connected to same url, noop
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.url === target) return;
    this.url = target;

    try {
      if (this.ws) {
        try { this.ws.close(); } catch (e) { /* ignore */ }
      }
      console.info('[realtime] connecting to', target);
      this.ws = new WebSocket(target);
    } catch (e) {
      console.error('[realtime] failed to create WebSocket', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      console.info('[realtime] connected to', target);
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      // flush send queue
      while (this.sendQueue.length > 0) {
        const m = this.sendQueue.shift()!;
        this._sendNow(m);
      }
      this.statusCbs.forEach(cb => cb(true));
    });

    this.ws.addEventListener('message', (ev) => {
      try {
        const msg: IncomingMessage = JSON.parse((ev.data as string) || '');
        if (isDev) console.debug('[realtime] received', msg);
        if (msg.type === 'ACTION') {
          this.actionCbs.forEach(cb => cb(msg.payload));
        } else if (msg.type === 'LOGIN_SUCCESS') {
          this.actionCbs.forEach(cb => cb({ type: 'LOGIN_SUCCESS', payload: msg.payload }));
        } else {
          this.actionCbs.forEach(cb => cb(msg));
        }
      } catch (e) {
        console.warn('[realtime] invalid message', e);
      }
    });

    this.ws.addEventListener('close', () => {
      console.info('[realtime] disconnected');
      this.statusCbs.forEach(cb => cb(false));
      if (!this.manualDisconnect) this.scheduleReconnect();
    });

    this.ws.addEventListener('error', (e) => {
      console.error('[realtime] websocket error', e);
    });
  }

  private scheduleReconnect() {
    if (this.manualDisconnect) return;
    if (this.reconnectTimer || !this.url) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const delay = Math.min(RECONNECT_BASE_MS * (2 ** this.reconnectAttempts), RECONNECT_MAX_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.url && !this.manualDisconnect) this.connect(this.url);
    }, delay) as unknown as number;
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
    this.removeNetworkListeners();
    this.statusCbs.forEach(cb => cb(false));
  }

  login(username: string, password?: string, room = 'demo', role?: Role) {
    this.send({ type: 'LOGIN', payload: { username, password, room, role } });
  }

  sendAction(action: any) {
    this.send({ type: 'ACTION', payload: action });
  }

  private _sendNow(msg: IncomingMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      if (isDev) console.debug('[realtime] send', msg);
      this.ws.send(JSON.stringify(msg));
    } catch (e) { console.warn('[realtime] send failed', e); }
  }

  send(msg: IncomingMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._sendNow(msg);
      return;
    }
    // queue for later
    this.sendQueue.push(msg);
    if (this.sendQueue.length > MAX_QUEUE_SIZE) {
      this.sendQueue.splice(0, this.sendQueue.length - MAX_QUEUE_SIZE);
      console.warn('[realtime] send queue exceeded max size; oldest messages were dropped');
    }
    // attempt connect
    try { this.connect(); } catch (e) { /* ignore */ }
  }

  onStatusChange(cb: StatusCb) {
    this.statusCbs.push(cb);
    return () => { this.statusCbs = this.statusCbs.filter(x => x !== cb); };
  }

  onAction(cb: ActionCb) {
    this.actionCbs.push(cb);
    return () => { this.actionCbs = this.actionCbs.filter(x => x !== cb); };
  }
}

const realtimeService = new RealtimeService();
export default realtimeService;
