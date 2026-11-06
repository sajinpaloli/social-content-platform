import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Field, PlatformIcon } from './shared';
import { useWorkspace } from './workspace';
import { api, planInputs, categories, platforms, type AutomationRun, type PlanSlot, type Platform } from '@/services/api';
import { toast } from 'sonner';

const periods = { 'Next week': 7, 'Next two weeks': 14, 'Next month': 30 } as const;
const steps = ['Business and period', 'Review inputs', 'Category mix and slots', 'Complete posts'];
const verified = (category: string) => category.includes('Verified') || category.includes('achievements');
const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

export function PlannerPage() {
  const workspace = useWorkspace();
  const activeBusinesses = workspace.businesses.filter(business => !business.archived);
  const initialBusinessId = workspace.selected !== 'all' ? workspace.selected : activeBusinesses[0]?.id || '';
  const initialBusiness = activeBusinesses.find(business => business.id === initialBusinessId);
  const initialFrequency = Number(initialBusiness?.frequency.match(/\d+/)?.[0] || 3);
  const [step, setStep] = useState(0);
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [period, setPeriod] = useState<keyof typeof periods>('Next week');
  const business = activeBusinesses.find(item => item.id === businessId);
  const [balance, setBalance] = useState<Record<string, number>>(() => ({ ...(business?.balance || {}) }));
  const [perWeek, setPerWeek] = useState(initialFrequency);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([...platforms]);
  const [slots, setSlots] = useState<PlanSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(0);
  const [job, setJob] = useState<AutomationRun | null>(null);
  const [monitorError, setMonitorError] = useState('');
  const [planError, setPlanError] = useState('');

  function chooseBusiness(id: string) {
    setBusinessId(id);
    const selectedBusiness = activeBusinesses.find(item => item.id === id);
    setBalance({ ...(selectedBusiness?.balance || {}) });
    setPerWeek(Number(selectedBusiness?.frequency.match(/\d+/)?.[0] || 3));
    setSlots([]);
    setJob(null);
  }

  const availability: Record<string, string> = business ? {
    'Brand profile': 'Available',
    'Website snapshot': business.snapshot ? `Snapshot ${business.snapshot.slice(0, 10)}` : 'Not run yet',
    Services: business.services || 'Missing',
    'Target audience': business.audience || 'Missing',
    'Previous posts': `${workspace.posts.filter(post => post.businessId === business.id).length} posts available`,
    'Marketing objectives': business.objectives || 'Missing',
    'Industry sources': business.research?.enabled ? 'OpenAI web research enabled' : 'Internet research disabled',
    'Seasonal events': 'Considered when relevant research is enabled',
    'Available analytics': workspace.analytics?.reach || workspace.analytics?.engagement ? 'Connected analytics available' : 'Unavailable until social analytics are connected',
  } : {};

  async function propose() {
    if (!business) return;
    setBusy(true);
    setJob(null);
    setMonitorError('');
    setPlanError('');
    setSlots([]);
    try {
      const result = await api.proposePlan(business.id, periods[period], perWeek, balance, selectedPlatforms);
      setSlots(result.slots);
      if (!result.slots.length) throw new Error('The planner returned no content slots. Check the business category balance and try again.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not propose a content plan.';
      setPlanError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function generateCompletePosts() {
    if (!business || !slots.length || busy) return;
    setBusy(true);
    setMonitorError('');
    try {
      let current = await api.generatePlannedPosts(business.id, slots);
      setJob(current);
      while (current.status === 'queued' || current.status === 'running') {
        await wait(1500);
        current = await api.getAutomationRun(current.id);
        setJob(current);
      }
      if (current.status === 'completed') {
        const count = current.result.completed ?? slots.length;
        setCreated(count);
        setStep(3);
        await workspace.refresh();
        toast.success(`${count} complete posts with OpenAI images are ready for review.`);
      } else {
        setMonitorError(current.error || current.result.error || 'The job failed. Check the details below and retry the unfinished posts.');
        toast.error(current.error || current.result.error || 'Post generation failed.');
      }
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : 'Could not check the generation job. The server may still be working; use Check status before retrying.');
      toast.error(error instanceof Error ? error.message : 'Could not check generation status.');
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (!job) return;
    setBusy(true);
    setMonitorError('');
    try {
      const current = await api.getAutomationRun(job.id);
      setJob(current);
      if (current.status === 'completed') {
        setCreated(current.result.completed ?? slots.length);
        setStep(3);
        await workspace.refresh();
        toast.success('Complete posts are ready for review.');
      } else if (current.status === 'failed') {
        setMonitorError(current.error || current.result.error || 'Generation failed. Retry the unfinished posts.');
      }
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : 'Could not refresh job status.');
    } finally {
      setBusy(false);
    }
  }

  const totalWeight = Object.values(balance).reduce((sum, value) => sum + value, 0) || 1;
  const jobProgress = job?.result;

  return <>
    <PageHeader title="Plan content" description="Plan a balanced schedule, then generate complete posts and visuals for review.">
      <Button variant="outline" asChild><Link to="/calendar"><CalendarDays />Open calendar</Link></Button>
    </PageHeader>
    <div className="notice mb-5"><Sparkles size={18} />Planning, copy and image generation use the configured OpenAI API key and may incur OpenAI usage charges. Generated posts are sent for review; this action does not publish them.</div>
    <ol className="stepper">{steps.map((label, index) => <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>{index < step ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}{label}</li>)}</ol>

    {step === 0 && <div className="form-section"><h2>Who and when?</h2><div className="form-grid mt-5">
      <Field label="Business"><select value={businessId} onChange={event => chooseBusiness(event.target.value)}>{activeBusinesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Planning period"><select value={period} onChange={event => setPeriod(event.target.value as keyof typeof periods)}>{Object.keys(periods).map(item => <option key={item}>{item}</option>)}</select></Field>
    </div><Button className="mt-5" disabled={!business} onClick={() => setStep(1)}>Continue<ArrowRight /></Button></div>}

    {step === 1 && <div className="form-section"><h2>Information this plan will use</h2><p className="text-sm text-muted-foreground my-3">Review the information available for {business?.name}. Missing items can limit the plan.</p><ul className="input-list">{planInputs.map(item => <li key={item}><strong>{item}</strong><span>{availability[item]}</span></li>)}</ul><div className="flex gap-2 mt-5"><Button variant="outline" disabled={busy} onClick={() => setStep(0)}><ArrowLeft />Back</Button><Button disabled={busy} onClick={() => { setStep(2); void propose(); }}>{busy ? 'Building plan with OpenAI…' : 'Propose plan'}<ArrowRight /></Button></div>{busy && <p className="notice mt-4" role="status" aria-live="polite">OpenAI is reviewing the business inputs and choosing topics. This can take a little time; the planner will show an error if it fails.</p>}</div>}

    {step === 2 && <div className="planner-grid">
      <div className="form-section"><h2>Category mix</h2><p className="sample-label my-2">Verified stories and achievements stay at zero until verified source material exists.</p><Field label="Platforms (choose one or more)"><div className="flex flex-wrap gap-4">{platforms.map(item => <label className="checkbox-label" key={item}><input type="checkbox" checked={selectedPlatforms.includes(item)} disabled={busy} onChange={event => setSelectedPlatforms(current => event.target.checked ? [...current, item] : current.filter(value => value !== item))}/><PlatformIcon platform={item}/>{item}</label>)}</div><small>Posting frequency applies to each selected platform. For example, 3 per week × 3 platforms creates 9 posts per week.</small></Field><Field label={`Posting frequency: ${perWeek} posts per week, per selected platform`}><input type="range" min={1} max={14} value={perWeek} disabled={busy} onChange={event => setPerWeek(Number(event.target.value))} /></Field>{categories.map(category => <div className="balance-row" key={category}><label htmlFor={`plan-${category}`}>{category}{verified(category) && <small>Verified source required</small>}</label><input id={`plan-${category}`} type="range" min="0" max="100" disabled={busy || verified(category)} value={verified(category) ? 0 : balance[category] || 0} onChange={event => setBalance({ ...balance, [category]: Number(event.target.value) })} /><span>{Math.round((verified(category) ? 0 : balance[category] || 0) / totalWeight * 100)}%</span></div>)}<Button variant="outline" className="mt-4" disabled={busy || !selectedPlatforms.length} onClick={() => void propose()}>{busy ? 'Updating plan…' : 'Update proposed slots'}</Button></div>
      <div className="form-section"><div className="flex justify-between items-center"><h2>Planned slots <span className="count-pill">{slots.length}</span></h2><span className="sample-label">Suggested plan</span></div>{busy && !slots.length ? <p className="text-sm text-muted-foreground mt-4" role="status">OpenAI is calculating the suggested slots…</p> : planError ? <div className="notice warning mt-4" role="alert"><strong>Plan generation failed</strong><p className="text-sm mt-2">{planError}</p><p className="text-xs mt-2">Check the OpenAI provider and research settings, then select Update proposed slots to retry.</p></div> : <ul className="slot-list">{slots.map(slot => <li key={slot.id}><PlatformIcon platform={slot.platform} /><div><strong>{new Date(slot.date).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' })} · {slot.date.slice(11)}</strong><small>{slot.platform} · {slot.category}</small></div></li>)}</ul>}
        <div className="flex gap-2 mt-5"><Button variant="outline" disabled={busy} onClick={() => setStep(1)}><ArrowLeft />Back</Button><Button disabled={busy || !slots.length} onClick={() => void generateCompletePosts()}><Sparkles />{busy ? 'Generating complete posts…' : job?.status === 'failed' ? 'Retry unfinished posts' : 'Generate complete posts'}</Button></div>
        {monitorError && !job && <div className="notice warning mt-4" role="alert"><strong>Could not start post generation</strong><p className="text-sm mt-2">{monitorError}</p><p className="text-xs mt-2">Check the OpenAI key, image generation access, and server status, then retry. If the request timed out, retrying this plan will not duplicate saved posts.</p></div>}
        {job && <div className={`notice mt-4 ${job.status === 'failed' ? 'warning' : ''}`} role="status" aria-live="polite"><strong>{job.status === 'completed' ? 'Generation complete' : job.status === 'failed' ? 'Generation failed' : jobProgress?.stage || 'Starting generation'}</strong>{(job.status === 'queued' || job.status === 'running') && <><progress className="w-full mt-3" max={jobProgress?.total || slots.length} value={jobProgress?.completed || 0} /><p className="text-sm mt-2">{jobProgress?.completed || 0} of {jobProgress?.total || slots.length} complete. {jobProgress?.current && `Now working on ${jobProgress.current.platform}${jobProgress.current.category ? ` · ${jobProgress.current.category}` : ''}.`}</p><p className="text-xs">Text and image generation both run through OpenAI. Keep this page open to watch progress; posts already saved will not be duplicated if you retry.</p></>}{job.status === 'failed' && <><p className="text-sm mt-2">{monitorError || job.error || jobProgress?.error}</p><p className="text-xs">{jobProgress?.completed || 0} of {jobProgress?.total || slots.length} posts completed. Retry will continue with posts that are not yet saved.</p></>}{monitorError && job.status !== 'failed' && <p className="text-sm mt-2">{monitorError}</p>}<div className="flex gap-2 mt-3">{(job.status === 'queued' || job.status === 'running') && !busy && <Button size="sm" variant="outline" onClick={() => void checkStatus()}>Check status</Button>}</div></div>}
      </div>
    </div>}

    {step === 3 && <div className="form-section text-center"><CheckCircle2 className="mx-auto text-primary" size={32} /><h2 className="mt-3">{created} complete posts are ready for review</h2><p className="text-sm text-muted-foreground my-3">Every post has platform-specific copy and an OpenAI-generated image. The posts are in the approval queue, not published. Review the facts, image and sources before approving.</p><div className="flex justify-center gap-2"><Button variant="outline" onClick={() => { setStep(0); setSlots([]); setJob(null); }}>Plan again</Button><Button asChild><Link to="/calendar">View posts in calendar<ArrowRight /></Link></Button></div></div>}
  </>;
}
