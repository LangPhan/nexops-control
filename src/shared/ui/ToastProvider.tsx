import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { Button } from './Primitives';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { ...input, id };
      setToasts((prev) => [...prev.slice(-3), item]);

      const duration = input.durationMs ?? 4800;
      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <div
        className="toast-viewport"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.type}`}
            role="status"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 13 }}>{toast.title}</strong>
              {toast.description && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {toast.description}
                </span>
              )}
              {toast.action && (
                <div style={{ marginTop: 4 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </Button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              style={{ padding: 4, height: 24 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
