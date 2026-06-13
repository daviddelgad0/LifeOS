"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GymLogTab } from "@/components/gym/log-tab";
import { GymProgressTab } from "@/components/gym/progress-tab";
import { GymRecoveryTab } from "@/components/gym/recovery-tab";
import { GymTrackersTab } from "@/components/gym/trackers-tab";

const TABS = ["log", "recovery", "progress", "trackers"];

export default function GymPage() {
  // Deep-linkable (/gym?tab=recovery). Safe to read location here: the
  // shell renders this page client-side only, after hydration.
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "log";
    const wanted = new URLSearchParams(window.location.search).get("tab");
    return wanted && TABS.includes(wanted) ? wanted : "log";
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold">Gym</h1>
      <Tabs
        value={tab}
        onValueChange={(v) => v && setTab(v)}
        className="flex flex-col gap-6"
      >
        <TabsList>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="trackers">Trackers</TabsTrigger>
        </TabsList>
        <TabsContent value="log">
          <GymLogTab />
        </TabsContent>
        <TabsContent value="recovery">
          <GymRecoveryTab />
        </TabsContent>
        <TabsContent value="progress">
          <GymProgressTab />
        </TabsContent>
        <TabsContent value="trackers">
          <GymTrackersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
