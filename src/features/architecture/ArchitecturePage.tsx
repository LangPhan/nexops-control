import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Badge, Button, Card } from '../../shared/ui/Primitives';
import { StatusIcon, type StatusIconVariant } from '../../shared/ui/StatusIcon';
import type { NavTab } from '../../types/domain';

interface JdSkillRow {
  category: string;
  jdRequirement: string;
  implementationProof: string;
  targetTab: NavTab;
  ctaLabel: string;
}

const JD_MATRIX: readonly JdSkillRow[] = [
  {
    category: 'Core Stack',
    jdRequirement:
      'React 18+ & TypeScript (strict), TanStack Query, Vite, Git/GitHub, Figma tokens',
    implementationProof:
      'Strict TS (`noUncheckedIndexedAccess`), TanStack Query v5 `keepPreviousData` + `AbortSignal`, Figma CSS variable tokens (Dark/Light).',
    targetTab: 'async-ops',
    ctaLabel: 'Open Query Lab',
  },
  {
    category: 'Complex State UI',
    jdRequirement:
      'Thiết kế và phát triển UI phức tạp, thay đổi theo luồng dữ liệu và trạng thái',
    implementationProof:
      'Discriminated-union Canary Rollout FSM (`rolloutMachine.ts`) + multi-workspace reactive telemetry pipeline.',
    targetTab: 'overview',
    ctaLabel: 'Open Operations',
  },
  {
    category: 'Async & Optimistic UI',
    jdRequirement:
      'Triển khai UI tương tác/trạng thái phản ánh hành động người dùng & tác vụ bất đồng bộ',
    implementationProof:
      'Optimistic Incident & Node mutations with snapshot rollback + retry toast + cancellable `AbortController` multi-stage jobs.',
    targetTab: 'async-ops',
    ctaLabel: 'Open Async Engine',
  },
  {
    category: 'Shared Architecture',
    jdRequirement:
      'Thiết kế, cải tiến cấu trúc Frontend & component dùng chung, tối ưu hiệu suất & bảo trì',
    implementationProof:
      'Feature-sliced `src/features/*` + reusable `src/shared/ui/*` primitives (`VirtualTable`, `Drawer`, `StatusIcon`, `ErrorBoundary`).',
    targetTab: 'architecture',
    ctaLabel: 'Inspect Tokens Below',
  },
  {
    category: 'Legacy Modernization',
    jdRequirement:
      'Hiểu codebase cũ, cải tiến dần dần dựa trên tinh thần hợp tác (Planning, Design, BE)',
    implementationProof:
      'Interactive Strangler Fig refactoring lab below comparing un-cancelled race-prone `useEffect` vs memoized TanStack Query.',
    targetTab: 'architecture',
    ctaLabel: 'Test Refactoring Lab',
  },
  {
    category: 'Bonus #1 · Charts',
    jdRequirement: 'Có kinh nghiệm phát triển đa dạng các loại biểu đồ',
    implementationProof:
      '4 custom responsive SVG charts (Multi-Series Area/Line, Stacked Bar, Radial SLA Donut, Service×Time Heatmap) linked to 2,000-row table.',
    targetTab: 'analytics',
    ctaLabel: 'Open 4 Charts',
  },
  {
    category: 'Bonus #2 · SVG UI',
    jdRequirement:
      'Triển khai UI trực quan hóa trạng thái & icon động bằng SVG',
    implementationProof:
      'Interactive 5-stage SVG Pipeline Map with dynamic flow speed + 7 animated vector `<StatusIcon />` states.',
    targetTab: 'overview',
    ctaLabel: 'Open SVG Pipeline',
  },
  {
    category: 'Bonus #3 · Canvas Perf',
    jdRequirement:
      'Phát triển đồ họa tương tác Canvas & tối ưu hiệu suất rendering',
    implementationProof:
      '250–5,000 node Pan/Zoom HTML5 Canvas with Spatial Hash Grid O(1) hit-testing, Frustum Culling, Sprite Atlas & Optimized vs Naive toggle.',
    targetTab: 'canvas',
    ctaLabel: 'Open Canvas Benchmark',
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
            Architecture, Incremental Refactoring &amp; JD Coverage Map
          </h1>
          <p className="page-subtitle">
            Direct traceability from every JD requirement &amp; bonus criterion to
            working, verified implementation
          </p>
        </div>
        <Badge variant="healthy">
          <CheckCircle2 size={13} /> 8 / 8 JD Criteria Verified
        </Badge>
      </div>

      {/* Section 1: JD Skill Coverage Matrix */}
      <Card
        title={
          <>
            <Layers size={16} color="var(--accent-primary)" />
            Interactive JD Skill Coverage Matrix (5+ YOE Frontend Developer)
          </>
        }
        subtitle="Click any live demo link to inspect the running implementation"
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>JD Requirement / Bonus</th>
                <th>Implemented Evidence in NexOps Control</th>
                <th>Live Demo</th>
              </tr>
            </thead>
            <tbody>
              {JD_MATRIX.map((row) => (
                <tr key={row.category}>
                  <td>
                    <Badge variant="info">{row.category}</Badge>
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.jdRequirement}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {row.implementationProof}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowRight size={12} />}
                      onClick={() => setActiveTab(row.targetTab)}
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
      <div className="grid-12">
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
