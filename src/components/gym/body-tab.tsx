"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Camera, Plus, Ruler, Syringe, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AXIS, ChartBox, TOOLTIP_STYLE } from "@/components/gym/chart-box";
import { MeasurementDialog } from "@/components/gym/measurement-dialog";
import { PhotoCalendar } from "@/components/gym/photo-calendar";
import { bodyReport, escalationCheck, weightTargetForDate } from "@/lib/body";
import {
  CYCLE_COMPOUNDS,
  CYCLE_START_DATE,
  CYCLE_WEEKLY_WEIGHT_TARGETS,
} from "@/lib/cycle-plans";
import { parseSex } from "@/lib/strength";
import { formatShort, todayISO } from "@/lib/dates";
import {
  addPhoto,
  compressImage,
  deletePhoto,
  getPhotos,
  setPhotoBodyFat,
  type Pose,
  type ProgressPhoto,
} from "@/lib/photo-store";
import { KG_PER_LB, toDisplayWeight } from "@/lib/units";
import { useAppStore } from "@/stores/app-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const POSES: Pose[] = ["front", "side", "back"];
type Loaded = ProgressPhoto & { url: string };

export function GymBodyTab() {
  const measurements = useWorkoutStore((s) => s.measurements);
  const logMeasurement = useWorkoutStore((s) => s.logMeasurement);
  const profile = useAppStore((s) => s.profile);
  const goalWeightLb = useAppStore((s) => s.goalWeightLb);
  const units = useAppStore((s) => s.units);
  const cycleStartDate = useAppStore((s) => s.cycleStartDate);
  const weeklyWeightTargets = useAppStore((s) => s.weeklyWeightTargets);
  const compounds = useAppStore((s) => s.compounds);
  const setAppState = useAppStore((s) => s.set);

  const [logOpen, setLogOpen] = useState(false);
  const [photos, setPhotos] = useState<Loaded[]>([]);
  const [pose, setPose] = useState<Pose>("front");
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  const [bfBusy, setBfBusy] = useState(false);
  const estimatingRef = useRef<string | null>(null);

  const heightIn = parseFloat(profile.heightIn) || 0;
  const report = bodyReport(measurements, heightIn, profile.sex, goalWeightLb);

  const wd = (lb: number | null) => (lb == null ? null : toDisplayWeight(lb, units));
  const rateDisplay = (lbPerWk: number) =>
    Math.round((units === "kg" ? lbPerWk * KG_PER_LB : lbPerWk) * 10) / 10;

  // ── Photos ────────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    let list: ProgressPhoto[] = [];
    try {
      list = await getPhotos();
    } catch {
      return;
    }
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const loaded = list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
    urlsRef.current = loaded.map((p) => p.url);
    setPhotos(loaded);
  }, []);

  useEffect(() => {
    reload();
    return () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
  }, [reload]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await compressImage(file);
      await addPhoto(blob, todayISO(), pose);
      await reload();
      toast.success("Photo saved", { description: `${pose} · ${formatShort(todayISO())}` });
    } catch {
      toast.error("Couldn't save that photo");
    }
  };

  const remove = async (id: string) => {
    await deletePhoto(id);
    await reload();
  };

  const importCyclePlan = () => {
    setAppState("cycleStartDate", CYCLE_START_DATE);
    setAppState("weeklyWeightTargets", CYCLE_WEEKLY_WEIGHT_TARGETS);
    setAppState("compounds", CYCLE_COMPOUNDS);
    toast("Cycle plan imported", {
      description: "Weekly weight targets and compound doses are set.",
    });
  };

  // ── Automatic body-fat estimate from the latest photo ──────────────────────
  const weightForEst = report.latestWeight ?? (parseFloat(profile.weightLb) || 0);
  const autoEstimate = useCallback(
    async (photo: Loaded) => {
      setBfBusy(true);
      try {
        const imageBase64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onloadend = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(photo.blob);
        });
        const resp = await fetch("/api/body-fat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            mediaType: photo.blob.type || "image/jpeg",
            heightIn,
            weightLb: weightForEst,
            age: parseInt(profile.age) || 0,
            sex: parseSex(profile.sex),
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error();
        await setPhotoBodyFat(photo.id, data.estimate, data.rationale);
        await reload();
      } catch {
        // Silent — the snapshot just falls back to the formula estimate.
      } finally {
        setBfBusy(false);
      }
    },
    [heightIn, weightForEst, profile.age, profile.sex, reload]
  );

  // Backfill any photo without an estimate, newest first, one at a time
  // (each is cached on its record, so this runs once per photo total).
  useEffect(() => {
    const pending = photos.find((p) => p.bodyFat === undefined);
    if (!pending || estimatingRef.current === pending.id) return;
    estimatingRef.current = pending.id;
    autoEstimate(pending).finally(() => {
      estimatingRef.current = null;
    });
  }, [photos, autoEstimate]);

  const photoBf = photos[0]?.bodyFat ?? null;

  // ── Charts ──────────────────────────────────────────────────────────────
  // low/bandHeight (stacked areas) draw the weekly target band, when a
  // cycle's imported — bandHeight is undefined outside the target table's
  // 12 weeks (before/after the cycle), which just leaves the band blank there.
  const weightData = measurements
    .filter((m) => m.weight !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      const target = cycleStartDate
        ? weightTargetForDate(m.date, cycleStartDate, weeklyWeightTargets)
        : null;
      const low = target ? wd(target.lowLb) : null;
      const high = target ? wd(target.highLb) : null;
      return {
        date: formatShort(m.date),
        value: wd(m.weight!),
        low: low ?? undefined,
        bandHeight: low != null && high != null ? Math.max(0, high - low) : undefined,
      };
    });
  const hasWeightBand = weightData.some((d) => d.low !== undefined);
  const bfData = report.bfSeries.map((p) => ({
    date: formatShort(p.date),
    value: p.value,
  }));
  // date → body-fat % so the photo calendar can show it alongside the photos.
  const bfByDate = new Map(report.bfSeries.map((p) => [p.date, p.value]));
  // A photo's own estimate takes precedence on its date.
  for (const p of photos) if (p.bodyFat != null) bfByDate.set(p.date, p.bodyFat);

  const fmtDelta = (n: number | null, unit: string) =>
    n == null ? "" : `${n > 0 ? "+" : ""}${n}${unit}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Weight, measurements, body-fat estimate, and progress photos — all in
          one place.
        </p>
        <div className="flex shrink-0 gap-2">
          {!cycleStartDate && (
            <Button size="sm" variant="outline" onClick={importCyclePlan}>
              Import cycle plan
            </Button>
          )}
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Ruler data-icon="inline-start" className="size-3.5" />
            Log
          </Button>
        </div>
      </div>

      {/* Snapshot */}
      <section className="grid grid-cols-3 gap-3">
        <Snapshot
          label="Weight"
          value={wd(report.latestWeight)}
          suffix={` ${units}`}
          sub={report.weightDelta != null ? `${fmtDelta(rateDisplayDelta(report.weightDelta, units), ` ${units}`)} total` : "log to start"}
        />
        <Snapshot
          label="Est. body fat"
          value={photoBf ?? report.bodyFat}
          suffix="%"
          sub={
            photoBf != null
              ? "from your latest photo"
              : bfBusy
                ? "reading your photo…"
                : heightIn
                  ? "RFM estimate"
                  : "add height in Settings"
          }
        />
        <Snapshot
          label="Waist"
          value={report.latestWaist}
          suffix='"'
          sub={report.waistDelta != null ? `${fmtDelta(report.waistDelta, '"')} total` : "log waist"}
        />
      </section>

      {photoBf != null || bfBusy ? (
        <p className="-mt-4 text-[0.65rem] text-text-tertiary">
          Body fat is auto-estimated from your newest photo (sent to Claude for
          the read; your saved photos stay on device). It leans high and weights
          your love handles — an estimate, not a measurement.
        </p>
      ) : null}

      {/* Estimates */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <TrendingDown className="size-3.5" /> Progress estimate
        </h2>
        {report.weightPerWeek != null ? (
          <p className="text-sm">
            {report.weightPerWeek < 0 ? "Losing" : "Gaining"}{" "}
            <span className="font-medium text-accent">
              {Math.abs(rateDisplay(report.weightPerWeek))} {units}/week
            </span>
            {report.waistPerWeek != null && Math.abs(report.waistPerWeek) >= 0.05 && (
              <>
                {" · waist "}
                {report.waistPerWeek < 0 ? "down" : "up"}{" "}
                {Math.abs(report.waistPerWeek)}&quot;/week
              </>
            )}
            .
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Log your weight a few times and I&apos;ll estimate your rate of change.
          </p>
        )}
        {report.weeksToGoal != null ? (
          <p className="text-sm text-text-secondary">
            At this pace you&apos;ll hit {wd(goalWeightLb)} {units} in about{" "}
            <span className="text-text-primary">{report.weeksToGoal} weeks</span>.
          </p>
        ) : goalWeightLb > 0 ? (
          <p className="text-xs text-text-tertiary">
            Not trending toward your {wd(goalWeightLb)} {units} goal yet.
          </p>
        ) : (
          <p className="text-xs text-text-tertiary">
            Set a goal weight in Settings → Profile for a projection.
          </p>
        )}
      </section>

      {/* Compounds */}
      {compounds.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <Syringe className="size-3.5" /> Compounds
          </h2>
          <div className="flex flex-col gap-2">
            {compounds.map((c) => {
              const check = escalationCheck(c, measurements, todayISO());
              return (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {c.doseLabel} · {check.weeksAtDose}w on this dose
                    </p>
                  </div>
                  {check.ready && (
                    <span className="shrink-0 rounded-full border border-accent-border bg-accent-dim px-2 py-0.5 text-[0.65rem] text-accent">
                      Stalled 2+ wks — worth considering
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.6rem] text-text-tertiary">
            Heuristic only — checks weight trend and time on dose, not
            adherence. Confirm protein/calories are actually on target
            yourself before changing anything.
          </p>
        </section>
      )}

      {/* Trends */}
      {weightData.length >= 2 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <TrendChart
            title={`Weight (${units})`}
            data={weightData}
            goal={goalWeightLb > 0 ? wd(goalWeightLb) : null}
            color="var(--accent)"
            showBand={hasWeightBand}
          />
          {bfData.length >= 2 && (
            <TrendChart title="Body fat % (est.)" data={bfData} color="#F5A623" />
          )}
        </section>
      )}

      {/* Progress photos */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <Camera className="size-3.5" /> Progress photos
          </h2>
          <span className="text-[0.6rem] text-text-tertiary">on this device</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {POSES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPose(p)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                  pose === p
                    ? "border-accent-border bg-accent-dim text-accent"
                    : "border-border text-text-secondary hover:border-border-hover"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Plus data-icon="inline-start" className="size-3.5" />
            Add {pose}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </div>

        {photos.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-tertiary">
            No photos yet. Same spot, same light, every couple weeks — that&apos;s
            where the real progress shows.
          </p>
        ) : (
          <PhotoCalendar
            photos={photos}
            onDelete={remove}
            onView={setViewing}
            bfByDate={bfByDate}
          />
        )}
      </section>

      <MeasurementDialog open={logOpen} onOpenChange={setLogOpen} onSave={logMeasurement} />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Progress photo</DialogTitle>
          </DialogHeader>
          {viewing && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewing} alt="Progress" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** weightDelta is stored in lb; show it in the display unit. */
function rateDisplayDelta(lb: number, units: "lb" | "kg"): number {
  return Math.round((units === "kg" ? lb * KG_PER_LB : lb) * 10) / 10;
}

function Snapshot({
  label,
  value,
  suffix,
  sub,
}: {
  label: string;
  value: number | null;
  suffix: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-3">
      <span className="text-[0.65rem] text-text-tertiary">{label}</span>
      <span className="font-mono text-xl font-medium">
        {value != null ? value : "—"}
        {value != null && <span className="text-xs text-text-tertiary">{suffix}</span>}
      </span>
      <span className="text-[0.6rem] text-text-tertiary">{sub}</span>
    </div>
  );
}


function TrendChart({
  title,
  data,
  color,
  goal,
  showBand,
}: {
  title: string;
  data: { date: string; value: number | null; low?: number; bandHeight?: number }[];
  color: string;
  goal?: number | null;
  showBand?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-text-tertiary">{title}</h2>
      <ChartBox height={160}>
        {(w, h) => (
          <ComposedChart width={w} height={h} data={data}>
            <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" />
            <YAxis {...AXIS} width={34} domain={["auto", "auto"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {goal != null && (
              <ReferenceLine y={goal} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
            )}
            {showBand && (
              <>
                {/* Stacked areas draw a low-to-high band: the first is an
                    invisible base up to `low`, the second the visible band
                    on top of it, `bandHeight` tall. */}
                <Area
                  type="monotone"
                  dataKey="low"
                  stackId="target-band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="bandHeight"
                  stackId="target-band"
                  stroke="none"
                  fill={color}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
              </>
            )}
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </ComposedChart>
        )}
      </ChartBox>
      {showBand && (
        <p className="text-[0.6rem] text-text-tertiary">shaded = target range</p>
      )}
    </div>
  );
}
