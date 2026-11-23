import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Client public (clé publishable) : il ne peut qu'insérer dans `reservations`, la base refuse tout le reste. */
export function supabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error("Supabase non configuré");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function makeReference() {
  const d = new Date();
  const ymd = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JC-${ymd}-${rnd}`;
}
