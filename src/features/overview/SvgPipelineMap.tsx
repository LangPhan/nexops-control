import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { queryKeys } from '../../lib/queryKeys';
import { mutateNodeAction } from '../../services/mockApi';
import { Badge, Button, Card } from '../../shared/ui/Primitives';
import { StatusIcon } from '../../shared/ui/StatusIcon';
import { useToast } from '../../shared/ui/ToastProvider';
import type {
  NodeAction,
  NodeStatus,
  OverviewSnapshot,
  PipelineStage,
} from '../../types/domain';

const STAGE_COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 96, y: 125 },
  { x: 274, y: 125 },
  { x: 452, y: 74 },
  { x: 634, y: 125 },
  { x: 452, y: 186 },
];

const CONNECTIONS: ReadonlyArray<{ from: number; to: number }> = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 1, to: 4 },
  { from: 3, to: 4 },
];

function statusStrokeColor(status: NodeStatus): string {
  switch (status) {
    case 'healthy':
      return 'var(--status-healthy)';
    case 'degraded':
      return 'var(--status-degraded)';
    case 'critical':
      return 'var(--status-critical)';
    case 'maintenance':
      return 'var(--status-maintenance)';
    case 'recovering':
      return 'var(--status-recovering)';
  }
}

export function SvgPipelineMap({ stages }: { stages: readonly PipelineStage[] }) {
  const { workspace, timeRange, setSelectedNode } = useAppContext();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const quickMutate = useMutation({
    mutationFn: ({ nodeId, action }: { nodeId: string; action: NodeAction }) =>
      mutateNodeAction(workspace, nodeId, action),
    onMutate: async ({ nodeId, action }) => {
      const key = queryKeys.overview(workspace, timeRange);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<OverviewSnapshot>(key);

      if (prev) {
        queryClient.setQueryData<OverviewSnapshot>(key, {
          ...prev,
          stages: prev.stages.map((s) => {
            if (s.id !== nodeId) return s;
            const nextStatus: NodeStatus =
              action === 'inject_fault'
                ? 'critical'
                : action === 'recover'
                ? 'healthy'
                : 'recovering';
            return {
              ...s,
              status: nextStatus,
              latencyMs: action === 'inject_fault' ? 215 : 26,
            };
          }),
        });
      }
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(ctx.key, ctx.prev);
      }
      pushToast({
        type: 'error',
        title: 'Pipeline mutation rolled back',
        description: err instanceof Error ? err.message : 'Network error',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.overview(workspace, timeRange),
      });
    },
  });

  const transformStage = stages[2];
  const hasFault = stages.some(
    (s) => s.status === 'critical' || s.status === 'degraded'
  );

  return (
    <Card
      title={
        <>
          <StatusIcon
            status={hasFault ? 'degraded' : 'healthy'}
            size={18}
            decorative
          />
          Dynamic SVG Pipeline State Map
        </>
      }
      subtitle="Animated SVG state rings, flow speed scaled by throughput, and click-to-mutate node inspector"
      actions={
        <>
          {transformStage && (
            <Button
              size="sm"
              variant={hasFault ? 'secondary' : 'danger'}
              loading={quickMutate.isPending}
              icon={
                hasFault ? (
                  <RotateCcw size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )
              }
              onClick={() =>
                quickMutate.mutate({
                  nodeId: transformStage.id,
                  action: hasFault ? 'recover' : 'inject_fault',
                })
              }
            >
              {hasFault ? 'Recover Pipeline' : 'Simulate Fault'}
            </Button>
          )}
        </>
      }
    >
      <div className="pipeline-svg-wrap">
        <svg
          viewBox="0 0 740 245"
          width="100%"
          height="240"
          role="img"
          aria-label="Interactive B2B 5-stage data pipeline topology"
        >
          <defs>
            <marker
              id="pipe-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--text-muted)" />
            </marker>
          </defs>

          {/* Subtle Blueprint Grid */}
          <g opacity="0.16" stroke="var(--border-strong)" strokeWidth="0.6">
            {[40, 100, 160, 220].map((y) => (
              <line key={y} x1="16" y1={y} x2="724" y2={y} />
            ))}
          </g>

          {/* Animated Bezier Connectors */}
          {CONNECTIONS.map(({ from, to }) => {
            const p1 = STAGE_COORDS[from];
            const p2 = STAGE_COORDS[to];
            const src = stages[from];
            if (!p1 || !p2 || !src) return null;

            const startX = p1.x + 64;
            const startY = p1.y;
            const endX = p2.x - 64;
            const endY = p2.y;
            const midX = (startX + endX) / 2;
            const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            const strokeColor = statusStrokeColor(src.status);
            const flowSpeed =
              src.status === 'critical'
                ? '2.2s'
                : src.status === 'maintenance'
                ? '0s'
                : src.throughputRps > 40000
                ? '0.65s'
                : '1.15s';

            return (
              <g key={`${from}-${to}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="2.5"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.4"
                  className={src.status === 'maintenance' ? '' : 'svg-flow-line'}
                  style={
                    src.status === 'maintenance'
                      ? { strokeDasharray: '3 6', opacity: 0.4 }
                      : { animationDuration: flowSpeed }
                  }
                  markerEnd="url(#pipe-arrow)"
                />
              </g>
            );
          })}

          {/* Interactive Stage Nodes */}
          {stages.map((stage, idx) => {
            const pos = STAGE_COORDS[idx];
            if (!pos) return null;
            const stroke = statusStrokeColor(stage.status);

            return (
              <g
                key={stage.id}
                className="pipeline-stage-group"
                transform={`translate(${pos.x}, ${pos.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${stage.name}: ${stage.status}, ${stage.latencyMs}ms`}
                onClick={() =>
                  setSelectedNode({ id: stage.id, source: 'pipeline' })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNode({ id: stage.id, source: 'pipeline' });
                  }
                }}
              >
                {/* Animated Outer Status Halo */}
                {(stage.status === 'healthy' ||
                  stage.status === 'critical') && (
                  <rect
                    x="-70"
                    y="-36"
                    width="140"
                    height="72"
                    rx="14"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="1.6"
                    opacity="0.4"
                    className="svg-pulse-ring"
                  />
                )}

                {/* Node Card */}
                <rect
                  x="-64"
                  y="-31"
                  width="128"
                  height="62"
                  rx="10"
                  fill="var(--bg-surface)"
                  stroke={stroke}
                  strokeWidth="1.6"
                  className="pipeline-node-box"
                />

                {/* Animated Vector Status Beacon */}
                <g transform="translate(-44, -10)">
                  <circle cx="0" cy="0" r="7" fill="var(--bg-elevated)" />
                  {stage.status === 'maintenance' ? (
                    <circle
                      cx="0"
                      cy="0"
                      r="4.5"
                      fill="none"
                      stroke={stroke}
                      strokeWidth="2"
                      strokeDasharray="3 2"
                      className="svg-spin-slow"
                    />
                  ) : stage.status === 'recovering' ? (
                    <path
                      d="M0 -5 A5 5 0 1 1 -4.8 1.5"
                      fill="none"
                      stroke={stroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="svg-spin-fast"
                    />
                  ) : (
                    <circle
                      cx="0"
                      cy="0"
                      r="4.2"
                      fill={stroke}
                      className={stage.status === 'critical' ? 'svg-blink' : ''}
                    />
                  )}
                </g>

                <text
                  x="-30"
                  y="-7"
                  fill="var(--text-primary)"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {stage.name}
                </text>

                <text
                  x="-52"
                  y="11"
                  fill="var(--text-secondary)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {(stage.throughputRps / 1000).toFixed(1)}k/s ·{' '}
                  {stage.latencyMs}ms
                </text>

                <text
                  x="-52"
                  y="24"
                  fill="var(--text-muted)"
                  fontSize="9.5"
                >
                  {stage.replicas} pods · {stage.status.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge variant="healthy">Healthy Flow</Badge>
          <Badge variant="degraded">Elevated Tail</Badge>
          <Badge variant="critical">Fault / Backpressure</Badge>
          <Badge variant="recovering">Recovering</Badge>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Click any SVG stage to inspect &amp; run optimistic mutations
        </span>
      </div>
    </Card>
  );
}
