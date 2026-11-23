import type {
  AnalyticsSnapshot,
  AuditEvent,
  ChaosConfig,
  EdgeLink,
  EdgeNode,
  HeatmapCell,
  Incident,
  IncidentAction,
  IncidentStatus,
  NodeAction,
  NodeMutationResult,
  NodeStatus,
  OverviewSnapshot,
  PipelineStage,
  RegionStatusBar,
  ServiceAllocation,
  TelemetryPoint,
  TimeRange,
  TopologySnapshot,
  WorkspaceId,
} from '../types/domain';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(message: string, statusCode = 503, retryable = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/* Deterministic seeded PRNG (Mulberry32) */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const WORKSPACE_META: Record<
  WorkspaceId,
  {
    label: string;
    regions: string[];
    baseRps: number;
    baseLatency: number;
    slaBase: number;
  }
> = {
  'apac-prod': {
    label: 'APAC Production',
    regions: ['APAC-SG', 'APAC-JP', 'APAC-VN', 'APAC-AU', 'APAC-IN'],
    baseRps: 48200,
    baseLatency: 34,
    slaBase: 99.94,
  },
  'eu-logistics': {
    label: 'EU Logistics Mesh',
    regions: ['EU-FRA', 'EU-AMS', 'EU-LON', 'EU-DUB', 'EU-WAW'],
    baseRps: 36400,
    baseLatency: 41,
    slaBase: 99.91,
  },
  'us-edge': {
    label: 'US Edge Core',
    regions: ['US-EAST', 'US-WEST', 'US-CENTRAL', 'CA-TOR', 'US-DAL'],
    baseRps: 61500,
    baseLatency: 29,
    slaBase: 99.97,
  },
};

const SERVICES = [
  'Ingest Gateway',
  'Stream Broker',
  'Transform Pool',
  'Analytics Engine',
  'Alert Dispatcher',
  'Auth Ledger',
];

let chaosConfig: ChaosConfig = {
  latencyMs: 140,
  errorRate: 0,
};

export function getChaosConfig(): ChaosConfig {
  return { ...chaosConfig };
}

export function setChaosConfig(next: Partial<ChaosConfig>): ChaosConfig {
  chaosConfig = {
    latencyMs:
      typeof next.latencyMs === 'number'
        ? Math.max(0, Math.min(3000, next.latencyMs))
        : chaosConfig.latencyMs,
    errorRate:
      typeof next.errorRate === 'number'
        ? Math.max(0, Math.min(1, next.errorRate))
        : chaosConfig.errorRate,
  };
  return { ...chaosConfig };
}

function createAbortError(): Error {
  const err = new Error('Request aborted by AbortSignal');
  err.name = 'AbortError';
  return err;
}

export function simulateNetwork(
  signal?: AbortSignal,
  options?: { bypassErrorRate?: boolean; minDelayMs?: number }
): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  const baseDelay = options?.minDelayMs ?? chaosConfig.latencyMs;
  const jitter = Math.round(Math.random() * Math.min(80, baseDelay * 0.25));
  const totalDelay = Math.max(15, baseDelay + jitter);

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      if (!options?.bypassErrorRate && Math.random() < chaosConfig.errorRate) {
        reject(
          new ApiError(
            `Upstream RPC timeout (${Math.round(chaosConfig.errorRate * 100)}% chaos error rate active)`,
            503,
            true
          )
        );
        return;
      }
      resolve();
    }, totalDelay);

    const onAbort = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

interface WorkspaceState {
  stages: PipelineStage[];
  incidents: Incident[];
  auditEvents: AuditEvent[];
  topologies: Map<number, { nodes: EdgeNode[]; links: EdgeLink[] }>;
}

const store = new Map<WorkspaceId, WorkspaceState>();

