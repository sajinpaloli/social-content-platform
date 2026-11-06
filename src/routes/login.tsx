import {createFileRoute} from '@tanstack/react-router';
import {LoginPage} from '@/features/login';
const t='Sign in | Postly',d='Sign in to the Postly content workspace.';
export const Route=createFileRoute('/login')({head:()=>({meta:[{title:t},{name:'description',content:d},{property:'og:title',content:t},{property:'og:description',content:d},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:LoginPage});
