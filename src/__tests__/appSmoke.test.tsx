import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createAppQueryClient } from '../lib/queryClient';
import { resetWorkspaceStore, setChaosConfig } from '../services/mockApi';

describe('NexOps Control App smoke navigation', () => {
  beforeEach(() => {
    resetWorkspaceStore();
    setChaosConfig({ latencyMs: 15, errorRate: 0 });
  });

  it('renders AppShell and switches across all 5 JD showcase views cleanly', async () => {
    const client = createAppQueryClient();
    const user = userEvent.setup();

    render(<App customQueryClient={client} />);

    // 1. Operations Overview
    expect(
      await screen.findByText(/B2B Real-Time Operations Overview/i)
    ).toBeInTheDocument();

    // 2. Canvas Topology
    await user.click(
      screen.getByRole('button', { name: /Canvas Topology/i })
    );
    expect(
      await screen.findByText(/Interactive HTML5 Canvas Network Topology/i)
    ).toBeInTheDocument();

    // 3. Analytics & Charts
    await user.click(
      screen.getByRole('button', { name: /Analytics & Charts/i })
    );
    expect(
      await screen.findByText(/Diverse B2B Charts & Virtualized Telemetry Stream/i)
    ).toBeInTheDocument();

    // 4. Async & Query Lab
    await user.click(
      screen.getByRole('button', { name: /Async & Query Lab/i })
    );
    expect(
      await screen.findByText(/Async Task Engine & TanStack Query Inspector/i)
    ).toBeInTheDocument();

    // 5. Architecture & JD Map
    await user.click(
      screen.getByRole('button', { name: /Architecture & JD Map/i })
    );
    expect(
      await screen.findByText(/Architecture, Incremental Refactoring & JD Coverage Map/i)
    ).toBeInTheDocument();
  });
});
