import {createFileRoute} from '@tanstack/react-router';
import {EditorPage} from '@/features/editor';
export const Route=createFileRoute('/editor')({
 validateSearch: (search: Record<string, unknown>): { post?: string; media?: string } => ({ ...(typeof search['post'] === 'string' ? { post: search['post'] } : {}), ...(typeof search['media'] === 'string' ? { media: search['media'] } : {}) }),
 head:()=>({meta:[{title:'Post editor | Postly'},{name:'description',content:'Create distinct content for LinkedIn, Facebook and Instagram.'},{property:'og:title',content:'Post editor | Postly'},{property:'og:description',content:'Create distinct content for LinkedIn, Facebook and Instagram.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Page
});
function Page(){const {post,media}=Route.useSearch();return <EditorPage key={post||media||"new"} postId={post} mediaId={media}/>;}
