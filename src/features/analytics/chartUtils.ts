export interface Point2D {
  x: number;
  y: number;
}

export function linearScale(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

export function buildSmoothPath(points: readonly Point2D[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${first.x} ${first.y}`;

  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;
    const midX = ((p0.x + p1.x) / 2).toFixed(1);
    const midY = ((p0.y + p1.y) / 2).toFixed(1);
    d += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  if (last) {
    d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  }
  return d;
}

export function buildAreaPath(
  points: readonly Point2D[],
  baselineY: number
): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  const line = buildSmoothPath(points);
  return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export function formatCompact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}
