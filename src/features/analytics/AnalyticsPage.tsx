import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { queryKeys } from '../../lib/queryKeys';
import { fetchAnalytics, fetchAuditEvents } from '../../services/mockApi';
import { Card, Skeleton } from '../../shared/ui/Primitives';
import { VirtualTable } from '../../shared/ui/VirtualTable';
import { LatencyHeatmap } from './LatencyHeatmap';
import { MultiSeriesChart } from './MultiSeriesChart';
import { RadialSlaGauge } from './RadialSlaGauge';
import { StackedBarChart } from './StackedBarChart';

export function AnalyticsPage() {
  const { workspace, timeRange } = useAppContext();
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics(workspace, timeRange),
    queryFn: ({ signal }) => fetchAnalytics(workspace, timeRange, signal),
    placeholderData: keepPreviousData,
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.auditEvents(workspace),
    queryFn: ({ signal }) => fetchAuditEvents(workspace, signal),
    placeholderData: keepPreviousData,
  });

  const analytics = analyticsQuery.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Diverse B2B Charts &amp; Virtualized Telemetry Stream
          </h1>
          <p className="page-subtitle">
            4 interactive custom SVG visualizations cross-linked with a 2,000-row
            windowed event table
          </p>
        </div>
      </div>

      <div className="grid-12">
        <div className="col-span-6">
          {analytics ? (
            <MultiSeriesChart series={analytics.series} />
          ) : (
            <Skeleton height={320} />
          )}
        </div>
        <div className="col-span-6">
          {analytics ? (
            <StackedBarChart
              bars={analytics.regionBars}
              selectedRegion={regionFilter}
              onSelectRegion={setRegionFilter}
            />
          ) : (
            <Skeleton height={320} />
          )}
        </div>
        <div className="col-span-5">
          {analytics ? (
            <RadialSlaGauge
              overallSlaPct={analytics.overallSlaPct}
              allocations={analytics.allocations}
            />
          ) : (
            <Skeleton height={300} />
          )}
        </div>
        <div className="col-span-7">
          {analytics ? (
            <LatencyHeatmap
              cells={analytics.heatmap}
              services={analytics.heatmapServices}
              buckets={analytics.heatmapBuckets}
              selectedService={serviceFilter}
              onSelectService={setServiceFilter}
            />
          ) : (
            <Skeleton height={300} />
          )}
        </div>
      </div>

      <Card
        title="2,000-Row Virtualized Audit Event Stream"
        subtitle="Custom viewport windowing + React 18 useDeferredValue search + chart click cross-filtering"
      >
        {eventsQuery.data ? (
          <VirtualTable
            rows={eventsQuery.data}
            regionFilter={regionFilter}
            serviceFilter={serviceFilter}
            onClearExternalFilters={() => {
              setRegionFilter(null);
              setServiceFilter(null);
            }}
          />
        ) : (
          <Skeleton height={360} />
        )}
      </Card>
    </div>
  );
}
