"use client";

import { useEffect, useState } from "react";
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
  const tasks = useTaskStore((s) => s.tasks);
  const updateClass = useTaskStore((s) => s.updateClass);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflect the real cookie-based connection state, and surface the OAuth
  // result after Google redirects back to ?google=connected / =error.
  useEffect(() => {
    fetch("/api/google-calendar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setApp("googleConnected", !!d.connected))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const status = params.get("google");
    if (status === "connected") {
      toast.success("Google Calendar connected");
      setApp("googleConnected", true);
      window.history.replaceState({}, "", "/school?tab=settings");
    } else if (status === "error") {
      toast.error(`Google failed: ${params.get("reason") ?? "unknown"}`);
      window.history.replaceState({}, "", "/school?tab=settings");
    }
  }, [setApp]);

  const connectGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-calendar/auth");
      const data = await res.json();
      if (!data.url) throw new Error("Google isn't configured yet");
      window.location.href = data.url; // direct nav avoids the iOS PWA bounce
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  const syncGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const synced = classes.filter((c) => c.syncToGoogle);
      const ids = new Set(synced.map((c) => c.id));
      const assignments = tasks
        .filter((t) => t.classId && ids.has(t.classId) && t.due)
        .map((t) => ({
          title: t.title,
          due: t.due!,
          className: classes.find((c) => c.id === t.classId)?.code,
        }));
      const res = await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          classes: synced.map((c) => ({
            name: c.name,
            code: c.code,
            location: c.location,
            meetings: c.meetings,
          })),
          assignments,
        }),
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const data: {
        events: number;
        failures?: { summary: string; reason: string }[];
        skipped?: string[];
      } = await res.json();
      // Assignments with no due date never make it into the request body at
      // all (filtered above), so they'd otherwise vanish with no explanation
      // for why the count came in lower than expected.
      const withoutDue = tasks.filter(
        (t) => t.classId && ids.has(t.classId) && !t.due
      ).length;
      const problems = (data.failures?.length ?? 0) + (data.skipped?.length ?? 0) + withoutDue;
      if (problems === 0) {
        toast.success("Pushed to Google Calendar", {
          description: `${data.events} event${data.events === 1 ? "" : "s"} on your “LifeOS School” calendar.`,
        });
      } else {
        const reasons = [
          ...(withoutDue > 0
            ? [`${withoutDue} assignment${withoutDue === 1 ? "" : "s"} have no due date set`]
            : []),
          ...(data.skipped ?? []),
          ...(data.failures ?? []).map((f) => `${f.summary}: ${f.reason}`),
        ];
        toast(`Pushed ${data.events}, skipped ${problems}`, {
          description: reasons.slice(0, 4).join(" · "),
          duration: 12000,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setApp("googleConnected", false);
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
          “LifeOS School” calendar — your main calendar stays clean.
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
                onClick={syncGoogle}
              >
                <RefreshCw data-icon="inline-start" className="size-3.5" />
                {busy ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={disconnectGoogle}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy} onClick={connectGoogle}>
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
