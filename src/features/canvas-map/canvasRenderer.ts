import type { EdgeLink, EdgeNode, NodeStatus } from '../../types/domain';
import type { SpatialGrid } from './spatialGrid';

export interface CameraState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface RenderFrameParams {
  width: number;
  height: number;
  dpr: number;
  theme: 'dark' | 'light';
  nodes: readonly EdgeNode[];
  links: readonly EdgeLink[];
  grid: SpatialGrid;
  camera: CameraState;
  optimized: boolean;
  showGrid: boolean;
  animateTraffic: boolean;
  statusFilter: 'all' | NodeStatus;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  timeMs: number;
  sprites: SpriteAtlas | null;
}

export interface FrameMetrics {
  renderedNodes: number;
  totalNodes: number;
  renderedLinks: number;
  totalLinks: number;
  culledPct: number;
  renderMs: number;
}

const STATUS_HEX: Record<NodeStatus, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  critical: '#ef4444',
  maintenance: '#64748b',
  recovering: '#38bdf8',
};

export interface SpriteEntry {
  canvas: HTMLCanvasElement;
  logicalSize: number;
}

export type SpriteAtlas = Record<NodeStatus, SpriteEntry>;

export function buildStatusSprites(dpr: number): SpriteAtlas | null {
  if (typeof document === 'undefined') return null;

  const statuses: NodeStatus[] = [
    'healthy',
    'degraded',
    'critical',
    'maintenance',
    'recovering',
  ];
  const logicalSize = 24;
  const pxSize = Math.max(24, Math.round(logicalSize * dpr));
  const atlas = {} as SpriteAtlas;

  for (const status of statuses) {
    const offscreen = document.createElement('canvas');
    offscreen.width = pxSize;
    offscreen.height = pxSize;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.scale(dpr, dpr);
    const center = logicalSize / 2;
    const color = STATUS_HEX[status];

    // Soft outer glow halo
    const grad = octx.createRadialGradient(
      center,
      center,
      2,
      center,
      center,
      10
    );
    grad.addColorStop(0, `${color}88`);
    grad.addColorStop(1, `${color}00`);
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(center, center, 10, 0, Math.PI * 2);
    octx.fill();

    // Core crisp node disc
    octx.fillStyle = color;
    octx.beginPath();
    octx.arc(center, center, 4.6, 0, Math.PI * 2);
    octx.fill();

    // Inner specular highlight
    octx.fillStyle = '#ffffffaa';
    octx.beginPath();
    octx.arc(center - 1.3, center - 1.3, 1.4, 0, Math.PI * 2);
    octx.fill();

    atlas[status] = { canvas: offscreen, logicalSize };
  }

  return atlas;
}

