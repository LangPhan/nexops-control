import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Primitives';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Detail panel'}
      >
        <header className="drawer-header">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h2>
            {subtitle && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Close drawer"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
