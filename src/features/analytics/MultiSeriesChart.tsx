import { useId, useState } from 'react';
import { Card } from '../../shared/ui/Primitives';
import { useContainerSize } from '../../shared/ui/useContainerSize';
import type { TelemetryPoint } from '../../types/domain';
import {
  buildAreaPath,
  buildSmoothPath,
  formatCompact,
  linearScale,
} from './chartUtils';

interface MultiSeriesChartProps {
  series: readonly TelemetryPoint[];
}

export function MultiSeriesChart({ series }: MultiSeriesChartProps) {
  const gradId = useId();
  const { ref, width } = useContainerSize(540, 260);
  const [visible, setVisible] = useState({
    throughput: true,
    p95Latency: true,
    errorRate: true,
  });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const height = 250;
  const pad = { top: 18, right: 48, bottom: 28, left: 46 };
  const plotW = Math.max(120, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const maxThroughput = Math.max(
    1,
    ...series.map((p) => p.throughput)
  );
  const maxLatency = Math.max(80, ...series.map((p) => p.p95Latency));

  const throughputPts = series.map((p, idx) => ({
    x: pad.left + linearScale(idx, 0, Math.max(1, series.length - 1), 0, plotW),
    y:
      pad.top +
      linearScale(p.throughput, 0, maxThroughput * 1.12, plotH, 0),
  }));

  const latencyPts = series.map((p, idx) => ({
    x: pad.left + linearScale(idx, 0, Math.max(1, series.length - 1), 0, plotW),
    y:
      pad.top +
      linearScale(p.p95Latency, 0, maxLatency * 1.18, plotH, 0),
  }));

  const errorPts = series.map((p, idx) => ({
    x: pad.left + linearScale(idx, 0, Math.max(1, series.length - 1), 0, plotW),
    y: pad.top + linearScale(p.errorRate, 0, 1.5, plotH, 0),
  }));

  const slaTargetY = pad.top + linearScale(60, 0, maxLatency * 1.18, plotH, 0);
  const hoveredPoint = hoverIdx !== null ? series[hoverIdx] : null;
  const hoveredX = hoverIdx !== null ? throughputPts[hoverIdx]?.x ?? 0 : 0;

  return (
    <Card
      title="Multi-Series Telemetry (Area + Line + Crosshair)"
      subtitle="Normalized dual-scale throughput, P95 latency & SLA threshold"
      actions={
        <div className="chart-legend">
          <button
            type="button"
            className={`chart-legend-btn ${!visible.throughput ? 'is-dimmed' : ''}`}
            onClick={() =>
              setVisible((v) => ({ ...v, throughput: !v.throughput }))
            }
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: 'var(--chart-1)',
              }}
            />
            Throughput
          </button>
          <button
            type="button"
            className={`chart-legend-btn ${!visible.p95Latency ? 'is-dimmed' : ''}`}
            onClick={() =>
              setVisible((v) => ({ ...v, p95Latency: !v.p95Latency }))
            }
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: 'var(--chart-4)',
              }}
            />
            P95 Latency
          </button>
          <button
            type="button"
            className={`chart-legend-btn ${!visible.errorRate ? 'is-dimmed' : ''}`}
            onClick={() =>
              setVisible((v) => ({ ...v, errorRate: !v.errorRate }))
            }
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: 'var(--chart-5)',
              }}
            />
            Error %
          </button>
        </div>
      }
    >
      <div ref={ref} className="chart-container">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Multi-series throughput and latency chart"
          onMouseMove={(e) => {
            if (series.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = e.clientX - rect.left - pad.left;
            const ratio = Math.max(0, Math.min(1, relX / Math.max(1, plotW)));
            setHoverIdx(Math.round(ratio * (series.length - 1)));
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Left Axis Ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + t * plotH;
            const val = Math.round(maxThroughput * 1.12 * (1 - t));
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

          {/* SLA Target Threshold Line */}
          <line
            x1={pad.left}
            y1={slaTargetY}
            x2={pad.left + plotW}
            y2={slaTargetY}
            stroke="var(--status-healthy)"
            strokeWidth="1.2"
            strokeDasharray="5 4"
            opacity="0.7"
          />
          <text
            x={pad.left + plotW + 4}
            y={slaTargetY + 3}
            fontSize="9.5"
            fill="var(--status-healthy)"
            fontFamily="var(--font-mono)"
          >
            60ms SLA
          </text>

          {/* Throughput Area + Line */}
          {visible.throughput && throughputPts.length > 1 && (
            <>
              <path
                d={buildAreaPath(throughputPts, pad.top + plotH)}
                fill={`url(#${gradId})`}
              />
              <path
                d={buildSmoothPath(throughputPts)}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.2"
              />
            </>
          )}

          {/* Latency Line */}
          {visible.p95Latency && latencyPts.length > 1 && (
            <path
              d={buildSmoothPath(latencyPts)}
              fill="none"
              stroke="var(--chart-4)"
              strokeWidth="2"
            />
          )}

          {/* Error Rate Line */}
          {visible.errorRate && errorPts.length > 1 && (
            <path
              d={buildSmoothPath(errorPts)}
              fill="none"
              stroke="var(--chart-5)"
              strokeWidth="1.7"
              strokeDasharray="4 2"
            />
          )}

          {/* X-axis Labels */}
          {series.map((pt, idx) => {
            if (idx % 4 !== 0 && idx !== series.length - 1) return null;
            const x = throughputPts[idx]?.x ?? pad.left;
            return (
              <text
                key={`${pt.timestamp}-${idx}`}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Interactive Crosshair */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={hoveredX}
                y1={pad.top}
                x2={hoveredX}
                y2={pad.top + plotH}
                stroke="var(--text-secondary)"
                strokeDasharray="3 3"
              />
              {visible.throughput && throughputPts[hoverIdx] && (
                <circle
                  cx={hoveredX}
                  cy={throughputPts[hoverIdx]!.y}
                  r="4"
                  fill="var(--chart-1)"
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
              )}
              {visible.p95Latency && latencyPts[hoverIdx] && (
                <circle
                  cx={hoveredX}
                  cy={latencyPts[hoverIdx]!.y}
                  r="4"
                  fill="var(--chart-4)"
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
        </svg>

        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(width - 175, Math.max(8, hoveredX + 12)),
              top: 16,
            }}
          >
            <div className="mono" style={{ fontWeight: 700, marginBottom: 4 }}>
              Window {hoveredPoint.label}
            </div>
            <div>Throughput: {hoveredPoint.throughput.toLocaleString()} req/s</div>
            <div>P95 Latency: {hoveredPoint.p95Latency} ms</div>
            <div>Error Rate: {hoveredPoint.errorRate}%</div>
          </div>
        )}
      </div>
    </Card>
  );
}
