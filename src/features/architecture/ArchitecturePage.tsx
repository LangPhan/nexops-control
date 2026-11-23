import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Badge, Button, Card } from '../../shared/ui/Primitives';
import { StatusIcon, type StatusIconVariant } from '../../shared/ui/StatusIcon';
import type { NavTab } from '../../types/domain';

interface SystemCapabilityRow {
  subsystem: string;
  capability: string;
  implementation: ReactNode;
  targetTab: NavTab;
  ctaLabel: string;
}

const SYSTEM_CAPABILITIES: readonly SystemCapabilityRow[] = [
  {
    subsystem: 'Data & State',
    capability: 'Server-state caching, cancellation & strict typing',
    implementation: (
      <>
        TanStack Query v5 (<code>keepPreviousData</code>,{' '}
        <code>AbortSignal</code>), strict TypeScript with{' '}
        <code>noUncheckedIndexedAccess</code>.
      </>
    ),
    targetTab: 'async-ops',
    ctaLabel: 'Open Query Lab',
  },
  {
    subsystem: 'Workflow FSM',
    capability: 'State-driven canary deployment & rollback control',
    implementation: (
      <>
        Discriminated-union finite state machine in{' '}
        <code>rolloutMachine.ts</code> with guarded transitions and recovery
        paths.
      </>
    ),
    targetTab: 'overview',
    ctaLabel: 'Open Operations',
  },
  {
    subsystem: 'Optimistic UI',
    capability: 'Non-blocking mutations with rollback & abortable jobs',
    implementation: (
      <>
        Cache snapshot rollback with retry toast notifications and multi-stage{' '}
        <code>AbortController</code> task orchestration.
      </>
    ),
    targetTab: 'async-ops',
    ctaLabel: 'Open Async Engine',
  },
  {
    subsystem: 'Canvas Engine',
    capability: 'High-density interactive topology (250–5,000 nodes)',
    implementation: (
      <>
        Uniform Spatial Hash Grid <code>O(1)</code> hit-testing, viewport
        frustum culling, offscreen sprite atlas, and Optimized vs Naive
        benchmark mode.
      </>
    ),
    targetTab: 'canvas',
    ctaLabel: 'Open Canvas Map',
  },
  {
    subsystem: 'Visualizations',
    capability: 'Cross-filtered analytics & 2,000-row virtualized stream',
    implementation: (
      <>
        4 custom responsive SVG charts synced with a windowed{' '}
        <code>VirtualTable</code> using React 18 <code>useDeferredValue</code>.
      </>
    ),
    targetTab: 'analytics',
    ctaLabel: 'Open Analytics',
  },
  {
    subsystem: 'Vector Status',
    capability: 'Dynamic SVG pipeline flow & accessible animated icons',
    implementation: (
      <>
        5-stage interactive SVG data pipeline scaled by throughput plus 7
        reusable vector <code>StatusIcon</code> states.
      </>
    ),
    targetTab: 'overview',
    ctaLabel: 'Open SVG Pipeline',
  },
  {
    subsystem: 'Design System',
    capability: 'Modular feature slices & shared UI primitives',
    implementation: (
      <>
        Reusable <code>Drawer</code>, <code>ToastProvider</code>,{' '}
        <code>ErrorBoundary</code>, and Dark/Light Figma-ready CSS tokens.
      </>
    ),
    targetTab: 'architecture',
    ctaLabel: 'Inspect Tokens',
  },
];

/* ==========================================================================
   Legacy vs Modernized Child Components for Live Render-Counter Proof
   ========================================================================== */

function LegacyChildPanel({
  config,
  onPing,
}: {
  config: { threshold: number; region: string };
  onPing: () => void;
}) {
  const renders = useRef(0);
  renders.current += 1;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        background: 'var(--status-critical-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 12 }}>Legacy Child (Un-memoized)</strong>
        <Badge variant="critical">Renders: {renders.current}</Badge>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        Inline config prop ({config.region}, &gt;{config.threshold}ms) triggers
        re-render on every parent keystroke.
      </span>
      <Button size="sm" variant="secondary" onClick={onPing}>
        Trigger Legacy Ping
      </Button>
    </div>
  );
}

const ModernChildPanel = memo(function ModernChildPanel({
  config,
  onPing,
}: {
  config: { threshold: number; region: string };
  onPing: () => void;
}) {
  const renders = useRef(0);
  renders.current += 1;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(16, 185, 129, 0.38)',
        background: 'var(--status-healthy-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 12 }}>
          Modernized Child (React.memo + useMemo)
        </strong>
        <Badge variant="healthy">Renders: {renders.current}</Badge>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        Stable config reference ({config.region}, &gt;{config.threshold}ms) stays
        at 1 render while parent types.
      </span>
      <Button size="sm" variant="primary" onClick={onPing}>
        Trigger Safe Ping
      </Button>
    </div>
  );
});

const TOKEN_SWATCHES: ReadonlyArray<{ name: string; cssVar: string }> = [
  { name: 'Canvas BG', cssVar: '--bg-canvas' },
  { name: 'Surface BG', cssVar: '--bg-surface' },
  { name: 'Elevated BG', cssVar: '--bg-elevated' },
  { name: 'Accent Primary', cssVar: '--accent-primary' },
  { name: 'Status Healthy', cssVar: '--status-healthy' },
  { name: 'Status Degraded', cssVar: '--status-degraded' },
  { name: 'Status Critical', cssVar: '--status-critical' },
  { name: 'Status Recovering', cssVar: '--status-recovering' },
];

