import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { queryKeys } from '../lib/queryKeys';
import { findNodeSnapshot, mutateNodeAction } from '../services/mockApi';
import { Badge, Button } from '../shared/ui/Primitives';
import { Drawer } from '../shared/ui/Drawer';
import { StatusIcon } from '../shared/ui/StatusIcon';
import { useToast } from '../shared/ui/ToastProvider';
import type {
  NodeAction,
  NodeStatus,
  OverviewSnapshot,
  TopologySnapshot,
} from '../types/domain';

function nextOptimisticStatus(
  current: NodeStatus,
  action: NodeAction
): NodeStatus {
  switch (action) {
    case 'restart':
      return 'recovering';
    case 'scale_up':
      return current;
    case 'toggle_maintenance':
      return current === 'maintenance' ? 'healthy' : 'maintenance';
    case 'inject_fault':
      return 'critical';
    case 'recover':
      return 'healthy';
  }
}

export function NodeInspectorDrawer() {
  const { workspace, timeRange, selectedNode, setSelectedNode } =
    useAppContext();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const snapshot = selectedNode
    ? findNodeSnapshot(workspace, selectedNode.id)
    : null;

  const mutation = useMutation({
    mutationFn: ({ nodeId, action }: { nodeId: string; action: NodeAction }) =>
      mutateNodeAction(workspace, nodeId, action),
    onMutate: async ({ nodeId, action }) => {
      const overviewKey = queryKeys.overview(workspace, timeRange);
      const topoPrefix = ['nexops', 'topology', workspace] as const;

      await queryClient.cancelQueries({ queryKey: overviewKey });
      await queryClient.cancelQueries({ queryKey: topoPrefix });

      const prevOverview =
        queryClient.getQueryData<OverviewSnapshot>(overviewKey);
      const prevTopos = queryClient.getQueriesData<TopologySnapshot>({
        queryKey: topoPrefix,
      });

      if (prevOverview) {
        queryClient.setQueryData<OverviewSnapshot>(overviewKey, {
          ...prevOverview,
          stages: prevOverview.stages.map((s) => {
            if (s.id !== nodeId) return s;
            return {
              ...s,
              status: nextOptimisticStatus(s.status, action),
              replicas: action === 'scale_up' ? s.replicas + 1 : s.replicas,
            };
          }),
        });
      }

      queryClient.setQueriesData<TopologySnapshot>(
        { queryKey: topoPrefix },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            nodes: old.nodes.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                status: nextOptimisticStatus(n.status, action),
                replicas: action === 'scale_up' ? n.replicas + 1 : n.replicas,
              };
            }),
          };
        }
      );

      return { prevOverview, overviewKey, prevTopos };
    },
    onError: (err, variables, ctx) => {
      if (ctx?.prevOverview) {
        queryClient.setQueryData(ctx.overviewKey, ctx.prevOverview);
      }
      if (ctx?.prevTopos) {
        for (const [key, data] of ctx.prevTopos) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({
        type: 'error',
        title: `Node action "${variables.action}" rolled back`,
        description: err instanceof Error ? err.message : 'RPC error',
        action: {
          label: 'Retry',
          onClick: () => mutation.mutate(variables),
        },
      });
    },
    onSuccess: (res) => {
      pushToast({
        type: 'success',
        title: `${res.nodeId} updated (${res.status})`,
        description: `Replicas: ${res.replicas} · Latency: ${res.latencyMs}ms`,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.overview(workspace, timeRange),
      });
      void queryClient.invalidateQueries({
        queryKey: ['nexops', 'topology', workspace],
      });
    },
  });

  const isStage = snapshot !== null && 'name' in snapshot;
  const title = snapshot
    ? isStage
      ? snapshot.name
      : snapshot.label
    : 'Node Inspector';

  return (
    <Drawer
      open={Boolean(selectedNode)}
      onClose={() => setSelectedNode(null)}
      title={title}
      subtitle={
        selectedNode
          ? `${selectedNode.source.toUpperCase()} · ${selectedNode.id}`
          : undefined
      }
    >
      {snapshot && selectedNode ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusIcon status={snapshot.status} size={26} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {snapshot.region} ·{' '}
                  {isStage ? snapshot.role : snapshot.service}
                </div>
              </div>
            </div>
            <Badge variant={snapshot.status}>{snapshot.status}</Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            <div className="kpi-card">
              <span className="kpi-label">Throughput</span>
              <strong className="mono tabular" style={{ fontSize: 18 }}>
                {snapshot.throughputRps.toLocaleString()} req/s
              </strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Latency (P95)</span>
              <strong className="mono tabular" style={{ fontSize: 18 }}>
                {snapshot.latencyMs} ms
              </strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">CPU Saturation</span>
              <strong className="mono tabular" style={{ fontSize: 18 }}>
                {snapshot.cpuPct}%
              </strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Active Replicas</span>
              <strong className="mono tabular" style={{ fontSize: 18 }}>
                {snapshot.replicas} pods
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <strong style={{ fontSize: 13 }}>
              Optimistic Node Control Actions
            </strong>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Updates TanStack Query caches immediately across Overview SVG &amp;
              Canvas Topology, with automatic rollback if Chaos Error Rate rejects.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} />}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    nodeId: selectedNode.id,
                    action: 'restart',
                  })
                }
              >
                Graceful Rolling Restart
              </Button>
              <Button
                variant="secondary"
                icon={<ArrowUpCircle size={14} />}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    nodeId: selectedNode.id,
                    action: 'scale_up',
                  })
                }
              >
                Scale +1 Replica Pod
              </Button>
              <Button
                variant="secondary"
                icon={<PauseCircle size={14} />}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    nodeId: selectedNode.id,
                    action: 'toggle_maintenance',
                  })
                }
              >
                {snapshot.status === 'maintenance'
                  ? 'Exit Maintenance Mode'
                  : 'Enter Maintenance Mode'}
              </Button>
              <Button
                variant="danger"
                icon={<AlertTriangle size={14} />}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    nodeId: selectedNode.id,
                    action: 'inject_fault',
                  })
                }
              >
                Inject Critical Fault
              </Button>
              <Button
                variant="primary"
                icon={<ShieldCheck size={14} />}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    nodeId: selectedNode.id,
                    action: 'recover',
                  })
                }
              >
                Restore Healthy State
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} />
          <span>Select a node on the SVG pipeline or Canvas topology.</span>
        </div>
      )}
    </Drawer>
  );
}
