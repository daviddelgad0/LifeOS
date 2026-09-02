"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, GraduationCap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { TaskRow } from "@/components/task-row";
import { formatShort } from "@/lib/dates";
import type {
  AssignmentType,
  ClassMeeting,
  ParsedClassInfo,
  ParsedSyllabusItem,
  SchoolClass,
} from "@/lib/types";
import { useTaskStore } from "@/stores/task-store";
import { cn } from "@/lib/utils";

const CLASS_COLORS = [
  "#5B8DEF",
  "#8B5CF6",
  "#FFB800",
  "#FB7185",
  "#34D399",
  "#22D3EE",
  "#F472B6",
  "#A3E635",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY_PARSED_CLASS: ParsedClassInfo = {
  name: "",
  code: "",
  professor: "",
  location: "",
  meetings: [],
  gradeWeights: [],
};

export function ClassesTab() {
  const classes = useTaskStore((s) => s.classes);
  const tasks = useTaskStore((s) => s.tasks);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const deleteClass = useTaskStore((s) => s.deleteClass);
  const updateClass = useTaskStore((s) => s.updateClass);
  const importSyllabus = useTaskStore((s) => s.importSyllabus);
  const importSyllabusWithClass = useTaskStore((s) => s.importSyllabusWithClass);

  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<SchoolClass | null>(null);
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<ParsedSyllabusItem[] | null>(null);
  const [reviewClass, setReviewClass] = useState<ParsedClassInfo>(EMPTY_PARSED_CLASS);
  const [reviewColor, setReviewColor] = useState(CLASS_COLORS[0]);
  const [reviewSync, setReviewSync] = useState(false);
  const [reviewMode, setReviewMode] = useState<"new" | "existing">("new");
  const [reviewClassId, setReviewClassId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const detailLive = useMemo(
    () => classes.find((c) => c.id === detail?.id) ?? null,
    [classes, detail]
  );

  const closeReview = () => {
    setReview(null);
    setReviewClass(EMPTY_PARSED_CLASS);
    setReviewColor(CLASS_COLORS[0]);
    setReviewSync(false);
    setReviewMode("new");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-syllabus", { method: "POST", body: form });
      if (!res.ok) throw new Error("api_error");
      const data = await res.json();
      const parsedClass: ParsedClassInfo = data.class ?? EMPTY_PARSED_CLASS;
      const items: ParsedSyllabusItem[] = Array.isArray(data.assignments) ? data.assignments : [];
      if (!parsedClass.name.trim() && items.length === 0) {
        toast("Nothing found", { description: "Claude couldn't read a class name or any dated assignments. Try a clearer PDF or image." });
        setParsing(false);
        return;
      }
      setReviewClass(parsedClass);
      setReview(items);
      setReviewMode("new");
      setReviewClassId(classes[0]?.id ?? "");
    } catch {
      toast("Parse failed", { description: "Couldn't read the syllabus. Try again or add the class manually." });
    } finally {
      setParsing(false);
    }
  };

  const confirmImport = () => {
    if (!review) return;
    const count = review.filter((i) => i.include).length;
    if (reviewMode === "existing") {
      if (!reviewClassId) return;
      importSyllabus(reviewClassId, review);
    } else {
      if (!reviewClass.name.trim()) return;
      importSyllabusWithClass(
        {
          name: reviewClass.name.trim(),
          code: reviewClass.code.trim() || reviewClass.name.trim().slice(0, 8).toUpperCase(),
          professor: reviewClass.professor.trim() || "TBD",
          location: reviewClass.location.trim() || "TBD",
          meetings: reviewClass.meetings,
          gradeWeights: reviewClass.gradeWeights,
          color: reviewColor,
          syncToGoogle: reviewSync,
        },
        review
      );
    }
    closeReview();
    toast(`${count} assignment${count === 1 ? "" : "s"} imported`, {
      description: "They'll show up in Today as they come due.",
    });
  };

  const canConfirm =
    !!review?.some((i) => i.include) &&
    (reviewMode === "existing" ? !!reviewClassId : !!reviewClass.name.trim());

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">Classes</h2>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus data-icon="inline-start" className="size-3.5" />
            Add class
          </Button>
        </div>
        {classes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            description="No classes yet. Add one to start tracking assignments."
            actionLabel="Add class"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => {
              const open = tasks.filter(
                (t) => t.classId === c.id && !t.completed
              ).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDetail(c)}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-hover"
                  style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs" style={{ color: c.color }}>
                      {c.code}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {open} open
                    </span>
                  </div>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-text-secondary">
                    {c.professor} · {c.location}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {c.meetings
                      .map((m) => `${DAY_NAMES[m.day]} ${m.start}`)
                      .join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Syllabus upload */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-tertiary">
          Syllabus upload
        </h2>
        {parsing ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
            <p className="text-sm text-text-secondary">Parsing syllabus…</p>
            <SkeletonLoader className="h-4 w-3/4" />
            <SkeletonLoader className="h-4 w-1/2" />
            <SkeletonLoader className="h-4 w-2/3" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 transition-colors",
              dragOver
                ? "border-accent bg-accent-dim"
                : "border-border-hover bg-surface hover:border-accent-border"
            )}
          >
            <FileUp className="size-8 text-text-tertiary" strokeWidth={1.5} />
            <p className="text-sm text-text-secondary">
              Drop a syllabus PDF or image, or tap to browse
            </p>
            <p className="text-xs text-text-tertiary">
              Parsed by Claude — course name, code, professor, location, meeting
              times, and grading all get filled in. You only pick a color and
              whether to sync it.
            </p>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </section>

      {/* Review screen */}
      <Dialog open={!!review} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent className="flex max-h-[85dvh] max-w-md flex-col">
          <DialogHeader>
            <DialogTitle>Review class & assignments</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-secondary">
            Syllabi are messy. Fix anything wrong before importing — unchecked
            assignments are skipped.
          </p>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-1">
            {classes.length > 0 && (
              <div className="flex gap-1 self-start rounded-lg border border-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setReviewMode("new")}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    reviewMode === "new"
                      ? "bg-accent-dim text-accent"
                      : "text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  New class
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode("existing")}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    reviewMode === "existing"
                      ? "bg-accent-dim text-accent"
                      : "text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  Existing class
                </button>
              </div>
            )}

            {reviewMode === "existing" ? (
              <div className="flex flex-col gap-2">
                <Label>Class</Label>
                <Select
                  value={reviewClassId}
                  onValueChange={(v) => v && setReviewClassId(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rv-name">Name</Label>
                    <Input
                      id="rv-name"
                      value={reviewClass.name}
                      onChange={(e) =>
                        setReviewClass((c) => ({ ...c, name: e.target.value }))
                      }
                      placeholder="Algorithms"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rv-code">Code</Label>
                    <Input
                      id="rv-code"
                      value={reviewClass.code}
                      onChange={(e) =>
                        setReviewClass((c) => ({ ...c, code: e.target.value }))
                      }
                      placeholder="CMSI 3510"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rv-prof">Professor</Label>
                    <Input
                      id="rv-prof"
                      value={reviewClass.professor}
                      onChange={(e) =>
                        setReviewClass((c) => ({ ...c, professor: e.target.value }))
                      }
                      placeholder="Prof. Park"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rv-loc">Location</Label>
                    <Input
                      id="rv-loc"
                      value={reviewClass.location}
                      onChange={(e) =>
                        setReviewClass((c) => ({ ...c, location: e.target.value }))
                      }
                      placeholder="Doolan 222"
                    />
                  </div>
                </div>

                <MeetingsEditor
                  meetings={reviewClass.meetings}
                  onChange={(meetings) =>
                    setReviewClass((c) => ({ ...c, meetings }))
                  }
                />

                {reviewClass.gradeWeights.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Grading (from syllabus)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {reviewClass.gradeWeights.map((g, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary"
                        >
                          {g.label} <span className="font-mono">{g.percent}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <span className="text-xs font-medium text-text-tertiary">
                    Your preferences
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      {CLASS_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setReviewColor(c)}
                          aria-label={`Color ${c}`}
                          className={cn(
                            "size-7 rounded-full border-2 transition-transform hover:scale-110",
                            reviewColor === c ? "border-text-primary" : "border-transparent"
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    Sync to Google Calendar
                    <Switch checked={reviewSync} onCheckedChange={setReviewSync} />
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Assignments</Label>
              {review?.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 transition-opacity",
                    !item.include && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.include}
                      onCheckedChange={(checked) =>
                        setReview((r) =>
                          r!.map((x, j) =>
                            j === i ? { ...x, include: checked === true } : x
                          )
                        )
                      }
                      aria-label="Include item"
                    />
                    <Input
                      value={item.title}
                      onChange={(e) =>
                        setReview((r) =>
                          r!.map((x, j) =>
                            j === i ? { ...x, title: e.target.value } : x
                          )
                        )
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="flex gap-2 pl-6">
                    <Select
                      value={item.type}
                      onValueChange={(v) =>
                        v &&
                        setReview((r) =>
                          r!.map((x, j) =>
                            j === i ? { ...x, type: v as AssignmentType } : x
                          )
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          ["reading", "problem set", "quiz", "project", "exam", "paper"] as const
                        ).map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={item.due}
                      onChange={(e) =>
                        setReview((r) =>
                          r!.map((x, j) =>
                            j === i ? { ...x, due: e.target.value } : x
                          )
                        )
                      }
                      className="h-8 w-36 text-xs"
                    />
                  </div>
                </div>
              ))}
              {review?.length === 0 && (
                <p className="py-2 text-center text-xs text-text-tertiary">
                  No dated assignments found — the class itself will still be
                  created.
                </p>
              )}
            </div>
          </div>

          <Button onClick={confirmImport} disabled={!canConfirm}>
            {reviewMode === "new" ? "Create class & import" : "Import"}{" "}
            {review?.filter((i) => i.include).length ?? 0} items
          </Button>
        </DialogContent>
      </Dialog>

      {/* Class detail */}
      <Dialog open={!!detailLive} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="flex max-h-[85dvh] max-w-md flex-col">
          {detailLive && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: detailLive.color }}
                  />
                  {detailLive.code} — {detailLive.name}
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-text-secondary">
                {detailLive.professor} · {detailLive.location} ·{" "}
                {detailLive.meetings
                  .map((m) => `${DAY_NAMES[m.day]} ${m.start}–${m.end}`)
                  .join(", ")}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {detailLive.gradeWeights.map((g) => (
                  <span
                    key={g.label}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary"
                  >
                    {g.label} <span className="font-mono">{g.percent}%</span>
                  </span>
                ))}
              </div>

              <label className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
                Sync to Google Calendar
                <Switch
                  checked={detailLive.syncToGoogle}
                  onCheckedChange={(v) =>
                    updateClass(detailLive.id, { syncToGoogle: v })
                  }
                />
              </label>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-1">
                <span className="text-xs text-text-tertiary">Assignments</span>
                {tasks
                  .filter((t) => t.classId === detailLive.id)
                  .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
                  .map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      cls={detailLive}
                      onToggle={() => toggleTask(t.id)}
                      onDelete={() => deleteTask(t.id)}
                      showDue={t.due ? formatShort(t.due) : undefined}
                    />
                  ))}
                {tasks.filter((t) => t.classId === detailLive.id).length === 0 && (
                  <p className="py-4 text-center text-sm text-text-tertiary">
                    No assignments yet — upload the syllabus.
                  </p>
                )}
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteClass(detailLive.id);
                  setDetail(null);
                }}
              >
                <Trash2 data-icon="inline-start" className="size-3.5" />
                Delete class and its assignments
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddClassDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/** Shared by the manual "Add class" dialog and the syllabus review screen. */
function MeetingsEditor({
  meetings,
  onChange,
}: {
  meetings: ClassMeeting[];
  onChange: (meetings: ClassMeeting[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Meeting times</Label>
      {meetings.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            value={String(m.day)}
            onValueChange={(v) =>
              v && onChange(meetings.map((x, j) => (j === i ? { ...x, day: Number(v) } : x)))
            }
          >
            <SelectTrigger className="h-9 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((d, idx) => (
                <SelectItem key={d} value={String(idx)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="time"
            value={m.start}
            onChange={(e) =>
              onChange(meetings.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
            }
            className="h-9"
          />
          <Input
            type="time"
            value={m.end}
            onChange={(e) =>
              onChange(meetings.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))
            }
            className="h-9"
          />
          <button
            type="button"
            onClick={() => onChange(meetings.filter((_, j) => j !== i))}
            aria-label="Remove meeting"
            className="rounded p-1 text-text-tertiary transition-colors hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...meetings, { day: 1, start: "10:00", end: "10:50" }])}
      >
        <Plus data-icon="inline-start" className="size-3.5" />
        Add meeting
      </Button>
    </div>
  );
}

function AddClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const addClass = useTaskStore((s) => s.addClass);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [professor, setProfessor] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0]);
  const [meetings, setMeetings] = useState<ClassMeeting[]>([
    { day: 1, start: "10:00", end: "10:50" },
  ]);

  const save = () => {
    if (!name.trim()) return;
    addClass({
      name: name.trim(),
      code: code.trim() || name.trim().slice(0, 8).toUpperCase(),
      professor: professor.trim() || "TBD",
      location: location.trim() || "TBD",
      color,
      meetings,
      gradeWeights: [],
      syncToGoogle: false,
    });
    setName("");
    setCode("");
    setProfessor("");
    setLocation("");
    setMeetings([{ day: 1, start: "10:00", end: "10:50" }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-sm flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add class</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-name">Name</Label>
              <Input
                id="cl-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Algorithms"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-code">Code</Label>
              <Input
                id="cl-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CMSI 3510"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-prof">Professor</Label>
              <Input
                id="cl-prof"
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                placeholder="Prof. Park"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-loc">Location</Label>
              <Input
                id="cl-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Doolan 222"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    color === c ? "border-text-primary" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <MeetingsEditor meetings={meetings} onChange={setMeetings} />

          <Button onClick={save} disabled={!name.trim()}>
            Add class
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
