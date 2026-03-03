import { useState, useEffect } from 'react';
import { getRun } from '../api/client';
import type { Run } from '../types/run';

const TERMINAL = new Set(['completed', 'failed']);
const POLL_MS = 2500;

export function useRunPoller(runId: string | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setRun(null);

    const poll = async () => {
      if (!alive) return;
      try {
        const data = await getRun(runId);
        if (!alive) return;
        setRun(data);
        setLoading(false);
        if (!TERMINAL.has(data.status)) {
          setTimeout(poll, POLL_MS);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    };

    poll();
    return () => {
      alive = false;
    };
  }, [runId]);

  return { run, loading, error };
}
