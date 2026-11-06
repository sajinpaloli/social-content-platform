import {useState} from 'react';
import {Link,useNavigate} from '@tanstack/react-router';
import {Eye,EyeOff,MailCheck,ArrowLeft} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Field} from './shared';
import {api} from '@/services/api';

export function LoginPage(){
 const navigate=useNavigate();const[mode,setMode]=useState<'login'|'forgot'|'sent'>('login');const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[show,setShow]=useState(false);const[errors,setErrors]=useState<{email?:string;password?:string;form?:string}>({});const[busy,setBusy]=useState(false);
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 async function submit(e:React.FormEvent){e.preventDefault();const next:typeof errors={};if(!validEmail)next.email='Enter a valid email address.';if(mode==='login'&&password.length<8)next.password='Password must be at least 8 characters.';setErrors(next);if(Object.keys(next).length)return;if(mode==='forgot'){setErrors({form:'Password reset is not configured. Contact your workspace administrator.'});return}setBusy(true);try{await api.login(email,password);await navigate({to:'/'})}catch(error){setErrors({form:error instanceof Error?error.message:'Sign-in failed.'})}finally{setBusy(false)}}
 return <div className="login-page"><div className="login-card">
  <div className="wordmark login-wordmark"><span className="app-mark"><i/><i/><i/></span>postly<span className="wordmark-dot">.</span></div>
  {mode==='sent'?<div className="text-center"><MailCheck className="mx-auto text-primary" size={32}/><h1 className="mt-4">Check your inbox</h1><p className="login-sub">Password reset is not configured. Ask your workspace administrator.</p><Button variant="outline" className="w-full mt-6" onClick={()=>{setMode('login');setPassword('')}}><ArrowLeft/>Back to sign in</Button></div>:<>
  <h1>{mode==='login'?'Welcome back':'Reset your password'}</h1><p className="login-sub">{mode==='login'?'Sign in to your content workspace.':'Enter your email and we will send a reset link.'}</p>
  <form onSubmit={submit} noValidate className="login-form">
   <Field label="Email address"><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email?'email-error':undefined}/></Field>{errors.email&&<p id="email-error" className="field-error">{errors.email}</p>}
   {mode==='login'&&<><div className="field"><span className="flex justify-between"><label htmlFor="password">Password</label><button type="button" className="link-button" onClick={()=>{setMode('forgot');setErrors({})}}>Forgot password?</button></span><div className="password-wrap"><input id="password" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={!!errors.password}/><Button type="button" variant="ghost" size="icon" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</Button></div></div>{errors.password&&<p className="field-error">{errors.password}</p>}</>}
   {errors.form&&<div className="notice warning" role="alert">{errors.form}</div>}
   <Button type="submit" className="w-full" disabled={busy}>{busy?(mode==='login'?'Signing in...':'Sending...'):mode==='login'?'Sign in':'Send reset link'}</Button>
   {mode==='forgot'&&<Button type="button" variant="ghost" className="w-full" onClick={()=>setMode('login')}><ArrowLeft/>Back to sign in</Button>}
  </form></>}
  <p className="sample-label text-center mt-4">The administrator account is created from the server environment during setup.</p>
  <p className="sr-only"><Link to="/">Skip to workspace</Link></p>
 </div></div>;
}
