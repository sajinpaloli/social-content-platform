import { useState } from 'react';
import { ArrowRight, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Filters, BrandIcon, PlatformIcon, StatusBadge, PostDetail, Empty } from './shared';
import { useWorkspace } from './workspace';
import { type Post } from '@/services/api';

export function ApprovalsPage() {
  const w = useWorkspace();
  const [platform, setPlatform] = useState('all');
  const [approver, setApprover] = useState('all');
  const [date, setDate] = useState('');
  const [post, setPost] = useState<Post | null>(null);
  const awaiting = w.posts.filter(p => p.status === 'Awaiting Approval' && (w.selected === 'all' || w.selected === p.businessId));
  const reviewers = [...new Set(awaiting.map(p => p.approver).filter(Boolean))];
  const posts = awaiting.filter(p => (platform === 'all' || platform === p.platform) && (approver === 'all' || approver === p.approver) && (!date || p.date.startsWith(date)));

  return <>
    <PageHeader title="Approval queue" description="Review drafts assigned to the businesses available to your account." />
    <div className="notice mb-6"><CheckCheck size={19}/><div><strong>Review is required before scheduling</strong><p>Approving a post saves its approval state. It does not publish the post to a social platform.</p></div></div>
    <div className="flex flex-wrap gap-3 items-start"><Filters platform={platform} setPlatform={setPlatform}/><select aria-label="Filter by approver" value={approver} onChange={e => setApprover(e.target.value)}><option value="all">All assigned reviewers</option>{reviewers.map(name => <option key={name}>{name}</option>)}</select><input aria-label="Filter by date" type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
    <div className="section-title"><h2>Awaiting review <span className="count-pill">{posts.length}</span></h2></div>
    {posts.length ? <div className="approval-grid">{posts.map(p => { const b = w.businesses.find(business => business.id === p.businessId); const caption = p.variants[p.platform]?.caption || ''; return <article className="approval-card" key={p.id}>
      {p.image && (p.format === 'Video' || w.media.some(media => media.url === p.image && media.type === 'Video') ? <video className="approval-media-video" src={p.image} controls preload="metadata" aria-label="Post video"/> : <img src={p.image} alt="Post media" width={500} height={230} loading="lazy"/>)}
      <div className="approval-card-content"><div className="flex justify-between"><span className="business-cell"><BrandIcon business={b} small/>{b?.name || 'Business'}</span><PlatformIcon platform={p.platform}/></div><h3>{p.title}</h3><p>{caption.slice(0,145)}{caption.length > 145 ? '…' : ''}</p><StatusBadge status={p.status}/><div className="approval-summary"><small>Brand voice: {b?.tone || 'Not set'}</small><small>Check claims and sources before approving.</small></div><Button className="w-full" variant="outline" onClick={() => setPost(p)}>Review post<ArrowRight/></Button></div>
    </article>; })}</div> : <Empty title="No posts awaiting review" description="Posts submitted for approval will appear here."/>}
    <PostDetail post={post} onClose={() => setPost(null)}/>
  </>;
}
