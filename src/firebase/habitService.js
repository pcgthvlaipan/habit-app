// ═══════════════════════════════════════════════════════════════
// src/firebase/habitService.js  — v8
// New: partial completion shown in calendar + charts
// ═══════════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, onSnapshot, query, orderBy,
  Timestamp, serverTimestamp,
} from "firebase/firestore";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "firebase/auth";
import { db } from "./firebaseConfig";

export const auth = getAuth();

// ─── AUTH ────────────────────────────────────────────────────
export async function registerUser(e, p) { return createUserWithEmailAndPassword(auth, e, p); }
export async function loginUser(e, p)    { return signInWithEmailAndPassword(auth, e, p); }
export async function logoutUser()       { return signOut(auth); }
export function subscribeToAuth(cb)      { return onAuthStateChanged(auth, cb); }

// Registration now captures name + email + department (all required — see AuthScreen).
export async function ensureUserDoc(uid, { name, email, department }) {
  await setDoc(
    doc(db, "users", uid),
    { name, email: email ?? null, department: department ?? null, createdAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── DEPARTMENTS ─────────────────────────────────────────────
// The list lives in a single Firestore doc (appConfig/departments → { list: [] })
// so it can be edited in-app by admins and read on the (pre-auth) registration
// screen. DEFAULT_DEPARTMENTS seeds the doc on first read and is the offline
// fallback. Firestore rules must allow: public read of appConfig/departments,
// write only when request.auth != null && the user's doc has isAdmin == true.
export const DEFAULT_DEPARTMENTS = [
  "WHA - Domestics Warehouse",
  "WHA - Export Warehouse",
  "WHA - Logistics System and Admin",
  "WHA - Transport Department",
  "WHA - HR Department",
  "WHA - Projects & Safety",
  "WHA - Raw Material WH",
  "WH Chiangmai",
  "WH Chiangrai",
  "WH Phitsanulok",
  "WH Hadyai",
  "WH Surath",
  "WH Khonkan",
  "WH Korath",
  "WH Ubon",
  "WH Ratchburi",
  "WH Sriracha",
  "BKKWH Nongkam",
  "BKKWH Saimai",
  "BKKWH Ladprow",
  "BKKWH Pakkret",
  "BKKWH Wangnoi",
];

const DEPARTMENTS_REF = () => doc(db, "appConfig", "departments");

// One-shot read for the registration screen. Falls back to the defaults if the
// doc is missing or unreadable (e.g. offline) so registration is never blocked.
export async function fetchDepartments() {
  try {
    const snap = await getDoc(DEPARTMENTS_REF());
    const list = snap.exists() ? snap.data().list : null;
    if (Array.isArray(list) && list.length) return list;
  } catch { /* fall through to defaults */ }
  return DEFAULT_DEPARTMENTS;
}

// Live list for the in-app admin editor.
export function subscribeToDepartments(cb) {
  return onSnapshot(
    DEPARTMENTS_REF(),
    snap => {
      const list = snap.exists() ? snap.data().list : null;
      cb(Array.isArray(list) && list.length ? list : DEFAULT_DEPARTMENTS);
    },
    () => cb(DEFAULT_DEPARTMENTS)
  );
}

export async function addDepartment(name) {
  const clean = name.trim();
  if (!clean) return;
  const current = await fetchDepartments();
  if (current.some(d => d.toLowerCase() === clean.toLowerCase())) return;
  const next = [...current, clean].sort((a, b) => a.localeCompare(b));
  await setDoc(DEPARTMENTS_REF(), { list: next, updatedAt: serverTimestamp() }, { merge: true });
}

export async function removeDepartment(name) {
  const current = await fetchDepartments();
  const next = current.filter(d => d !== name);
  await setDoc(DEPARTMENTS_REF(), { list: next, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── 50 ICONS ────────────────────────────────────────────────
export const HABIT_ICON_OPTIONS = [
  { icon: "🏃", label: "Run" },       { icon: "💪", label: "Gym" },
  { icon: "🚴", label: "Cycling" },   { icon: "🏊", label: "Swim" },
  { icon: "🧘", label: "Yoga" },      { icon: "🚶", label: "Walk" },
  { icon: "⛹️", label: "Sport" },     { icon: "🤸", label: "Stretch" },
  { icon: "🏋️", label: "Weights" },   { icon: "🥊", label: "Boxing" },
  { icon: "💧", label: "Water" },     { icon: "🥗", label: "Diet" },
  { icon: "🍎", label: "Eat well" },  { icon: "🥤", label: "Smoothie" },
  { icon: "🍵", label: "Tea" },       { icon: "☕", label: "Coffee" },
  { icon: "💊", label: "Medicine" },  { icon: "🫀", label: "Cardio" },
  { icon: "😴", label: "Sleep" },     { icon: "🛁", label: "Self care" },
  { icon: "📖", label: "Read" },      { icon: "📚", label: "Study" },
  { icon: "💻", label: "Code" },      { icon: "📝", label: "Journal" },
  { icon: "🧠", label: "Learn" },     { icon: "🎓", label: "Course" },
  { icon: "🗣️", label: "Language" },  { icon: "♟️", label: "Chess" },
  { icon: "📰", label: "News" },      { icon: "🔬", label: "Research" },
  { icon: "🎨", label: "Art" },       { icon: "🎵", label: "Music" },
  { icon: "🎸", label: "Guitar" },    { icon: "🎹", label: "Piano" },
  { icon: "✍️", label: "Write" },     { icon: "📸", label: "Photo" },
  { icon: "🎬", label: "Video" },     { icon: "🧶", label: "Craft" },
  { icon: "🎭", label: "Perform" },   { icon: "🖌️", label: "Paint" },
  { icon: "🙏", label: "Gratitude" }, { icon: "🌿", label: "Nature" },
  { icon: "🧹", label: "Clean" },     { icon: "💰", label: "Finance" },
  { icon: "🌙", label: "Evening" },   { icon: "☀️", label: "Morning" },
  { icon: "❤️", label: "Love" },      { icon: "👨‍👩‍👧", label: "Family" },
  { icon: "🐾", label: "Pet" },       { icon: "🌍", label: "Eco" },
];

// ─── REWARD BADGES ────────────────────────────────────────────
// label/desc text lives in src/i18n.jsx under `badgeDefs.<id>` so it can be shown
// in Thai or English. Order here == display order. The `type` groups them for the
// "next badge" hint in the AI coach card. Points: full completion = 10, partial = 5.
export const POINTS_FULL = 10;
export const POINTS_PARTIAL = 5;

export const REWARD_BADGES = [
  // ── small wins — the everyday motivation tier ──
  { id: "firststep",  icon: "🌱", type: "milestone", threshold: 1 },   // first ever log
  { id: "smallwins",  icon: "🪜", type: "milestone", threshold: 5 },   // 5 logs of any kind
  { id: "partialhero",icon: "◑",  type: "partial",   threshold: 3 },   // 3 partial completions
  { id: "points100",  icon: "⚡", type: "points",    threshold: 100 },
  { id: "points500",  icon: "💠", type: "points",    threshold: 500 },
  { id: "perfectweek",icon: "✨", type: "week" },                       // every scheduled check-in this week
  // ── streaks ──
  { id: "streak3",   icon: "🔥", type: "streak", threshold: 3 },
  { id: "streak7",   icon: "⭐", type: "streak", threshold: 7 },
  { id: "streak14",  icon: "💎", type: "streak", threshold: 14 },
  { id: "streak30",  icon: "👑", type: "streak", threshold: 30 },
  { id: "streak100", icon: "🏆", type: "streak", threshold: 100 },
  // ── totals & consistency ──
  { id: "done10",    icon: "✅", type: "total",  threshold: 10 },
  { id: "done50",    icon: "🌟", type: "total",  threshold: 50 },
  { id: "done100",   icon: "💫", type: "total",  threshold: 100 },
  { id: "rate80",    icon: "🎯", type: "rate",   threshold: 80 },
  { id: "habit3",    icon: "🌈", type: "habits", threshold: 3 },
  { id: "habit5",    icon: "🦋", type: "habits", threshold: 5 },
  // ── special ──
  { id: "comeback",  icon: "💪", type: "special" },
  { id: "earlybird", icon: "🌅", type: "special" },
  { id: "allday",    icon: "🌙", type: "special" },
];

export function computeEarnedBadges(habits, summary) {
  const earned         = [];
  const maxStreak      = habits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0);
  const totalDoneAll   = habits.reduce((s, h) => s + (h.totalDone ?? 0), 0);
  const totalLoggedAll = habits.reduce((s, h) => s + (h.totalLogged ?? 0), 0);
  const partialCntAll  = habits.reduce((s, h) => s + (h.partialCount ?? 0), 0);
  const totalPoints    = summary?.totalPoints ?? 0;
  const avgRate        = summary?.successRate ?? 0;
  const habitCount     = habits.length;
  const weeklyComplete = summary?.weeklyComplete ?? false;
  const hasEarly       = habits.some(h => h.hasEarlyLog);
  const hasComeback    = habits.some(h => h.hasComeback);
  const allDoneToday   = habits.length > 0 &&
    habits.every(h => h.todayStatus === "done" || h.todayStatus === "not-scheduled");

  for (const badge of REWARD_BADGES) {
    let earn = false;
    if (badge.type === "milestone" && totalLoggedAll >= badge.threshold) earn = true;
    if (badge.type === "partial"   && partialCntAll  >= badge.threshold) earn = true;
    if (badge.type === "points"    && totalPoints    >= badge.threshold) earn = true;
    if (badge.type === "streak"    && maxStreak      >= badge.threshold) earn = true;
    if (badge.type === "total"     && totalDoneAll   >= badge.threshold) earn = true;
    if (badge.type === "rate"      && avgRate        >= badge.threshold) earn = true;
    if (badge.type === "habits"    && habitCount     >= badge.threshold) earn = true;
    if (badge.type === "week"      && weeklyComplete)                    earn = true;
    if (badge.id   === "earlybird" && hasEarly)                          earn = true;
    if (badge.id   === "comeback"  && hasComeback)                       earn = true;
    if (badge.id   === "allday"    && allDoneToday)                      earn = true;
    if (earn) earned.push(badge);
  }
  return earned;
}

// Progress (0..1) toward a not-yet-earned badge, for the "next badge" progress bar.
export function badgeProgress(badge, habits, summary) {
  const val =
    badge.type === "milestone" ? habits.reduce((s, h) => s + (h.totalLogged ?? 0), 0) :
    badge.type === "partial"   ? habits.reduce((s, h) => s + (h.partialCount ?? 0), 0) :
    badge.type === "points"    ? (summary?.totalPoints ?? 0) :
    badge.type === "streak"    ? habits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0) :
    badge.type === "total"     ? habits.reduce((s, h) => s + (h.totalDone ?? 0), 0) :
    badge.type === "rate"      ? (summary?.successRate ?? 0) :
    badge.type === "habits"    ? habits.length :
    badge.type === "week"      ? (summary?.weeklyScheduled ? (summary.weeklyDone / summary.weeklyScheduled) * 100 : 0) :
    0;
  const target = badge.threshold ?? (badge.type === "week" ? 100 : 1);
  return { current: Math.min(val, target), target, ratio: target ? Math.min(1, val / target) : 0 };
}

// ─── DATE HELPERS (Bangkok UTC+7, app-wide single basis) ──────
// The whole app is hard-coded to Bangkok time. `bangkokDate` returns a Date whose
// UTC getters (getUTCFullYear / getUTCDate / getUTCDay …) read out Bangkok
// wall-clock values. ALL date logic — the date key AND the weekday — must be
// derived from this same shifted instant so they can never disagree near midnight.
export function bangkokDate(utcDate = new Date()) {
  return new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
}

// UTC timestamp / Date → Bangkok "YYYY-MM-DD" key.
// Used for BOTH Firestore timestamps and calendar/chart grid dates — there is no
// separate "local" date basis, the app is Bangkok-only.
export function bangkokKey(utcDate = new Date()) {
  const bkk = bangkokDate(utcDate);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bkk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Bangkok weekday label for a given instant ("Sun".."Sat").
function bangkokDayLabel(utcDate) {
  return DAY_LABELS[bangkokDate(utcDate).getUTCDay()];
}

// ─── CONSTANTS ────────────────────────────────────────────────
export const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_LABELS        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HABIT_COLORS      = [
  "#34C77B","#FF6B6B","#4E8EF7","#A78BFA","#F59E0B",
  "#E879A8","#14B8A6","#F97316","#8B5CF6","#06B6D4",
];
function pickColor(i) { return HABIT_COLORS[i % HABIT_COLORS.length]; }
function toDate(v) {
  if (!v) return new Date(0);
  if (v instanceof Timestamp) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
}

// ─── PARTIAL-COMPLETION CREDIT ───────────────────────────────
// A "done" log only counts as a FULL completion when it has no partial object,
// or the partial reached 100%. A partial log (pct < 100) is worth 0.5 credit
// toward success rate / totals, and — see the streak loop — does NOT extend a streak.
function isFullDone(status, partial) {
  return status === "done" && (!partial || (partial.pct ?? 100) >= 100);
}
function doneCredit(status, partial) {
  if (status !== "done") return 0;
  return isFullDone(status, partial) ? 1 : 0.5;
}

// ─── STAT ENGINE ──────────────────────────────────────────────
function getScheduled(habit) {
  if (habit.frequency === "custom" && Array.isArray(habit.scheduledDays))
    return habit.scheduledDays;
  return WEEK_DAYS;
}

function computeHabitStats(logs, habit) {
  const today  = new Date();
  const logMap     = new Map(); // key → status
  const partialMap = new Map(); // key → partial object

  // NOTE: logs come from Firestore with document IDs = date strings (e.g. "2026-04-26")
  // But we only have the log data, not the doc ID, so we use the date field.
  // The date field is a Timestamp stored as Bangkok time awareness via bangkokKey.
  for (const log of logs) {
    const key = bangkokKey(toDate(log.date));
    logMap.set(key, log.status);
    if (log.partial) partialMap.set(key, log.partial);
  }

  const scheduled    = getScheduled(habit);
  const todayKey = bangkokKey(today);  // must match logMap keys (both Bangkok)
  const todayDayName = bangkokDayLabel(today);  // weekday from the SAME Bangkok instant as todayKey
  const isSchedToday = habit.frequency === "daily" || scheduled.includes(todayDayName);
  const rawToday     = isSchedToday ? (logMap.get(todayKey) ?? "none") : "not-scheduled";
  const todayPartial = partialMap.get(todayKey) ?? null;
  // A partial-done day is reported as "partial", never "done", so summary counters
  // and badges never treat it as a full completion.
  const todayStatus  = isFullDone(rawToday, todayPartial) || rawToday !== "done"
    ? rawToday
    : "partial";

  // Streak — a partial day BREAKS the streak (same as a miss). We deliberately do
  // NOT give partials 0.5 credit here: a fractional "3.5-day streak" is meaningless
  // to display, so the streak counts only consecutive FULL completions.
  let streak = 0;
  const chk = new Date(today);
  if (rawToday === "none") chk.setDate(chk.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const dn  = bangkokDayLabel(chk);
    const key = bangkokKey(chk);  // must match logMap keys
    const ok  = habit.frequency === "daily" || scheduled.includes(dn);
    if (!ok) { chk.setDate(chk.getDate() - 1); continue; }
    if (isFullDone(logMap.get(key), partialMap.get(key))) { streak++; chk.setDate(chk.getDate() - 1); }
    else break;
  }

  // Success rate — a partial (pct < 100) is worth 0.5, a full done 1. Weekday
  // basis is the Bangkok-shifted date of the stored timestamp, matching logMap keys.
  const scheduledLogs = logs.filter(l => {
    const dn = bangkokDayLabel(toDate(l.date));
    return habit.frequency === "daily" || scheduled.includes(dn);
  });
  const doneCreditTotal = scheduledLogs.reduce((s, l) => s + doneCredit(l.status, l.partial), 0);
  const fullDoneLogs    = scheduledLogs.filter(l => isFullDone(l.status, l.partial)).length;
  const successRate = scheduledLogs.length > 0
    ? Math.round((doneCreditTotal / scheduledLogs.length) * 100) : 0;

  // buildChart — now includes partial data + pct for bar height
  function buildChart(days) {
    return Array.from({ length: days }, (_, i) => {
      const d     = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key   = bangkokKey(d);  // must match logMap keys
      const dn    = bangkokDayLabel(d);
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
      const partial = partialMap.get(key) ?? null;
      const label   = days <= 7 ? dn.slice(0, 3) : `${d.getDate()}`;
      // val: 1 = full done, 0.01–0.99 = partial pct, 0 = not done
      const val = status === "done"
        ? (partial ? (partial.pct / 100) : 1)
        : 0;
      return { day: label, date: key, val, status, partial, scheduled: sched, fullDate: d };
    });
  }

  // buildCalendar — now includes partial data
  function buildCalendar(startDate, endDate) {
    const result = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key   = bangkokKey(cur);  // must match logMap keys
      const dn    = bangkokDayLabel(cur);
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
      const partial = partialMap.get(key) ?? null;
      result.push({
        date: key, day: bangkokDate(cur).getUTCDate(), dayName: dn,
        month: bangkokDate(cur).getUTCMonth(), status, scheduled: sched, partial,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  const dow    = bangkokDate(today).getUTCDay();
  const monOff = (dow + 6) % 7;
  const mon    = new Date(today);
  mon.setDate(today.getDate() - monOff);
  let weekScheduled = 0;
  let weekDone      = 0;
  const weeklyDays = WEEK_DAYS.map((label, i) => {
    const d     = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key   = bangkokKey(d);  // must match logMap keys
    const sched = habit.frequency === "daily" || scheduled.includes(label);
    const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
    const partial = partialMap.get(key) ?? null;
    // Weekly-consistency reward: count scheduled days up to today only, and treat
    // a full done OR a partial as "done for the week" (small wins still count).
    if (sched && key <= todayKey) {
      weekScheduled++;
      if (status === "done") weekDone++;
    }
    // status stays raw "done" here; the WeeklySummary component detects partials
    // via the `partial` object (partial.pct < 100).
    return { day: label, done: status === "done", scheduled: sched, partial };
  });

  // ── Small-win signals ──
  // Points: every full completion is worth POINTS_FULL, every partial POINTS_PARTIAL.
  const points = logs.reduce((s, l) => {
    if (isFullDone(l.status, l.partial)) return s + POINTS_FULL;
    if (l.status === "done") return s + POINTS_PARTIAL;
    return s;
  }, 0);
  const partialCount = logs.filter(
    l => l.status === "done" && l.partial && (l.partial.pct ?? 100) < 100
  ).length;
  // Early bird: a completion logged before 08:00 Bangkok time.
  const hasEarlyLog = logs.some(l => {
    if (l.status !== "done") return false;
    return bangkokDate(toDate(l.date)).getUTCHours() < 8;
  });
  // Comeback: a "missed" day followed later by any completion.
  const chronological = [...logs].sort((a, b) => toDate(a.date) - toDate(b.date));
  let sawMiss = false;
  let hasComeback = false;
  for (const l of chronological) {
    if (l.status === "missed") sawMiss = true;
    else if (sawMiss && l.status === "done") { hasComeback = true; break; }
  }

  return {
    todayStatus, todayPartial, streak, successRate,
    chartData7d:  buildChart(7),
    chartData30d: buildChart(30),
    weeklyDays, buildChart, buildCalendar,
    // totalDone = count of FULL completions; successRate already blends in partials at 0.5.
    totalDone: fullDoneLogs, totalLogged: scheduledLogs.length, logMap,
    points, partialCount, weekScheduled, weekDone, hasEarlyLog, hasComeback,
  };
}

// ─── READS ────────────────────────────────────────────────────
export async function fetchUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    // Don't write here — ensureUserDoc (called at registration) is the single
    // writer of the profile doc. Writing a placeholder from here can race with
    // ensureUserDoc and clobber the real name/email/department.
    return { name: "Friend", avatarInitial: "F", email: null, department: null, isAdmin: false };
  }
  const d = snap.data();
  const name = d.name ?? "Friend";
  return {
    name,
    avatarInitial: name[0].toUpperCase(),
    email: d.email ?? null,
    department: d.department ?? null,
    isAdmin: d.isAdmin === true,
  };
}

export function subscribeToHabits(userId, onUpdate, onError) {
  // We need live updates for BOTH the habits collection AND every habit's `logs`
  // subcollection, so a log write (which lives in a subcollection) re-renders the
  // UI. We keep the habits-collection snapshot plus one `onSnapshot` per habit's
  // logs query, and reconcile them into a single onUpdate() payload.
  let habitDocs = [];                 // latest habit doc snapshots
  const logsByHabit = new Map();      // hid -> array of log data
  const logUnsubs   = new Map();      // hid -> unsubscribe fn
  let closed = false;

  function emit() {
    if (closed) return;
    try {
      const habits = habitDocs.map((hDoc, idx) => {
        const hd   = hDoc.data();
        const logs = logsByHabit.get(hDoc.id) ?? [];
        const obj  = {
          id:              hDoc.id,
          name:            hd.name            ?? "Unnamed",
          frequency:       hd.frequency       ?? "daily",
          scheduledDays:   hd.scheduledDays   ?? WEEK_DAYS,
          icon:            hd.icon            ?? "✨",
          color:           pickColor(idx),
          createdAt:       toDate(hd.createdAt),
          reminderEnabled: hd.reminderEnabled ?? false,
          reminderTime:    hd.reminderTime    ?? "08:00",
          gcalEventId:     hd.gcalEventId     ?? null,
          targetValue:     hd.targetValue     ?? null,
          unit:            hd.unit            ?? null,
        };
        const stats = computeHabitStats(logs, obj);
        return { ...obj, ...stats, _rawLogs: logs };
      });
      onUpdate(habits);
    } catch (e) { onError(e); }
  }

  const unsubHabits = onSnapshot(
    collection(db, "users", userId, "habits"),
    (snap) => {
      habitDocs = snap.docs;
      const liveIds = new Set(snap.docs.map(d => d.id));

      // Drop listeners for habits that were deleted.
      for (const [hid, unsub] of logUnsubs) {
        if (!liveIds.has(hid)) {
          unsub();
          logUnsubs.delete(hid);
          logsByHabit.delete(hid);
        }
      }

      // Add a logs listener for any habit we're not already watching.
      for (const hDoc of snap.docs) {
        if (logUnsubs.has(hDoc.id)) continue;
        const q = query(
          collection(db, "users", userId, "habits", hDoc.id, "logs"),
          orderBy("date", "asc")
        );
        const unsub = onSnapshot(
          q,
          (lSnap) => { logsByHabit.set(hDoc.id, lSnap.docs.map(d => d.data())); emit(); },
          onError
        );
        logUnsubs.set(hDoc.id, unsub);
      }

      emit();
    },
    onError
  );

  return () => {
    closed = true;
    unsubHabits();
    for (const unsub of logUnsubs.values()) unsub();
    logUnsubs.clear();
    logsByHabit.clear();
  };
}

export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  const w             = habits.filter(h => h._rawLogs.length > 0);
  const successRate   = w.length > 0
    ? Math.round(w.reduce((s, h) => s + h.successRate, 0) / w.length) : 0;

  // ── Rewards: points + weekly consistency ──
  const totalPoints     = habits.reduce((s, h) => s + (h.points ?? 0), 0);
  const weeklyScheduled = habits.reduce((s, h) => s + (h.weekScheduled ?? 0), 0);
  const weeklyDone      = habits.reduce((s, h) => s + (h.weekDone ?? 0), 0);
  const weeklyComplete  = weeklyScheduled > 0 && weeklyDone >= weeklyScheduled;

  return {
    totalHabits, doneToday, currentStreak, successRate,
    totalPoints, weeklyScheduled, weeklyDone, weeklyComplete,
  };
}

// ─── WRITES ───────────────────────────────────────────────────

export async function logHabitToday(uid, hid, status, partial) {
  const key = bangkokKey();  // Bangkok UTC+7
  const ref = doc(db, "users", uid, "habits", hid, "logs", key);
  if (status === "none") {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      date:    Timestamp.fromDate(new Date()),
      status,
      partial: partial ?? null,
    });
  }
}

export async function logHabitDate(uid, hid, dateStr, status) {
  const ref = doc(db, "users", uid, "habits", hid, "logs", dateStr);
  if (status === "none") {
    await deleteDoc(ref);
  } else {
    // Merge so we don't blow away fields we're not touching. The calendar toggle
    // only ever sets a plain "done" or "missed" (never a partial):
    //  - "done"  → deliberately CLEAR any stored partial: the user marked the day
    //             fully complete, so a leftover "45%" would contradict that.
    //  - "missed"→ PRESERVE partial: merge without touching it, so re-opening the
    //             day still shows what was logged.
    const data = { date: Timestamp.fromDate(new Date(dateStr)), status };
    if (status === "done") data.partial = null;
    await setDoc(ref, data, { merge: true });
  }
}

export async function addHabit(uid, {
  name, frequency, scheduledDays, icon,
  reminderEnabled, reminderTime, targetValue, unit,
}) {
  await addDoc(collection(db, "users", uid, "habits"), {
    name, frequency,
    scheduledDays:   scheduledDays   ?? WEEK_DAYS,
    icon:            icon            ?? "✨",
    reminderEnabled: reminderEnabled ?? false,
    reminderTime:    reminderTime    ?? "08:00",
    gcalEventId:     null,
    targetValue:     targetValue     ?? null,
    unit:            unit            ?? null,
    createdAt:       serverTimestamp(),
  });
}

export async function editHabit(uid, hid, {
  name, frequency, scheduledDays, icon,
  reminderEnabled, reminderTime, gcalEventId,
  targetValue, unit,
}) {
  await updateDoc(doc(db, "users", uid, "habits", hid), {
    name, frequency,
    scheduledDays:   scheduledDays   ?? WEEK_DAYS,
    icon,
    reminderEnabled: reminderEnabled ?? false,
    reminderTime:    reminderTime    ?? "08:00",
    gcalEventId:     gcalEventId     ?? null,
    targetValue:     targetValue     ?? null,
    unit:            unit            ?? null,
  });
}

export async function deleteHabit(uid, hid) {
  const snap = await getDocs(collection(db, "users", uid, "habits", hid, "logs"));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "users", uid, "habits", hid));
}