const ALL_STATUS_ICONS: readonly StatusIconVariant[] = [
  'healthy',
  'degraded',
  'critical',
  'maintenance',
  'recovering',
  'syncing',
  'paused',
];

export function ArchitecturePage() {
  const { setActiveTab, theme, toggleTheme } = useAppContext();
  const [filterText, setFilterText] = useState('');
  const [pingCount, setPingCount] = useState(0);

  const stableConfig = useMemo(
    () => ({ threshold: 80, region: 'APAC-SG' }),
    []
  );
  const stablePing = useCallback(() => {
    setPingCount((c) => c + 1);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            System Architecture &amp; Performance Lab
          </h1>
          <p className="page-subtitle">
            Core platform capabilities, render-isolation benchmarks, and
            semantic design tokens
          </p>
        </div>
        <Badge variant="healthy">
          <CheckCircle2 size={13} /> Production Architecture
        </Badge>
      </div>

      {/* Section 1: Platform Architecture & Capabilities */}
      <Card
        title={
          <>
            <Layers size={16} color="var(--accent-primary)" />
            Platform Architecture &amp; Capabilities
          </>
        }
        subtitle="Inspect any subsystem module directly in the live console"
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Subsystem</th>
                <th>Capability</th>
                <th>Engineering Implementation</th>
                <th>Module</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_CAPABILITIES.map((row) => (
                <tr key={row.subsystem}>
                  <td>
                    <Badge variant="info">{row.subsystem}</Badge>
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.capability}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {row.implementation}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowRight size={12} />}
                      onClick={() => {
                        if (row.targetTab === 'architecture') {
                          document
                            .getElementById('design-tokens')
                            ?.scrollIntoView({ behavior: 'smooth' });
                          return;
                        }
                        setActiveTab(row.targetTab);
                      }}
                    >
                      {row.ctaLabel}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 2: Legacy-to-Modern Incremental Refactoring Lab */}
      <Card
        title="Legacy-to-Modern Incremental Refactoring Lab (Strangler Fig Pattern)"
        subtitle="Type in the search box below and watch how memoization + stable references isolate child re-renders"
        actions={
          <Badge variant="neutral">Ping count: {pingCount}</Badge>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              aria-label="Unrelated parent input to test child re-renders"
              placeholder="Type here to trigger parent state re-renders..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Typing updates parent state: watch Legacy counter climb vs Modern staying locked.
            </span>
          </div>

          <div className="grid-12">
            <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <LegacyChildPanel
                config={{ threshold: 80, region: 'APAC-SG' }}
                onPing={() => setPingCount((c) => c + 1)}
              />
              <pre className="code-snippet">{`// Legacy Anti-Pattern (Race-prone + Inline Props)
useEffect(() => {
  fetch('/api/nodes?q=' + query)
    .then(r => r.json())
    .then(setNodes); // No AbortSignal -> stale overwrite!
}, [query]);
<Child config={{ threshold: 80 }} onPing={() => ...} />`}</pre>
            </div>

            <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ModernChildPanel
                config={stableConfig}
                onPing={stablePing}
              />
              <pre className="code-snippet">{`// Modernized Strangler Slice (TanStack Query + Memo)
useQuery({
  queryKey: queryKeys.topology(ws, scale),
  queryFn: ({ signal }) => fetchTopology(ws, scale, signal),
  placeholderData: keepPreviousData,
});
<ModernChild config={stableConfig} onPing={stablePing} />`}</pre>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              fontSize: 12,
            }}
          >
            <strong>4-Step Incremental Team Migration Playbook (Planning · Design · Backend):</strong>{' '}
            (1) Wrap legacy views behind typed adapter boundaries &amp; ErrorBoundary; (2) Extract
            Figma CSS tokens &amp; shared UI primitives before rewriting business logic; (3) Agree
            on typed DTO contracts + pagination/cancellation semantics with Backend; (4) Replace
            legacy fetch effects slice-by-slice with TanStack Query + RTL behavioral regression tests.
          </div>
        </div>
      </Card>

      {/* Section 3: Figma Design Tokens & Animated SVG Icon Kit */}
      <div id="design-tokens" className="grid-12">
        <div className="col-span-6">
          <Card
            title="Figma-Ready Semantic Design Tokens"
            subtitle="Live CSS custom properties responding immediately to theme switches"
            actions={
              <Button size="sm" variant="secondary" onClick={toggleTheme}>
                Toggle Theme ({theme})
              </Button>
            }
          >
            <div className="token-swatch-grid">
              {TOKEN_SWATCHES.map((tok) => (
                <div key={tok.cssVar} className="token-swatch">
                  <div
                    className="token-color-box"
                    style={{ background: `var(${tok.cssVar})` }}
                  />
                  <strong style={{ fontSize: 12 }}>{tok.name}</strong>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {tok.cssVar}
                  </code>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-6">
          <Card
            title="Reusable Animated SVG StatusIcon Kit"
            subtitle="7 accessible vector states respecting prefers-reduced-motion"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))',
                gap: 10,
              }}
            >
              {ALL_STATUS_ICONS.map((st) => (
                <div
                  key={st}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <StatusIcon status={st} size={28} />
                  <span className="mono" style={{ fontSize: 11 }}>
                    {st}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
