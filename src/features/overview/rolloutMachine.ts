import type {
  RolloutAction,
  RolloutLogEntry,
  RolloutPhase,
  RolloutState,
} from '../../types/domain';

function appendLog(
  logs: RolloutLogEntry[],
  from: RolloutPhase,
  to: RolloutPhase,
  note: string
): RolloutLogEntry[] {
  const entry: RolloutLogEntry = {
    id: `log-${logs.length + 1}-${Date.now().toString(36)}`,
    timestamp: new Date().toLocaleTimeString(),
    from,
    to,
    note,
  };
  return [entry, ...logs].slice(0, 24);
}

export function createInitialRolloutState(version = 'v4.9.0-rc2'): RolloutState {
  return {
    phase: 'idle',
    version,
    trafficPct: 0,
    errorBudgetPct: 100,
    logs: [
      {
        id: 'log-init',
        timestamp: new Date().toLocaleTimeString(),
        from: 'idle',
        to: 'idle',
        note: `Release candidate ${version} staged for B2B verification`,
      },
    ],
  };
}

export function rolloutReducer(
  state: RolloutState,
  action: RolloutAction
): RolloutState {
  switch (action.type) {
    case 'START': {
      if (state.phase !== 'idle') return state;
      const version = action.version ?? state.version;
      return {
        phase: 'validating',
        version,
        trafficPct: 0,
        errorBudgetPct: 100,
        logs: appendLog(
          state.logs,
          state.phase,
          'validating',
          `Running schema contracts & pre-flight checks for ${version}`
        ),
      };
    }

    case 'VALIDATION_PASSED': {
      if (state.phase !== 'validating') return state;
      return {
        phase: 'canary',
        version: state.version,
        trafficPct: 10,
        errorBudgetPct: 98,
        logs: appendLog(
          state.logs,
          state.phase,
          'canary',
          'Pre-flight green; routing 10% B2B canary traffic'
        ),
      };
    }

    case 'VALIDATION_FAILED': {
      if (state.phase !== 'validating') return state;
      return {
        phase: 'degraded',
        version: state.version,
        trafficPct: 0,
        reason: action.reason,
        errorBudgetPct: 42,
        logs: appendLog(
          state.logs,
          state.phase,
          'degraded',
          `Validation halted: ${action.reason}`
        ),
      };
    }

    case 'PROMOTE': {
      if (state.phase !== 'canary') return state;
      return {
        phase: 'rolling_out',
        version: state.version,
        trafficPct: 50,
        errorBudgetPct: 96,
        logs: appendLog(
          state.logs,
          state.phase,
          'rolling_out',
          'Canary SLO healthy; promoting deployment to 50% cluster traffic'
        ),
      };
    }

    case 'STEP_PROGRESS': {
      if (state.phase !== 'rolling_out') return state;
      if (state.trafficPct === 50) {
        return {
          ...state,
          trafficPct: 80,
          logs: appendLog(
            state.logs,
            'rolling_out',
            'rolling_out',
            'Progressive shift reached 80% traffic across regional hubs'
          ),
        };
      }
      return {
        phase: 'verified',
        version: state.version,
        trafficPct: 100,
        errorBudgetPct: 97,
        logs: appendLog(
          state.logs,
          state.phase,
          'verified',
          `${state.version} serving 100% production traffic cleanly`
        ),
      };
    }

    case 'COMPLETE': {
      if (state.phase !== 'rolling_out') return state;
      return {
        phase: 'verified',
        version: state.version,
        trafficPct: 100,
        errorBudgetPct: 97,
        logs: appendLog(
          state.logs,
          state.phase,
          'verified',
          `${state.version} verified at 100% traffic`
        ),
      };
    }

    case 'INJECT_FAULT': {
      if (state.phase !== 'canary' && state.phase !== 'rolling_out') {
        return state;
      }
      return {
        phase: 'degraded',
        version: state.version,
        trafficPct: state.trafficPct,
        reason: action.reason,
        errorBudgetPct: 18,
        logs: appendLog(
          state.logs,
          state.phase,
          'degraded',
          `SLO breach detected: ${action.reason}`
        ),
      };
    }

    case 'ROLLBACK': {
      if (state.phase !== 'degraded') return state;
      return {
        phase: 'rolling_back',
        version: state.version,
        trafficPct: state.trafficPct,
        reason: state.reason,
        errorBudgetPct: state.errorBudgetPct,
        logs: appendLog(
          state.logs,
          state.phase,
          'rolling_back',
          'Draining canary shards and restoring previous stable manifest'
        ),
      };
    }

    case 'ROLLBACK_COMPLETE': {
      if (state.phase !== 'rolling_back') return state;
      return {
        phase: 'rolled_back',
        version: state.version,
        trafficPct: 0,
        reason: state.reason,
        errorBudgetPct: 100,
        logs: appendLog(
          state.logs,
          state.phase,
          'rolled_back',
          'Rollback verified: 100% traffic restored to stable baseline'
        ),
      };
    }

    case 'RESET': {
      if (state.phase !== 'verified' && state.phase !== 'rolled_back') {
        return state;
      }
      return createInitialRolloutState(state.version);
    }

    default:
      return state;
  }
}

export interface AllowedRolloutControls {
  canStart: boolean;
  canPromote: boolean;
  canInjectFault: boolean;
  canRollback: boolean;
  canReset: boolean;
}

export function getAllowedActions(state: RolloutState): AllowedRolloutControls {
  return {
    canStart: state.phase === 'idle',
    canPromote: state.phase === 'canary',
    canInjectFault: state.phase === 'canary' || state.phase === 'rolling_out',
    canRollback: state.phase === 'degraded',
    canReset: state.phase === 'verified' || state.phase === 'rolled_back',
  };
}
