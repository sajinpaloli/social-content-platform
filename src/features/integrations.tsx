import { useState } from 'react';
import { Plug, ExternalLink, ShieldCheck, Settings2, Sparkles, LockKeyhole, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, PlatformIcon, Field, Filters } from './shared';
import { useWorkspace } from './workspace';
import { api, type Account } from '@/services/api';
import { toast } from 'sonner';

export function IntegrationsPage() {
  const w = useWorkspace();
  const [account, setAccount] = useState<Account | null>(null);
  const [connect, setConnect] = useState<Account | null>(null);
  const [credentials, setCredentials] = useState({ pageId: '', accessToken: '', clientId: '', clientSecret: '', organizationUrn: '', oauthScopes: 'w_organization_social' });
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [ai, setAi] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4.1-mini');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState('');
  const rows = w.accounts.filter(a => a.personal || w.selected === 'all' || a.businessId === w.selected);
  const isAdmin = w.currentUser?.role === 'Super Administrator';
  async function saveCredentials() {
    if (!connect) return;
    setSavingCredentials(true);
    try {
      const values = connect.platform === 'LinkedIn'
        ? { clientId: credentials.clientId, clientSecret: credentials.clientSecret, organizationUrn: credentials.organizationUrn, oauthScopes: 'w_organization_social' }
        : { pageId: credentials.pageId, accessToken: credentials.accessToken };
      await api.saveAccountCredentials(connect.id, values);
      await w.refresh();
      setConnect(null);
      setCredentials({ pageId: '', accessToken: '', clientId: '', clientSecret: '', organizationUrn: '', oauthScopes: 'w_organization_social' });
      toast.success('Credentials encrypted and saved. Validate Meta credentials or authorize LinkedIn to connect the account.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save credentials.'); }
    finally { setSavingCredentials(false); }
  }

  async function validateAccount(a: Account) {
    setAccountBusy(a.id);
    try { const result = await api.validateAccount(a.id); await w.refresh(); toast.success(`${result.identity} is authorized.`); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not validate provider credentials.'); }
    finally { setAccountBusy(''); }
  }

  async function connectLinkedIn(a: Account) {
    setAccountBusy(a.id);
    try { const result = await api.startLinkedIn(a.id); window.location.assign(result.authorizationUrl); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start LinkedIn authorization.'); setAccountBusy(''); }
  }

  return <>
    <PageHeader title="Account integrations" description="Configure provider credentials for the business accounts you manage.">{isAdmin&&<Button onClick={() => setAccount({id:`account-${(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))}`,name:'New social account',businessId:w.businesses[0]?.id||'',platform:'Facebook',url:'',personal:false,status:'Disconnected',lastConnected:'Never connected'})}><Plus/>Add social account</Button>}</PageHeader>
    <div className="notice warning mb-6"><Plug size={20}/><div><strong>Connect each account before scheduling</strong><p>Meta accounts are checked against the configured Page or professional account ID and token. LinkedIn requires a member to approve access through LinkedIn. A successful connection does not bypass platform app review or permission requirements.</p></div></div>
    <div className="section-title"><h2>Social accounts <span className="count-pill">{rows.length}</span></h2><Filters/></div>
    <div className="table-panel"><div className="table-scroll"><table><thead><tr><th>Account</th><th>Platform</th><th>Assignment</th><th>Connection</th><th>Credentials</th><th>Actions</th></tr></thead><tbody>{rows.map(a => <tr key={a.id}>
      <td><strong>{a.name}</strong><a className="account-link" href={a.url} target="_blank" rel="noreferrer">View {a.personal ? 'personal profile' : 'business page'}<ExternalLink size={11}/></a></td>
      <td><span className="flex items-center gap-2"><PlatformIcon platform={a.platform}/>{a.platform}</span></td>
      <td>{a.personal && <small className="personal-label">Personal account</small>}{w.businesses.find(b => b.id === a.businessId)?.name || 'Unassigned'}</td>
      <td><span className={`status ${a.status === 'Connected' ? 'status-published' : 'status-draft'}`}>{a.status === 'Connected' ? 'Connected' : 'Not authorized'}</span>{a.lastError&&<small className="error-text block">{a.lastError}</small>}</td>
      <td>{a.credentialsConfigured ? 'Saved securely' : 'Not configured'}</td>
      <td><div className="flex flex-wrap gap-1">{isAdmin && <Button variant="outline" size="sm" onClick={() => { setConnect(a); setCredentials({ pageId: '', accessToken: '', clientId: '', clientSecret: '', organizationUrn: a.metadata?.organizationUrn || '', oauthScopes: 'w_organization_social' }); }}>Credentials</Button>}{isAdmin&&a.credentialsConfigured&&(a.platform==='LinkedIn'?<Button size="sm" disabled={accountBusy===a.id} onClick={()=>connectLinkedIn(a)}>{accountBusy===a.id?'Opening…':'Connect LinkedIn'}</Button>:<Button size="sm" disabled={accountBusy===a.id} onClick={()=>validateAccount(a)}>{accountBusy===a.id?'Checking…':'Validate'}</Button>)}<Button variant="ghost" size="icon" aria-label={`Edit ${a.name} ${a.platform}`} onClick={() => setAccount(structuredClone(a))}><Settings2/></Button>{isAdmin&&<Button variant="ghost" size="icon" aria-label={`Remove ${a.name} ${a.platform}`} onClick={async()=>{if(!window.confirm(`Remove ${a.name} from this workspace? This removes saved credentials here; it does not revoke access at the provider or delete published posts.`))return;try{await api.deleteAccount(a.id);await w.refresh();toast.success("Social account removed from the app.")}catch(e){toast.error(e instanceof Error?e.message:"Could not remove account.")}}}><Trash2/></Button>}</div>{a.platform==='LinkedIn'&&a.metadata?.organizationUrn&&<small className="block mt-1 text-muted-foreground">Publishing as {a.metadata.organizationUrn}</small>}</td>
    </tr>)}</tbody></table></div></div>
    <div className="notice mt-5"><ShieldCheck size={20}/>Social network passwords are not requested. Secrets are encrypted on the server and are never returned to the browser. Only administrators can configure credentials.</div>
    <section className="form-section mt-8"><div className="flex items-center gap-4"><span className="metric-icon neutral"><Sparkles/></span><div><h2>AI provider settings</h2><p className="text-sm text-muted-foreground mt-1">AI draft generation, website analysis, and quality review use this provider when configured.</p></div><Button variant="outline" className="ml-auto" onClick={async () => { try { const cfg = await api.getProviderSettings(); setAiConfigured(cfg.configured); setAiModel(cfg.model); setApiKey(''); setAi(true); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load provider settings.'); } }}>View settings</Button></div></section>
    <Dialog open={!!connect || !!account || ai} onOpenChange={() => { setConnect(null); setAccount(null); setAi(false); }}><DialogContent className={connect?.platform==='LinkedIn'?'box-border w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md':''}>
      <DialogTitle>{account ? 'Edit account details' : ai ? 'AI provider settings' : `Configure ${connect?.platform || 'account'} credentials`}</DialogTitle>
      <DialogDescription>{account ? 'Set the platform, account label, profile link and business assignment.' : ai ? (aiConfigured ? 'Provider settings. Existing API key is stored securely and is never returned to the browser.' : 'No provider key has been configured yet.') : 'Saved values are encrypted and never shown again. Enter the current values to replace them.'}</DialogDescription>
      {account ? <>{account.id.startsWith('account-') && <Field label="Platform"><select value={account.platform} onChange={e=>setAccount({...account,platform:e.target.value as Account['platform'],name:`${e.target.value} account`})}><option>Facebook</option><option>Instagram</option><option>LinkedIn</option></select></Field>}<Field label="Account label"><input value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })}/></Field><Field label="Profile URL"><input type="url" value={account.url} onChange={e => setAccount({ ...account, url: e.target.value })}/></Field><Field label="Assign to business"><select value={account.businessId} onChange={e => setAccount({ ...account, businessId: e.target.value })}><option value="">Unassigned</option>{w.businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>{account.personal && <p className="sample-label">This remains a personal account regardless of assignment.</p>}<Button disabled={!account.name.trim()||!account.platform||!w.businesses.length&&!account.personal} onClick={async () => { if(await w.saveAccount({...account,personal:account.platform==='LinkedIn'?false:account.personal}))setAccount(null); }}>Save account details</Button></>
      : ai ? <><div className="notice"><LockKeyhole/>{aiConfigured ? 'An OpenAI key is configured. The saved secret is never shown; enter a replacement to rotate it.' : 'Add an OpenAI API key. It will be encrypted before being stored on the server.'}</div><Field label="Provider"><input value="OpenAI" readOnly/></Field><Field label="Model"><input value={aiModel} onChange={e => setAiModel(e.target.value)} placeholder="gpt-4.1-mini"/></Field><Field label="API key"><input type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={aiConfigured ? 'Stored securely. Enter a new key to replace it.' : 'sk-...'}/></Field><div className="flex gap-2"><Button disabled={aiBusy || (!apiKey && !aiConfigured)} onClick={async () => { setAiBusy(true); try { const cfg = await api.saveProviderSettings(apiKey, aiModel); setAiConfigured(cfg.configured); setApiKey(''); toast.success('OpenAI settings saved securely.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save settings.'); } finally { setAiBusy(false); } }}>{aiBusy ? 'Saving...' : 'Save provider settings'}</Button>{aiConfigured && <Button variant="outline" disabled={aiBusy} onClick={async () => { setAiBusy(true); try { const cfg = await api.clearProviderSettings(); setAiConfigured(cfg.configured); setApiKey(''); toast.success(cfg.configured ? 'Stored key removed. The environment key remains active.' : 'Provider key removed.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove the key.'); } finally { setAiBusy(false); } }}>Remove stored key</Button>}</div><p className="sample-label">The app never displays saved secret values. An environment key in .env takes precedence only when no database key is saved.</p></>
      : connect ? <><div className="notice"><KeyRound/>Enter provider credentials here. They are encrypted in PostgreSQL. Saving replacement credentials disconnects the account until you validate or authorize it again.</div>{connect.platform === 'LinkedIn' ? <><Field label="LinkedIn client ID"><input autoComplete="off" value={credentials.clientId} onChange={e => setCredentials({ ...credentials, clientId: e.target.value })}/></Field><Field label="LinkedIn client secret"><input type="password" autoComplete="new-password" value={credentials.clientSecret} onChange={e => setCredentials({ ...credentials, clientSecret: e.target.value })}/></Field><Field label="LinkedIn company Page URN" hint="Required for company Page publishing. Format: urn:li:organization:123456"><input placeholder="urn:li:organization:123456" value={credentials.organizationUrn} onChange={e => setCredentials({ ...credentials, organizationUrn: e.target.value })}/></Field><div className="notice"><ShieldCheck/><span>This account posts to the configured company Page using <code>w_organization_social</code>. Verify the saved URN matches the intended Page.</span></div></> : <><Field label={connect.platform==='Instagram'?'Instagram professional account ID':'Facebook Page ID'}><input autoComplete="off" value={credentials.pageId} onChange={e => setCredentials({ ...credentials, pageId: e.target.value })}/></Field><Field label="Page access token"><input type="password" autoComplete="new-password" value={credentials.accessToken} onChange={e => setCredentials({ ...credentials, accessToken: e.target.value })}/></Field><p className="sample-label">Meta app permissions must include Page publishing. Instagram requires a professional account and public image URL. Use Validate after saving.</p></>}<Button disabled={savingCredentials || (connect.platform === 'LinkedIn' ? !credentials.clientId || !credentials.clientSecret : !credentials.pageId || !credentials.accessToken)} onClick={saveCredentials}>{savingCredentials ? 'Saving...' : 'Save encrypted credentials'}</Button>{connect.credentialsConfigured && <Button variant="outline" disabled={savingCredentials} onClick={async () => { try { await api.clearAccountCredentials(connect.id); await w.refresh(); setConnect(null); toast.success('Stored credentials removed.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove credentials.'); } }}>Remove saved credentials</Button>}</>
      : null}
    </DialogContent></Dialog>
  </>;
}
