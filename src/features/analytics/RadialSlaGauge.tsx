import { useState } from 'react';
import { Card } from '../../shared/ui/Primitives';
import type { ServiceAllocation } from '../../types/domain';

interface RadialSlaGaugeProps {
  overallSlaPct: number;
  allocations: readonly ServiceAllocation[];
}

export function RadialSlaGauge({
  overallSlaPct,
  allocations,
}: RadialSlaGaugeProps) {
  const [activeService, setActiveService] = useState<string | null>(null);

  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 74;
  const circumference = 2 * Math.PI * radius;

  let cumulativePct = 0;
  const segments = allocations.map((item) => {
    const dashLen = (item.sharePct / 100) * circumference;
    const offset = -((cumulativePct / 100) * circumference);
    cumulativePct += item.sharePct;
    return {
      ...item,
      dashArray: `${Math.max(2, dashLen - 3)} ${circumference}`,
      dashOffset: offset,
    };
  });

  const focused = segments.find((s) => s.service === activeService);

  return (
    <Card
      title="Service SLA & Traffic Share (Radial Donut)"
      subtitle="Animated SVG stroke-dashoffset gauge across core B2B tiers"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Overall SLA compliance ${overallSlaPct}%`}
        >
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth="18"
          />

          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map((seg) => {
              const isFocus = activeService === seg.service;
              return (
                <circle
                  key={seg.service}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.colorToken}
                  strokeWidth={isFocus ? 22 : 18}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="butt"
                  style={{
                    cursor: 'pointer',
                    opacity:
                      activeService && !isFocus ? 0.35 : 1,
                    transition: 'stroke-width 160ms ease, opacity 160ms ease',
                  }}
                  onMouseEnter={() => setActiveService(seg.service)}
                  onMouseLeave={() => setActiveService(null)}
                />
              );
            })}
          </g>

          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="24"
            fontWeight="700"
            fill="var(--text-primary)"
            fontFamily="var(--font-sans)"
          >
            {focused ? `${focused.slaPct}%` : `${overallSlaPct}%`}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-secondary)"
          >
            {focused ? focused.service : 'Aggregate SLA'}
          </text>
        </svg>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minWidth: 200,
          }}
        >
          {segments.map((seg) => (
            <div
              key={seg.service}
              onMouseEnter={() => setActiveService(seg.service)}
              onMouseLeave={() => setActiveService(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                background:
                  activeService === seg.service
                    ? 'var(--bg-hover)'
                    : 'var(--bg-elevated)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: seg.colorToken,
                  }}
                />
                {seg.service}
              </span>
              <span className="mono tabular" style={{ color: 'var(--text-secondary)' }}>
                {seg.sharePct}% · {seg.slaPct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