function buildInitialStages(workspace: WorkspaceId): PipelineStage[] {
  const meta = WORKSPACE_META[workspace];
  const r0 = meta.regions[0] ?? 'APAC-SG';
  const r1 = meta.regions[1] ?? 'APAC-JP';
  const r2 = meta.regions[2] ?? 'APAC-VN';

  return [
    {
      id: 'stage-ingest',
      name: 'Ingest Gateway',
      role: 'Edge TLS & Rate Guard',
      region: r0,
      status: 'healthy',
      throughputRps: meta.baseRps,
      latencyMs: meta.baseLatency - 14,
      errorRatePct: 0.02,
      replicas: 12,
      cpuPct: 48,
      version: 'v4.8.2',
    },
    {
      id: 'stage-broker',
      name: 'Stream Broker',
      role: 'Partitioned Event Bus',
      region: r0,
      status: 'healthy',
      throughputRps: Math.round(meta.baseRps * 0.96),
      latencyMs: meta.baseLatency - 8,
      errorRatePct: 0.04,
      replicas: 9,
      cpuPct: 62,
      version: 'v4.8.2',
    },
    {
      id: 'stage-transform',
      name: 'Transform Pool',
      role: 'Stateful Enrichment',
      region: r1,
      status: workspace === 'eu-logistics' ? 'degraded' : 'healthy',
      throughputRps: Math.round(meta.baseRps * 0.91),
      latencyMs:
        workspace === 'eu-logistics'
          ? meta.baseLatency + 42
          : meta.baseLatency + 4,
      errorRatePct: workspace === 'eu-logistics' ? 1.18 : 0.08,
      replicas: 16,
      cpuPct: workspace === 'eu-logistics' ? 84 : 58,
      version: 'v4.8.1',
    },
    {
      id: 'stage-analytics',
      name: 'Analytics DB',
      role: 'Columnar Time-Series',
      region: r2,
      status: 'healthy',
      throughputRps: Math.round(meta.baseRps * 0.87),
      latencyMs: meta.baseLatency + 11,
      errorRatePct: 0.03,
      replicas: 8,
      cpuPct: 54,
      version: 'v4.7.9',
    },
    {
      id: 'stage-alert',
      name: 'Alert Sink',
      role: 'SLO Webhook & Audit',
      region: r0,
      status: 'healthy',
      throughputRps: Math.round(meta.baseRps * 0.14),
      latencyMs: 18,
      errorRatePct: 0.01,
      replicas: 4,
      cpuPct: 26,
      version: 'v4.8.2',
    },
  ];
}

function buildInitialIncidents(workspace: WorkspaceId): Incident[] {
  const meta = WORKSPACE_META[workspace];
  const r0 = meta.regions[0] ?? 'APAC-SG';
  const r1 = meta.regions[1] ?? 'APAC-JP';
  const r2 = meta.regions[2] ?? 'APAC-VN';

  return [
    {
      id: `INC-${workspace.toUpperCase().slice(0, 2)}-904`,
      title: 'P95 tail latency spike on Transform Pool shard-04',
      service: 'Transform Pool',
      region: r1,
      severity: 'sev1',
      status: 'open',
      createdAt: '2m ago',
      impactedRps: 4120,
    },
    {
      id: `INC-${workspace.toUpperCase().slice(0, 2)}-901`,
      title: 'Consumer lag exceeding 15s threshold on broker partition-11',
      service: 'Stream Broker',
      region: r0,
      severity: 'sev2',
      status: 'open',
      createdAt: '9m ago',
      impactedRps: 1890,
    },
    {
      id: `INC-${workspace.toUpperCase().slice(0, 2)}-897`,
      title: 'TLS handshake retries elevated from carrier POP-3',
      service: 'Ingest Gateway',
      region: r2,
      severity: 'sev2',
      status: 'acknowledged',
      createdAt: '24m ago',
      impactedRps: 740,
    },
    {
      id: `INC-${workspace.toUpperCase().slice(0, 2)}-890`,
      title: 'Columnar compaction queue paused during snapshot export',
      service: 'Analytics Engine',
      region: r0,
      severity: 'sev3',
      status: 'mitigating',
      createdAt: '41m ago',
      impactedRps: 310,
    },
  ];
}

