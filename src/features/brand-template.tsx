import { useMemo, useRef, useState } from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from './shared';
import { useWorkspace } from './workspace';
import { api, type Media, type Platform } from '@/services/api';
import { toast } from 'sonner';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the selected image or logo.'));
    image.src = src;
  });
}

export function BrandTemplateWorkflow() {
  const w = useWorkspace();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState(w.selected === 'all' ? w.businesses.find(b => !b.archived)?.id || '' : w.selected);
  const [backgroundId, setBackgroundId] = useState('');
  const [logoId, setLogoId] = useState('');
  const [fontId, setFontId] = useState('');
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [headline, setHeadline] = useState('A thoughtful message for your audience');
  const [subline, setSubline] = useState('Add supporting copy that fits your brand.');
  const [accent, setAccent] = useState('');
  const [busy, setBusy] = useState(false);
  const business = w.businesses.find(b => b.id === businessId);
  const images = useMemo(() => w.media.filter(m => m.businessId === businessId && m.type === 'Image'), [w.media, businessId]);
  const logos = useMemo(() => w.media.filter(m => m.businessId === businessId && (m.type === 'Logo' || /logo/i.test(m.name)) && ['PNG','JPG','JPEG','WEBP','GIF'].includes(m.fileType.toUpperCase())), [w.media, businessId]);
  const fonts = useMemo(() => w.media.filter(m => m.businessId === businessId && m.type === 'Font'), [w.media, businessId]);
  const fontAsset = fonts.find(m => m.id === fontId);
  const background = images.find(m => m.id === backgroundId);
  const logo = logos.find(m => m.id === logoId);
  const color = accent || business?.colors?.[0] || '#2563eb';

  async function makeImage() {
    if (!background || !canvas.current) throw new Error('Choose a background image.');
    const target = canvas.current;
    const square = platform === 'Instagram';
    target.width = square ? 1080 : 1200;
    target.height = square ? 1080 : 627;
    const context = target.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
    const source = await loadImage(background.url);
    const scale = Math.max(target.width / source.naturalWidth, target.height / source.naturalHeight);
    const sw = target.width / scale, sh = target.height / scale;
    context.drawImage(source, (source.naturalWidth - sw) / 2, (source.naturalHeight - sh) / 2, sw, sh, 0, 0, target.width, target.height);
    context.fillStyle = `${color}d9`;
    context.fillRect(0, target.height * 0.61, target.width, target.height * 0.39);
    context.fillStyle = '#ffffff';
    let fontStack = business?.fonts && business.fonts !== 'Not set' ? `${business.fonts}, Arial, sans-serif` : 'Arial, sans-serif';
    if (fontAsset) { const face = new FontFace('CCCUploadedFont', `url("${fontAsset.url}")`); await face.load(); document.fonts.add(face); fontStack = 'CCCUploadedFont, Arial, sans-serif'; }
    const fontSize = square ? 58 : 48;
    context.font = `700 ${fontSize}px ${fontStack}`;
    context.textBaseline = 'top';
    const maxWidth = target.width - 100;
    const words = headline.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const top = target.height * 0.67;
    lines.slice(0, 2).forEach((value, i) => context.fillText(value, 50, top + i * (fontSize + 8), maxWidth));
    context.font = `400 ${square ? 32 : 27}px ${fontStack}`;
    context.fillStyle = 'rgba(255,255,255,.92)';
    context.fillText(subline.trim().slice(0, 130), 50, top + Math.min(lines.length, 2) * (fontSize + 12) + 8, maxWidth);
    if (logo) {
      const brandLogo = await loadImage(logo.url);
      const maxLogoW = target.width * 0.23, maxLogoH = target.height * 0.13;
      const factor = Math.min(maxLogoW / brandLogo.naturalWidth, maxLogoH / brandLogo.naturalHeight);
      const lw = brandLogo.naturalWidth * factor, lh = brandLogo.naturalHeight * factor;
      context.drawImage(brandLogo, target.width - lw - 42, 34, lw, lh);
    }
    context.fillStyle = '#ffffff';
    context.font = `600 ${square ? 23 : 20}px ${fontStack}`;
    context.fillText(business?.name || '', 50, target.height - 42, target.width - 100);
    return await new Promise<Blob>((resolve, reject) => target.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the branded image.')), 'image/jpeg', .92));
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await makeImage();
      const file = new File([blob], `${business?.name || 'brand'}-${platform.toLowerCase()}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await api.uploadMedia([file], businessId);
      await w.refresh();
      toast.success('Branded image rendered and saved to the media library.');
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Template rendering failed.'); }
    finally { setBusy(false); }
  }

  return <section className="form-section mt-6">
    <div className="flex items-center justify-between gap-4"><div><h2>Brand template renderer</h2><p className="sample-label mt-1">Add exact business colours, logo and copy to an uploaded image. The final JPEG is saved to the media library.</p></div><Button onClick={() => { setBusinessId(w.selected === 'all' ? w.businesses.find(b => !b.archived)?.id || '' : w.selected); setOpen(true); }}><Palette/>Create branded image</Button></div>
    {open && <div className="form-grid mt-5"><Field label="Business"><select value={businessId} onChange={e => { setBusinessId(e.target.value); setBackgroundId(''); setLogoId(''); setFontId(''); }}><option value="">Choose business</option>{w.businesses.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Platform layout"><select value={platform} onChange={e => setPlatform(e.target.value as Platform)}><option>Instagram</option><option>Facebook</option><option>LinkedIn</option></select></Field><Field label="Background image"><select value={backgroundId} onChange={e => setBackgroundId(e.target.value)}><option value="">Choose an uploaded image</option>{images.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Business logo (optional)"><select value={logoId} onChange={e => setLogoId(e.target.value)}><option value="">No logo</option>{logos.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Uploaded font (optional)"><select value={fontId} onChange={e => setFontId(e.target.value)}><option value="">Use business profile font</option>{fonts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Headline"><input maxLength={180} value={headline} onChange={e => setHeadline(e.target.value)}/></Field><Field label="Supporting copy"><input maxLength={130} value={subline} onChange={e => setSubline(e.target.value)}/></Field><Field label="Overlay colour"><input type="color" value={color} onChange={e => setAccent(e.target.value)}/></Field><div className="field field-wide flex flex-wrap gap-2"><Button variant="outline" disabled={!background} onClick={async () => { try { await makeImage(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Preview failed.'); } }}><Sparkles/>Preview</Button><Button disabled={!background || busy} onClick={() => void save()}><Check/>{busy ? 'Rendering…' : 'Save to media library'}</Button><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button></div><div className="field field-wide"><canvas ref={canvas} className="w-full rounded-md border" aria-label="Branded image preview"/></div></div>}
  </section>;
}
