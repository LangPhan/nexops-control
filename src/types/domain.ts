export type WorkspaceId = 'apac-prod' | 'eu-logistics' | 'us-edge';

export type TimeRange = '15m' | '1h' | '6h' | '24h';

export type NodeStatus =
  | 'healthy'
  | 'degraded'
  | 'critical'
  | 'maintenance'
  | 'recovering';

export type NavTab =
  | 'overview'
  | 'canvas'
  | 'analytics'
  | 'async-ops'
  | 'architecture';

export interface ChaosConfig {
  latencyMs: number;
  errorRate: number; // 0..1
}

export interface PipelineStage {
  id: string;
  name: string;
  role: string;
  region: string;
  status: NodeStatus;
  throughputRps: number;
  latencyMs: number;
  errorRatePct: number;
  replicas: number;
  cpuPct: number;
  version: string;
}

export interface EdgeNode {
  id: string;
  label: string;
  region: string;
  cluster: string;
  service: string;
  x: number;
  y: number;
  status: NodeStatus;
  latencyMs: number;
  throughputRps: number;
  cpuPct: number;
  replicas: number;
  isHub: boolean;
}

export interface EdgeLink {
  sourceIdx: number;
  targetIdx: number;
  load: number; // 0..1
}

export interface TopologySnapshot {
  workspace: WorkspaceId;
  nodeCount: number;
  nodes: EdgeNode[];
  links: EdgeLink[];
  generatedAt: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  status: NodeStatus;
  sparkline: number[];
}

export interface KpiSummary {
  activeNodes: KpiMetric;
  throughput: KpiMetric;
  p95Latency: KpiMetric;
  slaCompliance: KpiMetric;
}

export interface OverviewSnapshot {
  workspace: WorkspaceId;
  timeRange: TimeRange;
  updatedAt: string;
  kpis: KpiSummary;
  stages: PipelineStage[];
}

export interface TelemetryPoint {
  timestamp: string;
  label: string;
  throughput: number;
  p95Latency: number;
  errorRate: number;
}

export interface RegionStatusBar {
  region: string;
  healthy: number;
  retried: number;
  failed: number;
}

export interface ServiceAllocation {
  service: string;
  slaPct: number;
  sharePct: number;
  colorToken: string;
}

export interface HeatmapCell {
  service: string;
  bucketIndex: number;
  bucketLabel: string;
  latencyMs: number;
  samples: number;
}

export interface AnalyticsSnapshot {
  workspace: WorkspaceId;
  timeRange: TimeRange;
  updatedAt: string;
  overallSlaPct: number;
  series: TelemetryPoint[];
  regionBars: RegionStatusBar[];
  allocations: ServiceAllocation[];
  heatmap: HeatmapCell[];
  heatmapBuckets: string[];
  heatmapServices: string[];
}

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3';
export type IncidentStatus = 'open' | 'acknowledged' | 'mitigating' | 'resolved';
export type IncidentAction = 'acknowledge' | 'mitigate' | 'resolve';

export interface Incident {
  id: string;
  title: string;
  service: string;
  region: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: string;
  impactedRps: number;
  _optimistic?: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  region: string;
  service: string;
  status: NodeStatus;
  latencyMs: number;
  message: string;
}

export type NodeAction =
  | 'restart'
  | 'scale_up'
  | 'toggle_maintenance'
  | 'inject_fault'
  | 'recover';

export interface NodeMutationResult {
  nodeId: string;
  status: NodeStatus;
  latencyMs: number;
  replicas: number;
  cpuPct: number;
  updatedAt: string;
}

export type AsyncJobStatus =
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AsyncJobStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'failed';
}

export interface AsyncJob {
  id: string;
  templateId: string;
  title: string;
  workspace: WorkspaceId;
  status: AsyncJobStatus;
  progressPct: number;
  steps: AsyncJobStep[];
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
}

/* Discriminated Union State Machine for B2B Canary Rollout */
export interface RolloutLogEntry {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  note: string;
}

export type RolloutPhase =
  | 'idle'
  | 'validating'
  | 'canary'
  | 'rolling_out'
  | 'degraded'
  | 'rolling_back'
  | 'verified'
  | 'rolled_back';

export type RolloutState =
  | {
      phase: 'idle';
      version: string;
      trafficPct: 0;
      errorBudgetPct: 100;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'validating';
      version: string;
      trafficPct: 0;
      errorBudgetPct: 100;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'canary';
      version: string;
      trafficPct: 10;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'rolling_out';
      version: string;
      trafficPct: 50 | 80;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'degraded';
      version: string;
      trafficPct: number;
      reason: string;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'rolling_back';
      version: string;
      trafficPct: number;
      reason: string;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'verified';
      version: string;
      trafficPct: 100;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    }
  | {
      phase: 'rolled_back';
      version: string;
      trafficPct: 0;
      reason: string;
      errorBudgetPct: number;
      logs: RolloutLogEntry[];
    };

export type RolloutAction =
  | { type: 'START'; version?: string }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; reason: string }
  | { type: 'PROMOTE' }
  | { type: 'STEP_PROGRESS' }
  | { type: 'COMPLETE' }
  | { type: 'INJECT_FAULT'; reason: string }
  | { type: 'ROLLBACK' }
  | { type: 'ROLLBACK_COMPLETE' }
  | { type: 'RESET' };
