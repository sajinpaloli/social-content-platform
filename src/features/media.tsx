import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Upload, LayoutGrid, List, Play, Sparkles, Video, Image, Check, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, Filters, Field, Empty } from './shared';
import { useWorkspace } from './workspace';
import { api, type Media, type Platform, platforms } from '@/services/api';
import { VideoWorkflow } from './videos';
import { BrandTemplateWorkflow } from './brand-template';
import { toast } from 'sonner';

export function MediaPage() {
  const w = useWorkspace();
  const [section, setSection] = useState<'images' | 'templates' | 'videos'>('images');
  const [view, setView] = useState('Grid');
  const [media, setMedia] = useState<Media | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imagePlatform, setImagePlatform] = useState<Platform>('Instagram');
  const [imageBusiness, setImageBusiness] = useState(w.selected === 'all' ? (w.businesses.find(b => !b.archived)?.id || '') : w.selected);
  const [videoBusy, setVideoBusy] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const rows = w.media.filter(m => (w.selected === 'all' || m.businessId === w.selected) && m.type === 'Image');
  useEffect(() => { setSelectedImageIds([]); }, [w.selected]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setProgress(0);
    try {
      const list = Array.from(files);
      const chosenBusiness = w.selected === 'all' ? (w.businesses.find(b => !b.archived)?.id || '') : w.selected;
      const saved = await api.uploadMedia(list, chosenBusiness);
      await w.refresh();
      setProgress(100);
      const images = saved.filter(item => item.type === 'Image').length;
      const videos = saved.filter(item => item.type === 'Video').length;
      toast.success(`${images} image(s) and ${videos} video(s) uploaded to their separate library views.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Media upload failed.');
    } finally {
      window.setTimeout(() => setProgress(null), 1600);
      if (input.current) input.current.value = '';
    }
  }

  async function openImageGenerator() {
    try {
      const provider = await api.getProviderSettings();
      if (!provider.configured) {
        toast.error('Add an OpenAI API key in Integrations before generating images.');
        return;
      }
      setImageBusiness(w.selected === 'all' ? (w.businesses.find(b => !b.archived)?.id || '') : w.selected);
      setImageOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not check the image provider.');
    }
  }

  async function generateImage() {
    if (!imagePrompt.trim()) return;
    setImageBusy(true);
    try {
      const saved = await api.generateImage(imageBusiness, imagePrompt, imagePlatform);
      await w.refresh();
      setImageOpen(false);
      setImagePrompt('');
      setMedia(saved);
      toast.success('Generated image saved to the image library.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      setImageBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedImageIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function selectAllImages() {
    setSelectedImageIds(selectedImageIds.length === rows.length ? [] : rows.map(item => item.id));
  }

  async function deleteSelectedImages() {
    if (!selectedImageIds.length || !window.confirm(`Delete ${selectedImageIds.length} selected image(s)? Images attached to active posts cannot be deleted.`)) return;
    setBulkDeleting(true);
    const results = await Promise.all(selectedImageIds.map(async id => {
      try { await api.deleteMedia(id); return { id, error: '' }; }
      catch (error) { return { id, error: error instanceof Error ? error.message : 'Delete failed.' }; }
    }));
    const failed = results.filter(result => result.error);
    const deleted = results.length - failed.length;
    setSelectedImageIds(failed.map(result => result.id));
    try { await w.refresh(); } catch { /* Keep the successful deletion results visible via refresh on next navigation. */ }
    setBulkDeleting(false);
    if (deleted) toast.success(`${deleted} image(s) deleted.`);
    if (failed.length) toast.error(`${failed.length} image(s) could not be deleted. ${failed[0]?.error || ''}`);
  }

  async function analyzeVideo() {
    if (!media) return;
    setVideoBusy(true);
    try {
      const updated = await api.analyzeVideo(media.id);
      setMedia(updated);
      await w.refresh();
      toast.success('Video transcript, captions, subtitles and clip suggestions are ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Video analysis failed.');
    } finally { setVideoBusy(false); }
  }

  async function renderClip(start: number, end: number) {
    if (!media) return;
    setVideoBusy(true);
    try {
      const result = await api.renderVideoClip(media.id, start, end);
      await w.refresh();
      toast.success(`Rendered ${result.name} and saved it to the video library.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Clip render failed.');
    } finally { setVideoBusy(false); }
  }

  async function makeThumbnail(at: number) {
    if (!media) return;
    setVideoBusy(true);
    try {
      const result = await api.extractThumbnail(media.id, at);
      await w.refresh();
      toast.success(`Thumbnail saved: ${result.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thumbnail extraction failed.');
    } finally { setVideoBusy(false); }
  }

  async function downloadSubtitles(format: 'srt' | 'vtt') {
    if (!media) return;
    try {
      const result = await api.getSubtitles(media.id, format);
      const url = URL.createObjectURL(new Blob([result.content], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = result.filename; link.click(); URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download subtitles.');
    }
  }

  async function deleteCurrentMedia() {
    if (!media || !window.confirm('Delete this media file from the library?')) return;
    try {
      await api.deleteMedia(media.id);
      await w.refresh(); setMedia(null); toast.success('Media file deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this media file.');
    }
  }

  return <>
    <PageHeader title="Your creative library." description="The right visuals, ready for the right moment.">
      <Button variant="outline" onClick={() => void openImageGenerator()}><Sparkles />Generate image</Button>
      <Button onClick={() => input.current?.click()}><Upload />Upload media</Button>
      <input hidden ref={input} type="file" multiple accept="image/*,video/*" aria-label="Upload images or videos" onChange={event => void upload(event.target.files)} />
    </PageHeader>
    <div className="notice mb-6"><Image size={18} />Images and videos appear in separate tabs. Select an image’s expand icon to open the original file at full size in a new browser tab.</div>
    {progress !== null && <div className="upload-progress"><span>{progress === 100 ? 'Upload complete' : 'Uploading files...'} {progress}%</span><progress max="100" value={progress} /></div>}
    <div className="library-tabs" role="tablist" aria-label="Media library sections">
      {[{ id: 'images', label: `Images (${w.media.filter(m => m.type === 'Image').length})` }, { id: 'videos', label: `Videos (${w.media.filter(m => m.type === 'Video').length})` }, { id: 'templates', label: 'Brand template renderer' }].map(tab => <Button key={tab.id} role="tab" aria-selected={section === tab.id} variant="outline" className={section === tab.id ? 'active' : ''} onClick={() => setSection(tab.id as typeof section)}>{tab.label}</Button>)}
    </div>
    {section === 'images' && <>
      <div className="flex flex-wrap justify-between gap-3"><Filters /><div className="segmented">{[{ v: 'Grid', icon: LayoutGrid }, { v: 'List', icon: List }].map(({ v, icon: Icon }) => <Button key={v} variant="ghost" className={view === v ? 'selected' : ''} onClick={() => setView(v)}><Icon />{v}</Button>)}</div></div>
      <div className="media-selection-toolbar"><label className="checkbox-label"><input type="checkbox" checked={rows.length > 0 && selectedImageIds.length === rows.length} onChange={selectAllImages} />Select all images</label><span>{selectedImageIds.length} selected</span><Button variant="destructive" disabled={!selectedImageIds.length || bulkDeleting} onClick={() => void deleteSelectedImages()}><Trash2 />{bulkDeleting ? 'Deleting selected…' : `Delete selected${selectedImageIds.length ? ` (${selectedImageIds.length})` : ''}`}</Button></div>
      <div className="section-title"><h2>Images <span className="count-pill">{rows.length}</span></h2><span className="sample-label">Image files only</span></div>
      <div className={view === 'Grid' ? 'media-grid' : 'media-list'}>{rows.map(item => <article className="media-card" key={item.id}>
        <div className="media-thumbnail"><button type="button" className="media-thumbnail-open" onClick={() => setMedia(structuredClone(item))} aria-label={`Open details for ${item.name}`}><img src={item.url} width={800} height={600} loading="lazy" alt={item.name} /></button><div className="media-image-actions"><label className="media-select" aria-label={`Select ${item.name}`} onClick={event => event.stopPropagation()}><input type="checkbox" checked={selectedImageIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /></label><Button type="button" variant="ghost" size="icon" className="media-fullsize-button" aria-label={`Open ${item.name} at full size in a new tab`} title="Open full-size image in a new tab" onClick={event => { event.stopPropagation(); window.open(item.url, '_blank', 'noopener,noreferrer'); }}><Maximize2 size={17} /></Button></div><span className="media-type"><Image size={12} />{item.fileType}</span></div>
        <div className="media-description"><button type="button" className="media-name-button" onClick={() => setMedia(structuredClone(item))}>{item.name}</button><span>{w.businesses.find(b => b.id === item.businessId)?.name}</span><small>{item.dimensions} · {item.date}</small></div>
      </article>)}</div>
      {!rows.length && <Empty title="No images yet" description="Upload images from your computer or generate a branded image to get started." />}
    </>}
    {section === 'templates' && <BrandTemplateWorkflow />}
    {section === 'videos' && <VideoWorkflow onOpen={id => { const item = w.media.find(m => m.id === id); if (item) setMedia(structuredClone(item)); }} />}

    <Dialog open={!!media} onOpenChange={open => { if (!open) setMedia(null); }}>
      <DialogContent className="detail-dialog"><DialogTitle>{media?.name}</DialogTitle><DialogDescription>Saved media details</DialogDescription>
        {media && <>{media.type === 'Video' ? <video className="detail-image" src={media.url} width={800} height={600} controls preload="metadata" aria-label={media.name} /> : <img className="detail-image" src={media.url} width={1200} height={900} alt={media.name} />}
          <Field label="Business assignment"><select value={media.businessId} onChange={event => setMedia({ ...media, businessId: event.target.value })}>{w.businesses.map(business => <option value={business.id} key={business.id}>{business.name}</option>)}</select></Field>
          <p className="text-sm">{media.dimensions} · {media.fileType} · Uploaded {media.date}</p>
          {media.type === 'Video' ? <div className="video-tools"><h3>Video analysis</h3>{media.metadata?.analysis ? <><p>{media.metadata.analysis.summary || 'No summary was returned.'}</p>{platforms.map(platform => { const variant = media.metadata?.analysis?.captions?.[platform]; return variant ? <div key={platform}><strong>{platform} caption</strong><p>{variant.hook}</p><p>{variant.caption}</p><p>{variant.hashtags}</p></div> : null; })}<details><summary>Transcript and subtitles</summary><pre className="text-xs whitespace-pre-wrap max-h-60 overflow-auto">{media.metadata.analysis.transcript}</pre><textarea aria-label="Subtitles in SRT format" readOnly value={media.metadata.analysis.subtitles || ''} rows={8} /><div className="flex gap-2 mt-2"><Button size="sm" variant="outline" onClick={() => void downloadSubtitles('srt')}>Download SRT</Button><Button size="sm" variant="outline" onClick={() => void downloadSubtitles('vtt')}>Download VTT</Button></div></details>{media.metadata.analysis.clips?.map((clip, index) => <div className="flex items-center gap-2" key={`${clip.start}-${index}`}><span className="flex-1"><strong>{clip.title}</strong><small>{clip.start}s–{clip.end}s · {clip.reason}</small></span><Button size="sm" variant="outline" disabled={videoBusy} onClick={() => void renderClip(clip.start, clip.end)}>Render clip</Button><Button size="sm" variant="ghost" disabled={videoBusy} onClick={() => void makeThumbnail(clip.start)}>Thumbnail</Button></div>)}<small>Analyzed {media.metadata.analysis.analyzedAt ? new Date(media.metadata.analysis.analyzedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : ''}</small></> : <><p>Extracts speech, prepares separate platform captions, creates subtitle text and suggests short clip ranges from the transcript. An OpenAI key and FFmpeg are required; provider charges may apply.</p><Button disabled={videoBusy} className="w-full" onClick={() => void analyzeVideo()}><Sparkles />{videoBusy ? 'Analyzing video…' : 'Analyze video with OpenAI'}</Button></>}</div> : <p className="text-sm text-muted-foreground">Used by {w.posts.filter(post => post.image === media.url).length} posts.</p>}
          <div className="flex justify-between gap-2"><Button variant="destructive" onClick={() => void deleteCurrentMedia()}><Trash2 />Delete media</Button><Button onClick={async () => { await w.saveMedia(media); setMedia(null); }}><Check />Save details</Button></div>
          {media.type === 'Video' && <Button variant="outline" asChild><Link to="/editor" search={{ media: media.id }}>Create video post</Link></Button>}
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={imageOpen} onOpenChange={setImageOpen}><DialogContent className="detail-dialog"><DialogTitle>Generate a branded visual</DialogTitle><DialogDescription>Uses OpenAI image generation and saves the result to this business image library. Each generation may incur API charges.</DialogDescription><Field label="Business"><select value={imageBusiness} onChange={event => setImageBusiness(event.target.value)}>{w.businesses.filter(b => !b.archived).map(business => <option value={business.id} key={business.id}>{business.name}</option>)}</select></Field><Field label="Platform"><select value={imagePlatform} onChange={event => setImagePlatform(event.target.value as Platform)}>{platforms.map(platform => <option key={platform}>{platform}</option>)}</select></Field><Field label="Image brief"><textarea rows={4} maxLength={1500} value={imagePrompt} onChange={event => setImagePrompt(event.target.value)} placeholder="Describe the image concept, subject and mood. Avoid asking the AI to draw logos or text." /></Field><Button disabled={imageBusy || !imagePrompt.trim()} onClick={() => void generateImage()}><Sparkles />{imageBusy ? 'Generating…' : 'Generate image'}</Button></DialogContent></Dialog>
  </>;
}
