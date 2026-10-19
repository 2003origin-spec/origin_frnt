'use client';

/**
 * "Send coins" on the wallet (decision B93): gift bought or earned coins to
 * another Origin NOW member by @username. Shown only when an admin has
 * switched coin gifts on; the server checks every rule again.
 */

import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';

type GiftOptions = { enabled: boolean; dailyCap: number; limit: number; blocked: string | null };

export function NowSendCoins({ onSent }: { onSent: () => void }) {
  const [options, setOptions] = useState<GiftOptions | null>(null);
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/wallet/gifts')
      .then((res) => !cancelled && setOptions((res as { gifts: GiftOptions }).gifts))
      .catch(() => !cancelled && setOptions(null));
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (!options?.enabled) return null;
  const coins = Number(amount);
  const valid = username.trim().replace(/^@/, '').length >= 3 && Number.isInteger(coins) && coins >= 1 && coins <= options.limit;

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = (await apiCall('/now/wallet/gifts', {
        method: 'POST',
        headers: { 'Idempotency-Key': `gift:${crypto.randomUUID()}` },
        body: JSON.stringify({ toUsername: username.trim(), amount: coins }),
      })) as { sent: number; toName: string };
      setMessage({ ok: true, text: `Sent ${res.sent} coins to ${res.toName}.` });
      setUsername('');
      setAmount('');
      setConfirming(false);
      setVersion((v) => v + 1);
      onSent();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not send the coins.' });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="h-4 w-4 text-primary" aria-hidden /> Send coins
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {options.blocked ? (
          <p className="text-muted-foreground">{options.blocked}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="now-gift-to" className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">To (@username)</span>
                <input
                  id="now-gift-to"
                  className="w-48 rounded-md border bg-background px-2 py-1.5 text-sm"
                  placeholder="@asha_k"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setConfirming(false);
                  }}
                />
              </label>
              <label htmlFor="now-gift-amount" className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Coins</span>
                <input
                  id="now-gift-amount"
                  inputMode="numeric"
                  className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/\D/g, ''));
                    setConfirming(false);
                  }}
                />
              </label>
              {confirming ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={send} disabled={busy}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Send {coins} coins to {username.trim().startsWith('@') ? username.trim() : `@${username.trim()}`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" disabled={!valid} onClick={() => setConfirming(true)}>
                  Send
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              You can send up to {options.limit} coins now ({options.dailyCap} a day). Only coins you bought or earned can be gifted, and a gift cannot be taken back.
            </p>
          </>
        )}
        {message && (
          <p className={message.ok ? 'text-emerald-700' : 'text-red-600'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
