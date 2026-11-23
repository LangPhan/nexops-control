import { QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { AsyncJobsDrawer } from './components/AsyncJobsDrawer';
import { NodeInspectorDrawer } from './components/NodeInspectorDrawer';
import { AppProvider, useAppContext } from './context/AppContext';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { ArchitecturePage } from './features/architecture/ArchitecturePage';
import { AsyncOpsPage } from './features/async-ops/AsyncOpsPage';
import { CanvasMapPage } from './features/canvas-map/CanvasMapPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { createAppQueryClient, queryClient } from './lib/queryClient';
import { ErrorBoundary } from './shared/ui/Primitives';
import { ToastProvider } from './shared/ui/ToastProvider';

function ActiveFeatureView() {
  const { activeTab } = useAppContext();

  switch (activeTab) {
    case 'overview':
      return <OverviewPage />;
    case 'canvas':
      return <CanvasMapPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'async-ops':
      return <AsyncOpsPage />;
    case 'architecture':
      return <ArchitecturePage />;
  }
}

export function App({
  customQueryClient,
}: {
  customQueryClient?: ReturnType<typeof createAppQueryClient>;
}) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={customQueryClient ?? queryClient}>
        <ToastProvider>
          <AppProvider>
            <AppShell>
              <ActiveFeatureView />
            </AppShell>
            <NodeInspectorDrawer />
            <AsyncJobsDrawer />
          </AppProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
