import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { IncidentQueue } from '../features/overview/IncidentQueue';
import { createAppQueryClient } from '../lib/queryClient';
import { resetWorkspaceStore, setChaosConfig } from '../services/mockApi';
import { ToastProvider } from '../shared/ui/ToastProvider';

describe('IncidentQueue optimistic mutation & rollback', () => {
  beforeEach(() => {
    resetWorkspaceStore();
    setChaosConfig({ latencyMs: 15, errorRate: 0 });
  });

  it('optimistically updates incident status then rolls back cleanly on API error', async () => {
    const client = createAppQueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <IncidentQueue workspace="apac-prod" />
        </ToastProvider>
      </QueryClientProvider>
    );

    // Wait for initial incidents to load
    expect(
      await screen.findByText(/P95 tail latency spike on Transform Pool/i)
    ).toBeInTheDocument();

    // Now force 100% failure with enough delay to observe optimistic state first
    setChaosConfig({ latencyMs: 120, errorRate: 1 });

    const ackButtons = screen.getAllByRole('button', { name: /Acknowledge/i });
    expect(ackButtons.length).toBeGreaterThan(0);

    await user.click(ackButtons[0]!);

    // Optimistic state should appear immediately before RPC finishes
    expect(await screen.findByText(/Syncing optimistic/i)).toBeInTheDocument();

    // After RPC fails (errorRate = 1), rollback toast must appear and optimistic indicator clears
    await waitFor(
      () => {
        expect(screen.getByText(/Mutation rolled back/i)).toBeInTheDocument();
      },
      { timeout: 2500 }
    );

    // Incident remains open (2 Acknowledge buttons restored after rollback)
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Acknowledge/i }).length
      ).toBe(2);
    });
  });
});