export function renderTopologyFrame(
  ctx: CanvasRenderingContext2D,
  params: RenderFrameParams
): FrameMetrics {
  const startMs = performance.now();
  const {
    width,
    height,
    dpr,
    theme,
    nodes,
    links,
    grid,
    camera,
    optimized,
    showGrid,
    animateTraffic,
    statusFilter,
    hoveredNodeId,
    selectedNodeId,
    timeMs,
    sprites,
  } = params;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Clear background
  ctx.fillStyle = theme === 'dark' ? '#070c16' : '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // World viewport bounds with generous padding so sprites near edge never pop
  const invZoom = 1 / camera.zoom;
  const padWorld = 80 * invZoom;
  const minX = (0 - camera.offsetX) * invZoom - padWorld;
  const minY = (0 - camera.offsetY) * invZoom - padWorld;
  const maxX = (width - camera.offsetX) * invZoom + padWorld;
  const maxY = (height - camera.offsetY) * invZoom + padWorld;

  ctx.translate(camera.offsetX, camera.offsetY);
  ctx.scale(camera.zoom, camera.zoom);

  // Optional Spatial Hash Grid debug overlay
  if (showGrid) {
    const cell = grid.cellSize;
    const gxStart = Math.floor(minX / cell) * cell;
    const gyStart = Math.floor(minY / cell) * cell;
    ctx.strokeStyle =
      theme === 'dark'
        ? 'rgba(34, 211, 238, 0.14)'
        : 'rgba(2, 132, 199, 0.16)';
    ctx.lineWidth = Math.max(0.5, 1 * invZoom);
    ctx.beginPath();
    for (let gx = gxStart; gx <= maxX; gx += cell) {
      ctx.moveTo(gx, minY);
      ctx.lineTo(gx, maxY);
    }
    for (let gy = gyStart; gy <= maxY; gy += cell) {
      ctx.moveTo(minX, gy);
      ctx.lineTo(maxX, gy);
    }
    ctx.stroke();
  }

  const visibleNodes = optimized
    ? grid.queryViewport(minX, minY, maxX, maxY)
    : nodes;

  const filteredNodes =
    statusFilter === 'all'
      ? visibleNodes
      : visibleNodes.filter((n) => n.status === statusFilter);

  const visibleIdSet = optimized
    ? new Set(filteredNodes.map((n) => n.id))
    : null;

  let renderedLinks = 0;

  // Draw links (in Optimized mode, skip micro-links when heavily zoomed out unless hub-to-hub)
  const drawWorkerLinks = !optimized || camera.zoom >= 0.34;
  ctx.lineWidth = Math.max(0.6, 1.1 * invZoom);
  ctx.strokeStyle =
    theme === 'dark'
      ? 'rgba(148, 163, 184, 0.16)'
      : 'rgba(71, 85, 105, 0.18)';

  if (optimized) {
    ctx.beginPath();
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link) continue;
      const src = nodes[link.sourceIdx];
      const dst = nodes[link.targetIdx];
      if (!src || !dst) continue;
      if (!drawWorkerLinks && !(src.isHub && dst.isHub)) continue;
      if (
        visibleIdSet &&
        !visibleIdSet.has(src.id) &&
        !visibleIdSet.has(dst.id)
      ) {
        continue;
      }
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      renderedLinks++;
    }
    ctx.stroke();
  } else {
    // Naive unbatched individual stroke path per link
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link) continue;
      const src = nodes[link.sourceIdx];
      const dst = nodes[link.targetIdx];
      if (!src || !dst) continue;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.stroke();
      renderedLinks++;
    }
  }

  // Highlight links connected to hovered or selected node
  const focusId = hoveredNodeId ?? selectedNodeId;
  if (focusId) {
    ctx.strokeStyle = theme === 'dark' ? '#22d3ee' : '#0284c7';
    ctx.lineWidth = Math.max(1.2, 2.2 * invZoom);
    ctx.beginPath();
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link) continue;
      const src = nodes[link.sourceIdx];
      const dst = nodes[link.targetIdx];
      if (!src || !dst) continue;
      if (src.id === focusId || dst.id === focusId) {
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dst.x, dst.y);
      }
    }
    ctx.stroke();
  }

  // Animated traffic packets along a capped subset of visible backbone/active links
  if (animateTraffic) {
    const packetPhase = (timeMs * 0.00055) % 1;
    const step = optimized ? Math.max(1, Math.floor(links.length / 180)) : 1;
    ctx.fillStyle = theme === 'dark' ? '#22d3ee' : '#0284c7';
    ctx.beginPath();
    for (let i = 0; i < links.length; i += step) {
      const link = links[i];
      if (!link) continue;
      const src = nodes[link.sourceIdx];
      const dst = nodes[link.targetIdx];
      if (!src || !dst) continue;
      if (
        optimized &&
        (src.x < minX || src.x > maxX || src.y < minY || src.y > maxY) &&
        (dst.x < minX || dst.x > maxX || dst.y < minY || dst.y > maxY)
      ) {
        continue;
      }
      const t = (packetPhase + (i % 13) * 0.077) % 1;
      const px = src.x + (dst.x - src.x) * t;
      const py = src.y + (dst.y - src.y) * t;
      const r = Math.max(1.5, 2.2 * invZoom);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Render nodes
  let renderedNodes = 0;
  for (let i = 0; i < filteredNodes.length; i++) {
    const node = filteredNodes[i];
    if (!node) continue;
    renderedNodes++;

    const sprite = optimized && sprites ? sprites[node.status] : null;
    const scale = node.isHub ? 1.45 : 1;

    if (sprite) {
      const drawSize = sprite.logicalSize * scale * Math.max(0.55, Math.min(1.25, invZoom * 0.75 + 0.45));
      ctx.drawImage(
        sprite.canvas,
        node.x - drawSize / 2,
        node.y - drawSize / 2,
        drawSize,
        drawSize
      );
    } else {
      // Naive per-node shadow + arc path rendering
      const r = (node.isHub ? 7 : 4.5) * Math.max(0.65, invZoom * 0.6 + 0.4);
      const color = STATUS_HEX[node.status];
      if (!optimized) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (!optimized) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Pulsing selection / hover ring
    if (node.id === selectedNodeId || node.id === hoveredNodeId) {
      const pulse = 1 + 0.16 * Math.sin(timeMs * 0.008);
      const ringR = (node.isHub ? 13 : 9) * pulse;
      ctx.strokeStyle =
        node.id === selectedNodeId ? '#22d3ee' : '#f8fafc';
      ctx.lineWidth = Math.max(1.4, 2 * invZoom);
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Level-of-detail (LOD) labels when zoomed in
    if (
      (node.isHub && camera.zoom >= 0.45) ||
      camera.zoom >= 1.25 ||
      node.id === hoveredNodeId ||
      node.id === selectedNodeId
    ) {
      ctx.font = `${node.isHub ? '600' : '500'} ${Math.max(9, Math.round(11 * invZoom))}px Inter, sans-serif`;
      ctx.fillStyle = theme === 'dark' ? '#e2e8f0' : '#0f172a';
      ctx.fillText(node.label, node.x + 10 * invZoom, node.y + 4 * invZoom);
    }
  }

  ctx.restore();

  const renderMs = performance.now() - startMs;
  const totalNodes = nodes.length;
  const culledPct =
    totalNodes > 0
      ? Math.max(0, Math.round(((totalNodes - renderedNodes) / totalNodes) * 100))
      : 0;

  return {
    renderedNodes,
    totalNodes,
    renderedLinks,
    totalLinks: links.length,
    culledPct,
    renderMs,
  };
}
