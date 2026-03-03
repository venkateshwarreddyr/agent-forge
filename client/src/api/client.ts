import type { CreateRunResponse, ListRunsResponse, Run } from '../types/run';

export async function submitRun(requirements: string): Promise<CreateRunResponse> {
  const res = await fetch('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getRun(runId: string): Promise<Run> {
  const res = await fetch(`/run/${runId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function listRuns(
  status = 'completed',
  limit = 20,
): Promise<ListRunsResponse> {
  const res = await fetch(`/run?status=${status}&limit=${limit}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}
