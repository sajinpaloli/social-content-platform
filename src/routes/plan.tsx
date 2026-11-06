import {createFileRoute} from '@tanstack/react-router';
import {PlannerPage} from '@/features/planner';
const t='Plan content | Postly',d='Simulated content planning with category balance and calendar slots.';
export const Route=createFileRoute('/plan')({head:()=>({meta:[{title:t},{name:'description',content:d},{property:'og:title',content:t},{property:'og:description',content:d},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:PlannerPage});
