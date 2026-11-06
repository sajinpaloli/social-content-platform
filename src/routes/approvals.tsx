import {createFileRoute} from '@tanstack/react-router';
import {ApprovalsPage} from '@/features/approvals';
export const Route=createFileRoute('/approvals')({
 
 head:()=>({meta:[{title:'Approvals | Postly'},{name:'description',content:'Review pending posts and record approval decisions.'},{property:'og:title',content:'Approvals | Postly'},{property:'og:description',content:'Review pending posts and record approval decisions.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:ApprovalsPage
});
