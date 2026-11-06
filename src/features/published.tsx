import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PostTable, PostDetail, Empty } from './shared';
import { useWorkspace } from './workspace';
import type { Post } from '@/services/api';

export function PublishedPage() {
  const w = useWorkspace();
  const [post, setPost] = useState<Post | null>(null);
  const posts = w.posts.filter(p => (p.status === 'Published' || !!p.providerDeletedAt) && (w.selected === 'all' || p.businessId === w.selected)).sort((a,b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0));
  return <>
    <PageHeader title="Published posts" description="Published posts and records retained after deletion from a social account. Times use Europe/London.">
      <Button variant="outline" asChild><Link to="/calendar"><CalendarDays/>Content calendar</Link></Button>
    </PageHeader>
    <div className="notice mb-5">This list keeps each published post after it is deleted from the social account. Open a post to see its social link, edit its content or republish it.</div>
    {posts.length ? <div className="table-panel"><PostTable posts={posts} onSelect={setPost}/><div className="table-bottom"><span>{posts.length} published/deleted post{posts.length===1?'':'s'}</span><span>Times shown in Europe/London</span></div></div> : <Empty title="No published posts yet" description="Posts appear here after publication. Deleted posts stay in this list so you can review, edit and republish them."/>}
    <PostDetail post={post} onClose={()=>setPost(null)}/>
  </>;
}