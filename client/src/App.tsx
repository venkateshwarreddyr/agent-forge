import { useState } from 'react';
import { AppShell, type Tab } from './components/AppShell';
import { SubmitForm } from './components/SubmitForm';
import { RunsList } from './components/RunsList';
import { RunDetail } from './components/RunDetail';
import { useRuns } from './hooks/useRuns';

export default function App() {
  const [tab, setTab] = useState<Tab>('submit');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { runs, loading: runsLoading, refresh: refreshRuns } = useRuns();

  const openRun = (runId: string) => {
    setActiveRunId(runId);
    setTab('detail');
  };

  return (
    <AppShell tab={tab} setTab={setTab}>
      {tab === 'submit' && (
        <SubmitForm
          onSubmitted={(id) => {
            refreshRuns();
            openRun(id);
          }}
        />
      )}
      {tab === 'runs' && (
        <RunsList runs={runs} loading={runsLoading} onSelectRun={openRun} />
      )}
      {tab === 'detail' && (
        <RunDetail
          runId={activeRunId}
          onBack={() => {
            refreshRuns();
            setTab('runs');
          }}
        />
      )}
    </AppShell>
  );
}
