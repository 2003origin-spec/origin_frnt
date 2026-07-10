"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Anonymous student join. Posts { slug, code, displayName } to /api/cbt-student/join
 * (CSRF-exempt, rate-limited). On success the server sets the participant cookie
 * and returns the memorable student ID, which we surface prominently.
 */
export function CbtJoinCard({
  slug,
  roomName,
  onJoined,
}: {
  slug: string;
  roomName: string;
  onJoined: (studentCode: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("Enter your name and the room code.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/cbt-student/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, code: code.trim(), displayName: name.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; studentCode?: string };
      if (!res.ok || !data.studentCode) {
        setError(data.detail ?? `Could not join (${res.status}).`);
        return;
      }
      onJoined(data.studentCode);
    });
  }

  return (
    <div className="neu-raised w-full max-w-sm space-y-4 rounded-3xl p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{roomName || "Join test"}</h1>
        <p className="text-sm text-muted-foreground">Enter the code your teacher shared.</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="cbt-name">Your name</Label>
          <Input
            id="cbt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cbt-code">Room code</Label>
          <Input
            id="cbt-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            autoCapitalize="characters"
            className="text-center text-lg font-semibold tracking-[0.3em]"
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
        </div>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" onClick={join} disabled={pending}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </div>
    </div>
  );
}
