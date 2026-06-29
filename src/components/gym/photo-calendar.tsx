"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatShort } from "@/lib/dates";
import type { ProgressPhoto } from "@/lib/photo-store";
import { cn } from "@/lib/utils";

type Loaded = ProgressPhoto & { url: string };
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Month calendar; photo-days are marked and tapping one opens that day's
 * photos. Keeps the photos hidden behind a click instead of a gallery. */
export function PhotoCalendar({
  photos,
  onDelete,
  onView,
}: {
  photos: Loaded[];
  onDelete: (id: string) => void;
  onView: (url: string) => void;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Loaded[]>();
    for (const p of photos) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return map;
  }, [photos]);

  const { y, m } = cursor;
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = new Date(y, m, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const dateStr = (d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

  const prev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  const dayPhotos = selected ? byDate.get(selected) ?? [] : [];
  const del = (id: string) => {
    onDelete(id);
    if (dayPhotos.length <= 1) setSelected(null);
  };

  const iconBtn =
    "flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} aria-label="Previous month" className={iconBtn}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button type="button" onClick={next} aria-label="Next month" className={iconBtn}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-[0.6rem] text-text-tertiary">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const ds = dateStr(d);
          const has = byDate.has(ds);
          return (
            <button
              key={i}
              type="button"
              disabled={!has}
              onClick={() => has && setSelected(ds)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors",
                has
                  ? "border border-accent-border bg-accent-dim text-accent hover:bg-accent-dim/70"
                  : "cursor-default text-text-tertiary"
              )}
            >
              {d}
              {has && <span className="size-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <p className="text-center text-[0.65rem] text-text-tertiary">
        Tap a highlighted day to see that day&apos;s photos.
      </p>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selected && formatShort(selected)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {dayPhotos.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.pose}
                    onClick={() => onView(p.url)}
                    className="size-full cursor-pointer object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Delete photo"
                    onClick={() => del(p.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <span className="text-center text-[0.65rem] capitalize text-text-tertiary">
                  {p.pose}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
