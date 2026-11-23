import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Cpu,
  Grid,
  Maximize2,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { queryKeys } from '../../lib/queryKeys';
import { fetchTopology } from '../../services/mockApi';
import { Badge, Button, Card, Select } from '../../shared/ui/Primitives';
import { StatusIcon } from '../../shared/ui/StatusIcon';
import { useContainerSize } from '../../shared/ui/useContainerSize';
import type { EdgeNode, NodeStatus } from '../../types/domain';
import {
  buildStatusSprites,
  renderTopologyFrame,
  type CameraState,
  type SpriteAtlas,
} from './canvasRenderer';
import { SpatialGrid } from './spatialGrid';

interface HudTelemetry {
  fps: number;
  frameMs: number;
  renderedNodes: number;
  totalNodes: number;
  culledPct: number;
  hitTestUs: number;
  occupiedCells: number;
}

interface HoveredTooltip {
  node: EdgeNode;
  screenX: number;
  screenY: number;
}

const NODE_SCALE_OPTIONS = [
  { value: '250', label: '250 nodes' },
  { value: '1000', label: '1,000 nodes' },
  { value: '2500', label: '2,500 nodes' },
  { value: '5000', label: '5,000 nodes (Stress)' },
] as const;

const STATUS_FILTERS: readonly ('all' | NodeStatus)[] = [
  'all',
  'healthy',
  'degraded',
  'critical',
  'recovering',
  'maintenance',
];

