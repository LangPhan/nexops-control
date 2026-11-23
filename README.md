# NexOps Control — B2B Real-Time Operations & Pipeline Topology

Interactive enterprise Frontend Developer (5+ YOE) portfolio demo built with **React 18, TypeScript (strict), TanStack Query v5, Vite, custom SVG visualizations, and optimized HTML5 Canvas** to demonstrate every core requirement and bonus criterion from the Job Description.

---

## JD Skill Mapping (Đối chiếu yêu cầu tuyển dụng)

| JD Requirement / Bonus | Implemented Proof in NexOps Control | Key Files |
| --- | --- | --- |
| **React 18+ & TypeScript, TanStack Query, Vite, Figma tokens** | Strict TS (`noUncheckedIndexedAccess`), TanStack Query v5 (`keepPreviousData`, `AbortSignal`, cache subscription), Figma-ready CSS variables (Dark/Light themes) | `tsconfig.json`, `src/styles/tokens.css`, `src/lib/queryKeys.ts` |
| **UI phức tạp, thay đổi theo luồng dữ liệu & trạng thái** | Discriminated-union Canary Rollout Finite State Machine (`rolloutReducer`), live multi-workspace switching | `src/features/overview/rolloutMachine.ts`, `src/features/overview/RolloutWorkflow.tsx` |
| **UI tương tác/trạng thái phản ánh hành động & tác vụ bất đồng bộ** | Optimistic incident & node mutations with snapshot rollback + retry toast, `AbortController` multi-stage jobs, Chaos Simulator | `src/features/overview/IncidentQueue.tsx`, `src/components/NodeInspectorDrawer.tsx`, `src/features/async-ops/AsyncOpsPage.tsx` |
| **Thiết kế cấu trúc FE & component dùng chung, tối ưu hiệu suất** | Feature-sliced modules + shared accessible primitives (`VirtualTable` 2,000 rows, `Drawer`, `ToastProvider`, `ErrorBoundary`), React 18 `useDeferredValue` | `src/shared/ui/Primitives.tsx`, `src/shared/ui/VirtualTable.tsx` |
| **Hiểu codebase cũ & cải tiến dần dần (Strangler Fig)** | Interactive Legacy vs Modernized live render-counter lab + 4-step team migration checklist | `src/features/architecture/ArchitecturePage.tsx` |
| **Điểm cộng #1: Đa dạng biểu đồ (Charts)** | 4 custom interactive SVG charts (Multi-Series Area/Line + crosshair, Stacked Bar, Radial SLA Donut, Service×Time Heatmap) cross-filtered with 2,000-row table | `src/features/analytics/*` |
| **Điểm cộng #2: Trực quan hóa trạng thái & icon động SVG** | Interactive 5-stage SVG Data Pipeline (flow speed scaled by throughput + fault ring animations) + 7 animated `<StatusIcon />` states | `src/features/overview/SvgPipelineMap.tsx`, `src/shared/ui/StatusIcon.tsx` |
| **Điểm cộng #3: Đồ họa tương tác Canvas & tối ưu rendering** | 250–5,000 node Pan/Zoom HTML5 Canvas with **Spatial Hash Grid** $O(1)$ hit-testing, **Viewport Frustum Culling**, **Offscreen Sprite Atlas**, HiDPI scaling, live FPS HUD & **Optimized vs Naive** benchmark mode | `src/features/canvas-map/spatialGrid.ts`, `src/features/canvas-map/canvasRenderer.ts`, `src/features/canvas-map/CanvasMapPage.tsx` |

---

## Architecture Overview

```text
src/
├── context/AppContext.tsx          # Global workspace, timeRange, theme, Chaos config, AbortController job runner
├── lib/                            # QueryClient & typed queryKeys factory
├── services/mockApi.ts             # Seeded deterministic B2B telemetry & chaos-aware async API
├── shared/ui/                      # Reusable design system primitives (StatusIcon, VirtualTable, Drawer, Toast, ErrorBoundary)
├── components/                     # AppShell, NodeInspectorDrawer, AsyncJobsDrawer
└── features/
    ├── overview/                   # KPI cards, Dynamic SVG Pipeline Map, Canary Rollout FSM, Optimistic Incident Queue
    ├── canvas-map/                 # SpatialGrid O(1), Offscreen Sprite Cache, Frustum Culling, 60fps Canvas HUD
    ├── analytics/                  # 4 custom interactive SVG charts linked to 2,000-row VirtualTable
    ├── async-ops/                  # Cancellable async jobs, Chaos Simulator, TanStack Query Cache Inspector
    └── architecture/               # JD Skill Matrix, Legacy-to-Modern Refactoring Lab, Figma Token Swatches
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