function buildAuditEvents(workspace: WorkspaceId): AuditEvent[] {
  const meta = WORKSPACE_META[workspace];
  const rand = mulberry32(hashSeed(`${workspace}:audit-2000`));
  const statuses: NodeStatus[] = [
    'healthy',
    'healthy',
    'healthy',
    'healthy',
    'healthy',
    'healthy',
    'degraded',
    'recovering',
    'maintenance',
    'critical',
  ];
  const messages = [
    'Shard checkpoint committed cleanly',
    'Adaptive batch window resized to 256ms',
    'Heartbeat ACK received within SLA budget',
    'Tail latency elevated during compaction',
    'Autoscaler added +1 warm worker pod',
    'Circuit breaker half-open probe succeeded',
    'Downstream webhook retry succeeded (attempt 2)',
    'Schema contract validated against v4.8',
  ];

  const baseTime = Date.UTC(2026, 10, 23, 11, 25, 0);
  const events: AuditEvent[] = [];

  for (let i = 0; i < 2000; i++) {
    const status = statuses[Math.floor(rand() * statuses.length)] ?? 'healthy';
    const region =
      meta.regions[Math.floor(rand() * meta.regions.length)] ?? 'APAC-SG';
    const service =
      SERVICES[Math.floor(rand() * SERVICES.length)] ?? 'Ingest Gateway';
    const msg =
      messages[Math.floor(rand() * messages.length)] ?? 'Telemetry heartbeat';
    const ts = new Date(baseTime - i * 4200);
    const hh = String(ts.getUTCHours()).padStart(2, '0');
    const mm = String(ts.getUTCMinutes()).padStart(2, '0');
    const ss = String(ts.getUTCSeconds()).padStart(2, '0');

    const latencyBase =
      status === 'critical'
        ? 240
        : status === 'degraded'
        ? 115
        : status === 'recovering'
        ? 72
        : 22;

    events.push({
      id: `EVT-${String(2000 - i).padStart(4, '0')}`,
      timestamp: `${hh}:${mm}:${ss}`,
      region,
      service,
      status,
      latencyMs: Math.round(latencyBase + rand() * 55),
      message: `${msg} · trace=${Math.floor(rand() * 899999 + 100000)}`,
    });
  }

  return events;
}

function buildTopologyData(
  workspace: WorkspaceId,
  nodeCount: number
): { nodes: EdgeNode[]; links: EdgeLink[] } {
  const meta = WORKSPACE_META[workspace];
  const rand = mulberry32(hashSeed(`${workspace}:topo:${nodeCount}`));

  // Arrange clusters in 6 realistic geographical/logical constellations
  const clusterCenters = [
    { name: 'Cluster-Alpha', cx: -860, cy: -420 },
    { name: 'Cluster-Beta', cx: 0, cy: -520 },
    { name: 'Cluster-Gamma', cx: 880, cy: -380 },
    { name: 'Cluster-Delta', cx: -760, cy: 440 },
    { name: 'Cluster-Epsilon', cx: 60, cy: 460 },
    { name: 'Cluster-Zeta', cx: 880, cy: 420 },
  ];

  const nodes: EdgeNode[] = [];
  const links: EdgeLink[] = [];
  const clusterCount = clusterCenters.length;

  for (let i = 0; i < nodeCount; i++) {
    const clusterIdx = i % clusterCount;
    const center = clusterCenters[clusterIdx] ?? clusterCenters[0]!;
    const isHub = i < clusterCount * 3;

    // Gaussian-like radial spread using two random numbers
    const angle = rand() * Math.PI * 2;
    const radius = isHub
      ? 25 + rand() * 90
      : 60 + Math.pow(rand(), 0.72) * 340;

    const x = Math.round(center.cx + Math.cos(angle) * radius * 1.15);
    const y = Math.round(center.cy + Math.sin(angle) * radius * 0.92);

    const roll = rand();
    let status: NodeStatus = 'healthy';
    if (roll > 0.975) status = 'critical';
    else if (roll > 0.92) status = 'degraded';
    else if (roll > 0.89) status = 'recovering';
    else if (roll > 0.865) status = 'maintenance';

    const region = meta.regions[clusterIdx % meta.regions.length] ?? 'APAC-SG';
    const service = SERVICES[i % SERVICES.length] ?? 'Ingest Gateway';

    nodes.push({
      id: `node-${workspace}-${String(i + 1).padStart(4, '0')}`,
      label: isHub
        ? `${region}-HUB-${String(i + 1).padStart(2, '0')}`
        : `${region.toLowerCase()}-${String(i + 1).padStart(4, '0')}`,
      region,
      cluster: center.name,
      service,
      x,
      y,
      status,
      latencyMs:
        status === 'critical'
          ? Math.round(180 + rand() * 140)
          : status === 'degraded'
          ? Math.round(85 + rand() * 65)
          : Math.round(14 + rand() * 34),
      throughputRps: isHub
        ? Math.round(2400 + rand() * 1800)
        : Math.round(180 + rand() * 640),
      cpuPct:
        status === 'critical'
          ? Math.round(86 + rand() * 12)
          : Math.round(22 + rand() * 58),
      replicas: isHub ? 6 : 2,
      isHub,
    });
  }

  // Backbone mesh links between cluster hubs
  for (let c = 0; c < clusterCount; c++) {
    const next = (c + 1) % clusterCount;
    links.push({ sourceIdx: c, targetIdx: next, load: 0.78 });
    links.push({
      sourceIdx: c,
      targetIdx: (c + 2) % clusterCount,
      load: 0.52,
    });
  }

  // Connect each worker node to its cluster hub + occasional cross-peer link
  for (let i = clusterCount; i < nodeCount; i++) {
    const hubIdx = i % clusterCount;
    links.push({
      sourceIdx: i,
      targetIdx: hubIdx,
      load: 0.25 + rand() * 0.65,
    });
    if (i % 7 === 0 && i + 1 < nodeCount) {
      links.push({
        sourceIdx: i,
        targetIdx: i + 1,
        load: 0.18 + rand() * 0.45,
      });
    }
  }

  return { nodes, links };
}

