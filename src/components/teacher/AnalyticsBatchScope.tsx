"use client";

import { useState } from "react";
import { BarChart3, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BatchWithCounts } from "@/server/workspaces/types";

import { AnalyticsCenterHighFidelity } from "./AnalyticsCenterHighFidelity";
import { BatchLeaderboardPanel } from "./BatchLeaderboardPanel";

type Props = {
  workspaceId: string;
  batches: BatchWithCounts[];
  /** Leaderboards ride the same flag as the rest of the deep-dive analytics. */
  analyticsEnabled: boolean;
};

type Section = "mastery" | "leaderboards";

/**
 * Batch scoping for the workspace Analytics page.
 *
 * The page previously hardcoded `batches[0].id` with no way to change it, so a
 * workspace with five batches could only ever see the first one's analytics —
 * a real bug, not just a missing control. This wrapper owns the selected batch
 * and the section split, leaving AnalyticsCenterHighFidelity untouched.
 *
 * The child is keyed on batchId so switching batches remounts it: every piece of
 * its internal state (loaded snapshots, the open student drill-down, optimistic
 * coverage toggles) belongs to one batch, and carrying any of it across would
 * show one batch's data under another's name.
 */
export function AnalyticsBatchScope({ workspaceId, batches, analyticsEnabled }: Props) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [section, setSection] = useState<Section>("mastery");
  const active = batches.find((batch) => batch.id === batchId) ?? batches[0];

  if (!active) return null;

  return (
    <div className="space-y-6">
      {/* ── Batch scope ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Batch
        </div>
        <div className="flex flex-wrap gap-2">
          {batches.map((batch) => (
            <button
              key={batch.id}
              type="button"
              onClick={() => setBatchId(batch.id)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                batch.id === active.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {batch.name}
              <span className="ml-2 font-mono text-[0.7rem] tabular-nums opacity-70">
                {batch.studentCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section ─────────────────────────────────────────────────────── */}
      <div className="flex border-b">
        <Button
          variant="ghost"
          onClick={() => setSection("mastery")}
          className={`h-11 gap-2 rounded-none border-b-2 px-5 font-bold ${
            section === "mastery"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Mastery &amp; Topics
        </Button>
        {analyticsEnabled ? (
          <Button
            variant="ghost"
            onClick={() => setSection("leaderboards")}
            className={`h-11 gap-2 rounded-none border-b-2 px-5 font-bold ${
              section === "leaderboards"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Trophy className="h-4 w-4" />
            Leaderboards
          </Button>
        ) : null}
      </div>

      {section === "mastery" ? (
        <AnalyticsCenterHighFidelity key={active.id} workspaceId={workspaceId} batchId={active.id} />
      ) : (
        <BatchLeaderboardPanel key={active.id} workspaceId={workspaceId} batchId={active.id} />
      )}
    </div>
  );
}
