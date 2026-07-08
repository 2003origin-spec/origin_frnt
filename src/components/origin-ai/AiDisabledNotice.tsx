import Link from "next/link";
import { Bot } from "lucide-react";

/**
 * AI Feature Toggle epic — rendered in place of the Doubt Solver when the AI
 * Explainer is disabled for this student (admin / institute / global toggle),
 * or for non-student roles (role-denied). Shown instead of redirecting so the
 * state is legible and there is no redirect loop (doc 04 §2.2).
 *
 * Server-safe (no client hooks). Copy is verbatim from doc 05 §5.
 */
export default function AiDisabledNotice() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Bot className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">AI features are turned off</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Origin AI and the AI Explainer are currently disabled for your account by your
          administrator or institute.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
