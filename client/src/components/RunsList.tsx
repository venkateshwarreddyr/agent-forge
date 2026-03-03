import type { Run } from '../types/run';
import { StatusBadge } from './StatusBadge';

interface Props {
  runs: Run[];
  loading: boolean;
  onSelectRun: (runId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RunsList({ runs, loading, onSelectRun }: Props) {
  if (loading && runs.length === 0) {
    return <p className="text-gray-400 text-sm">Loading runs...</p>;
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">No runs yet. Submit your first request!</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Recent Runs</h2>
      <div className="bg-surface-800 border border-surface-600 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-600 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requirements</th>
              <th className="px-4 py-3 font-medium text-right">Quality</th>
              <th className="px-4 py-3 font-medium text-right">Cost</th>
              <th className="px-4 py-3 font-medium text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.run_id}
                onClick={() => onSelectRun(run.run_id)}
                className="border-b border-surface-700 last:border-b-0 hover:bg-surface-700/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-gray-200 max-w-md truncate">
                  {run.requirements.slice(0, 80)}
                  {run.requirements.length > 80 && '...'}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {run.quality_score != null
                    ? `${(run.quality_score * 100).toFixed(0)}%`
                    : '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {run.total_cost_usd != null
                    ? `$${run.total_cost_usd.toFixed(4)}`
                    : '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {formatDate(run.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
