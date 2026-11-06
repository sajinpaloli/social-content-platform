import {createFileRoute} from '@tanstack/react-router';
import {Overview} from '@/features/overview';
export const Route=createFileRoute('/')({
 
 head:()=>({meta:[{title:'Overview | Postly'},{name:'description',content:'Your multi-business content workspace at a glance.'},{property:'og:title',content:'Overview | Postly'},{property:'og:description',content:'Your multi-business content workspace at a glance.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Overview
});
