import { useState } from 'react';
import { Card } from '../../shared/ui/Primitives';
import { useContainerSize } from '../../shared/ui/useContainerSize';
import type { RegionStatusBar } from '../../types/domain';
import { formatCompact } from './chartUtils';

interface StackedBarChartProps {
  bars: readonly RegionStatusBar[];
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

export function StackedBarChart({
  bars,
  selectedRegion,
  onSelectRegion,
}: StackedBarChartProps) {
  const { ref, width } = useContainerSize(500, 250);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const height = 250;
  const pad = { top: 18, right: 16, bottom: 32, left: 42 };
  const plotW = Math.max(120, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const maxTotal = Math.max(
    1,
    ...bars.map((b) => b.healthy + b.retried + b.failed)
  );
  const colSlot = plotW / Math.max(1, bars.length);
  const barW = Math.min(44, Math.max(18, colSlot * 0.56));
  const hoveredBar = bars.find((b) => b.region === hoveredRegion);

  return (
    <Card
      title="Regional Request Outcomes (Stacked Bar)"
      subtitle="Click any region bar to cross-filter the 2,000-row virtualized event table"
      actions={
        <div className="chart-legend" style={{ fontSize: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-healthy)' }} />
            Healthy
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-degraded)' }} />
            Retried
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-critical)' }} />
            Failed
          </span>
        </div>
      }
    >
      <div ref={ref} className="chart-container">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Stacked bar chart of regional outcomes"
        >
          {[0, 0.5, 1].map((t) => {
            const y = pad.top + t * plotH;
            const val = Math.round(maxTotal * 1.1 * (1 - t));
            return (
              <g key={t}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 4"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {formatCompact(val)}
                </text>
              </g>
            );
          })}

          {bars.map((bar, idx) => {
            const total = bar.healthy + bar.retried + bar.failed;
            const scale = plotH / (maxTotal * 1.1);
            const hHealthy = bar.healthy * scale;
            const hRetried = bar.retried * scale;
            const hFailed = bar.failed * scale;

            const x = pad.left + idx * colSlot + (colSlot - barW) / 2;
            const yHealthy = pad.top + plotH - hHealthy;
            const yRetried = yHealthy - hRetried;
            const yFailed = yRetried - hFailed;
            const isSelected = selectedRegion === bar.region;
            const dimmed = selectedRegion !== null && !isSelected;

            return (
              <g
                key={bar.region}
                style={{ cursor: 'pointer', opacity: dimmed ? 0.38 : 1 }}
                role="button"
                tabIndex={0}
                aria-label={`Filter by region ${bar.region}: ${total} requests`}
                onClick={() =>
                  onSelectRegion(isSelected ? null : bar.region)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRegion(isSelected ? null : bar.region);
                  }
                }}
                onMouseEnter={() => setHoveredRegion(bar.region)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <rect
                  x={x - 4}
                  y={pad.top}
                  width={barW + 8}
                  height={plotH}
                  rx="6"
                  fill={
                    hoveredRegion === bar.region || isSelected
                      ? 'var(--bg-subtle)'
                      : 'transparent'
                  }
                />
                <rect
                  x={x}
                  y={yHealthy}
                  width={barW}
                  height={Math.max(1, hHealthy)}
                  fill="var(--status-healthy)"
                />
                <rect
                  x={x}
                  y={yRetried}
                  width={barW}
                  height={Math.max(1, hRetried)}
                  fill="var(--status-degraded)"
                />
                <rect
                  x={x}
                  y={yFailed}
                  width={barW}
                  height={Math.max(2, hFailed)}
                  rx="3"
                  fill="var(--status-critical)"
                />
                <text
                  x={x + barW / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={isSelected ? '700' : '500'}
                  fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {bar.region}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredBar && (
          <div className="chart-tooltip" style={{ right: 14, top: 12 }}>
            <strong className="mono">{hoveredBar.region}</strong>
            <div style={{ color: 'var(--status-healthy)' }}>
              Healthy: {hoveredBar.healthy.toLocaleString()}k
            </div>
            <div style={{ color: 'var(--status-degraded)' }}>
              Retried: {hoveredBar.retried.toLocaleString()}k
            </div>
            <div style={{ color: 'var(--status-critical)' }}>
              Failed: {hoveredBar.failed.toLocaleString()}k
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
