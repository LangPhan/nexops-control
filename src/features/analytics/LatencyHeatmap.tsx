import { useState } from 'react';
import { Card } from '../../shared/ui/Primitives';
import type { HeatmapCell } from '../../types/domain';

interface LatencyHeatmapProps {
  cells: readonly HeatmapCell[];
  services: readonly string[];
  buckets: readonly string[];
  selectedService: string | null;
  onSelectService: (service: string | null) => void;
}

function latencyToBg(ms: number): { bg: string; text: string } {
  if (ms >= 180) {
    return { bg: 'rgba(239, 68, 68, 0.72)', text: '#ffffff' };
  }
  if (ms >= 110) {
    return { bg: 'rgba(245, 158, 11, 0.65)', text: '#0f172a' };
  }
  if (ms >= 65) {
    return { bg: 'rgba(56, 189, 248, 0.42)', text: 'var(--text-primary)' };
  }
  return { bg: 'rgba(16, 185, 129, 0.34)', text: 'var(--text-primary)' };
}

export function LatencyHeatmap({
  cells,
  services,
  buckets,
  selectedService,
  onSelectService,
}: LatencyHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  return (
    <Card
      title="Service × Time Latency Heatmap"
      subtitle="Click any service cell to cross-filter the audit table below"
      actions={
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {hoveredCell
            ? `${hoveredCell.service} (${hoveredCell.bucketLabel}): ${hoveredCell.latencyMs}ms · ${hoveredCell.samples} req`
            : 'Hover cell for P95 details'}
        </span>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `140px repeat(${buckets.length}, minmax(30px, 1fr))`,
            minWidth: 520,
          }}
        >
          <div />
          {buckets.map((bucket) => (
            <div
              key={bucket}
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              {bucket}
            </div>
          ))}

          {services.map((service) => (
            <div key={service} style={{ display: 'contents' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  justifyContent: 'flex-start',
                  padding: '0 6px',
                  height: 28,
                  fontSize: 11,
                  fontWeight: selectedService === service ? 700 : 500,
                  color:
                    selectedService === service
                      ? 'var(--accent-primary)'
                      : 'var(--text-primary)',
                }}
                onClick={() =>
                  onSelectService(selectedService === service ? null : service)
                }
              >
                {service}
              </button>

              {buckets.map((bucketLabel, bIdx) => {
                const cell = cells.find(
                  (c) => c.service === service && c.bucketIndex === bIdx
                );
                if (!cell) return <div key={`${service}-${bucketLabel}`} />;
                const tone = latencyToBg(cell.latencyMs);
                const isSelected = selectedService === service;

                return (
                  <button
                    key={`${service}-${bucketLabel}`}
                    type="button"
                    className={`heatmap-cell ${isSelected ? 'is-selected' : ''}`}
                    style={{ background: tone.bg, color: tone.text }}
                    aria-label={`${service} ${bucketLabel}: ${cell.latencyMs} milliseconds`}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() =>
                      onSelectService(
                        selectedService === service ? null : service
                      )
                    }
                  >
                    {cell.latencyMs}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 12,
          fontSize: 11,
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <span>Scale:</span>
        <span>&lt;65ms Optimal (Green)</span>
        <span>65–109ms Nominal (Blue)</span>
        <span>110–179ms Tail Warning (Amber)</span>
        <span>≥180ms Critical (Red)</span>
      </div>
    </Card>
  );
}
