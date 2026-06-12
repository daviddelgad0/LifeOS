"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  GraduationCap,
  Home,
  ListTodo,
  MessageCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import { SkeletonLoader } from "@/components/skeleton-loader";
import { StreakBadge } from "@/components/streak-badge";
import { XPBar } from "@/components/xp-bar";
import { daysBetween, todayISO } from "@/lib/dates";
import { dayStreak } from "@/lib/streaks";
import { ACCENTS, levelFromXP } from "@/lib/xp";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useIsClient } from "@/stores/hydration";
import { useProductivityStore } from "@/stores/productivity-store";
import { useTaskStore } from "@/stores/task-store";
import { gymDayDates, useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/gym", label: "Gym", icon: Dumbbell },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/school", label: "School", icon: GraduationCap },
  { href: "/productivity", label: "Tasks", icon: ListTodo },
];

const NAV_DESKTOP = [
  ...NAV,
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Applies the unlocked accent color to the CSS custom properties. */
function AccentSync() {
  const accent = useAppStore((s) => s.accent);
  useEffect(() => {
    const def = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
    const root = document.documentElement.style;
    root.setProperty("--accent", def.hex);
    root.setProperty("--accent-dim", `rgba(${def.rgb},0.15)`);
    root.setProperty("--accent-border", `rgba(${def.rgb},0.25)`);
    root.setProperty("--ring", `rgba(${def.rgb},0.4)`);
  }, [accent]);
  return null;
}

/**
 * Persist writes only happen on state changes, so on a first visit the
 * seeded defaults would regenerate (with shifted dates) every load.
 * One empty setState per store flushes the current state to localStorage.
 */
function PersistSeeds() {
  useEffect(() => {
    useAppStore.setState({});
    useTaskStore.setState({});
    useWorkoutStore.setState({});
    useProductivityStore.setState({});
    useChatStore.setState({});
  }, []);
  return null;
}

/** One pass per load: surface due-soon assignment reminders. */
function ReminderCheck() {
  const ran = useRef(false);
  const tasks = useTaskStore((s) => s.tasks);
  const prefs = useAppStore((s) => s.notifications);
  const profiles = useAppStore((s) => s.reminderProfiles);

  useEffect(() => {
    if (ran.current || !prefs.assignments) return;
    ran.current = true;
    const today = todayISO();
    const due = tasks.filter(
      (t) => !t.completed && t.classId && t.due && t.due >= today
    );
    for (const t of due) {
      const big =
        t.assignmentType === "exam" ||
        t.assignmentType === "paper" ||
        t.assignmentType === "project";
      const profile =
        profiles[t.assignmentType ?? ""] ?? (big ? "early" : "standard");
      const leads = profile === "early" ? [7, 3, 1, 0] : [3, 1, 0];
      const gap = daysBetween(today, t.due!);
      if (leads.includes(gap)) {
        const when = gap === 0 ? "due today" : `due in ${gap} day${gap > 1 ? "s" : ""}`;
        toast(t.title, { description: `Assignment ${when}` });
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("LifeOS", { body: `${t.title} — ${when}` });
        }
      }
    }
  }, [tasks, prefs.assignments, profiles]);
  return null;
}

function Header() {
  const totalXP = useAppStore((s) => s.totalXP);
  const sessions = useWorkoutStore((s) => s.sessions);
  const manual = useWorkoutStore((s) => s.manualGymDays);
  const { level, intoLevel, toNext } = levelFromXP(totalXP);
  const streak = dayStreak(gymDayDates(sessions, manual));

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="font-display text-base font-semibold tracking-display transition-colors hover:text-accent">
          LifeOS
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <XPBar level={level} xp={intoLevel} xpToNext={toNext} />
          </div>
          <span className="font-mono text-xs text-text-tertiary sm:hidden">
            Lv {level}
          </span>
          <StreakBadge count={streak} />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary md:hidden"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-y-0 left-0 z-40 hidden w-52 flex-col border-r border-border bg-background/60 px-3 py-4 backdrop-blur-md md:flex">
      <Link href="/" className="px-3 py-2 font-display text-lg font-semibold tracking-display">
        LifeOS
      </Link>
      <div className="mt-4 flex flex-1 flex-col gap-1">
        {NAV_DESKTOP.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted text-text-primary"
                  : "text-text-secondary hover:bg-muted/60 hover:text-text-primary",
                item.href === "/settings" && "mt-auto"
              )}
            >
              <item.icon
                className={cn("size-4", active && "text-accent")}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-md md:hidden">
      <div className="grid h-16 grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                active ? "text-accent" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[0.65rem] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <SkeletonLoader className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonLoader className="h-32" />
        <SkeletonLoader className="h-32" />
        <SkeletonLoader className="h-32" />
      </div>
      <SkeletonLoader className="h-64" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isClient = useIsClient();
  const focusMode = pathname.startsWith("/gym/workout");

  if (!isClient) return <LoadingSkeleton />;

  return (
    <div className="flex min-h-screen flex-col">
      <AccentSync />
      <PersistSeeds />
      <ReminderCheck />
      {!focusMode && <Sidebar pathname={pathname} />}
      <div className={cn("flex flex-1 flex-col", !focusMode && "md:pl-52")}>
        {!focusMode && <Header />}
        <main className={cn("flex flex-1 flex-col", !focusMode && "pb-20 md:pb-8")}>
          {children}
        </main>
      </div>
      {!focusMode && <BottomBar pathname={pathname} />}
    </div>
  );
}
