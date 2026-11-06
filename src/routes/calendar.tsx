import {createFileRoute} from '@tanstack/react-router';
import {CalendarPage} from '@/features/calendar';
export const Route=createFileRoute('/calendar')({
 
 head:()=>({meta:[{title:'Content calendar | Postly'},{name:'description',content:'Plan and review saved social content.'},{property:'og:title',content:'Content calendar | Postly'},{property:'og:description',content:'Plan and review saved social content.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:CalendarPage
});
