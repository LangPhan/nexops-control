import { useIsFetching } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Cpu,
  Flame,
  Layers,
  Menu,
  Moon,
  Network,
  Pause,
  Play,
  Sun,
  Workflow,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import { Badge, Button, Select, Tabs } from '../shared/ui/Primitives';
import { StatusIcon } from '../shared/ui/StatusIcon';
import type { NavTab, TimeRange, WorkspaceId } from '../types/domain';

interface NavItemConfig {
  id: NavTab;
  label: string;
  pill: string;
  icon: ReactNode;
}

const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Operations Overview',
    pill: 'SVG + FSM',
    icon: <Activity size={16} />,
  },
  {
    id: 'canvas',
    label: 'Canvas Topology',
    pill: '5k Nodes',
    icon: <Network size={16} />,
  },
  {
    id: 'analytics',
    label: 'Analytics & Charts',
    pill: '4 Charts',
    icon: <BarChart3 size={16} />,
  },
  {
    id: 'async-ops',
    label: 'Async & Query Lab',
    pill: 'TanStack',
    icon: <Workflow size={16} />,
  },
  {
    id: 'architecture',
    label: 'System Architecture',
    pill: 'Design',
    icon: <Layers size={16} />,
  },
];

const WORKSPACE_OPTIONS: ReadonlyArray<{ value: WorkspaceId; label: string }> = [
  { value: 'apac-prod', label: 'APAC Production' },
  { value: 'eu-logistics', label: 'EU Logistics Mesh' },
  { value: 'us-edge', label: 'US Edge Core' },
];

const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: TimeRange; label: string }> = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const {
    activeTab,
    setActiveTab,
    workspace,
    setWorkspace,
    timeRange,
    setTimeRange,
    theme,
    toggleTheme,
    livePolling,
    setLivePolling,
    chaosConfig,
    updateChaosConfig,
    runningJobCount,
    setJobsDrawerOpen,
  } = useAppContext();

  const isFetching = useIsFetching();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chaosOpen, setChaosOpen] = useState(false);

  const selectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div>
          <div className="brand-block">
            <div className="brand-logo">
              <StatusIcon status="healthy" size={20} decorative />
            </div>
            <div>
              <div className="brand-title">NexOps Control</div>
              <div className="brand-tag">B2B Telemetry &amp; Mesh</div>
            </div>
          </div>

          <nav className="nav-list" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeTab === item.id ? 'is-active' : ''}`}
                onClick={() => selectTab(item.id)}
              >
                <span className="nav-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                <span className="nav-pill">{item.pill}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: 12 }}>Platform Console</strong>
            <Badge variant="healthy">v4.9.0</Badge>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            React 18 · TS Strict · TanStack Query · SVG · Canvas
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => selectTab('architecture')}
          >
            Explore Architecture
          </Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              size="sm"
              variant="ghost"
              className="mobile-menu-btn"
              aria-label="Toggle navigation menu"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <Menu size={16} />
            </Button>

            <Select
              ariaLabel="Select B2B workspace"
              value={workspace}
              options={WORKSPACE_OPTIONS}
              onChange={setWorkspace}
            />

            <Tabs
              ariaLabel="Select telemetry time range"
              value={timeRange}
              options={TIME_RANGE_OPTIONS}
              onChange={setTimeRange}
            />
          </div>

          <div className="topbar-right">
            <Button
              size="sm"
              variant="secondary"
              icon={
                <StatusIcon
                  status={
                    isFetching > 0
                      ? 'syncing'
                      : livePolling
                      ? 'healthy'
                      : 'paused'
                  }
                  size={14}
                  decorative
                />
              }
              onClick={() => setLivePolling(!livePolling)}
              title="Toggle automatic background telemetry polling"
            >
              {isFetching > 0
                ? 'Syncing'
                : livePolling
                ? 'Live Sync'
                : 'Paused'}
              {livePolling ? <Pause size={12} /> : <Play size={12} />}
            </Button>

            <div className="popover-anchor">
              <Button
                size="sm"
                variant={chaosConfig.errorRate > 0 ? 'danger' : 'secondary'}
                icon={<Flame size={14} />}
                onClick={() => setChaosOpen((o) => !o)}
              >
                Chaos{' '}
                {chaosConfig.errorRate > 0
                  ? `${Math.round(chaosConfig.errorRate * 100)}%`
                  : `${chaosConfig.latencyMs}ms`}
              </Button>

              {chaosOpen && (
                <div className="popover-panel" role="dialog" aria-label="Chaos simulator">
                  <strong style={{ fontSize: 13 }}>API Chaos Simulator</strong>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Latency: <strong className="mono">{chaosConfig.latencyMs}ms</strong>
                    <input
                      type="range"
                      min={0}
                      max={2000}
                      step={50}
                      value={chaosConfig.latencyMs}
                      onChange={(e) =>
                        updateChaosConfig({ latencyMs: Number(e.target.value) })
                      }
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Error Rate:{' '}
                    <strong className="mono">
                      {Math.round(chaosConfig.errorRate * 100)}%
                    </strong>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={Math.round(chaosConfig.errorRate * 100)}
                      onChange={(e) =>
                        updateChaosConfig({
                          errorRate: Number(e.target.value) / 100,
                        })
                      }
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateChaosConfig({ latencyMs: 140, errorRate: 0 })
                      }
                    >
                      Healthy
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        updateChaosConfig({ latencyMs: 500, errorRate: 1 })
                      }
                    >
                      100% Fail
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant={runningJobCount > 0 ? 'primary' : 'secondary'}
              icon={
                runningJobCount > 0 ? (
                  <StatusIcon status="syncing" size={14} decorative />
                ) : (
                  <Cpu size={14} />
                )
              }
              onClick={() => setJobsDrawerOpen(true)}
            >
              Jobs ({runningJobCount})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
