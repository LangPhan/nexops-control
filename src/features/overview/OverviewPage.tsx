import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { queryKeys } from '../../lib/queryKeys';
import { fetchOverview } from '../../services/mockApi';
import { Badge, Button, Card, Skeleton } from '../../shared/ui/Primitives';
import { StatusIcon } from '../../shared/ui/StatusIcon';
import type { KpiMetric } from '../../types/domain';
import { IncidentQueue } from './IncidentQueue';
import { RolloutWorkflow } from './RolloutWorkflow';
import { SvgPipelineMap } from './SvgPipelineMap';

function KpiSparkline({
  values,
  color,
}: {
  values: readonly number[];
  color: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 92;
  const height = 28;

  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const color =
    metric.status === 'critical'
      ? 'var(--status-critical)'
      : metric.status === 'degraded'
      ? 'var(--status-degraded)'
      : 'var(--status-healthy)';

  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{metric.label}</span>
        <StatusIcon status={metric.status} size={16} decorative />
      </div>
      <div className="kpi-value-row">
        <span className="kpi-value tabular">{metric.value}</span>
        <KpiSparkline values={metric.sparkline} color={color} />
      </div>
      <div>
        <Badge variant={metric.status}>{metric.delta}</Badge>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { workspace, timeRange, livePolling } = useAppContext();

  const overviewQuery = useQuery({
    queryKey: queryKeys.overview(workspace, timeRange),
    queryFn: ({ signal }) => fetchOverview(workspace, timeRange, signal),
    placeholderData: keepPreviousData,
    refetchInterval: livePolling ? 6000 : false,
  });

  const data = overviewQuery.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">B2B Real-Time Operations Overview</h1>
          <p className="page-subtitle">
            Live pipeline health, state-driven canary deployment, and optimistic
            incident workflows
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Synced {data.updatedAt}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            loading={overviewQuery.isFetching}
            icon={<RefreshCw size={13} />}
            onClick={() => overviewQuery.refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {overviewQuery.isError && !data ? (
        <Card title="Telemetry Unavailable">
          <p style={{ color: 'var(--status-critical)', marginBottom: 12 }}>
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : 'Failed to load workspace overview'}
          </p>
          <Button variant="primary" onClick={() => overviewQuery.refetch()}>
            Retry Sync
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid-12">
            {data ? (
              <>
                <div className="col-span-3">
                  <KpiCard metric={data.kpis.activeNodes} />
                </div>
                <div className="col-span-3">
                  <KpiCard metric={data.kpis.throughput} />
                </div>
                <div className="col-span-3">
                  <KpiCard metric={data.kpis.p95Latency} />
                </div>
                <div className="col-span-3">
                  <KpiCard metric={data.kpis.slaCompliance} />
                </div>
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="col-span-3">
                  <Skeleton height={116} />
                </div>
              ))
            )}
          </div>

          <div className="grid-12">
            <div className="col-span-7">
              {data ? (
                <SvgPipelineMap stages={data.stages} />
              ) : (
                <Skeleton height={340} />
              )}
            </div>
            <div className="col-span-5">
              <RolloutWorkflow />
            </div>
          </div>

          <IncidentQueue workspace={workspace} />
        </>
      )}
    </div>
  );
}
