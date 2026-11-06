import {createFileRoute} from '@tanstack/react-router';
import {BusinessesPage} from '@/features/businesses';
export const Route=createFileRoute('/businesses')({
 validateSearch: (search: Record<string, unknown>): { business?: string } => typeof search['business'] === 'string' ? { business: search['business'] } : {},
 head:()=>({meta:[{title:'Businesses & brand profiles | Postly'},{name:'description',content:'Manage editable business identities and content settings.'},{property:'og:title',content:'Businesses & brand profiles | Postly'},{property:'og:description',content:'Manage editable business identities and content settings.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Page
});
function Page(){const {business}=Route.useSearch();return <BusinessesPage initialBusiness={business}/>;}