function getWorkspaceState(workspace: WorkspaceId): WorkspaceState {
  const existing = store.get(workspace);
  if (existing) return existing;

  const created: WorkspaceState = {
    stages: buildInitialStages(workspace),
    incidents: buildInitialIncidents(workspace),
    auditEvents: buildAuditEvents(workspace),
    topologies: new Map(),
  };
  store.set(workspace, created);
  return created;
}

export function resetWorkspaceStore(): void {
  store.clear();
  chaosConfig = { latencyMs: 140, errorRate: 0 };
}

export async function fetchOverview(
  workspace: WorkspaceId,
  timeRange: TimeRange,
  signal?: AbortSignal
): Promise<OverviewSnapshot> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);
  const meta = WORKSPACE_META[workspace];
  const rangeFactor =
    timeRange === '15m'
      ? 1
      : timeRange === '1h'
      ? 0.97
      : timeRange === '6h'
      ? 0.93
      : 0.89;

  const totalRps = ws.stages.reduce((acc, s) => acc + s.throughputRps, 0);
  const avgLat = Math.round(
    ws.stages.reduce((acc, s) => acc + s.latencyMs, 0) /
      Math.max(1, ws.stages.length)
  );
  const degradedCount = ws.stages.filter(
    (s) => s.status === 'degraded' || s.status === 'critical'
  ).length;

  const rand = mulberry32(hashSeed(`${workspace}:${timeRange}:kpi`));
  const mkSpark = (base: number, amp: number): number[] =>
    Array.from({ length: 12 }, (_, idx) =>
      Math.round(base + Math.sin(idx * 0.65) * amp + (rand() - 0.5) * amp)
    );

  const slaValue = (meta.slaBase - degradedCount * 0.11).toFixed(2);
  const stagesCopy = ws.stages.map((s) => ({ ...s }));

  return {
    workspace,
    timeRange,
    updatedAt: new Date().toLocaleTimeString(),
    kpis: {
      activeNodes: {
        id: 'nodes',
        label: 'Active Edge Nodes',
        value: '2,486 / 2,500',
        delta: '+14 provisioned',
        trend: 'up',
        status: degradedCount > 0 ? 'degraded' : 'healthy',
        sparkline: mkSpark(2465, 25),
      },
      throughput: {
        id: 'throughput',
        label: 'Pipeline Throughput',
        value: `${Math.round((totalRps * rangeFactor) / 1000).toLocaleString()}k req/s`,
        delta: '+6.4% vs baseline',
        trend: 'up',
        status: 'healthy',
        sparkline: mkSpark(Math.round(totalRps / 1000), 14),
      },
      p95Latency: {
        id: 'latency',
        label: 'P95 End-to-End Latency',
        value: `${Math.round(avgLat * (2 - rangeFactor))} ms`,
        delta: degradedCount > 0 ? '+18 ms elevated' : '-4 ms improved',
        trend: degradedCount > 0 ? 'up' : 'down',
        status: avgLat > 65 ? 'critical' : avgLat > 42 ? 'degraded' : 'healthy',
        sparkline: mkSpark(avgLat, 9),
      },
      slaCompliance: {
        id: 'sla',
        label: 'B2B SLA Compliance',
        value: `${slaValue}%`,
        delta: 'Target 99.90%',
        trend: degradedCount > 0 ? 'down' : 'flat',
        status: Number(slaValue) < 99.85 ? 'degraded' : 'healthy',
        sparkline: mkSpark(999, 2),
      },
    },
    stages: stagesCopy,
  };
}

