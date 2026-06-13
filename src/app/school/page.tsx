"use client";

import { useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassesTab } from "@/components/school/classes-tab";
import { SchoolCalendarTab } from "@/components/school/calendar-tab";
import { SchoolSettingsTab } from "@/components/school/school-settings-tab";

export default function SchoolPage() {
  const [tab, setTab] = useState("classes");

  // Honor ?tab= so the Google OAuth callback can land on the Sync tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "sync" || t === "settings") setTab("sync");
    else if (t === "calendar") setTab("calendar");
    else if (t === "classes") setTab("classes");
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold">School</h1>
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="sync">Sync &amp; reminders</TabsTrigger>
        </TabsList>
        <TabsContent value="classes">
          <ClassesTab />
        </TabsContent>
        <TabsContent value="calendar">
          <SchoolCalendarTab />
        </TabsContent>
        <TabsContent value="sync">
          <SchoolSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
