import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, Wrench } from 'lucide-react';
import { queryKeys } from '../../lib/queryKeys';
import { fetchIncidents, mutateIncidentStatus } from '../../services/mockApi';
import { Badge, Button, Card, Skeleton } from '../../shared/ui/Primitives';
import { StatusIcon } from '../../shared/ui/StatusIcon';
import { useToast } from '../../shared/ui/ToastProvider';
import type {
  Incident,
  IncidentAction,
  IncidentStatus,
  WorkspaceId,
} from '../../types/domain';

function statusBadgeVariant(status: IncidentStatus) {
  switch (status) {
    case 'open':
      return 'critical' as const;
    case 'acknowledged':
      return 'degraded' as const;
    case 'mitigating':
      return 'recovering' as const;
    case 'resolved':
      return 'healthy' as const;
  }
}

export function IncidentQueue({
  workspace = 'apac-prod',
}: {
  workspace?: WorkspaceId;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const incidentsQuery = useQuery({
    queryKey: queryKeys.incidents(workspace),
    queryFn: ({ signal }) => fetchIncidents(workspace, signal),
  });

  const mutation = useMutation({
    mutationFn: ({
      incidentId,
      action,
    }: {
      incidentId: string;
      action: IncidentAction;
    }) => mutateIncidentStatus(workspace, incidentId, action),
    onMutate: async ({ incidentId, action }) => {
      const key = queryKeys.incidents(workspace);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Incident[]>(key);

      const nextStatus: IncidentStatus =
        action === 'acknowledge'
          ? 'acknowledged'
          : action === 'mitigate'
          ? 'mitigating'
          : 'resolved';

      if (previous) {
        queryClient.setQueryData<Incident[]>(
          key,
          previous.map((item) =>
            item.id === incidentId
              ? { ...item, status: nextStatus, _optimistic: true }
              : item
          )
        );
      }

      return { previous, key };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      pushToast({
        type: 'error',
        title: `Mutation rolled back (${variables.incidentId})`,
        description:
          error instanceof Error ? error.message : 'Server rejected update',
        action: {
          label: 'Retry',
          onClick: () => mutation.mutate(variables),
        },
      });
    },
    onSuccess: (updated) => {
      pushToast({
        type: 'success',
        title: `${updated.id} → ${updated.status}`,
        description: 'Confirmed by backend state store.',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents(workspace),
      });
    },
  });

  return (
    <Card
      title={
        <>
          <StatusIcon status="degraded" size={18} decorative />
          Active Incident Queue (Optimistic Mutations + Rollback)
        </>
      }
      subtitle="TanStack Query onMutate cache snapshot → immediate UI update → automatic rollback on simulated API errors"
      actions={<Badge variant="info">Tip: Test Error Rate in Chaos Simulator</Badge>}
    >
      {incidentsQuery.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={54} />
          <Skeleton height={54} />
          <Skeleton height={54} />
        </div>
      ) : incidentsQuery.isError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--status-critical)' }}>
            Failed to load incidents:{' '}
            {incidentsQuery.error instanceof Error
              ? incidentsQuery.error.message
              : 'Unknown error'}
          </span>
          <Button size="sm" onClick={() => incidentsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="incident-list">
          {(incidentsQuery.data ?? []).map((incident) => (
            <div
              key={incident.id}
              className={`incident-row ${
                incident._optimistic ? 'is-optimistic' : ''
              }`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {incident.id}
                  </span>
                  <Badge
                    variant={
                      incident.severity === 'sev1'
                        ? 'critical'
                        : incident.severity === 'sev2'
                        ? 'degraded'
                        : 'info'
                    }
                  >
                    {incident.severity.toUpperCase()}
                  </Badge>
                  <Badge variant={statusBadgeVariant(incident.status)}>
                    {incident.status}
                  </Badge>
                  {incident._optimistic && (
                    <Badge variant="info">Syncing optimistic...</Badge>
                  )}
                </div>
                <strong style={{ fontSize: 13 }}>{incident.title}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {incident.service} · {incident.region} ·{' '}
                  {incident.impactedRps.toLocaleString()} req/s affected ·{' '}
                  {incident.createdAt}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {incident.status === 'open' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Check size={13} />}
                    onClick={() =>
                      mutation.mutate({
                        incidentId: incident.id,
                        action: 'acknowledge',
                      })
                    }
                  >
                    Acknowledge
                  </Button>
                )}
                {(incident.status === 'open' ||
                  incident.status === 'acknowledged') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Wrench size={13} />}
                    onClick={() =>
                      mutation.mutate({
                        incidentId: incident.id,
                        action: 'mitigate',
                      })
                    }
                  >
                    Mitigate
                  </Button>
                )}
                {incident.status !== 'resolved' && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<ShieldCheck size={13} />}
                    onClick={() =>
                      mutation.mutate({
                        incidentId: incident.id,
                        action: 'resolve',
                      })
                    }
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
