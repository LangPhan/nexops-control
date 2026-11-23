import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import {
  Ban,
  Flame,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { JOB_TEMPLATES, useAppContext } from '../../context/AppContext';
import { queryKeys } from '../../lib/queryKeys';
import { mutateNodeAction } from '../../services/mockApi';
import { Badge, Button, Card } from '../../shared/ui/Primitives';
import { StatusIcon, type StatusIconVariant } from '../../shared/ui/StatusIcon';
import { useToast } from '../../shared/ui/ToastProvider';
import type { AsyncJobStatus, OverviewSnapshot } from '../../types/domain';

interface QueryInspectorRow {
  hash: string;
  keyLabel: string;
  status: string;
  fetchStatus: string;
  observers: number;
  updatedAt: string;
  queryKey: readonly unknown[];
}

function readCacheSnapshot(
  queries: readonly Query[]
): QueryInspectorRow[] {
  return queries.map((q) => ({
    hash: q.queryHash,
    keyLabel: JSON.stringify(q.queryKey),
    status: q.state.status,
    fetchStatus: q.state.fetchStatus,
    observers: q.getObserversCount(),
    updatedAt:
      q.state.dataUpdatedAt > 0
        ? new Date(q.state.dataUpdatedAt).toLocaleTimeString()
        : '—',
    queryKey: q.queryKey,
  }));
}

function jobBadge(status: AsyncJobStatus) {
  switch (status) {
    case 'running':
      return 'recovering' as const;
    case 'completed':
      return 'healthy' as const;
    case 'cancelled':
      return 'degraded' as const;
    case 'failed':
      return 'critical' as const;
  }
}

function jobIcon(status: AsyncJobStatus): StatusIconVariant {
  switch (status) {
    case 'running':
      return 'syncing';
    case 'completed':
      return 'healthy';
    case 'cancelled':
      return 'paused';
    case 'failed':
      return 'critical';
  }
}

export function AsyncOpsPage() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const {
    workspace,
    timeRange,
    chaosConfig,
    updateChaosConfig,
    jobs,
    launchJob,
    cancelJob,
    retryJob,
    clearCompletedJobs,
  } = useAppContext();

  const [cacheRows, setCacheRows] = useState<QueryInspectorRow[]>(() =>
    readCacheSnapshot(queryClient.getQueryCache().getAll())
  );

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    setCacheRows(readCacheSnapshot(cache.getAll()));
    const unsubscribe = cache.subscribe(() => {
      setCacheRows(readCacheSnapshot(cache.getAll()));
    });
    return () => unsubscribe();
  }, [queryClient]);

  const sandboxScaleMutation = useMutation({
    mutationFn: () => mutateNodeAction(workspace, 'stage-ingest', 'scale_up'),
    onMutate: async () => {
      const key = queryKeys.overview(workspace, timeRange);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<OverviewSnapshot>(key);
      if (prev) {
        queryClient.setQueryData<OverviewSnapshot>(key, {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === 'stage-ingest' ? { ...s, replicas: s.replicas + 1 } : s
          ),
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
        title: 'Sandbox mutation rolled back',
        description: err instanceof Error ? err.message : 'Network error',
      });
    },
    onSuccess: (res) => {
      pushToast({
        type: 'success',
        title: `Ingest Gateway scaled to ${res.replicas} replicas`,
        description: 'Optimistic cache mutation confirmed.',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.overview(workspace, timeRange),
      });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Async Task Engine &amp; TanStack Query Inspector
          </h1>
          <p className="page-subtitle">
            AbortController cancellation, chaos fault injection, optimistic
            rollback sandbox, and live query cache introspection
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 size={13} />}
          onClick={clearCompletedJobs}
        >
          Clear Finished Jobs
        </Button>
      </div>

      <div className="grid-12">
        <div className="col-span-7">
          <Card
            title="Cancellable Multi-Stage Async Jobs"
            subtitle="Each workflow uses a dedicated AbortController so in-flight steps abort immediately on cancel"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {JOB_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13 }}>{tpl.title}</strong>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {tpl.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Play size={12} />}
                    onClick={() => launchJob(tpl.id)}
                  >
                    Launch Job
                  </Button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {jobs.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No jobs launched yet. Start any workflow above and try
                  cancelling mid-flight.
                </p>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-canvas)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusIcon
                          status={jobIcon(job.status)}
                          size={16}
                          decorative
                        />
                        <strong style={{ fontSize: 13 }}>{job.title}</strong>
                        <Badge variant={jobBadge(job.status)}>
                          {job.status} · {job.progressPct}%
                        </Badge>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {job.status === 'running' ? (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Ban size={12} />}
                            onClick={() => cancelJob(job.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<RotateCcw size={12} />}
                            onClick={() => retryJob(job.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 6,
                      }}
                    >
                      {job.steps.map((step, idx) => (
                        <div
                          key={step.name}
                          style={{
                            fontSize: 11,
                            padding: '5px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            background:
                              step.status === 'done'
                                ? 'var(--status-healthy-soft)'
                                : step.status === 'running'
                                ? 'var(--accent-soft)'
                                : step.status === 'cancelled' ||
                                  step.status === 'failed'
                                ? 'var(--status-critical-soft)'
                                : 'var(--bg-elevated)',
                          }}
                        >
                          {idx + 1}. {step.name} ({step.status})
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="col-span-5">
          <Card
            title={
              <>
                <Flame size={16} color="var(--status-degraded)" />
                Chaos &amp; Optimistic Rollback Sandbox
              </>
            }
            subtitle="Inject latency and RPC failures to observe AbortSignal & cache rollback"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  <span>Simulated API Latency</span>
                  <strong className="mono">{chaosConfig.latencyMs} ms</strong>
                </div>
                <input
                  type="range"
                  aria-label="Simulated API latency"
                  min={0}
                  max={2500}
                  step={50}
                  value={chaosConfig.latencyMs}
                  onChange={(e) =>
                    updateChaosConfig({ latencyMs: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[140, 600, 1500].map((ms) => (
                    <Button
                      key={ms}
                      size="sm"
                      variant={
                        chaosConfig.latencyMs === ms ? 'primary' : 'secondary'
                      }
                      onClick={() => updateChaosConfig({ latencyMs: ms })}
                    >
                      {ms}ms
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  <span>Simulated Error Rate</span>
                  <strong className="mono">
                    {Math.round(chaosConfig.errorRate * 100)}%
                  </strong>
                </div>
                <input
                  type="range"
                  aria-label="Simulated API error rate"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(chaosConfig.errorRate * 100)}
                  onChange={(e) =>
                    updateChaosConfig({
                      errorRate: Number(e.target.value) / 100,
                    })
                  }
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[0, 35, 100].map((pct) => (
                    <Button
                      key={pct}
                      size="sm"
                      variant={
                        Math.round(chaosConfig.errorRate * 100) === pct
                          ? 'primary'
                          : 'secondary'
                      }
                      onClick={() =>
                        updateChaosConfig({ errorRate: pct / 100 })
                      }
                    >
                      {pct}% Errors
                    </Button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 12 }}>
                  Optimistic Cache Test (Ingest Gateway +1 Replica)
                </strong>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Set error rate to 100% and latency to 600ms, then click below
                  to observe immediate cache update followed by rollback toast.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  loading={sandboxScaleMutation.isPending}
                  onClick={() => sandboxScaleMutation.mutate()}
                >
                  Run Optimistic Scale Mutation
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Live TanStack Query Cache Inspector"
        subtitle="Real-time subscription to queryClient.getQueryCache() with manual invalidation & refetch"
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Query Key</th>
                <th>Data Status</th>
                <th>Fetch Status</th>
                <th>Observers</th>
                <th>Last Updated</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {cacheRows.map((row) => (
                <tr key={row.hash}>
                  <td className="mono">{row.keyLabel}</td>
                  <td>
                    <Badge
                      variant={
                        row.status === 'success'
                          ? 'healthy'
                          : row.status === 'error'
                          ? 'critical'
                          : 'recovering'
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      variant={
                        row.fetchStatus === 'fetching' ? 'info' : 'neutral'
                      }
                    >
                      {row.fetchStatus}
                    </Badge>
                  </td>
                  <td className="mono tabular">{row.observers}</td>
                  <td className="mono">{row.updatedAt}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RefreshCw size={12} />}
                        onClick={() =>
                          void queryClient.refetchQueries({
                            queryKey: row.queryKey,
                          })
                        }
                      >
                        Refetch
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void queryClient.invalidateQueries({
                            queryKey: row.queryKey,
                          })
                        }
                      >
                        Invalidate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
