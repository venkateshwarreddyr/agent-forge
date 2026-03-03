import type { ReactNode } from 'react';

export type Tab = 'submit' | 'runs' | 'detail';

const tabs: { key: Tab; label: string }[] = [
  { key: 'submit', label: 'New Run' },
  { key: 'runs', label: 'Runs' },
];

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  children: ReactNode;
}

export function AppShell({ tab, setTab, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-surface-800 border-b border-surface-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-base font-semibold text-gray-100">
                Multi-Agent Orchestrator
              </h1>
            </div>
            <nav className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    tab === t.key
                      ? 'bg-surface-600 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
