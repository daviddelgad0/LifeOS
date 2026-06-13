/**
 * Cloud sync via Supabase user_data table.
 * Strategy: localStorage is the local cache; Supabase is the source of truth.
 * - push: reads zustand persist JSON from localStorage → upserts to Supabase
 * - pull: fetches from Supabase → writes to localStorage (stores rehydrate themselves)
 */
import { supabase } from "./supabase";

const STORE_KEYS = ["app", "workouts", "tasks", "productivity", "chat"] as const;
type StoreKey = (typeof STORE_KEYS)[number];

const LS_KEY: Record<StoreKey, string> = {
  app:          "lifeos-app",
  workouts:     "lifeos-workouts",
  tasks:        "lifeos-tasks",
  productivity: "lifeos-productivity",
  chat:         "lifeos-chat",
};

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function pushData(key: StoreKey): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  const raw = localStorage.getItem(LS_KEY[key]);
  if (!raw) return;
  await supabase.from("user_data").upsert(
    { user_id: uid, key, data: JSON.parse(raw), updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
}

export async function pullData(key: StoreKey): Promise<boolean> {
  const uid = await userId();
  if (!uid) return false;
  const { data } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", uid)
    .eq("key", key)
    .maybeSingle();
  if (!data?.data) return false;
  localStorage.setItem(LS_KEY[key], JSON.stringify(data.data));
  return true;
}

/** Pull all store keys from cloud, write to localStorage, return count found. */
export async function pullAll(): Promise<number> {
  const uid = await userId();
  if (!uid) return 0;
  const { data: rows } = await supabase
    .from("user_data")
    .select("key, data")
    .eq("user_id", uid);
  if (!rows?.length) return 0;
  for (const row of rows) {
    const key = row.key as StoreKey;
    if (LS_KEY[key]) localStorage.setItem(LS_KEY[key], JSON.stringify(row.data));
  }
  return rows.length;
}

/** Push current localStorage state of all stores to cloud. */
export async function pushAll(): Promise<void> {
  await Promise.all(STORE_KEYS.map(pushData));
}
