"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { csrfHeaders } from "@/lib/csrf";

export function CbtRoomCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("200");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; slug: string } | null>(null);

  const joinUrl = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/cbt/r/${created.slug}` : "";

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cbt/rooms", {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), capacity: Number(capacity) || 200 }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string;
        code?: string;
        room?: { id: string; publicSlug: string };
      };
      if (!res.ok || !data.room || !data.code) {
        setError(data.detail ?? `Create failed (${res.status})`);
        return;
      }
      setCreated({ id: data.room.id, code: data.code, slug: data.room.publicSlug });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New room</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "Room created" : "New room"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Share this link and code with your students:</p>
            <div className="space-y-1">
              <Label>Student link</Label>
              <Input readOnly value={joinUrl} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="space-y-1">
              <Label>Room code</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-2xl font-bold tracking-[0.3em]">
                {created.code}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The code is stored hashed — you can regenerate it later, but it won&apos;t be shown again here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Room name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics mock 1" />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
            </div>
            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          {created ? (
            <Button onClick={() => router.push(`/cbt/rooms/${created.id}`)}>Open room</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={create} disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
