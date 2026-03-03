import { useState, useEffect, useCallback } from 'react';
import { listRuns } from '../api/client';
import type { Run } from '../types/run';

export function useRuns() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [completed, running, pending] = await Promise.all([
        listRuns('completed', 20),
        listRuns('running', 20),
        listRuns('pending', 20),
      ]);
      const all = [...pending.runs, ...running.runs, ...completed.runs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRuns(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { runs, loading, error, refresh: load };
}
