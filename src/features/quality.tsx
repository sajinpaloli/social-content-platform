import { useState } from 'react';
import { CheckCircle2, AlertCircle, TriangleAlert, ShieldAlert, RefreshCw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { workflows, type Platform, type QualityResult } from '@/services/api';
import { toast } from 'sonner';

interface Props {
  caption: string;
  platform: Platform;
  limit: number;
  restricted: boolean;
  duplicate: boolean;
  format: string;
  sources?: { title: string; url: string }[];
  onRegenerate?: (() => void | boolean | Promise<void | boolean>) | undefined;
  compact?: boolean;
}

const icons = { Pass: CheckCircle2, Warning: TriangleAlert, Fail: AlertCircle, 'Needs human review': ShieldAlert };

export function QualityReport({ caption, platform, limit, restricted, duplicate, format, sources = [], onRegenerate, compact }: Props) {
  const [results, setResults] = useState<QualityResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSources, setShowSources] = useState(false);
  async function run() {
    setBusy(true);
    try {
      setResults(await workflows.qualityChecks(caption, { platform, limit, restricted, duplicate, format, sources }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Quality review failed. Check server and provider settings.');
    } finally {
      setBusy(false);
    }
  }
  async function regenerate() {
    if (!onRegenerate) return;
    setBusy(true);
    try {
      const repaired = await onRegenerate();
      if (repaired !== false) setResults(null);
    } finally {
      setBusy(false);
    }
  }
  const review = results?.some((result) => result.status === 'Needs human review');
  return (
    <div className={compact ? '' : 'form-section mt-5'}>
      <div className="flex items-center justify-between gap-3"><h2>Quality checks</h2><Button size="sm" variant="outline" disabled={busy} onClick={run}><RefreshCw />{busy ? 'Checking…' : results ? 'Run again' : 'Run checks'}</Button></div>
      <p className="sample-label mt-2">AI-assisted checks run on the server. Review every factual claim and source before approval.</p>
      {!results ? <p className="mt-4 text-sm text-muted-foreground">Run checks when your draft is ready for a second look.</p> : <>
        {review && <div className="review-banner" role="alert"><ShieldAlert size={20} /><div><strong>Needs human review</strong><p>Confirm factual claims against the source material before approval.</p></div></div>}
        <ul className="quality-list">{results.map((result) => { const Icon = icons[result.status]; return <li key={result.name} className={`quality-item q-${result.status.split(' ')[0]?.toLowerCase()}`}><Icon size={16} aria-hidden /><div><div className="flex flex-wrap items-center gap-2"><strong>{result.name}</strong><span className="q-status">{result.status}</span></div><small>{result.detail}</small>{result.status !== 'Pass' && onRegenerate && <div className="mt-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void regenerate()}><RefreshCw />{busy ? 'Regenerating…' : 'Regenerate corrected draft'}</Button></div>}</div></li>; })}</ul>
      </>}
      <div className="mt-4"><Button size="sm" variant="ghost" onClick={() => setShowSources(!showSources)} aria-expanded={showSources}><BookOpen />{showSources ? 'Hide sources' : 'Industry and regulatory sources'}</Button>
        {showSources && <div className="source-panel">{sources.length ? sources.map((source) => <div className="source-row" key={source.url}><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong></a><span>{source.url}</span></div>) : <p className="text-sm text-muted-foreground">No sources are attached to this draft. Enable research for time-sensitive or industry claims, then regenerate and review the cited material.</p>}</div>}
      </div>
    </div>
  );
}
