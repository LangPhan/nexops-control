import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import type { AuditEvent, NodeStatus } from '../../types/domain';
import { Badge, Button } from './Primitives';
import { StatusIcon } from './StatusIcon';

const ROW_HEIGHT = 38;
const VIEWPORT_HEIGHT = 340;
const OVERSCAN = 4;

interface VirtualTableProps {
  rows: readonly AuditEvent[];
  regionFilter: string | null;
  serviceFilter: string | null;
  onClearExternalFilters: () => void;
}

const STATUS_FILTERS: readonly ('all' | NodeStatus)[] = [
  'all',
  'healthy',
  'degraded',
  'critical',
  'recovering',
  'maintenance',
];

export function VirtualTable({
  rows,
  regionFilter,
  serviceFilter,
  onClearExternalFilters,
}: VirtualTableProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<'all' | NodeStatus>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'latencyMs'>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [scrollTop, setScrollTop] = useState(0);

  const filteredRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (regionFilter && row.region !== regionFilter) return false;
      if (serviceFilter && row.service !== serviceFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (query) {
        const hay = `${row.id} ${row.region} ${row.service} ${row.message}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      const cmp =
        sortBy === 'latencyMs'
          ? a.latencyMs - b.latencyMs
          : a.id.localeCompare(b.id);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    rows,
    deferredSearch,
    regionFilter,
    serviceFilter,
    statusFilter,
    sortBy,
    sortDir,
  ]);

  const totalHeight = filteredRows.length * ROW_HEIGHT;
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    filteredRows.length,
    startIndex + visibleCount + OVERSCAN * 2
  );
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const toggleSort = (col: 'timestamp' | 'latencyMs') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  return (
    <div className="vtable-wrap">
      <div className="vtable-toolbar">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="search"
              className="input"
              aria-label="Filter telemetry events"
              placeholder="Search trace, service, region..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setScrollTop(0);
              }}
              style={{ paddingLeft: 30, width: 240 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'primary' : 'secondary'}
                onClick={() => {
                  setStatusFilter(st);
                  setScrollTop(0);
                }}
              >
                {st}
              </Button>
            ))}
          </div>
        </div>

        {(regionFilter || serviceFilter) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {regionFilter && (
              <Badge variant="info">Chart Filter: {regionFilter}</Badge>
            )}
            {serviceFilter && (
              <Badge variant="info">Heatmap Filter: {serviceFilter}</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<X size={13} />}
              onClick={onClearExternalFilters}
            >
              Clear chart filter
            </Button>
          </div>
        )}
      </div>

      <div className="vtable-header" role="row">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifyContent: 'flex-start', padding: 0, height: 24 }}
          onClick={() => toggleSort('timestamp')}
        >
          Event ID <ArrowUpDown size={12} />
        </button>
        <span>Region</span>
        <span>Service</span>
        <span>Status</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifyContent: 'flex-start', padding: 0, height: 24 }}
          onClick={() => toggleSort('latencyMs')}
        >
          Latency <ArrowUpDown size={12} />
        </button>
        <span>Message</span>
      </div>

      <div
        className="vtable-scroll"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows.map((row, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <div
                key={row.id}
                className="vtable-row"
                style={{
                  transform: `translateY(${actualIndex * ROW_HEIGHT}px)`,
                }}
              >
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {row.id}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {row.region}
                </span>
                <span style={{ fontWeight: 500 }}>{row.service}</span>
                <span>
                  <Badge variant={row.status}>
                    <StatusIcon status={row.status} size={12} decorative />
                    {row.status}
                  </Badge>
                </span>
                <span
                  className="mono tabular"
                  style={{
                    color:
                      row.latencyMs > 180
                        ? 'var(--status-critical)'
                        : row.latencyMs > 90
                        ? 'var(--status-degraded)'
                        : 'var(--text-primary)',
                  }}
                >
                  {row.latencyMs} ms
                </span>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={row.message}
                >
                  {row.timestamp} · {row.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vtable-footer">
        <span className="mono tabular">
          Rendering {visibleRows.length} DOM rows of{' '}
          {filteredRows.length.toLocaleString()} matched (
          {rows.length.toLocaleString()} total virtualized)
        </span>
        <span>Windowed overscan: {OVERSCAN} rows</span>
      </div>
    </div>
  );
}
