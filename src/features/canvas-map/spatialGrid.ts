import type { EdgeNode } from '../../types/domain';

export interface SpatialGridMetrics {
  cellSize: number;
  occupiedCells: number;
  totalIndexed: number;
}

export class SpatialGrid {
  readonly cellSize: number;
  private buckets = new Map<string, EdgeNode[]>();
  private totalIndexed = 0;

  constructor(cellSize = 160) {
    this.cellSize = Math.max(32, cellSize);
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  rebuild(nodes: readonly EdgeNode[]): void {
    this.buckets.clear();
    this.totalIndexed = nodes.length;
    const inv = 1 / this.cellSize;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      const cx = Math.floor(node.x * inv);
      const cy = Math.floor(node.y * inv);
      const k = this.key(cx, cy);
      const list = this.buckets.get(k);
      if (list) {
        list.push(node);
      } else {
        this.buckets.set(k, [node]);
      }
    }
  }

  queryViewport(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): EdgeNode[] {
    const inv = 1 / this.cellSize;
    const startX = Math.floor(minX * inv);
    const endX = Math.floor(maxX * inv);
    const startY = Math.floor(minY * inv);
    const endY = Math.floor(maxY * inv);

    const results: EdgeNode[] = [];
    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const list = this.buckets.get(this.key(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const node = list[i];
          if (
            node &&
            node.x >= minX &&
            node.x <= maxX &&
            node.y >= minY &&
            node.y <= maxY
          ) {
            results.push(node);
          }
        }
      }
    }
    return results;
  }

  findNearest(
    worldX: number,
    worldY: number,
    maxRadius: number
  ): EdgeNode | null {
    const inv = 1 / this.cellSize;
    const minCx = Math.floor((worldX - maxRadius) * inv);
    const maxCx = Math.floor((worldX + maxRadius) * inv);
    const minCy = Math.floor((worldY - maxRadius) * inv);
    const maxCy = Math.floor((worldY + maxRadius) * inv);

    let bestNode: EdgeNode | null = null;
    let bestDistSq = maxRadius * maxRadius;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = this.buckets.get(this.key(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const node = list[i];
          if (!node) continue;
          const dx = node.x - worldX;
          const dy = node.y - worldY;
          const distSq = dx * dx + dy * dy;
          if (distSq <= bestDistSq) {
            bestDistSq = distSq;
            bestNode = node;
          }
        }
      }
    }

    return bestNode;
  }

  getGridMetrics(): SpatialGridMetrics {
    return {
      cellSize: this.cellSize,
      occupiedCells: this.buckets.size,
      totalIndexed: this.totalIndexed,
    };
  }
}
