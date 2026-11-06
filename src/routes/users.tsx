import {createFileRoute} from '@tanstack/react-router';
import {UsersPage} from '@/features/users';
export const Route=createFileRoute('/users')({
 
 head:()=>({meta:[{title:'Users & permissions | Postly'},{name:'description',content:'Manage workspace users and business assignments.'},{property:'og:title',content:'Users & permissions | Postly'},{property:'og:description',content:'Manage workspace users and business assignments.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:UsersPage
});
