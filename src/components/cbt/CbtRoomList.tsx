"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/csrf";
import type { CbtRoom } from "@/lib/cbt/room-model";

import { CbtRoomCreateDialog } from "./CbtRoomCreateDialog";

type RoomRow = CbtRoom & { participantCount: number };

const STATUS_LABEL: Record<CbtRoom["status"], string> = {
  lobby: "Lobby",
  in_test: "In test",
  finished: "Finished",
  closed: "Closed",
};

export function CbtRoomList({ initialRooms }: { initialRooms: RoomRow[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Delete this room and all its participants? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/rooms/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Rooms</h1>
          <p className="text-sm text-muted-foreground">Live sessions students join with a link + code.</p>
        </div>
        <CbtRoomCreateDialog />
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No rooms yet. Create one to get a student link and code.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/cbt/rooms/${room.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium hover:underline">{room.name}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS_LABEL[room.status]} · {room.participantCount} joined
                </p>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => remove(room.id)}
                disabled={pending}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