export function CanvasMapPage() {
  const { workspace, theme, selectedNode, setSelectedNode } = useAppContext();
  const [nodeScale, setNodeScale] = useState<'250' | '1000' | '2500' | '5000'>(
    '2500'
  );
  const [optimized, setOptimized] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [animateTraffic, setAnimateTraffic] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | NodeStatus>('all');
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltip | null>(
    null
  );

  const [hud, setHud] = useState<HudTelemetry>({
    fps: 60,
    frameMs: 0.4,
    renderedNodes: 0,
    totalNodes: 0,
    culledPct: 0,
    hitTestUs: 0,
    occupiedCells: 0,
  });

  const nodeCount = Number(nodeScale);
  const topologyQuery = useQuery({
    queryKey: queryKeys.topology(workspace, nodeCount),
    queryFn: ({ signal }) => fetchTopology(workspace, nodeCount, signal),
    placeholderData: keepPreviousData,
  });

  const { ref: containerRef, width: boxWidth, height: boxHeight } =
    useContainerSize(960, 540);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const spatialGrid = useMemo(() => new SpatialGrid(160), []);
  const spritesRef = useRef<SpriteAtlas | null>(null);

  const cameraRef = useRef<CameraState>({
    offsetX: 480,
    offsetY: 270,
    zoom: 0.42,
  });

  const interactionRef = useRef<{
    dragging: boolean;
    movedDistance: number;
    lastX: number;
    lastY: number;
    hoveredNodeId: string | null;
    hitTestUs: number;
  }>({
    dragging: false,
    movedDistance: 0,
    lastX: 0,
    lastY: 0,
    hoveredNodeId: null,
    hitTestUs: 0,
  });

  // Keep latest render flags in refs so rAF loop stays allocation-free
  const renderParamsRef = useRef({
    theme,
    optimized,
    showGrid,
    animateTraffic,
    statusFilter,
    selectedNodeId: selectedNode?.id ?? null,
    width: boxWidth,
    height: boxHeight,
  });

  renderParamsRef.current = {
    theme,
    optimized,
    showGrid,
    animateTraffic,
    statusFilter,
    selectedNodeId: selectedNode?.id ?? null,
    width: boxWidth,
    height: boxHeight,
  };

  // Rebuild Spatial Grid whenever topology dataset updates
  useEffect(() => {
    const nodes = topologyQuery.data?.nodes;
    if (!nodes) return;
    spatialGrid.rebuild(nodes);
  }, [topologyQuery.data?.nodes, spatialGrid]);

  // Fit view to container dimensions when workspace or container initially settles
  const fitView = useCallback(() => {
    const w = Math.max(320, renderParamsRef.current.width);
    const h = Math.max(260, renderParamsRef.current.height);
    const fitZoom = Math.max(0.24, Math.min(0.65, Math.min(w / 2450, h / 1350)));
    cameraRef.current = {
      offsetX: w / 2,
      offsetY: h / 2,
      zoom: fitZoom,
    };
  }, []);

  useEffect(() => {
    fitView();
  }, [fitView, workspace]);

  // Build HiDPI sprite cache once per DPR
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    spritesRef.current = buildStatusSprites(dpr);
  }, []);

  // Main 60fps requestAnimationFrame loop + throttled HUD stats (~250ms)
  useEffect(() => {
    let rafId = 0;
    let frameCounter = 0;
    let accumRenderMs = 0;
    let lastHudUpdate = performance.now();

    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const data = topologyQuery.data;
      if (canvas && data) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const {
          width,
          height,
          theme: curTheme,
          optimized: isOpt,
          showGrid: gridOn,
          animateTraffic: animOn,
          statusFilter: filter,
          selectedNodeId,
        } = renderParamsRef.current;

        const targetW = Math.max(1, Math.round(width * dpr));
        const targetH = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const metrics = renderTopologyFrame(ctx, {
            width,
            height,
            dpr,
            theme: curTheme,
            nodes: data.nodes,
            links: data.links,
            grid: spatialGrid,
            camera: cameraRef.current,
            optimized: isOpt,
            showGrid: gridOn,
            animateTraffic: animOn,
            statusFilter: filter,
            hoveredNodeId: interactionRef.current.hoveredNodeId,
            selectedNodeId,
            timeMs: now,
            sprites: spritesRef.current,
          });

          frameCounter++;
          accumRenderMs += metrics.renderMs;

          if (now - lastHudUpdate >= 260) {
            const elapsedSec = (now - lastHudUpdate) / 1000;
            const fps = Math.min(
              144,
              Math.max(1, Math.round(frameCounter / Math.max(0.01, elapsedSec)))
            );
            const avgMs = Number(
              (accumRenderMs / Math.max(1, frameCounter)).toFixed(2)
            );
            const gridMetrics = spatialGrid.getGridMetrics();

            setHud({
              fps,
              frameMs: avgMs,
              renderedNodes: metrics.renderedNodes,
              totalNodes: metrics.totalNodes,
              culledPct: metrics.culledPct,
              hitTestUs: interactionRef.current.hitTestUs,
              occupiedCells: gridMetrics.occupiedCells,
            });

            frameCounter = 0;
            accumRenderMs = 0;
            lastHudUpdate = now;
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [topologyQuery.data, spatialGrid]);

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const cx =
      clientX !== undefined && rect ? clientX - rect.left : boxWidth / 2;
    const cy =
      clientY !== undefined && rect ? clientY - rect.top : boxHeight / 2;

    const worldX = (cx - cam.offsetX) / cam.zoom;
    const worldY = (cy - cam.offsetY) / cam.zoom;
    const nextZoom = Math.max(0.14, Math.min(3.5, cam.zoom * factor));

    cameraRef.current = {
      zoom: nextZoom,
      offsetX: cx - worldX * nextZoom,
      offsetY: cy - worldY * nextZoom,
    };
  };

  const performHitTest = (screenX: number, screenY: number): EdgeNode | null => {
    const data = topologyQuery.data;
    if (!data) return null;

    const cam = cameraRef.current;
    const worldX = (screenX - cam.offsetX) / cam.zoom;
    const worldY = (screenY - cam.offsetY) / cam.zoom;
    const maxRadius = Math.max(12, 16 / cam.zoom);

    const t0 = performance.now();
    let hit: EdgeNode | null = null;

    if (optimized) {
      hit = spatialGrid.findNearest(worldX, worldY, maxRadius);
    } else {
      // Naive O(N) linear scan
      let bestSq = maxRadius * maxRadius;
      for (let i = 0; i < data.nodes.length; i++) {
        const n = data.nodes[i];
        if (!n) continue;
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        const sq = dx * dx + dy * dy;
        if (sq <= bestSq) {
          bestSq = sq;
          hit = n;
        }
      }
    }

    if (hit && statusFilter !== 'all' && hit.status !== statusFilter) {
      hit = null;
    }

    interactionRef.current.hitTestUs = Math.max(
      1,
      Math.round((performance.now() - t0) * 1000)
    );
    return hit;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Interactive HTML5 Canvas Network Topology
          </h1>
          <p className="page-subtitle">
            Spatial Hash Grid O(1) hit-testing, viewport frustum culling,
            offscreen sprite atlas, and live Optimized vs Naive benchmark
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            ariaLabel="Topology node scale"
            value={nodeScale}
            options={NODE_SCALE_OPTIONS}
            onChange={(v) =>
              setNodeScale(v as '250' | '1000' | '2500' | '5000')
            }
          />
          <Button
            size="sm"
            variant={optimized ? 'primary' : 'danger'}
            icon={<Zap size={13} />}
            onClick={() => setOptimized((o) => !o)}
          >
            {optimized ? 'Mode: Optimized' : 'Mode: Naive (Unoptimized)'}
          </Button>
          <Button
            size="sm"
            variant={showGrid ? 'primary' : 'secondary'}
            icon={<Grid size={13} />}
            onClick={() => setShowGrid((g) => !g)}
          >
            Spatial Grid
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={animateTraffic ? <Pause size={13} /> : <Play size={13} />}
            onClick={() => setAnimateTraffic((a) => !a)}
          >
            {animateTraffic ? 'Traffic On' : 'Traffic Paused'}
          </Button>
        </div>
      </div>

      <Card compact>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Drag to pan · Scroll to zoom · Click any node to mutate via TanStack Query
          </span>
        </div>

        <div ref={containerRef} className="canvas-shell">
          <canvas
            ref={canvasRef}
            className="canvas-element"
            aria-label="Interactive Canvas Topology Map"
            onWheel={(e) => {
              e.preventDefault();
              zoomAt(e.deltaY < 0 ? 1.14 : 0.88, e.clientX, e.clientY);
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              interactionRef.current.dragging = true;
              interactionRef.current.movedDistance = 0;
              interactionRef.current.lastX = e.clientX;
              interactionRef.current.lastY = e.clientY;
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const sx = e.clientX - rect.left;
              const sy = e.clientY - rect.top;

              if (interactionRef.current.dragging) {
                const dx = e.clientX - interactionRef.current.lastX;
                const dy = e.clientY - interactionRef.current.lastY;
                interactionRef.current.movedDistance +=
                  Math.abs(dx) + Math.abs(dy);
                interactionRef.current.lastX = e.clientX;
                interactionRef.current.lastY = e.clientY;
                cameraRef.current.offsetX += dx;
                cameraRef.current.offsetY += dy;
                return;
              }

              const hit = performHitTest(sx, sy);
              interactionRef.current.hoveredNodeId = hit ? hit.id : null;
              e.currentTarget.style.cursor = hit ? 'pointer' : 'grab';

              if (hit) {
                setHoveredTooltip({
                  node: hit,
                  screenX: Math.min(boxWidth - 210, Math.max(12, sx + 14)),
                  screenY: Math.min(boxHeight - 110, Math.max(12, sy - 14)),
                });
              } else {
                setHoveredTooltip(null);
              }
            }}
            onPointerUp={(e) => {
              const wasDrag = interactionRef.current.movedDistance > 6;
              interactionRef.current.dragging = false;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              if (!wasDrag) {
                const rect = e.currentTarget.getBoundingClientRect();
                const hit = performHitTest(
                  e.clientX - rect.left,
                  e.clientY - rect.top
                );
                if (hit) {
                  setSelectedNode({ id: hit.id, source: 'canvas' });
                }
              }
            }}
            onPointerLeave={() => {
              interactionRef.current.dragging = false;
              interactionRef.current.hoveredNodeId = null;
              setHoveredTooltip(null);
            }}
          />

          {/* Floating Performance Telemetry HUD */}
          <div className="canvas-hud">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Cpu size={13} color="var(--accent-primary)" />
                RENDER TELEMETRY HUD
              </span>
              <Badge variant={optimized ? 'healthy' : 'critical'}>
                {optimized ? 'OPTIMIZED' : 'NAIVE'}
              </Badge>
            </div>

            <div className="canvas-hud-grid mono tabular">
              <div>
                <div style={{ color: 'var(--text-muted)' }}>FPS</div>
                <strong
                  style={{
                    fontSize: 14,
                    color:
                      hud.fps >= 50
                        ? 'var(--status-healthy)'
                        : hud.fps >= 30
                        ? 'var(--status-degraded)'
                        : 'var(--status-critical)',
                  }}
                >
                  {hud.fps} fps
                </strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Frame Draw</div>
                <strong style={{ fontSize: 14 }}>{hud.frameMs} ms</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Visible / Total</div>
                <strong>
                  {hud.renderedNodes.toLocaleString()} /{' '}
                  {hud.totalNodes.toLocaleString()}
                </strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Frustum Culled</div>
                <strong>{hud.culledPct}%</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Hit-Test</div>
                <strong>{hud.hitTestUs} µs</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Grid Cells</div>
                <strong>{hud.occupiedCells}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              <Badge variant="neutral">HiDPI</Badge>
              {optimized && (
                <>
                  <Badge variant="info">Frustum Culling</Badge>
                  <Badge variant="info">Spatial Hash</Badge>
                  <Badge variant="info">Sprite Cache</Badge>
                </>
              )}
            </div>
          </div>

          {/* Floating Node Hover Tooltip */}
          {hoveredTooltip && (
            <div
              className="canvas-tooltip"
              style={{
                left: hoveredTooltip.screenX,
                top: hoveredTooltip.screenY,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <strong className="mono" style={{ fontSize: 11 }}>
                  {hoveredTooltip.node.label}
                </strong>
                <StatusIcon
                  status={hoveredTooltip.node.status}
                  size={14}
                  decorative
                />
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                {hoveredTooltip.node.service} · {hoveredTooltip.node.region}
              </div>
              <div className="mono" style={{ fontSize: 11, marginTop: 4 }}>
                {hoveredTooltip.node.latencyMs}ms · CPU {hoveredTooltip.node.cpuPct}%
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--accent-primary)',
                  marginTop: 4,
                }}
              >
                Click node to inspect &amp; mutate
              </div>
            </div>
          )}

          {/* Bottom-right Zoom & Fit Controls */}
          <div className="canvas-controls-overlay">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Zoom in"
              onClick={() => zoomAt(1.22)}
            >
              <ZoomIn size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Zoom out"
              onClick={() => zoomAt(0.82)}
            >
              <ZoomOut size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Fit topology to view"
              onClick={fitView}
            >
              <Maximize2 size={14} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
