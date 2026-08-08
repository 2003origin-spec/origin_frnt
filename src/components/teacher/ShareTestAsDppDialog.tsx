"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/teacher-client";
import type { BatchWithCounts, TeacherDppShare } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  testId: string;
  testTitle: string;
  batches: BatchWithCounts[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function formatExpiry(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : DATE_FORMATTER.format(parsed);
}

/**
 * "Share as DPP" — pick batches, publish, done. The test's questions become a
 * DPP in every selected batch's students' /dpp section for 30 days.
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 3)
 */
export function ShareTestAsDppDialog({
  workspaceId,
  testId,
  testTitle,
  batches,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [shares, setShares] = useState<TeacherDppShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Batches that already have this test live as a DPP are shown with their
  // expiry and locked — re-sharing to them is refused server-side anyway.
  const liveByBatch = new Map<string, string>();
  for (const share of shares) {
    for (const batchId of share.batchIds) liveByBatch.set(batchId, share.expiresAt);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelected([]);
    setLoadingShares(true);
    void (async () => {
      const res = await apiJson<{ shares: TeacherDppShare[] }>(
        `/api/teacher/workspaces/${workspaceId}/tests/${testId}/assign`,
      );
      if (cancelled) return;
      setShares(res.ok ? res.data.shares : []);
      setLoadingShares(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, testId]);

  function toggle(batchId: string) {
    setSelected((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId],
    );
  }

  async function handlePublish() {
    if (selected.length === 0) {
      toast.error("Select at least one batch.");
      return;
    }
    setSubmitting(true);
    const res = await apiJson<{ share: TeacherDppShare }>(
      `/api/teacher/workspaces/${workspaceId}/tests/${testId}/assign`,
      { method: "POST", json: { action: "share_dpp", batchIds: selected } },
    );
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.detail || "Failed to share this test as a DPP.");
      return;
    }
    toast.success(
      `Shared as a DPP with ${selected.length} batch${selected.length === 1 ? "" : "es"}. Live for 30 days.`,
    );
    onOpenChange(false);
    router.refresh();
  }

  const availableBatches = batches.filter((batch) => batch.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Share as DPP
          </DialogTitle>
          <DialogDescription>
            Send <span className="font-semibold text-foreground">{testTitle}</span> to your batches
            as a Daily Practice Problem set. It appears in each student&apos;s DPP section under your
            institute&apos;s name and stays available for 30 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {availableBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No active batches yet. Create a batch first.
            </p>
          ) : (
            availableBatches.map((batch) => {
              const liveUntil = liveByBatch.get(batch.id);
              const disabled = Boolean(liveUntil) || loadingShares;
              return (
                <label
                  key={batch.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-primary/40"
                  }`}
                >
                  <Checkbox
                    checked={selected.includes(batch.id)}
                    disabled={disabled}
                    onCheckedChange={() => toggle(batch.id)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{batch.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {batch.studentCount} student{batch.studentCount === 1 ? "" : "s"}
                      {liveUntil ? ` · already shared, live until ${formatExpiry(liveUntil)}` : ""}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={submitting || selected.length === 0}>
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
