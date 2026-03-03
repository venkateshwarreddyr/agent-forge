import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useRunPoller } from '../hooks/useRunPoller';
import { StatusBadge } from './StatusBadge';
import type { Run, TestCase } from '../types/run';

interface Props {
  runId: string | null;
  onBack: () => void;
}

export function RunDetail({ runId, onBack }: Props) {
  const { run, loading, error } = useRunPoller(runId);

  if (!runId) {
    return <p className="text-gray-400">Select a run to view details.</p>;
  }

  if (loading && !run) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Spinner /> Loading run...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-danger/30 rounded-lg text-danger">
        {error}
      </div>
    );
  }

  if (!run) return null;

  const isActive = run.status === 'pending' || run.status === 'running';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to runs
        </button>
        <div className="flex items-center gap-3">
          {isActive && <Spinner />}
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Requirements */}
      <Section title="Requirements">
        <p className="text-gray-300 whitespace-pre-wrap">{run.requirements}</p>
      </Section>

      {/* Pipeline progress */}
      {isActive && <PipelineProgress run={run} />}

      {/* Plan */}
      {run.plan && (
        <Section title="Plan">
          <pre className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
            {run.plan}
          </pre>
        </Section>
      )}

      {/* Code */}
      {run.code && <CodeSection code={run.code} />}

      {/* Review */}
      {run.review && (
        <Section title="Review">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <QualityBar score={run.review.quality_score} />
              <span
                className={`text-sm font-medium ${
                  run.review.approved ? 'text-success' : 'text-danger'
                }`}
              >
                {run.review.approved ? 'Approved' : 'Not Approved'}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{run.review.summary}</p>
          </div>
        </Section>
      )}

      {/* Tests */}
      {run.tests && run.tests.length > 0 && (
        <Section title="Tests">
          {run.test_results && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{
                    width: `${run.test_results.success_rate * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm text-gray-300">
                {run.test_results.passed}/{run.test_results.total} passed
              </span>
            </div>
          )}
          <div className="space-y-2">
            {run.tests.map((tc, i) => (
              <TestCaseItem key={i} testCase={tc} />
            ))}
          </div>
        </Section>
      )}

      {/* Cost & Tokens */}
      <Section title="Cost & Usage">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {run.revision_count != null && (
            <Stat label="Revisions" value={String(run.revision_count)} />
          )}
          {run.total_cost_usd != null && (
            <Stat label="Total Cost" value={`$${run.total_cost_usd.toFixed(4)}`} />
          )}
          {run.quality_score != null && (
            <Stat
              label="Final Quality"
              value={`${(run.quality_score * 100).toFixed(0)}%`}
            />
          )}
          <Stat
            label="Updated"
            value={new Date(run.updated_at).toLocaleTimeString()}
          />
        </div>
        {run.token_usage && Object.keys(run.token_usage).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Token Usage by Agent</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(run.token_usage).map(([agent, tokens]) => (
                <div
                  key={agent}
                  className="bg-surface-700 rounded px-3 py-2 text-xs"
                >
                  <span className="text-gray-400 capitalize">{agent}</span>
                  <span className="block text-gray-200 font-mono mt-0.5">
                    {tokens.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Errors */}
      {run.errors && run.errors.length > 0 && (
        <Section title="Errors">
          <ul className="space-y-1">
            {run.errors.map((err, i) => (
              <li key={i} className="text-sm text-danger">
                {err}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-800 border border-surface-600 rounded-lg p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function CodeSection({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Section title="Generated Code">
      <div className="relative">
        <button
          onClick={copy}
          className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-surface-600 text-gray-300 rounded hover:bg-surface-500 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </Section>
  );
}

function QualityBar({ score }: { score: number }) {
  const pct = score * 100;
  const color = pct >= 70 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono text-gray-200">{pct.toFixed(0)}%</span>
    </div>
  );
}

function TestCaseItem({ testCase }: { testCase: TestCase }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-surface-600 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-surface-700/50 transition-colors"
      >
        <span className="text-gray-200">{testCase.name}</span>
        <span className="text-gray-500 text-xs">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="border-t border-surface-600 p-4 space-y-2 text-sm">
          <p className="text-gray-400">{testCase.description}</p>
          <SyntaxHighlighter
            language="python"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.75rem' }}
          >
            {testCase.testCode}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

function PipelineProgress({ run }: { run: Run }) {
  const steps = [
    { label: 'Plan', done: !!run.plan },
    { label: 'Code', done: !!run.code },
    { label: 'Review', done: !!run.review },
    { label: 'Tests', done: !!run.tests?.length },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border ${
              s.done
                ? 'bg-success/20 border-success/40 text-success'
                : 'bg-surface-700 border-surface-600 text-gray-500'
            }`}
          >
            {s.done ? '\u2713' : i + 1}
          </div>
          <span
            className={`text-xs ${s.done ? 'text-gray-200' : 'text-gray-500'}`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className="w-8 h-px bg-surface-600" />
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-mono text-gray-200">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 text-accent-400"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
