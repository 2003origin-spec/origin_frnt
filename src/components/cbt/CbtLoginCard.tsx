"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { loginWithCbtOtpAction, sendCbtOtpAction } from "@/server/actions/cbt-auth-actions";

/**
 * Two-step CBT teacher OTP login: email → 6-digit code. Mirrors the admin OTP
 * UX. All logic is server-side; this card only drives the two dedicated CBT
 * auth actions and never sees or sets tokens directly.
 */
export function CbtLoginCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await sendCbtOtpAction(email.trim());
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setMessage(res.message ?? "If eligible, a code has been sent.");
      setStep("code");
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginWithCbtOtpAction(email.trim(), code.trim());
      if (!res.ok) {
        setError(res.message ?? "Invalid code.");
        return;
      }
      router.push("/cbt");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-foreground">CBT teacher sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your allowlisted email to receive a one-time code.
      </p>

      {step === "email" ? (
        <form className="mt-5 space-y-3" onSubmit={submitEmail}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <Button type="submit" className="w-full" disabled={isPending || !email.trim()}>
            {isPending ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form className="mt-5 space-y-3" onSubmit={submitCode}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.4em] text-foreground"
          />
          <Button type="submit" className="w-full" disabled={isPending || code.trim().length < 6}>
            {isPending ? "Verifying…" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      {error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
