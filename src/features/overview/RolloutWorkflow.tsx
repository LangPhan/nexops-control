import { useEffect, useReducer } from 'react';
import { Play, RotateCcw, ShieldAlert, TrendingUp } from 'lucide-react';
import { Badge, Button, Card } from '../../shared/ui/Primitives';
import { StatusIcon, type StatusIconVariant } from '../../shared/ui/StatusIcon';
import {
  createInitialRolloutState,
  getAllowedActions,
  rolloutReducer,
} from './rolloutMachine';
import type { RolloutPhase } from '../../types/domain';

const STEP_LABELS: ReadonlyArray<{ key: string; label: string; desc: string }> = [
  { key: 'validate', label: '1. Validate', desc: 'Schema & pre-flight' },
  { key: 'canary', label: '2. Canary 10%', desc: 'Error budget check' },
  { key: 'rollout', label: '3. Rollout', desc: '50% → 80% shift' },
  { key: 'verify', label: '4. Verified', desc: '100% SLA lock' },
];

function phaseToBadge(phase: RolloutPhase) {
  switch (phase) {
    case 'verified':
      return 'healthy' as const;
    case 'degraded':
      return 'critical' as const;
    case 'rolling_back':
    case 'rolled_back':
      return 'degraded' as const;
    case 'validating':
    case 'canary':
    case 'rolling_out':
      return 'recovering' as const;
    case 'idle':
      return 'neutral' as const;
  }
}

function phaseToIcon(phase: RolloutPhase): StatusIconVariant {
  switch (phase) {
    case 'verified':
      return 'healthy';
    case 'degraded':
      return 'critical';
    case 'rolling_back':
      return 'recovering';
    case 'rolled_back':
      return 'paused';
    case 'validating':
    case 'canary':
    case 'rolling_out':
      return 'syncing';
    case 'idle':
      return 'maintenance';
  }
}

export function RolloutWorkflow() {
  const [state, dispatch] = useReducer(
    rolloutReducer,
    'v4.9.0-rc2',
    createInitialRolloutState
  );

  const controls = getAllowedActions(state);

  // Automatic progression timers for async phases (cleanly cancelled on unmount/state change)
  useEffect(() => {
    if (state.phase === 'validating') {
      const t = window.setTimeout(
        () => dispatch({ type: 'VALIDATION_PASSED' }),
        950
      );
      return () => window.clearTimeout(t);
    }

    if (state.phase === 'rolling_out') {
      const t = window.setTimeout(
        () => dispatch({ type: 'STEP_PROGRESS' }),
        1050
      );
      return () => window.clearTimeout(t);
    }

    if (state.phase === 'rolling_back') {
      const t = window.setTimeout(
        () => dispatch({ type: 'ROLLBACK_COMPLETE' }),
        950
      );
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [state.phase, state.trafficPct]);

  const activeStepIdx =
    state.phase === 'idle'
      ? -1
      : state.phase === 'validating'
      ? 0
      : state.phase === 'canary'
      ? 1
      : state.phase === 'rolling_out'
      ? 2
      : state.phase === 'verified'
      ? 3
      : 1;

  return (
    <Card
      title={
        <>
          <StatusIcon status={phaseToIcon(state.phase)} size={18} decorative />
          State-Driven Canary Rollout
        </>
      }
      subtitle="Discriminated union finite state machine with guarded transitions"
      actions={
        <Badge variant={phaseToBadge(state.phase)}>
          {state.phase.toUpperCase()} · {state.trafficPct}%
        </Badge>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="rollout-steps">
          {STEP_LABELS.map((step, idx) => {
            const isError = state.phase === 'degraded' && idx === activeStepIdx;
            const isDone =
              state.phase === 'verified' ||
              (activeStepIdx > idx && state.phase !== 'rolled_back');
            const isActive =
              !isError && idx === activeStepIdx && state.phase !== 'verified';

            return (
              <div
                key={step.key}
                className={`rollout-step ${
                  isError
                    ? 'is-error'
                    : isDone
                    ? 'is-done'
                    : isActive
                    ? 'is-active'
                    : ''
                }`}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {step.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {step.desc}
                </span>
              </div>
            );
          })}
        </div>

        {'reason' in state && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-critical-soft)',
              border: '1px solid rgba(239,68,68,0.35)',
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
          >
            <strong>Reason:</strong> {state.reason}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={13} />}
            disabled={!controls.canStart}
            onClick={() => dispatch({ type: 'START' })}
          >
            Start Release
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<TrendingUp size={13} />}
            disabled={!controls.canPromote}
            onClick={() => dispatch({ type: 'PROMOTE' })}
          >
            Promote Rollout
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<ShieldAlert size={13} />}
            disabled={!controls.canInjectFault}
            onClick={() =>
              dispatch({
                type: 'INJECT_FAULT',
                reason: 'Canary P99 latency exceeded 240ms budget',
              })
            }
          >
            Simulate Canary Fault
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!controls.canRollback}
            onClick={() => dispatch({ type: 'ROLLBACK' })}
          >
            Trigger Rollback
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={13} />}
            disabled={!controls.canReset}
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Reset
          </Button>
        </div>

        <div className="rollout-log" aria-label="State machine transition log">
          {state.logs.map((entry) => (
            <div key={entry.id}>
              <span style={{ color: 'var(--text-muted)' }}>
                [{entry.timestamp}]
              </span>{' '}
              <span style={{ color: 'var(--accent-primary)' }}>
                {entry.from} → {entry.to}
              </span>{' '}
              <span>· {entry.note}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
