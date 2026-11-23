import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AsyncJob,
  ChaosConfig,
  NavTab,
  TimeRange,
  WorkspaceId,
} from '../types/domain';
import { runAsyncJobStep, setChaosConfig as syncApiChaos } from '../services/mockApi';
import { useToast } from '../shared/ui/ToastProvider';

export interface JobTemplate {
  id: string;
  title: string;
  description: string;
  steps: string[];
}

export const JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    id: 'rebalance-shards',
    title: 'Rebalance Cluster Shards',
    description: 'Zero-downtime partition migration across edge hubs',
    steps: [
      'Snapshot partition offsets',
      'Acquire distributed shard lease',
      'Stream delta replicas',
      'Verify quorum checksums',
    ],
  },
  {
    id: 'region-failover',
    title: 'Drain & Failover Region',
    description: 'Gracefully shift B2B ingress traffic to standby POPs',
    steps: [
      'Shift DNS weighted routing (50%)',
      'Drain active gRPC connections',
      'Promote standby stream broker',
      'Confirm SLA probe health',
    ],
  },
  {
    id: 'integrity-audit',
    title: 'Run Full Integrity Audit',
    description: 'Cross-check 2,000 ledger traces & schema contracts',
    steps: [
      'Fetch columnar manifest',
      'Verify Merkle tree digests',
      'Publish signed audit artifact',
    ],
  },
  {
    id: 'compliance-export',
    title: 'Export Compliance Snapshot',
    description: 'Package SOC2 telemetry bundle for Planning & Audit',
    steps: [
      'Aggregate 24h KPI metrics',
      'Redact PII & sign archive',
      'Upload to cold storage vault',
    ],
  },
];

export interface SelectedNodeRef {
  id: string;
  source: 'pipeline' | 'canvas';
}

interface AppContextValue {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  workspace: WorkspaceId;
  setWorkspace: (ws: WorkspaceId) => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  livePolling: boolean;
  setLivePolling: (enabled: boolean) => void;
  chaosConfig: ChaosConfig;
  updateChaosConfig: (next: Partial<ChaosConfig>) => void;
  selectedNode: SelectedNodeRef | null;
  setSelectedNode: (node: SelectedNodeRef | null) => void;
  jobsDrawerOpen: boolean;
  setJobsDrawerOpen: (open: boolean) => void;
  jobs: AsyncJob[];
  runningJobCount: number;
  launchJob: (templateId: string) => void;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [workspace, setWorkspace] = useState<WorkspaceId>('apac-prod');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [livePolling, setLivePolling] = useState<boolean>(true);
  const [chaosConfig, setChaosState] = useState<ChaosConfig>({
    latencyMs: 140,
    errorRate: 0,
  });
  const [selectedNode, setSelectedNode] = useState<SelectedNodeRef | null>(null);
  const [jobsDrawerOpen, setJobsDrawerOpen] = useState(false);
  const [jobs, setJobs] = useState<AsyncJob[]>([]);

  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const ctrl of controllers.values()) {
        ctrl.abort();
      }
      controllers.clear();
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const updateChaosConfig = useCallback((next: Partial<ChaosConfig>) => {
    const synced = syncApiChaos(next);
    setChaosState(synced);
  }, []);

  const executeJob = useCallback(
    async (jobId: string, template: JobTemplate, ctrl: AbortController) => {
      const totalSteps = template.steps.length;
      try {
        for (let i = 0; i < totalSteps; i++) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    steps: j.steps.map((s, idx) =>
                      idx === i ? { ...s, status: 'running' } : s
                    ),
                  }
                : j
            )
          );

          await runAsyncJobStep(i, totalSteps, ctrl.signal);

          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    progressPct: Math.round(((i + 1) / totalSteps) * 100),
                    steps: j.steps.map((s, idx) =>
                      idx === i ? { ...s, status: 'done' } : s
                    ),
                  }
                : j
            )
          );
        }

        controllersRef.current.delete(jobId);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'completed',
                  progressPct: 100,
                  finishedAt: new Date().toLocaleTimeString(),
                }
              : j
          )
        );
        pushToast({
          type: 'success',
          title: `${template.title} completed`,
          description: 'All multi-stage operations verified.',
        });
      } catch (err) {
        controllersRef.current.delete(jobId);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const message =
          err instanceof Error ? err.message : 'Async job step failed';

        setJobs((prev) =>
          prev.map((j) => {
            if (j.id !== jobId) return j;
            return {
              ...j,
              status: isAbort ? 'cancelled' : 'failed',
              finishedAt: new Date().toLocaleTimeString(),
              errorMessage: isAbort ? 'Cancelled by operator' : message,
              steps: j.steps.map((s) =>
                s.status === 'running'
                  ? { ...s, status: isAbort ? 'cancelled' : 'failed' }
                  : s
              ),
            };
          })
        );

        pushToast({
          type: isAbort ? 'warning' : 'error',
          title: isAbort
            ? `${template.title} cancelled`
            : `${template.title} failed`,
          description: isAbort ? 'In-flight AbortSignal triggered cleanly.' : message,
        });
      }
    },
    [pushToast]
  );

  const launchJob = useCallback(
    (templateId: string) => {
      const template =
        JOB_TEMPLATES.find((t) => t.id === templateId) ?? JOB_TEMPLATES[0]!;
      const jobId = `job-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      const ctrl = new AbortController();
      controllersRef.current.set(jobId, ctrl);

      const newJob: AsyncJob = {
        id: jobId,
        templateId: template.id,
        title: template.title,
        workspace,
        status: 'running',
        progressPct: 0,
        steps: template.steps.map((name) => ({ name, status: 'pending' })),
        startedAt: new Date().toLocaleTimeString(),
      };

      setJobs((prev) => [newJob, ...prev]);
      void executeJob(jobId, template, ctrl);
    },
    [executeJob, workspace]
  );

  const cancelJob = useCallback((jobId: string) => {
    const ctrl = controllersRef.current.get(jobId);
    if (ctrl) {
      ctrl.abort();
    }
  }, []);

  const retryJob = useCallback(
    (jobId: string) => {
      const existing = jobs.find((j) => j.id === jobId);
      if (!existing) return;
      launchJob(existing.templateId);
    },
    [jobs, launchJob]
  );

  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'running'));
  }, []);

  const runningJobCount = jobs.filter((j) => j.status === 'running').length;

  return (
    <AppContext.Provider
      value={{
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
        selectedNode,
        setSelectedNode,
        jobsDrawerOpen,
        setJobsDrawerOpen,
        jobs,
        runningJobCount,
        launchJob,
        cancelJob,
        retryJob,
        clearCompletedJobs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}
