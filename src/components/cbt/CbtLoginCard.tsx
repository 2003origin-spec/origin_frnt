"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

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
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const currentTheme = (mounted ? resolvedTheme : "light") || "light";

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
      // Dev-only: no SMTP configured, so the server returns the code to prefill.
      if (res.devCode) {
        setCode(res.devCode);
        setMessage(`Dev mode — no email configured. Code auto-filled: ${res.devCode}`);
      } else {
        setMessage(res.message ?? "If eligible, a code has been sent.");
      }
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
    <div className="neu-raised w-full max-w-sm rounded-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">CBT teacher sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your allowlisted email to receive a one-time code.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
          title={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="neu-raised flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-amber-500"
        >
          {currentTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {step === "email" ? (
        <form className="mt-5 space-y-3" onSubmit={submitEmail}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="neu-inset w-full rounded-xl bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
          <Button type="submit" className="w-full shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={isPending || !email.trim()}>
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
            className="neu-inset w-full rounded-xl bg-transparent px-3 py-2.5 text-center text-lg tracking-[0.4em] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
          <Button type="submit" className="w-full shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={isPending || code.trim().length < 6}>
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
