"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GymLogTab } from "@/components/gym/log-tab";
import { GymProgressTab } from "@/components/gym/progress-tab";
import { GymTrackersTab } from "@/components/gym/trackers-tab";

export default function GymPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold">Gym</h1>
      <Tabs defaultValue="log" className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="trackers">Trackers</TabsTrigger>
        </TabsList>
        <TabsContent value="log">
          <GymLogTab />
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
