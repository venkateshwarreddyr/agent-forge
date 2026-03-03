import type { RunStatus } from '../types/run';

const styles: Record<RunStatus, string> = {
  pending: 'bg-yellow-900/40 text-warning border-warning/30',
  running: 'bg-blue-900/40 text-accent-400 border-accent-500/30',
  completed: 'bg-green-900/40 text-success border-success/30',
  failed: 'bg-red-900/40 text-danger border-danger/30',
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse mr-1.5" />
      )}
      {status}
    </span>
  );
}
