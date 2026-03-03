import { useState } from 'react';
import { submitRun } from '../api/client';

interface Props {
  onSubmitted: (runId: string) => void;
}

export function SubmitForm({ onSubmitted }: Props) {
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requirements.trim().length < 10) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await submitRun(requirements.trim());
      setRequirements('');
      onSubmitted(res.run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Submit a New Run</h2>
      <p className="text-sm text-gray-400 mb-6">
        Describe what you want to build. The agent pipeline will generate a plan,
        write code, review it for quality, and create test cases.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="e.g. Build a FastAPI endpoint that accepts a list of integers and returns their mean, median, and mode."
          rows={6}
          minLength={10}
          maxLength={8000}
          className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 resize-y"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {requirements.length} / 8000 characters (min 10)
          </span>
          <button
            type="submit"
            disabled={submitting || requirements.trim().length < 10}
            className="px-5 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Run'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
