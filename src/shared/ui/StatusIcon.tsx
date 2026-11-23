import { useId } from 'react';
import type { NodeStatus } from '../../types/domain';

export type StatusIconVariant = NodeStatus | 'syncing' | 'paused';

interface StatusIconProps {
  status: StatusIconVariant;
  size?: number;
  label?: string;
  decorative?: boolean;
}

const COLOR_MAP: Record<StatusIconVariant, string> = {
  healthy: 'var(--status-healthy)',
  degraded: 'var(--status-degraded)',
  critical: 'var(--status-critical)',
  maintenance: 'var(--status-maintenance)',
  recovering: 'var(--status-recovering)',
  syncing: 'var(--accent-primary)',
  paused: 'var(--text-muted)',
};

export function StatusIcon({
  status,
  size = 18,
  label,
  decorative = false,
}: StatusIconProps) {
  const uid = useId();
  const color = COLOR_MAP[status];
  const ariaProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label ?? `${status} status` };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
      {...ariaProps}
    >
      {status === 'healthy' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke={color}
            strokeWidth="1.5"
            opacity="0.45"
            className="svg-pulse-ring"
          />
          <circle cx="12" cy="12" r="5" fill={color} />
          <path
            d="M9.8 12.1l1.5 1.5 3.1-3.2"
            stroke="var(--bg-surface)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {status === 'degraded' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke={color}
            strokeWidth="1.6"
            strokeDasharray="4 3"
            className="svg-spin-slow"
          />
          <path
            d="M12 7.5l4.6 8.2H7.4L12 7.5z"
            fill={color}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth="1"
          />
          <path
            d="M12 10.6v2.4"
            stroke="var(--bg-surface)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="14.5" r="0.75" fill="var(--bg-surface)" />
        </>
      )}

      {status === 'critical' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke={color}
            strokeWidth="1.8"
            opacity="0.55"
            className="svg-pulse-ring"
          />
          <circle cx="12" cy="12" r="6.5" fill={color} className="svg-blink" />
          <path
            d="M12 8.5v4.2"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="15.2" r="1" fill="#ffffff" />
        </>
      )}

      {status === 'maintenance' && (
        <g className="svg-spin-slow">
          <circle
            cx="12"
            cy="12"
            r="4.2"
            stroke={color}
            strokeWidth="2"
          />
          <path
            d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      )}

      {status === 'recovering' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke={color}
            strokeWidth="2"
            opacity="0.24"
          />
          <path
            d="M12 4a8 8 0 0 1 7.6 5.5"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
            className="svg-spin-fast"
          />
          <circle cx="12" cy="12" r="3.2" fill={color} />
        </>
      )}

      {status === 'syncing' && (
        <g className="svg-spin-fast" id={`sync-${uid}`}>
          <path
            d="M5.6 9.5A7 7 0 0 1 18.2 7.8"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M18.4 14.5A7 7 0 0 1 5.8 16.2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polyline
            points="15.4 8.2 18.6 8.1 18.2 4.9"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="8.6 15.8 5.4 15.9 5.8 19.1"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {status === 'paused' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8.5"
            stroke={color}
            strokeWidth="1.6"
            opacity="0.65"
          />
          <rect x="9" y="8.2" width="2.2" height="7.6" rx="1" fill={color} />
          <rect x="12.8" y="8.2" width="2.2" height="7.6" rx="1" fill={color} />
        </>
      )}
    </svg>
  );
}
