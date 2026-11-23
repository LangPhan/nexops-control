import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../features/canvas-map/spatialGrid';
import type { EdgeNode } from '../types/domain';

function makeNode(id: string, x: number, y: number): EdgeNode {
  return {
    id,
    label: id,
    region: 'APAC-SG',
    cluster: 'Cluster-Alpha',
    service: 'Ingest Gateway',
    x,
    y,
    status: 'healthy',
    latencyMs: 22,
    throughputRps: 500,
    cpuPct: 40,
    replicas: 2,
    isHub: false,
  };
}

describe('SpatialGrid', () => {
  it('indexes nodes and culls out-of-viewport nodes accurately', () => {
    const grid = new SpatialGrid(160);
    const nodes = [
      makeNode('inside-1', 40, 50),
      makeNode('inside-2', 180, 140),
      makeNode('outside-right', 900, 100),
      makeNode('outside-negative', -500, -400),
    ];

    grid.rebuild(nodes);
    const metrics = grid.getGridMetrics();
    expect(metrics.totalIndexed).toBe(4);
    expect(metrics.occupiedCells).toBeGreaterThanOrEqual(3);

    const visible = grid.queryViewport(0, 0, 250, 200);
    const visibleIds = visible.map((n) => n.id);
    expect(visibleIds).toContain('inside-1');
    expect(visibleIds).toContain('inside-2');
    expect(visibleIds).not.toContain('outside-right');
    expect(visibleIds).not.toContain('outside-negative');
  });

  it('finds the nearest node in O(1) cell lookup and respects maxRadius', () => {
    const grid = new SpatialGrid(160);
    const nodes = [
      makeNode('far', 400, 400),
      makeNode('target', 120, 130),
      makeNode('neighbor', 142, 132),
    ];

    grid.rebuild(nodes);

    const hit = grid.findNearest(123, 129, 24);
    expect(hit?.id).toBe('target');

    const miss = grid.findNearest(-200, -200, 25);
    expect(miss).toBeNull();
  });
});
