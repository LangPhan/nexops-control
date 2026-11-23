import { Ban, Play, RotateCcw, Trash2 } from 'lucide-react';
import { JOB_TEMPLATES, useAppContext } from '../context/AppContext';
import { Drawer } from '../shared/ui/Drawer';
import { Badge, Button, EmptyState } from '../shared/ui/Primitives';
import { StatusIcon } from '../shared/ui/StatusIcon';

export function AsyncJobsDrawer() {
  const {
    jobsDrawerOpen,
    setJobsDrawerOpen,
    jobs,
    launchJob,
    cancelJob,
    retryJob,
    clearCompletedJobs,
  } = useAppContext();

  return (
    <Drawer
      open={jobsDrawerOpen}
      onClose={() => setJobsDrawerOpen(false)}
      title="Background Async Jobs"
      subtitle="Cancellable AbortController pipelines running across workspaces"
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant="primary"
          icon={<Play size={12} />}
          onClick={() => launchJob(JOB_TEMPLATES[0]!.id)}
        >
          Launch Rebalance
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Play size={12} />}
          onClick={() => launchJob(JOB_TEMPLATES[2]!.id)}
        >
          Launch Audit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 size={12} />}
          onClick={clearCompletedJobs}
        >
          Clear Finished
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<StatusIcon status="paused" size={28} decorative />}
          title="No background jobs queued"
          description="Launch a cluster rebalance or integrity audit above to inspect live step progress and cancellation."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusIcon
                    status={
                      job.status === 'running'
                        ? 'syncing'
                        : job.status === 'completed'
                        ? 'healthy'
                        : job.status === 'cancelled'
                        ? 'paused'
                        : 'critical'
                    }
                    size={16}
                    decorative
                  />
                  <strong style={{ fontSize: 13 }}>{job.title}</strong>
                </div>
                <Badge
                  variant={
                    job.status === 'completed'
                      ? 'healthy'
                      : job.status === 'running'
                      ? 'recovering'
                      : job.status === 'cancelled'
                      ? 'degraded'
                      : 'critical'
                  }
                >
                  {job.progressPct}%
                </Badge>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {job.workspace} · Started {job.startedAt}
                {job.errorMessage ? ` · ${job.errorMessage}` : ''}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {job.status === 'running' ? (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Ban size={12} />}
                    onClick={() => cancelJob(job.id)}
                  >
                    Abort Job
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={12} />}
                    onClick={() => retryJob(job.id)}
                  >
                    Re-run
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
