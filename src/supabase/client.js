// ═══════════════════════════════════════════════════════════════
// src/supabase/client.js — the one Supabase client for the whole app
// ═══════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't hard-crash the whole app on a config mistake — log loudly and fall
  // back to a placeholder so the UI still mounts (network calls will just fail).
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Copy .env.example to .env and fill them in (or set them on your host)."
  );
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for the password-reset redirect link
    },
  }
);
