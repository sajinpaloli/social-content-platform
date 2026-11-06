import {createFileRoute} from '@tanstack/react-router';
import {MediaPage} from '@/features/media';
export const Route=createFileRoute('/media')({
 
 head:()=>({meta:[{title:'Media library | Postly'},{name:'description',content:'Organize uploaded images, videos and brand assets.'},{property:'og:title',content:'Media library | Postly'},{property:'og:description',content:'Organize uploaded images, videos and brand assets.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:MediaPage
});
