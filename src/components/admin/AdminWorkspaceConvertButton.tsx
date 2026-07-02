"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";

/**
 * Compact "convert workspace type" control for the Institutes list. Reuses the
 * existing `set_type` admin action. The convert button was previously only on
 * the buried `/admin/workspaces/[id]` detail page, so operators couldn't find
 * it — this surfaces it directly on the Institutes roster.
 */
export function AdminWorkspaceConvertButton({
  workspaceId,
  currentType,
}: {
  workspaceId: string;
  currentType: "personal" | "institute";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const target = currentType === "institute" ? "personal" : "institute";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const ok = window.confirm(
              target === "institute"
                ? "Convert to INSTITUTE? It enters the approval queue and becomes browsable to students once approved in Institute Approvals."
                : "Convert to PERSONAL? It will no longer appear in the marketplace / student Browse.",
            );
            if (!ok) return;
            const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
              method: "POST",
              headers: { "content-type": "application/json", ...csrfHeaders() },
              credentials: "include",
              body: JSON.stringify({ action: "set_type", workspaceType: target }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { detail?: string };
              setError(data.detail ?? `Convert failed (${res.status})`);
              return;
            }
            setError(null);
            router.refresh();
          })
        }
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        {isPending ? "…" : target === "institute" ? "To institute" : "To personal"}
      </Button>
      {error ? <span className="text-[10px] text-destructive">{error}</span> : null}
    </span>
  );
}
