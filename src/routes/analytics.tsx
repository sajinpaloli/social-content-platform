import {createFileRoute} from '@tanstack/react-router';
import {AnalyticsPage} from '@/features/analytics';
export const Route=createFileRoute('/analytics')({
 
 head:()=>({meta:[{title:'Analytics | Postly'},{name:'description',content:'Review platform performance after connecting an authorized account.'},{property:'og:title',content:'Analytics | Postly'},{property:'og:description',content:'Review platform performance after connecting an authorized account.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:AnalyticsPage
});
