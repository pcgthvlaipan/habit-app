// ═══════════════════════════════════════════════════════════════
// One-time data migration: Firebase (Auth + Firestore) → Supabase
//
// Prereqs (see .env.example):
//   SUPABASE_SERVICE_ROLE_KEY        Supabase → Settings → API → service_role / secret
//   VITE_SUPABASE_URL                Supabase → Settings → API → Project URL
//   GOOGLE_APPLICATION_CREDENTIALS   path to the Firebase service-account JSON
//
// Run:  node --env-file=.env scripts/migrate-firebase-to-supabase.mjs
//   --dry-run      print what would happen, write nothing
//   --send-reset   also email every migrated user a password-reset link
//
// Talks to Supabase over the plain REST + Auth-admin API (service_role bypasses
// RLS) — no supabase-js, so it runs on any Node without a WebSocket polyfill.
// Idempotent-ish: existing Supabase users (matched by email) are reused and
// their habits are wiped + re-inserted, so re-running is safe.
// ═══════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DRY  = process.argv.includes("--dry-run");
const SEND = process.argv.includes("--send-reset");

const SB_URL   = process.env.VITE_SUPABASE_URL;
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_PATH  = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SB_URL || !SB_KEY || !SA_PATH) {
  console.error("Missing env. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, "utf8"))) });
const fdb  = getFirestore();
const fauth = getAuth();

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── tiny Supabase REST helpers ──────────────────────────────
const H = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};
async function sbRest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
async function sbAuth(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SB_URL}/auth/v1/${path}`, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`auth ${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Firestore Timestamp / string → { day: "YYYY-MM-DD" (Bangkok), stamp: ISO }.
function toDayAndStamp(v, fallbackDocId) {
  let d = null;
  if (v?.toDate) d = v.toDate();
  else if (v?._seconds != null) d = new Date(v._seconds * 1000);
  else if (v?.seconds != null) d = new Date(v.seconds * 1000);
  else if (typeof v === "string") d = new Date(v);
  const bkk = d ? new Date(d.getTime() + 7 * 3600 * 1000) : null;
  const day = bkk
    ? `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`
    : (fallbackDocId && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDocId) ? fallbackDocId : null);
  return { day, stamp: (d ?? new Date()).toISOString() };
}

let sbUserCache = null;
async function allSupabaseUsers() {
  if (sbUserCache) return sbUserCache;
  const users = [];
  for (let page = 1; ; page++) {
    const r = await sbAuth(`admin/users?page=${page}&per_page=1000`);
    const batch = r.users ?? [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  sbUserCache = users;
  return users;
}

async function findOrCreateSupabaseUser(email, meta) {
  const existing = (await allSupabaseUsers())
    .find(u => (u.email || "").toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;
  const created = await sbAuth("admin/users", {
    method: "POST",
    body: {
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { name: meta.name ?? null, department: meta.department ?? null },
    },
  });
  sbUserCache?.push(created);
  return created.id;
}

async function readFirestoreProfile(uid) {
  const snap = await fdb.collection("users").doc(uid).get();
  const d = snap.exists ? snap.data() : {};
  return {
    name: d.name ?? null,
    department: d.department ?? null,
    isAdmin: d.isAdmin === true,
  };
}

// Habits live at users/{uid}/habits and/or the legacy top-level habits/{uid}/habits.
async function readHabits(uid) {
  const out = [];
  for (const base of [fdb.collection("users").doc(uid), fdb.collection("habits").doc(uid)]) {
    let hs;
    try { hs = await base.collection("habits").get(); } catch { continue; }
    for (const h of hs.docs) {
      const hd = h.data();
      const logsSnap = await base.collection("habits").doc(h.id).collection("logs").get();
      const logs = logsSnap.docs.map(l => {
        const ld = l.data();
        const { day, stamp } = toDayAndStamp(ld.date, l.id);
        return { day, stamp, status: ld.status ?? "done", partial: ld.partial ?? null };
      });
      out.push({
        name: hd.name ?? "Habit",
        frequency: hd.frequency ?? "daily",
        scheduled_days: Array.isArray(hd.scheduledDays) && hd.scheduledDays.length ? hd.scheduledDays : WEEK_DAYS,
        icon: hd.icon ?? "✨",
        reminder_enabled: hd.reminderEnabled ?? false,
        reminder_time: hd.reminderTime ?? "08:00",
        gcal_event_id: hd.gcalEventId ?? null,
        target_value: hd.targetValue ?? null,
        unit: hd.unit ?? null,
        created_at: toDayAndStamp(hd.createdAt).stamp,
        logs,
      });
    }
  }
  return out;
}

async function main() {
  console.log(`\n${DRY ? "DRY RUN — " : ""}Firebase → Supabase migration\n`);

  // ── departments ──
  const deptSnap = await fdb.collection("appConfig").doc("departments").get();
  const deptList = deptSnap.exists ? deptSnap.data().list : null;
  if (Array.isArray(deptList) && deptList.length) {
    console.log(`departments: ${deptList.length} entries`);
    if (!DRY) {
      await sbRest("app_config?on_conflict=key", {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: [{ key: "departments", value: { list: deptList }, updated_at: new Date().toISOString() }],
      });
    }
  }

  // ── auth users ──
  const users = [];
  let pageToken;
  do {
    const res = await fauth.listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`firebase auth users: ${users.length}\n`);

  let migrated = 0, skipped = 0;
  for (const fu of users) {
    if (!fu.email) { console.log(`  skip ${fu.uid} (no email)`); skipped++; continue; }
    const profile = await readFirestoreProfile(fu.uid);
    const habits  = await readHabits(fu.uid);
    const logCount = habits.reduce((s, h) => s + h.logs.length, 0);
    console.log(`  ${fu.email} — ${habits.length} habits, ${logCount} logs${profile.isAdmin ? " [admin]" : ""}`);
    if (DRY) { migrated++; continue; }

    const sbId = await findOrCreateSupabaseUser(fu.email, profile);

    // profile — service_role write bypasses the is_admin column lock
    await sbRest("profiles?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: [{
        id: sbId,
        name: profile.name ?? fu.displayName ?? "Friend",
        email: fu.email,
        department: profile.department,
        is_admin: profile.isAdmin,
      }],
    });

    // wipe + re-insert this user's habits (logs cascade)
    await sbRest(`habits?user_id=eq.${sbId}`, { method: "DELETE" });
    for (const h of habits) {
      const { logs, ...habitRow } = h;
      let ins;
      try {
        ins = await sbRest("habits", { method: "POST", prefer: "return=representation", body: [{ ...habitRow, user_id: sbId }] });
      } catch (e) { console.log(`    ! habit "${h.name}": ${e.message}`); continue; }
      const hid = ins[0].id;
      const seen = new Set();
      const rows = logs
        .filter(l => l.day && !seen.has(l.day) && seen.add(l.day))
        .map(l => ({ habit_id: hid, user_id: sbId, log_date: l.day, status: l.status, partial: l.partial, logged_at: l.stamp }));
      if (rows.length) {
        try { await sbRest("logs", { method: "POST", body: rows }); }
        catch (e) { console.log(`    ! logs for "${h.name}": ${e.message}`); }
      }
    }

    if (SEND) {
      try { await sbAuth("recover", { method: "POST", body: { email: fu.email } }); }
      catch (e) { console.log(`    ! reset email: ${e.message}`); }
    }
    migrated++;
  }

  console.log(`\n${DRY ? "would migrate" : "migrated"}: ${migrated} users (${skipped} skipped)`);
  console.log(SEND ? "password-reset emails sent." : "re-run with --send-reset to email reset links.\n");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
