import type { TimeRange, WorkspaceId } from '../types/domain';

export const queryKeys = {
  all: ['nexops'] as const,
  overview: (workspace: WorkspaceId, timeRange: TimeRange) =>
    ['nexops', 'overview', workspace, timeRange] as const,
  topology: (workspace: WorkspaceId, nodeCount: number) =>
    ['nexops', 'topology', workspace, nodeCount] as const,
  analytics: (workspace: WorkspaceId, timeRange: TimeRange) =>
    ['nexops', 'analytics', workspace, timeRange] as const,
  incidents: (workspace: WorkspaceId) =>
    ['nexops', 'incidents', workspace] as const,
  auditEvents: (workspace: WorkspaceId) =>
    ['nexops', 'auditEvents', workspace] as const,
};
