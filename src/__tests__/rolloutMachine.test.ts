import { describe, expect, it } from 'vitest';
import {
  createInitialRolloutState,
  getAllowedActions,
  rolloutReducer,
} from '../features/overview/rolloutMachine';

describe('rolloutReducer finite state machine', () => {
  it('progresses cleanly along the happy path to verified 100%', () => {
    let state = createInitialRolloutState('v4.9.0-rc2');
    expect(state.phase).toBe('idle');
    expect(getAllowedActions(state).canStart).toBe(true);

    state = rolloutReducer(state, { type: 'START' });
    expect(state.phase).toBe('validating');

    state = rolloutReducer(state, { type: 'VALIDATION_PASSED' });
    expect(state.phase).toBe('canary');
    expect(state.trafficPct).toBe(10);

    state = rolloutReducer(state, { type: 'PROMOTE' });
    expect(state.phase).toBe('rolling_out');
    expect(state.trafficPct).toBe(50);

    state = rolloutReducer(state, { type: 'STEP_PROGRESS' });
    expect(state.phase).toBe('rolling_out');
    expect(state.trafficPct).toBe(80);

    state = rolloutReducer(state, { type: 'STEP_PROGRESS' });
    expect(state.phase).toBe('verified');
    expect(state.trafficPct).toBe(100);
    expect(getAllowedActions(state).canReset).toBe(true);
  });

  it('handles canary fault injection and full rollback', () => {
    let state = createInitialRolloutState();
    state = rolloutReducer(state, { type: 'START' });
    state = rolloutReducer(state, { type: 'VALIDATION_PASSED' });
    state = rolloutReducer(state, {
      type: 'INJECT_FAULT',
      reason: 'P99 breach',
    });

    expect(state.phase).toBe('degraded');
    expect(getAllowedActions(state).canRollback).toBe(true);

    state = rolloutReducer(state, { type: 'ROLLBACK' });
    expect(state.phase).toBe('rolling_back');

    state = rolloutReducer(state, { type: 'ROLLBACK_COMPLETE' });
    expect(state.phase).toBe('rolled_back');
    expect(state.trafficPct).toBe(0);
  });

  it('ignores invalid actions in guarded states', () => {
    const initial = createInitialRolloutState();
    const afterInvalidPromote = rolloutReducer(initial, { type: 'PROMOTE' });
    expect(afterInvalidPromote).toBe(initial);

    const afterInvalidRollback = rolloutReducer(initial, { type: 'ROLLBACK' });
    expect(afterInvalidRollback).toBe(initial);
  });
});