export async function fetchTopology(
  workspace: WorkspaceId,
  nodeCount: number,
  signal?: AbortSignal
): Promise<TopologySnapshot> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);
  let cached = ws.topologies.get(nodeCount);
  if (!cached) {
    cached = buildTopologyData(workspace, nodeCount);
    ws.topologies.set(nodeCount, cached);
  }

  return {
    workspace,
    nodeCount,
    nodes: cached.nodes.map((n) => ({ ...n })),
    links: cached.links,
    generatedAt: new Date().toLocaleTimeString(),
  };
}

export async function fetchAnalytics(
  workspace: WorkspaceId,
  timeRange: TimeRange,
  signal?: AbortSignal
): Promise<AnalyticsSnapshot> {
  await simulateNetwork(signal);
  const meta = WORKSPACE_META[workspace];
  const rand = mulberry32(hashSeed(`${workspace}:${timeRange}:analytics`));

  const pointCount = 24;
  const series: TelemetryPoint[] = [];
  const baseMinutes =
    timeRange === '15m'
      ? 15
      : timeRange === '1h'
      ? 60
      : timeRange === '6h'
      ? 360
      : 1440;

  for (let i = 0; i < pointCount; i++) {
    const wave = Math.sin((i / pointCount) * Math.PI * 2.4);
    const spike = i === 16 ? 1.38 : 1;
    const throughput = Math.round(
      meta.baseRps * (0.85 + 0.16 * wave + rand() * 0.08)
    );
    const p95Latency = Math.round(
      (meta.baseLatency + 10 * Math.cos(i * 0.45) + rand() * 14) * spike
    );
    const errorRate = Number(
      (0.08 + (i === 16 ? 0.62 : 0) + rand() * 0.18).toFixed(2)
    );

    const minsAgo = Math.round(
      baseMinutes - (i / (pointCount - 1)) * baseMinutes
    );
    const label = minsAgo === 0 ? 'Now' : `-${minsAgo}m`;

    series.push({
      timestamp: label,
      label,
      throughput,
      p95Latency,
      errorRate,
    });
  }

  const regionBars: RegionStatusBar[] = meta.regions.map((region, idx) => ({
    region,
    healthy: Math.round(780 + rand() * 420 - idx * 35),
    retried: Math.round(28 + rand() * 54),
    failed: Math.round(4 + rand() * 26),
  }));

  const allocations: ServiceAllocation[] = [
    {
      service: 'Ingest Gateway',
      slaPct: 99.98,
      sharePct: 31,
      colorToken: 'var(--chart-1)',
    },
    {
      service: 'Stream Broker',
      slaPct: 99.95,
      sharePct: 24,
      colorToken: 'var(--chart-3)',
    },
    {
      service: 'Transform Pool',
      slaPct: 99.84,
      sharePct: 21,
      colorToken: 'var(--chart-2)',
    },
    {
      service: 'Analytics Engine',
      slaPct: 99.93,
      sharePct: 15,
      colorToken: 'var(--chart-4)',
    },
    {
      service: 'Alert Dispatcher',
      slaPct: 99.99,
      sharePct: 9,
      colorToken: 'var(--chart-5)',
    },
  ];

  const heatmapBuckets = Array.from({ length: 12 }, (_, i) => `T-${11 - i}`);
  const heatmap: HeatmapCell[] = [];
  for (const service of SERVICES) {
    for (let b = 0; b < heatmapBuckets.length; b++) {
      const hotSpot =
        service === 'Transform Pool' && (b === 8 || b === 9) ? 145 : 0;
      const base = service === 'Analytics Engine' ? 58 : 26;
      const latencyMs = Math.round(base + hotSpot + rand() * 68);
      heatmap.push({
        service,
        bucketIndex: b,
        bucketLabel: heatmapBuckets[b] ?? `T-${b}`,
        latencyMs,
        samples: Math.round(1200 + rand() * 3400),
      });
    }
  }

  return {
    workspace,
    timeRange,
    updatedAt: new Date().toLocaleTimeString(),
    overallSlaPct: meta.slaBase,
    series,
    regionBars,
    allocations,
    heatmap,
    heatmapBuckets,
    heatmapServices: SERVICES,
  };
}

export async function fetchIncidents(
  workspace: WorkspaceId,
  signal?: AbortSignal
): Promise<Incident[]> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);
  return ws.incidents.map((inc) => ({ ...inc }));
}

