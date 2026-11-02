'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { reportConversation } from '@/features/messaging/client';
import { REPORT_NOTE_MAX_CHARS } from '@/features/messaging/messaging-ui';
import type { ReportReason } from '@/features/messaging/types';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Bullying or abuse' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

export default function ReportDialog({
  open,
  onOpenChange,
  conversationId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  name: string;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    const res = await reportConversation(conversationId, reason, note.trim() || undefined);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.detail ?? 'Couldn’t send the report. Try again.');
      return;
    }
    toast.success('Thanks. Our team will look at it.');
    setReason('');
    setNote('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {name}</DialogTitle>
          <DialogDescription>
            Our team reads the conversation and decides what to do. {name} isn&apos;t told who reported.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="gap-2">
          {REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`report-${r.value}`}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 font-semibold has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem id={`report-${r.value}`} value={r.value} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>
        <div className="space-y-1">
          <Label htmlFor="report-note" className="text-xs text-muted-foreground">
            Anything else we should know? (optional)
          </Label>
          <Textarea
            id="report-note"
            value={note}
            maxLength={REPORT_NOTE_MAX_CHARS}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!reason || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
