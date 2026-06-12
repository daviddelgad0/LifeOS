"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassesTab } from "@/components/school/classes-tab";
import { SchoolCalendarTab } from "@/components/school/calendar-tab";
import { SchoolSettingsTab } from "@/components/school/school-settings-tab";

export default function SchoolPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold">School</h1>
      <Tabs defaultValue="classes" className="flex flex-col gap-6">
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
