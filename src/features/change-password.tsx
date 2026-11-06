import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field } from './shared';
import { api } from '@/services/api';
import { toast } from 'sonner';

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (newPassword.length < 14) { toast.error('Choose a password with at least 14 characters.'); return; }
    setBusy(true);
    try { await api.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); onOpenChange(false); toast.success('Password changed.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not change your password.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogTitle>Change your password</DialogTitle><DialogDescription>Use a unique password with at least 14 characters.</DialogDescription><Field label="Current password"><input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></Field><Field label="New password"><input type="password" autoComplete="new-password" minLength={14} value={newPassword} onChange={e => setNewPassword(e.target.value)}/></Field><Button disabled={busy || !currentPassword || !newPassword} onClick={() => void save()}>{busy ? 'Saving…' : 'Change password'}</Button></DialogContent></Dialog>;
}
