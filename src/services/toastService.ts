export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  text: string;
  kind: ToastKind;
  durationMs: number;
  actions?: ToastAction[];
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

const emit = (toast: ToastMessage) => {
  listeners.forEach((listener) => {
    try {
      listener(toast);
    } catch (error) {
      console.error('Toast listener failed', error);
    }
  });
};

const show = (text: string, kind: ToastKind = 'info', durationMs = 3000, actions?: ToastAction[]) => {
  const toast: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text,
    kind,
    durationMs,
    actions,
  };
  emit(toast);
};

const subscribe = (listener: ToastListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export default { show, subscribe };
