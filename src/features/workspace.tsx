import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { api, type Business, type Post, type Media, type Account, type User, type Analytics } from '@/services/api';
import { toast } from 'sonner';

interface Data { businesses: Business[]; posts: Post[]; media: Media[]; accounts: Account[]; users: User[]; analytics: Analytics | null; currentUser: User | null }
const initial: Data = { businesses: [], posts: [], media: [], accounts: [], users: [], analytics: null, currentUser: null };
type Workspace = Data & { loading: boolean; error: string; selected: string; setSelected: (id: string) => void; refresh: () => Promise<void>; savePost: (p: Post) => Promise<boolean>; saveBusiness: (b: Business) => Promise<boolean>; saveUser: (u: User) => Promise<boolean>; saveAccount: (a: Account) => Promise<boolean>; saveMedia: (m: Media) => Promise<boolean>; removePost: (id: string) => Promise<boolean> };
const Context = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: s => s.location.pathname });
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('all');

  async function refresh() {
    try {
      const currentUser = await api.getCurrentUser();
      const [businesses, posts, media, accounts, analytics, users] = await Promise.all([
        api.listBusinesses(), api.listPosts(), api.listMedia(), api.listAccounts(), api.getAnalytics(),
        currentUser.role === 'Super Administrator' ? api.listUsers() : Promise.resolve([] as User[]),
      ]);
      setData({ businesses, posts, media, accounts, analytics, users, currentUser });
      setError('');
    } catch {
      setError('We couldn’t load your workspace. Please try again.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (path === '/login') return;
    const expired=()=>{api.logout().catch(()=>{});setData(initial);setError('Your session expired after 30 minutes without activity. Sign in again.');void navigate({to:'/login'})};
    window.addEventListener('ccc:session-expired',expired);
    if (!api.hasSession()) { void navigate({ to: '/login' }); return ()=>window.removeEventListener('ccc:session-expired',expired); }
    let idleTimer:number;const resetIdleTimer=()=>{window.clearTimeout(idleTimer);idleTimer=window.setTimeout(expired,30*60*1000)};const activity=['pointerdown','keydown','touchstart','click'] as const;activity.forEach(event=>window.addEventListener(event,resetIdleTimer,{passive:true}));resetIdleTimer();
    void refresh();
    return ()=>{window.removeEventListener('ccc:session-expired',expired);activity.forEach(event=>window.removeEventListener(event,resetIdleTimer));window.clearTimeout(idleTimer)};
  }, [path]);

  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    try { await action(); await refresh(); toast.success(message); return true; }
    catch { toast.error('Changes could not be saved. Please try again.'); return false; }
  }

  return <Context.Provider value={{ ...data, loading, error, selected, setSelected, refresh,
    savePost: p => run(() => api.updatePost(p), 'Post saved'),
    saveBusiness: b => run(() => api.updateBusiness(b), 'Business profile saved'),
    saveUser: u => run(() => api.updateUser(u), 'User updated'),
    saveAccount: a => run(() => api.updateAccount(a), 'Account details updated'),
    saveMedia: m => run(() => api.updateMedia(m), 'Media details saved'),
    removePost: id => run(() => api.deletePost(id), 'Post deleted'),
  }}>{children}</Context.Provider>;
}
export function useWorkspace() { const ctx = useContext(Context); if (!ctx) throw new Error('Workspace provider missing'); return ctx; }
