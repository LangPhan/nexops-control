import {
  Component,
  type ButtonHTMLAttributes,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { StatusIcon } from './StatusIcon';
import type { NodeStatus } from '../../types/domain';

/* ==========================================================================
   Button
   ========================================================================== */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <StatusIcon status="syncing" size={14} decorative /> : icon}
      {children}
    </button>
  );
}

/* ==========================================================================
   Badge
   ========================================================================== */

export type BadgeVariant = NodeStatus | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = 'neutral',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {children}
    </span>
  );
}

/* ==========================================================================
   Card
   ========================================================================== */

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  title,
  subtitle,
  actions,
  compact = false,
  className = '',
  children,
}: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <header className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={`card-body ${compact ? 'compact' : ''}`.trim()}>
        {children}
      </div>
    </section>
  );
}

/* ==========================================================================
   Skeleton & EmptyState
   ========================================================================== */

export function Skeleton({
  width = '100%',
  height = 20,
  className = '',
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
        {title}
      </strong>
      {description && (
        <p style={{ fontSize: 12, maxWidth: 380 }}>{description}</p>
      )}
      {action}
    </div>
  );
}

/* ==========================================================================
   Segmented Tabs & Select
   ========================================================================== */

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly TabOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-btn ${active ? 'is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="ui-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ==========================================================================
   ErrorBoundary
   ========================================================================== */

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Captured cleanly in state fallback UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32 }}>
          <Card
            title="Console Module Recovered by ErrorBoundary"
            subtitle="Isolated fault containment prevented full-application crash"
          >
            <p style={{ color: 'var(--status-critical)', marginBottom: 16 }}>
              {this.state.message}
            </p>
            <Button
              variant="primary"
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Reset View
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
