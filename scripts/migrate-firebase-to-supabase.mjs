// ═══════════════════════════════════════════════════════════════
// One-time data migration: Firebase (Auth + Firestore) → Supabase
//
// Prereqs (see .env.example):
//   SUPABASE_SERVICE_ROLE_KEY        Supabase → Settings → API → service_role
//   VITE_SUPABASE_URL                Supabase → Settings → API → Project URL
//   GOOGLE_APPLICATION_CREDENTIALS   path to the Firebase service-account JSON
//                                    (Firebase console → Project settings →
//                                     Service accounts → Generate new private key)
//
// Run:  node --env-file=.env scripts/migrate-firebase-to-supabase.mjs
//   add  --send-reset   to also email every migrated user a password-reset link
//   add  --dry-run      to print what would happen without writing
//
// What it does:
//   1. reads every Firebase Auth user (email + uid)
//   2. creates a matching Supabase auth user (email confirmed, random password)
//   3. copies the Firestore profile (name / department / isAdmin) into `profiles`
//   4. copies that user's habits + logs, remapping ids
//   5. (optional) sends each user a password-reset email
//
// Idempotent-ish: existing Supabase users (matched by email) are reused and
// their habits are wiped + re-inserted, so re-running is safe.
// ═══════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const DRY  = process.argv.includes("--dry-run");
const SEND = process.argv.includes("--send-reset");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_PATH      = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SUPABASE_URL || !SERVICE_KEY || !SA_PATH) {
  console.error("Missing env. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(SA_PATH, "utf8"))),
});
const fs = admin.firestore();
const fireAuth = admin.auth();

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Firestore Timestamp / string → "YYYY-MM-DD" (Bangkok day) + ISO timestamp.
function toDayAndStamp(v, fallbackDocId) {
  let d;
  if (v?.toDate) d = v.toDate();
  else if (v?._seconds != null) d = new Date(v._seconds * 1000);
  else if (typeof v === "string") d = new Date(v);
  else d = null;
  const bkk = d ? new Date(d.getTime() + 7 * 3600 * 1000) : null;
  const day = bkk
    ? `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`
    : fallbackDocId; // logs were keyed by the date string
  return { day, stamp: (d ?? new Date()).toISOString() };
}

async function findOrCreateSupabaseUser(email, meta) {
  // Look for an existing user with this email.
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find(u => (u.email || "").toLowerCase() === email.toLowerCase());
  if (existing) return { id: existing.id, created: false };

  const { data, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: { name: meta.name ?? null, department: meta.department ?? null },
  });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function readFirestoreProfile(uid) {
  const snap = await fs.collection("users").doc(uid).get();
  const d = snap.exists ? snap.data() : {};
  return {
    name: d.name ?? null,
    email: d.email ?? null,
    department: d.department ?? null,
    isAdmin: d.isAdmin === true,
  };
}

// Habits live at users/{uid}/habits OR the legacy top-level habits/{uid}/habits.
async function readHabits(uid) {
  const out = [];
  for (const base of [fs.collection("users").doc(uid), fs.collection("habits").doc(uid)]) {
    const hs = await base.collection("habits").get().catch(() => ({ empty: true, docs: [] }));
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
  const deptSnap = await fs.collection("appConfig").doc("departments").get();
  const deptList = deptSnap.exists ? deptSnap.data().list : null;
  if (Array.isArray(deptList) && deptList.length) {
    console.log(`departments: ${deptList.length} entries`);
    if (!DRY) {
      await sb.from("app_config").upsert(
        { key: "departments", value: { list: deptList }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }
  }

  // ── auth users ──
  let pageToken;
  const users = [];
  do {
    const res = await fireAuth.listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`firebase auth users: ${users.length}\n`);

  let migrated = 0;
  for (const fu of users) {
    if (!fu.email) { console.log(`  skip ${fu.uid} (no email)`); continue; }
    const profile = await readFirestoreProfile(fu.uid);
    const habits  = await readHabits(fu.uid);
    const logCount = habits.reduce((s, h) => s + h.logs.length, 0);
    console.log(`  ${fu.email} — ${habits.length} habits, ${logCount} logs${profile.isAdmin ? " [admin]" : ""}`);
    if (DRY) { migrated++; continue; }

    const { id: sbId } = await findOrCreateSupabaseUser(fu.email, profile);

    // profile (service role bypasses the is_admin column lock)
    await sb.from("profiles").upsert({
      id: sbId,
      name: profile.name ?? fu.displayName ?? "Friend",
      email: fu.email,
      department: profile.department,
      is_admin: profile.isAdmin,
    }, { onConflict: "id" });

    // wipe + re-insert this user's habits (logs cascade)
    await sb.from("habits").delete().eq("user_id", sbId);
    for (const h of habits) {
      const { logs, ...habitRow } = h;
      const { data: ins, error } = await sb.from("habits")
        .insert({ ...habitRow, user_id: sbId }).select("id").single();
      if (error) { console.log(`    ! habit "${h.name}": ${error.message}`); continue; }
      if (logs.length) {
        const rows = logs
          .filter(l => l.day)
          .map(l => ({
            habit_id: ins.id, user_id: sbId, log_date: l.day,
            status: l.status, partial: l.partial, logged_at: l.stamp,
          }));
        // de-dupe on (habit_id, log_date)
        const seen = new Set();
        const deduped = rows.filter(r => (seen.has(r.log_date) ? false : seen.add(r.log_date)));
        if (deduped.length) {
          const { error: le } = await sb.from("logs").insert(deduped);
          if (le) console.log(`    ! logs for "${h.name}": ${le.message}`);
        }
      }
    }

    if (SEND) {
      const { error } = await sb.auth.resetPasswordForEmail(fu.email);
      if (error) console.log(`    ! reset email: ${error.message}`);
    }
    migrated++;
  }

  console.log(`\n${DRY ? "would migrate" : "migrated"}: ${migrated} users`);
  console.log(SEND ? "password-reset emails sent." : "run again with --send-reset to email reset links.\n");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
