import {useState} from 'react';
import {Check,Eye,RotateCcw,Undo2,Plus,X,Lock,Search,AlertTriangle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Field} from './shared';
import {useWorkspace} from './workspace';
import {type Business,type Recency,type Platform,platforms,requiredRules,defaultPrompt,defaultResearch,defaultPromptSettings,fillPrompt,looksLikeCredential} from '@/services/api';

export function AiPlanning({business,onChange}:{business:Business;onChange:(b:Business)=>void}){
  const w=useWorkspace();
  const research=business.research||defaultResearch();
  const saved=w.businesses.find(b=>b.id===business.id)?.prompt||business.prompt||defaultPromptSettings();
  const [text,setText]=useState(saved.text);
  const [domain,setDomain]=useState('');
  const [preview,setPreview]=useState(false);
  const [platform,setPlatform]=useState<Platform>('LinkedIn');
  const [confirmRestore,setConfirmRestore]=useState(false);
  const dirty=text!==saved.text;
  const credential=looksLikeCredential(text);
  const setResearch=(r:Partial<typeof research>)=>onChange({...business,research:{...research,...r}});
  const previous=w.posts.filter(p=>p.businessId===business.id).slice(0,3).map(p=>p.title);
  async function save(next=text){const prompt={text:next,updatedAt:new Date().toISOString(),updatedBy:'Workspace administrator'};const b={...business,research,prompt};onChange(b);await w.saveBusiness(b);}
  function addDomain(){const d=domain.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');if(d&&!research.domains.includes(d))setResearch({domains:[...research.domains,d]});setDomain('');}
  return <div className="form-section">
    <h2>AI planning for {business.name}</h2>
    <div className="notice warning my-4"><AlertTriangle size={16}/>Internet research is used only when enabled here and a provider key is configured in Integrations. Current sources are retrieved during generation.</div>

    <h3 className="mt-6 mb-2 font-semibold">Internet research</h3>
    <fieldset className="flex gap-4 mb-3"><legend className="text-sm mb-2">Use internet research when planning content</legend>
      <label className="checkbox-label"><input type="radio" name={`research-${business.id}`} checked={research.enabled} onChange={()=>setResearch({enabled:true})}/>Yes</label>
      <label className="checkbox-label"><input type="radio" name={`research-${business.id}`} checked={!research.enabled} onChange={()=>setResearch({enabled:false})}/>No</label>
    </fieldset>
    {research.enabled?<>
      <p className="text-sm text-muted-foreground mb-3">Once connected, the AI will search these approved sources for relevant industry news and seasonal topics during planning.</p>
      <Field label="Approved source domains"><div className="flex flex-wrap gap-2">{research.domains.map(d=><span key={d} className="status status-draft">{d}<button type="button" aria-label={`Remove ${d}`} onClick={()=>setResearch({domains:research.domains.filter(x=>x!==d)})}><X size={12}/></button></span>)}</div></Field>
      <div className="flex gap-2 my-2"><input aria-label="Add source domain" placeholder="example.org" value={domain} onChange={e=>setDomain(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addDomain()}}}/><Button size="sm" variant="outline" onClick={addDomain}><Plus/>Add domain</Button></div>
      <Field label="Preferred recency"><select value={research.recency} onChange={e=>setResearch({recency:e.target.value as Recency})}><option>Past week</option><option>Past month</option><option>Past quarter</option></select></Field>
      <div className="mt-3"><p className="text-sm text-muted-foreground">No research has run yet. With this setting enabled, allowed domains are searched during content generation and sources are attached to the draft.</p></div>
    </>:<p className="text-sm text-muted-foreground mb-3">Planning will use the business profile, website information, previous posts, objectives and other information already saved in the app.</p>}

    <div className="grid gap-6 mt-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <h3 className="mb-2 font-semibold">Content generation prompt</h3>
        <Field label="Prompt for this business" hint="Placeholders in braces are filled from the profile. Never include API keys or credentials."><textarea rows={14} value={text} onChange={e=>setText(e.target.value)}/></Field>
        {credential&&<p className="error-text">This looks like it contains a key or credential. Remove it before saving.</p>}
        <p className="text-xs text-muted-foreground my-2">Last updated by {saved.updatedBy} on {new Date(saved.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/London'})}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty||credential} onClick={()=>save()}><Check/>Save</Button>
          <Button variant="outline" disabled={!dirty} onClick={()=>setText(saved.text)}><Undo2/>Discard changes</Button>
          <Button variant="outline" onClick={()=>setPreview(true)}><Eye/>Preview prompt</Button>
          <Button variant="outline" onClick={()=>setConfirmRestore(true)}><RotateCcw/>Restore default</Button>
        </div>
        {confirmRestore&&<div className="notice warning mt-3">Replace the prompt with the default template?<Button size="sm" variant="destructive" onClick={async()=>{setText(defaultPrompt());setConfirmRestore(false);await save(defaultPrompt())}}>Restore</Button><Button size="sm" variant="ghost" onClick={()=>setConfirmRestore(false)}>Cancel</Button></div>}
      </div>
      <aside className="form-section">
        <h3 className="mb-2 font-semibold flex items-center gap-2"><Lock size={15}/>Required content rules</h3>
        <p className="text-xs text-muted-foreground mb-3">Always applied, even if the prompt is edited.</p>
        <ul className="grid gap-2 text-sm">{requiredRules.map(r=><li key={r} className="flex gap-2"><Check size={14} className="shrink-0 mt-1"/>{r}</li>)}</ul>
      </aside>
    </div>

    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="detail-dialog">
      <DialogTitle>Example preview</DialogTitle>
      <DialogDescription>Prompt filled with {business.name}'s saved business profile. Nothing is sent to an AI service.</DialogDescription>
      <select aria-label="Preview platform" value={platform} onChange={e=>setPlatform(e.target.value as Platform)}>{platforms.map(p=><option key={p}>{p}</option>)}</select>
      <pre className="text-xs whitespace-pre-wrap border rounded-md p-3 max-h-80 overflow-auto">{fillPrompt(text,business,platform,previous)}{'\n\nRequired rules (always applied):\n- '+requiredRules.join('\n- ')}</pre>
    </DialogContent></Dialog>
  </div>;
}
