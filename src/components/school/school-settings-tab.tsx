"use client";

import { useState } from "react";
import { CalendarCheck2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AssignmentType } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useTaskStore } from "@/stores/task-store";

const TYPES: AssignmentType[] = [
  "exam",
  "paper",
  "project",
  "problem set",
  "quiz",
  "reading",
];
const BIG = new Set(["exam", "paper", "project"]);

export function SchoolSettingsTab() {
  const googleConnected = useAppStore((s) => s.googleConnected);
  const setApp = useAppStore((s) => s.set);
  const reminderProfiles = useAppStore((s) => s.reminderProfiles);
  const classes = useTaskStore((s) => s.classes);
  const updateClass = useTaskStore((s) => s.updateClass);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callStub = async (action: "connect" | "disconnect" | "sync") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      if (action === "connect") {
        setApp("googleConnected", true);
        toast("Google connected (stub)", {
          description: "Real OAuth lands when we wire the Calendar API.",
        });
      } else if (action === "disconnect") {
        setApp("googleConnected", false);
      } else {
        const syncing = classes.filter((c) => c.syncToGoogle).length;
        toast("Sync simulated", {
          description: `${syncing} class${syncing === 1 ? "" : "es"} would push to the LifeOS calendar.`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <CalendarCheck2 className="size-3.5" />
          Google Calendar
        </h2>
        <p className="text-sm text-text-secondary">
          One-way sync pushes class meetings and due dates to a dedicated
          “LifeOS” calendar — your main calendar stays clean. This is a stub
          until the Calendar API is connected.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          {googleConnected ? (
            <>
              <span className="flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-dim px-2.5 py-1 text-xs text-accent">
                <span className="size-1.5 rounded-full bg-accent" />
                Connected
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => callStub("sync")}
              >
                <RefreshCw data-icon="inline-start" className="size-3.5" />
                Sync now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => callStub("disconnect")}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => callStub("connect")}>
              {busy ? "Connecting…" : "Connect Google account"}
            </Button>
          )}
        </div>
        {googleConnected && classes.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-xs text-text-tertiary">Sync per class</span>
            {classes.map((c) => (
              <label
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.code}
                </span>
                <Switch
                  checked={c.syncToGoogle}
                  onCheckedChange={(v) => updateClass(c.id, { syncToGoogle: v })}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Assignment reminders
        </h2>
        <p className="text-sm text-text-secondary">
          Early = 1 week / 3 days / 1 day / day-of. Standard = 3 days / 1 day /
          day-of. Big assignments default to early.
        </p>
        <div className="flex flex-col gap-2">
          {TYPES.map((t) => {
            const current = reminderProfiles[t] ?? (BIG.has(t) ? "early" : "standard");
            return (
              <div key={t} className="flex items-center justify-between text-sm">
                <span className="capitalize">{t}</span>
                <Select
                  value={current}
                  onValueChange={(v) =>
                    v &&
                    setApp("reminderProfiles", {
                      ...reminderProfiles,
                      [t]: v as "early" | "standard",
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early">Early</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
