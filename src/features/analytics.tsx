import { useState } from 'react';
import { BarChart3, Plug, RefreshCw, Eye, MousePointerClick, Heart } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageHeader, Empty, PlatformIcon } from './shared';
import { useWorkspace } from './workspace';
import { api } from '@/services/api';
import { toast } from 'sonner';

export function AnalyticsPage() {
  const w = useWorkspace();
  const [busy, setBusy] = useState(false);
  const data = w.analytics;
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const items = data?.items ?? [];

  async function refresh() {
    setBusy(true);
    try {
      const result = await api.refreshAnalytics();
      await w.refresh();
      toast.success(`Updated analytics from ${result.updated} provider record(s).`);
      if (result.errors.length) toast.warning(`${result.errors.length} account or metric request(s) need attention. See the connection details.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not refresh platform analytics.'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Content performance" description="Workspace post totals and real metrics returned by connected platform APIs.">
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}><RefreshCw/>{busy ? 'Refreshing…' : 'Refresh platform metrics'}</Button>
    </PageHeader>
    {!w.accounts.some(a => a.status === 'Connected') && <div className="notice warning mb-6"><BarChart3 size={20}/><div><strong>No social account is connected</strong><p>Connect and validate a business account to fetch its platform analytics.</p></div><Button variant="outline" size="sm" asChild><Link to="/integrations"><Plug/>Connect accounts</Link></Button></div>}
    {items.length > 0 ? <>
      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label"><Eye size={15}/> Reach</div><strong>{data?.reach.toLocaleString()}</strong><p>Provider-reported reach</p></div>
        <div className="metric-card"><div className="metric-label"><Heart size={15}/> Engagement</div><strong>{data?.engagement.toLocaleString()}</strong><p>Likes, comments, shares or provider interactions</p></div>
        <div className="metric-card"><div className="metric-label"><MousePointerClick size={15}/> Clicks</div><strong>{data?.clicks.toLocaleString()}</strong><p>Reported clicks where available</p></div>
      </div>
      <div className="table-panel mt-6"><div className="table-scroll"><table><thead><tr><th>Account or post</th><th>Platform</th><th>Impressions</th><th>Reach</th><th>Engagement</th><th>Clicks</th><th>Last fetched</th></tr></thead><tbody>{items.map(item=><tr key={item.postId}><td><strong>{item.title}</strong><small>{item.source}</small></td><td><span className="flex items-center gap-2"><PlatformIcon platform={item.platform}/>{item.platform}</span></td><td>{Number(item.stats['impressions']||0).toLocaleString()}</td><td>{Number(item.stats['reach']||0).toLocaleString()}</td><td>{Number(item.stats['engagement']||0).toLocaleString()}</td><td>{Number(item.stats['clicks']||0).toLocaleString()}</td><td>{new Date(item.fetchedAt).toLocaleString("en-GB",{timeZone:"Europe/London"})}</td></tr>)}</tbody></table></div></div>
      <p className="sample-label mt-3">Metrics reflect only the APIs and permissions returned by each provider. A missing metric is not treated as zero reach for an unconnected account.</p>
    </> : <div className="form-section mb-6"><h2>No provider metrics fetched yet</h2><p className="text-sm text-muted-foreground mt-3">Press Refresh platform metrics after connecting accounts. Some metrics require additional provider permissions and app approval.</p></div>}
    {total > 0 && <><div className="section-title mt-8"><h2>Workspace content totals</h2></div><div className="metrics-grid">{['Draft','Awaiting Approval','Approved','Scheduled','Publishing','Published','Failed','Rejected'].map(status=><div className="metric-card" key={status}><div className="metric-label">{status}</div><strong>{counts[status] ?? 0}</strong><p>Saved workspace records</p></div>)}</div></>}
    {total === 0 && <Empty title="No saved content yet" description="Create and save posts first. Provider analytics appear once an authorized account is connected and its metrics are refreshed."/>}
  </>;
}
