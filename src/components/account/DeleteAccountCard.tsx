'use client';

/**
 * Client island for /account/delete (plan §5.6). The user re-types their
 * account email as the deletion confirmation; the server verifies it against
 * the session's account. On success the API has already revoked the session
 * and cleared cookies — we notify the shell (push-token invalidation) and
 * hard-navigate home to purge client state.
 */

import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { mutateJson } from '@/lib/csrf';
import { notifyNativeLogout } from '@/native/bridge';

export function DeleteAccountCard() {
  const { user } = useAuth();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm">
        <p className="font-medium">You need to be signed in to delete your account.</p>
        <p className="mt-1 text-muted-foreground">
          <a href="/auth" className="underline underline-offset-2">Log in</a> first, then return to
          this page. If you can no longer access your account, email support from your registered
          address and we will process the deletion manually.
        </p>
      </div>
    );
  }

  const matches = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  const handleDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      const response = await mutateJson('/api/users/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        warnings?: string[];
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(body.detail ?? 'Could not delete the account. Please try again.');
      }
      for (const warning of body.warnings ?? []) toast.warning(warning);
      toast.success('Your account has been deleted.');
      await notifyNativeLogout();
      window.location.href = '/';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the account.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-red-500">This is permanent</p>
          <p className="mt-1 text-muted-foreground">
            Your name, email, mobile number, photo and public profile are erased immediately and
            cannot be recovered. Active premium subscriptions are cancelled. Anonymous learning
            statistics (test attempts, leaderboard aggregates) are retained without any link to you.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-email" className="text-xs font-medium text-muted-foreground">
          Type <span className="font-mono">{user.email}</span> to confirm
        </label>
        <Input
          id="confirm-email"
          type="email"
          autoComplete="off"
          placeholder={user.email}
          value={confirmEmail}
          onChange={(event) => setConfirmEmail(event.target.value)}
          disabled={busy}
        />
      </div>
      <Button
        type="button"
        variant="destructive"
        className="w-full rounded-full"
        disabled={!matches || busy}
        onClick={() => void handleDelete()}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Delete my account permanently
      </Button>
    </div>
  );
}
