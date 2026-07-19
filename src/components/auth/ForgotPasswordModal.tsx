'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Mail, KeyRound, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { requestPasswordResetAction, resetPasswordAction } from '@/server/actions/auth-actions';

type Props = {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
  role: 'student' | 'teacher' | 'admin' | null;
  /** Called after a successful reset so the parent can prefill/return to login. */
  onResetComplete?: (email: string) => void;
};

export function ForgotPasswordModal({ open, onClose, initialEmail = '', role, onResetComplete }: Props) {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  if (!open) return null;

  function reset() {
    setStep('email');
    setCode('');
    setNewPassword('');
    setConfirm('');
    setError(null);
    setBusy(false);
    setResendCooldown(0);
  }

  function close() {
    reset();
    onClose();
  }

  async function sendCode() {
    setError(null);
    if (resendCooldown > 0) return; // guard: the server also silently no-ops resends within its window
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestPasswordResetAction({ email: trimmed, role });
      // Enumeration-safe: we always advance, even if no account exists.
      toast.success('If an account exists, a reset code has been sent to your email.');
      if (res.devCode) toast.message(`Dev code: ${res.devCode}`); // dev-only when no mail configured
      setResendCooldown(100);
      setStep('reset');
    } catch {
      setError('Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await resetPasswordAction({ email: email.trim(), role, code, newPassword });
      if (!res.ok) {
        setError(res.error ?? 'Reset failed.');
        return;
      }
      setStep('done');
      toast.success('Password updated. You can now sign in.');
      onResetComplete?.(email.trim());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
      <div
        className="w-full max-w-sm space-y-5 rounded-3xl border border-border/40 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight text-foreground">Reset password</h2>
          <button onClick={close} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'email' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your account email and we&apos;ll send a 6-digit reset code.
            </p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && sendCode()}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border/40 bg-background py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            <button
              onClick={sendCode}
              disabled={busy || resendCooldown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send reset code'}
            </button>
          </div>
        )}

        {step === 'reset' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the code sent to <span className="font-bold text-foreground">{email}</span> and choose a new password.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} containerClassName="group">
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground">
              <span>Didn&apos;t get the code?</span>
              <button
                type="button"
                disabled={busy || resendCooldown > 0}
                onClick={sendCode}
                className="flex items-center gap-1 font-bold text-primary disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : <><RefreshCw className="h-3 w-3" />Resend</>}
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-xl border border-border/40 bg-background py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && submitReset()}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-border/40 bg-background py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('email'); setError(null); }}
                disabled={busy}
                className="rounded-xl border border-border/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={submitReset}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-sm font-bold text-foreground">Password updated</p>
            <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
            <button
              onClick={close}
              className="w-full rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
