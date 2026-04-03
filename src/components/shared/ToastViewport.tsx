import React, { useEffect, useState, useCallback } from 'react';
import toastService, { ToastMessage } from '../../services/toastService';

const kindClass: Record<ToastMessage['kind'], string> = {
  info: 'border-slate-500 bg-slate-800/95 text-slate-100',
  success: 'border-green-500 bg-green-900/90 text-green-100',
  warning: 'border-amber-500 bg-amber-900/95 text-amber-100',
  error: 'border-red-500 bg-red-900/90 text-red-100',
};

const ToastViewport: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = toastService.subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        removeToast(toast.id);
      }, toast.durationMs);
    });

    return () => {
      unsub();
    };
  }, [removeToast]);

  const handleAction = (toastId: string, action: ToastMessage['actions'] extends (infer T)[] | undefined ? T : never) => {
    if (action?.onClick) {
      action.onClick();
    }
    removeToast(toastId);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[210000] w-full max-w-md px-4 space-y-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${kindClass[toast.kind]}`}
        >
          <p className="text-sm font-medium">{toast.text}</p>
          {toast.actions && toast.actions.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(toast.id, action)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors bg-white/20 hover:bg-white/30 text-white"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastViewport;
