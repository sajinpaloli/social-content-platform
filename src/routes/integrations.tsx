import {createFileRoute} from '@tanstack/react-router';
import {IntegrationsPage} from '@/features/integrations';
export const Route=createFileRoute('/integrations')({
 
 head:()=>({meta:[{title:'Integrations | Postly'},{name:'description',content:'Manage disconnected social accounts and provider placeholders.'},{property:'og:title',content:'Integrations | Postly'},{property:'og:description',content:'Manage disconnected social accounts and provider placeholders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:IntegrationsPage
});
