# NexOps Control — B2B Real-Time Operations & Pipeline Topology

Enterprise B2B real-time telemetry, deployment orchestration, and mesh topology console built with **React 18, TypeScript (strict), TanStack Query v5, Vite, custom SVG visualizations, and optimized HTML5 Canvas**.

Live Demo: https://nexops-control.vercel.app

---

## Key Engineering Highlights

| Area | Implementation | Key Files |
| --- | --- | --- |
| **React 18 + Strict TypeScript + TanStack Query v5** | Strict TS (`noUncheckedIndexedAccess`), `keepPreviousData`, `AbortSignal` request cancellation, typed query key factory, Dark/Light CSS token system | `tsconfig.json`, `src/styles/tokens.css`, `src/lib/queryKeys.ts` |
| **State-Driven Workflow & FSM** | Discriminated-union Canary Rollout Finite State Machine (`rolloutReducer`) with guarded phase transitions and rollback recovery | `src/features/overview/rolloutMachine.ts`, `src/features/overview/RolloutWorkflow.tsx` |
| **Optimistic UI & Abortable Async Engine** | Instant cache mutations with automatic snapshot rollback + retry toasts, Chaos latency/error simulator, and multi-stage `AbortController` jobs | `src/features/overview/IncidentQueue.tsx`, `src/components/NodeInspectorDrawer.tsx`, `src/features/async-ops/AsyncOpsPage.tsx` |
| **Shared Primitives & Virtualization** | Modular feature slices with reusable `VirtualTable` (2,000+ rows + `useDeferredValue`), `Drawer`, `ToastProvider`, and `ErrorBoundary` | `src/shared/ui/Primitives.tsx`, `src/shared/ui/VirtualTable.tsx` |
| **Incremental Refactoring Lab** | Side-by-side render-isolation comparison contrasting un-memoized race-prone patterns with `React.memo` + `useMemo` + TanStack Query | `src/features/architecture/ArchitecturePage.tsx` |
| **Custom Interactive SVG Charts** | 4 responsive SVG charts (Multi-Series Area/Line + crosshair, Stacked Bar, Radial SLA Donut, Service×Time Heatmap) cross-linked to the audit table | `src/features/analytics/*` |
| **Dynamic SVG Pipeline & Animated Icons** | Interactive 5-stage SVG data pipeline scaled by throughput and fault state + 7 accessible animated `<StatusIcon />` variants | `src/features/overview/SvgPipelineMap.tsx`, `src/shared/ui/StatusIcon.tsx` |
| **High-Performance HTML5 Canvas (5,000 Nodes)** | Uniform Spatial Hash Grid $O(1)$ hit-testing, viewport frustum culling, offscreen sprite atlas, HiDPI scaling, and live Optimized vs Naive benchmark HUD | `src/features/canvas-map/spatialGrid.ts`, `src/features/canvas-map/canvasRenderer.ts`, `src/features/canvas-map/CanvasMapPage.tsx` |

---

## Architecture Overview

```text
src/
├── context/AppContext.tsx          # Workspace, timeRange, theme, Chaos config, AbortController job runner
├── lib/                            # QueryClient & typed queryKeys factory
├── services/mockApi.ts             # Seeded deterministic B2B telemetry & chaos-aware async API
├── shared/ui/                      # Design system primitives (StatusIcon, VirtualTable, Drawer, Toast, ErrorBoundary)
├── components/                     # AppShell, NodeInspectorDrawer, AsyncJobsDrawer
└── features/
    ├── overview/                   # KPI cards, Dynamic SVG Pipeline Map, Canary Rollout FSM, Optimistic Incident Queue
    ├── canvas-map/                 # SpatialGrid O(1), Offscreen Sprite Cache, Frustum Culling, 60fps Canvas HUD
    ├── analytics/                  # 4 custom interactive SVG charts linked to 2,000-row VirtualTable
    ├── async-ops/                  # Cancellable async jobs, Chaos Simulator, TanStack Query Cache Inspector
    └── architecture/               # System capabilities, Legacy-to-Modern Refactoring Lab, Design Token Swatches
```

---

## Quickstart

```bash
npm install
npm run dev        # Start local Vite dev server
npm run typecheck  # Strict TypeScript validation
npm test           # Run Vitest + React Testing Library suite
npm run build      # Typecheck + production bundle into dist/
```
