import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { api, type AutomationRun } from '@/services/api';

export function AutomationStatus({ businessId }: { businessId: string }) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.listAutomationRuns(businessId);
        if (active) { setRuns(result); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load automation status.');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [businessId]);

  const monthly = runs.find(run => run.runKey.startsWith('monthly:'));
  const weekly = runs.find(run => run.runKey.startsWith('weekly:auto:'));
  function renderRun(latest: AutomationRun | undefined, label: string) {
    if (!latest) return <p className="text-sm mt-2">No {label.toLowerCase()} generation run has started for this business yet.</p>;
    const running = latest.status === 'running' || latest.status === 'queued';
    const completed = latest.status === 'completed';
    const failed = latest.status === 'failed';
    return <div className="automation-run-status"><strong>{label}</strong><p className="text-sm mt-2 flex items-center gap-2">{running ? <LoaderCircle className="animate-spin" size={16} /> : failed ? <AlertTriangle size={16} /> : completed ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}{running ? latest.result.stage || `Preparing ${label.toLowerCase()} posts…` : failed ? `The ${label.toLowerCase()} run failed.` : completed ? `${label} posts are ready.` : `Latest run: ${latest.status}.`}</p>{(running || failed) && <><progress className="w-full mt-2" max={latest.result.total || 1} value={latest.result.completed || 0} /><p className="text-xs mt-1">{latest.result.completed || 0} of {latest.result.total || 0} complete{latest.result.current ? ` · ${latest.result.current.platform} post ${latest.result.current.index}` : ''}.</p></>}{failed && <p className="text-sm mt-2">{latest.error || latest.result.error || 'Check the OpenAI provider configuration and server logs.'} Posts already completed remain available for review.</p>}{completed && <p className="text-sm mt-2">{latest.result.completed || 0} complete posts were generated. Review them in the calendar or approvals queue.</p>}{latest.startedAt && <p className="text-xs mt-2">Started {new Date(latest.startedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}.</p>}</div>;
  }

  return <section className="notice my-4" aria-live="polite">
    <div><strong>Automatic content generation status</strong>{error ? <p className="text-sm mt-2">{error}</p> : <>{renderRun(monthly, 'Monthly')}{renderRun(weekly, 'Weekly')}</>}</div>
  </section>;
}
