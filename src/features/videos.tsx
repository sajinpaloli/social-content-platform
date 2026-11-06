import { useEffect, useRef, useState } from 'react';
import { Film, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from './workspace';
import { api } from '@/services/api';
import { toast } from 'sonner';

type VideoWorkflowProps = {
  onOpen: (id: string) => void;
};

export function VideoWorkflow({ onOpen }: VideoWorkflowProps) {
  const workspace = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const videos = workspace.media.filter((item) => item.type === 'Video' && (workspace.selected === 'all' || item.businessId === workspace.selected));
  useEffect(() => { setSelectedIds([]); }, [workspace.selected]);

  function toggle(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function deleteSelected() {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected video(s)? Videos attached to active posts cannot be deleted.`)) return;
    setDeleting(true);
    const results = await Promise.all(selectedIds.map(async id => {
      try { await api.deleteMedia(id); return { id, error: '' }; }
      catch (error) { return { id, error: error instanceof Error ? error.message : 'Delete failed.' }; }
    }));
    const failed = results.filter(result => result.error);
    const deleted = results.length - failed.length;
    setSelectedIds(failed.map(result => result.id));
    await workspace.refresh().catch(() => {});
    setDeleting(false);
    if (deleted) toast.success(`${deleted} video(s) deleted.`);
    if (failed.length) toast.error(`${failed.length} video(s) could not be deleted. ${failed[0]?.error || ''}`);
  }

  async function upload(files: FileList | null) {
    const selected = Array.from(files || []).filter((file) => file.type.startsWith('video/'));
    if (!selected.length) {
      toast.error('Choose one or more video files.');
      return;
    }

    setBusy(true);
    try {
      const businessId = workspace.selected === 'all'
        ? (workspace.businesses.find((business) => !business.archived)?.id || '')
        : workspace.selected;
      const saved = await api.uploadMedia(selected, businessId);
      await workspace.refresh();
      toast.success(`${saved.length} video(s) uploaded to the server and media library.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Video upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="form-section mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Video library</h2>
          <p className="sample-label mt-1">
            Upload a video, then open its tools to analyze it, create platform captions and subtitles,
            render clips, or extract thumbnails. The server needs FFmpeg and an OpenAI key; analysis
            may incur usage charges.
          </p>
        </div>
        <Button disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> {busy ? 'Uploading…' : 'Upload videos'}
        </Button>
        <input
          hidden
          ref={input}
          type="file"
          multiple
          accept="video/*"
          aria-label="Upload one or more videos"
          onChange={(event) => void upload(event.target.files)}
        />
      </div>

      {videos.length ? (
        <>
        <div className="media-selection-toolbar"><label className="checkbox-label"><input type="checkbox" checked={videos.length > 0 && selectedIds.length === videos.length} onChange={() => setSelectedIds(selectedIds.length === videos.length ? [] : videos.map(video => video.id))} />Select all videos</label><span>{selectedIds.length} selected</span><Button variant="destructive" disabled={!selectedIds.length || deleting} onClick={() => void deleteSelected()}><Trash2 />{deleting ? 'Deleting selected…' : `Delete selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}</Button></div>
        <ul className="video-jobs mt-4">
          {videos.map((video) => (
            <li key={video.id}>
              <input type="checkbox" aria-label={`Select ${video.name}`} checked={selectedIds.includes(video.id)} onChange={() => toggle(video.id)} />
              <Film size={18} />
              <div className="min-w-0 flex-1">
                <strong className="block truncate">{video.name}</strong>
                <small>
                  {workspace.businesses.find((business) => business.id === video.businessId)?.name || 'Unassigned'}
                  {' · '}{video.fileType} · uploaded {video.date}
                </small>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpen(video.id)}>
                Open video tools
              </Button>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No videos have been uploaded to this workspace.</p>
      )}
    </section>
  );
}