export async function fetchAuditEvents(
  workspace: WorkspaceId,
  signal?: AbortSignal
): Promise<AuditEvent[]> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);
  return ws.auditEvents;
}

export async function mutateIncidentStatus(
  workspace: WorkspaceId,
  incidentId: string,
  action: IncidentAction,
  signal?: AbortSignal
): Promise<Incident> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);
  const target = ws.incidents.find((item) => item.id === incidentId);
  if (!target) {
    throw new ApiError(`Incident ${incidentId} not found`, 404, false);
  }

  const nextStatus: IncidentStatus =
    action === 'acknowledge'
      ? 'acknowledged'
      : action === 'mitigate'
      ? 'mitigating'
      : 'resolved';

  target.status = nextStatus;
  return { ...target };
}

function applyNodeAction(
  current: {
    status: NodeStatus;
    latencyMs: number;
    replicas: number;
    cpuPct: number;
  },
  action: NodeAction
): {
  status: NodeStatus;
  latencyMs: number;
  replicas: number;
  cpuPct: number;
} {
  switch (action) {
    case 'restart':
      return {
        ...current,
        status: 'recovering',
        latencyMs: Math.max(18, Math.round(current.latencyMs * 0.72)),
        cpuPct: Math.max(24, current.cpuPct - 18),
      };
    case 'scale_up':
      return {
        ...current,
        replicas: current.replicas + 1,
        cpuPct: Math.max(18, Math.round(current.cpuPct * 0.84)),
        latencyMs: Math.max(14, Math.round(current.latencyMs * 0.88)),
      };
    case 'toggle_maintenance':
      return {
        ...current,
        status: current.status === 'maintenance' ? 'healthy' : 'maintenance',
      };
    case 'inject_fault':
      return {
        ...current,
        status: 'critical',
        latencyMs: Math.max(195, current.latencyMs + 140),
        cpuPct: Math.min(98, current.cpuPct + 28),
      };
    case 'recover':
      return {
        ...current,
        status: 'healthy',
        latencyMs: 26,
        cpuPct: 44,
      };
  }
}

export async function mutateNodeAction(
  workspace: WorkspaceId,
  nodeId: string,
  action: NodeAction,
  signal?: AbortSignal
): Promise<NodeMutationResult> {
  await simulateNetwork(signal);
  const ws = getWorkspaceState(workspace);

  const stage = ws.stages.find((s) => s.id === nodeId);
  if (stage) {
    const next = applyNodeAction(stage, action);
    stage.status = next.status;
    stage.latencyMs = next.latencyMs;
    stage.replicas = next.replicas;
    stage.cpuPct = next.cpuPct;
    stage.errorRatePct =
      next.status === 'critical'
        ? 4.6
        : next.status === 'degraded'
        ? 1.2
        : 0.03;

    return {
      nodeId,
      ...next,
      updatedAt: new Date().toLocaleTimeString(),
    };
  }

  // Search cached topologies for matching EdgeNode
  let updatedSnapshot: NodeMutationResult | null = null;
  for (const topo of ws.topologies.values()) {
    const node = topo.nodes.find((n) => n.id === nodeId);
    if (node) {
      const next = applyNodeAction(node, action);
      node.status = next.status;
      node.latencyMs = next.latencyMs;
      node.replicas = next.replicas;
      node.cpuPct = next.cpuPct;
      updatedSnapshot = {
        nodeId,
        ...next,
        updatedAt: new Date().toLocaleTimeString(),
      };
    }
  }

  if (!updatedSnapshot) {
    throw new ApiError(`Node ${nodeId} was not found in active topology`, 404, false);
  }

  return updatedSnapshot;
}

export function findNodeSnapshot(
  workspace: WorkspaceId,
  nodeId: string
): PipelineStage | EdgeNode | null {
  const ws = getWorkspaceState(workspace);
  const stage = ws.stages.find((s) => s.id === nodeId);
  if (stage) return { ...stage };

  for (const topo of ws.topologies.values()) {
    const node = topo.nodes.find((n) => n.id === nodeId);
    if (node) return { ...node };
  }
  return null;
}

export async function runAsyncJobStep(
  stepIndex: number,
  totalSteps: number,
  signal?: AbortSignal
): Promise<{ stepIndex: number; completedSteps: number }> {
  await simulateNetwork(signal, { minDelayMs: Math.max(420, chaosConfig.latencyMs) });
  return {
    stepIndex,
    completedSteps: Math.min(totalSteps, stepIndex + 1),
  };
}
