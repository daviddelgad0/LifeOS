"use client";

import { useEffect, useState } from "react";
import { Check, Download, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { download, workoutsToCSV } from "@/lib/export";
import { formatShort } from "@/lib/dates";
import { ACCENTS, ACHIEVEMENTS, levelFromXP } from "@/lib/xp";
import type { CoachPersonality, Profile } from "@/lib/types";
import { useAppStore, type NotificationPrefs } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWhoopStore } from "@/stores/whoop-store";
import { useChatStore } from "@/stores/chat-store";
import { useProductivityStore } from "@/stores/productivity-store";
import { useTaskStore } from "@/stores/task-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const PERSONALITIES: { id: CoachPersonality; label: string; blurb: string }[] = [
  { id: "direct", label: "Direct", blurb: "Straight answers, no padding" },
  { id: "warm", label: "Warm", blurb: "Same advice, softer delivery" },
  { id: "drill", label: "Drill sergeant", blurb: "Zero sympathy, maximum push" },
  { id: "brother", label: "Older brother", blurb: "Real talk from someone who lifts" },
];

const PROFILE_FIELDS: { key: keyof Profile; label: string; long?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "age", label: "Age" },
  { key: "heightIn", label: "Height (in)" },
  { key: "weightLb", label: "Weight (lb)" },
  { key: "sex", label: "Sex" },
  { key: "bodyFat", label: "Body fat %" },
  { key: "experience", label: "Experience level" },
  { key: "equipment", label: "Equipment access" },
  { key: "schedule", label: "Schedule", long: true },
  { key: "injuries", label: "Injuries / limitations", long: true },
  { key: "diet", label: "Dietary preferences", long: true },
  { key: "bodyNotes", label: "Body composition notes", long: true },
  { key: "goal", label: "Primary goal" },
  { key: "goalTarget", label: "Goal target" },
  { key: "goalTimeline", label: "Timeline" },
  { key: "lifeGoals", label: "Life goals beyond fitness", long: true },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-text-tertiary">{title}</h2>
      {children}
    </section>
  );
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export default function SettingsPage() {
  const app = useAppStore();
  const { level } = levelFromXP(app.totalXP);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const whoopConnected = useWhoopStore((s) => s.connected);
  const whoopDisconnect = useWhoopStore((s) => s.disconnect);
  const sessions = useWorkoutStore((s) => s.sessions);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const estCost = Math.round(app.coachMessagesSent * 1.2) / 100;
  const budgetPct = Math.min(100, (estCost / Math.max(0.01, app.monthlyBudget)) * 100);

  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: app.profile,
      totalXP: app.totalXP,
      achievements: app.achievements,
      sessions,
      measurements: useWorkoutStore.getState().measurements,
      routines: useWorkoutStore.getState().routines,
      customExercises,
      tasks: useTaskStore.getState().tasks,
      classes: useTaskStore.getState().classes,
      ratings: useProductivityStore.getState().ratings,
      chat: useChatStore.getState().messages,
    };
    download("lifeos-data.json", JSON.stringify(data, null, 2), "application/json");
  };

  const notifLabels: { key: keyof NotificationPrefs; label: string }[] = [
    { key: "tasks", label: "Task due dates" },
    { key: "assignments", label: "Assignment reminders" },
    { key: "workouts", label: "Workout nudges" },
    { key: "productivityReminder", label: "Evening productivity rating" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Section title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          {PROFILE_FIELDS.map((f) => (
            <div
              key={f.key}
              className={cn("flex flex-col gap-1.5", f.long && "sm:col-span-2")}
            >
              <Label htmlFor={`p-${f.key}`} className="text-xs">
                {f.label}
              </Label>
              {f.long ? (
                <Textarea
                  id={`p-${f.key}`}
                  rows={2}
                  value={app.profile[f.key]}
                  onChange={(e) => app.setProfile({ [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  id={`p-${f.key}`}
                  value={app.profile[f.key]}
                  onChange={(e) => app.setProfile({ [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Coach personality">
        <RadioGroup
          value={app.personality}
          onValueChange={(v) => v && app.set("personality", v as CoachPersonality)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {PERSONALITIES.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                app.personality === p.id
                  ? "border-accent-border bg-accent-dim"
                  : "border-border hover:border-border-hover"
              )}
            >
              <RadioGroupItem value={p.id} />
              <span className="flex flex-col">
                <span className="text-sm">{p.label}</span>
                <span className="text-xs text-text-tertiary">{p.blurb}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Section>

      <Section title="Preferences">
        <div className="flex items-center justify-between text-sm">
          <span>Units</span>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => app.set("units", u)}
                className={cn(
                  "rounded-md px-3 py-1 font-mono text-xs transition-colors",
                  app.units === u
                    ? "bg-muted text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Default rest timer</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              step={15}
              min={30}
              value={app.defaultRestSeconds}
              onChange={(e) =>
                app.set("defaultRestSeconds", Math.max(30, Number(e.target.value) || 120))
              }
              className="h-9 w-20 text-right font-mono"
            />
            <span className="text-xs text-text-tertiary">seconds</span>
          </div>
        </div>
        <label className="flex items-center justify-between text-sm">
          <span>
            Timer sound at zero
            <span className="block text-xs text-text-tertiary">
              Vibration always fires; sound is opt-in
            </span>
          </span>
          <Switch
            checked={app.timerSound}
            onCheckedChange={(v) => app.set("timerSound", v)}
          />
        </label>
        <div className="flex items-center justify-between text-sm">
          <span>Goal weight (lb)</span>
          <Input
            type="number"
            inputMode="numeric"
            value={app.goalWeightLb}
            onChange={(e) => app.set("goalWeightLb", Number(e.target.value) || 0)}
            className="h-9 w-20 text-right font-mono"
          />
        </div>
      </Section>

      <Section title="Notifications">
        {notifLabels.map((n) => (
          <label key={n.key} className="flex items-center justify-between text-sm">
            {n.label}
            <Switch
              checked={app.notifications[n.key]}
              onCheckedChange={(v) => app.setNotification(n.key, v)}
            />
          </label>
        ))}
        <p className="text-xs text-text-tertiary">
          One gentle reminder per feature, max. No guilt trips.
        </p>
      </Section>

      <Section title="Theme">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-text-secondary">
            Accent color — unlocks by leveling (you&apos;re level {level})
          </span>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => {
              const locked = level < a.unlockLevel;
              const selected = app.accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    app.set("accent", a.id);
                    toast(`Accent: ${a.name}`);
                  }}
                  aria-label={`${a.name}${locked ? ` — unlocks at level ${a.unlockLevel}` : ""}`}
                  title={locked ? `Unlocks at level ${a.unlockLevel}` : a.name}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full border-2 transition-transform",
                    selected ? "border-text-primary" : "border-transparent",
                    locked
                      ? "cursor-not-allowed opacity-40"
                      : "hover:scale-110"
                  )}
                  style={{ background: a.hex }}
                >
                  {selected && <Check className="size-4 text-background" strokeWidth={3} />}
                  {locked && <Lock className="size-3.5 text-background" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Ring style</span>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(["round", "flat"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => app.set("ringStyle", s)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs capitalize transition-colors",
                  app.ringStyle === s
                    ? "bg-muted text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Achievements">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const unlockedAt = app.achievements[a.id];
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3",
                  unlockedAt
                    ? "border-border-hover bg-surface-raised"
                    : "border-border opacity-40"
                )}
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-xs text-text-tertiary">
                  {unlockedAt ? formatShort(unlockedAt) : a.description}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Connected accounts">
        <div className="flex items-center justify-between text-sm">
          <span>Google Calendar</span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              app.googleConnected
                ? "border-accent-border bg-accent-dim text-accent"
                : "border-border text-text-tertiary"
            )}
          >
            {app.googleConnected ? "Connected (stub)" : "Not connected"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Whoop</span>
          {whoopConnected ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-accent-border bg-accent-dim px-2.5 py-1 text-xs text-accent">
                Connected
              </span>
              <Button variant="outline" size="sm" onClick={() => whoopDisconnect()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams({
                  client_id: "55b30dd5-3520-404b-82e8-be484d13e46a",
                  redirect_uri: "https://life-os-jade-phi.vercel.app/api/whoop/callback",
                  response_type: "code",
                  scope: "read:recovery read:sleep read:workout read:profile read:cycles offline",
                });
                window.location.href = `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`;
              }}
            >
              Connect Whoop
            </Button>
          )}
        </div>
        <p className="text-xs text-text-tertiary">
          Manage the Google connection in School → Sync &amp; reminders.
        </p>
      </Section>

      <Section title="API usage">
        <div className="flex items-center justify-between text-sm">
          <span>Estimated this month</span>
          <span className="font-mono">${estCost.toFixed(2)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
          <div
            className={cn("h-full rounded-full", budgetPct > 90 ? "bg-danger" : "bg-accent")}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Soft budget</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-tertiary">$</span>
            <Input
              type="number"
              inputMode="decimal"
              value={app.monthlyBudget}
              onChange={(e) => app.set("monthlyBudget", Number(e.target.value) || 0)}
              className="h-9 w-20 text-right font-mono"
            />
          </div>
        </div>
        <p className="text-xs text-text-tertiary">
          Coach runs on the mock engine right now, so this is a projection for
          when the real Claude API connects ({app.coachMessagesSent} messages
          sent).
        </p>
      </Section>

      <Section title="Data export">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
                "lifeos-workouts.csv",
                workoutsToCSV(sessions.filter((s) => s.endedAt), customExercises),
                "text/csv"
              )
            }
          >
            <Download data-icon="inline-start" className="size-3.5" />
            Workouts CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <Download data-icon="inline-start" className="size-3.5" />
            Everything as JSON
          </Button>
        </div>
        <p className="text-xs text-text-tertiary">
          Data syncs to Supabase automatically when you&apos;re signed in.
        </p>
      </Section>

      <Section title="Account">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Signed in as</span>
          <span className="font-mono text-xs text-text-secondary">{user?.email}</span>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => signOut()}>
          Sign out
        </Button>
      </Section>

      <Section title="About">
        <div className="flex items-center justify-between text-sm">
          <span>Version</span>
          <span className="font-mono text-xs text-text-tertiary">
            1.0.0 — local-first build
          </span>
        </div>
        {installEvent ? (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await installEvent.prompt();
              setInstallEvent(null);
            }}
          >
            Install LifeOS to home screen
          </Button>
        ) : (
          <p className="text-xs text-text-tertiary">
            On iPhone: Share → Add to Home Screen to install.
          </p>
        )}
        <a
          href="mailto:drd456delgado@gmail.com?subject=LifeOS feedback"
          className="text-xs text-text-secondary underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          Send feedback
        </a>
      </Section>
    </div>
  );
}
