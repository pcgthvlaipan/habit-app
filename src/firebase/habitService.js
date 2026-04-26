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
export async function ensureUserDoc(uid, name) {
  await setDoc(doc(db, "users", uid), { name, createdAt: serverTimestamp() }, { merge: true });
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
export const REWARD_BADGES = [
  { id: "streak3",   icon: "🔥", label: "3-Day Streak",    desc: "3 days in a row!",       type: "streak",  threshold: 3 },
  { id: "streak7",   icon: "⚡", label: "Week Warrior",     desc: "7 days streak!",          type: "streak",  threshold: 7 },
  { id: "streak14",  icon: "💎", label: "2-Week Champion",  desc: "14 days streak!",         type: "streak",  threshold: 14 },
  { id: "streak30",  icon: "👑", label: "Monthly Legend",   desc: "30 days streak!",         type: "streak",  threshold: 30 },
  { id: "streak100", icon: "🏆", label: "Century Club",     desc: "100 days streak!",        type: "streak",  threshold: 100 },
  { id: "done10",    icon: "⭐", label: "First 10",         desc: "Completed 10 habits",     type: "total",   threshold: 10 },
  { id: "done50",    icon: "🌟", label: "50 Done!",         desc: "Completed 50 habits",     type: "total",   threshold: 50 },
  { id: "done100",   icon: "💫", label: "Century Done",     desc: "100 habits completed",    type: "total",   threshold: 100 },
  { id: "rate80",    icon: "🎯", label: "Sharp Shooter",    desc: "80%+ success rate",       type: "rate",    threshold: 80 },
  { id: "rate100",   icon: "✨", label: "Perfect Week",     desc: "100% success this week",  type: "rate",    threshold: 100 },
  { id: "habit3",    icon: "🌈", label: "Habit Collector",  desc: "Tracking 3+ habits",      type: "habits",  threshold: 3 },
  { id: "habit5",    icon: "🦋", label: "Habit Master",     desc: "Tracking 5+ habits",      type: "habits",  threshold: 5 },
  { id: "comeback",  icon: "💪", label: "Comeback Kid",     desc: "Back after a miss!",      type: "special" },
  { id: "morning",   icon: "🌅", label: "Early Bird",       desc: "Logged before 8am",       type: "special" },
  { id: "allday",    icon: "🌙", label: "Full Day",         desc: "All habits done today",   type: "special" },
];

export function computeEarnedBadges(habits, summary) {
  const earned       = [];
  const maxStreak    = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  const totalDoneAll = habits.reduce((s, h) => s + (h.totalDone ?? 0), 0);
  const avgRate      = summary?.successRate ?? 0;
  const habitCount   = habits.length;
  const allDoneToday = habits.length > 0 &&
    habits.every(h => h.todayStatus === "done" || h.todayStatus === "not-scheduled");
  for (const badge of REWARD_BADGES) {
    let earn = false;
    if (badge.type === "streak"  && maxStreak    >= badge.threshold) earn = true;
    if (badge.type === "total"   && totalDoneAll >= badge.threshold) earn = true;
    if (badge.type === "rate"    && avgRate       >= badge.threshold) earn = true;
    if (badge.type === "habits"  && habitCount    >= badge.threshold) earn = true;
    if (badge.id   === "allday"  && allDoneToday)                     earn = true;
    if (earn) earned.push(badge);
  }
  return earned;
}

// ─── DATE KEY HELPERS ─────────────────────────────────────────
// Use this for FIRESTORE TIMESTAMPS: converts UTC timestamp → Bangkok date string
// e.g. "April 26 at 3:39am UTC" → "2026-04-26" (Bangkok UTC+7)
function bangkokKey(utcDate = new Date()) {
  const bkk = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bkk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Use this for CALENDAR/CHART GRID DATES: simple local date string
// e.g. a Date object representing April 26 → "2026-04-26"
// Do NOT apply bangkokKey here — these dates are already "local" calendar dates
function dateKey(localDate) {
  const y = localDate.getFullYear();
  const m = String(localDate.getMonth() + 1).padStart(2, "0");
  const d = String(localDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const todayDayName = DAY_LABELS[today.getDay()];
  const isSchedToday = habit.frequency === "daily" || scheduled.includes(todayDayName);
  const todayStatus  = isSchedToday ? (logMap.get(todayKey) ?? "none") : "not-scheduled";

  // Streak
  let streak = 0;
  const chk = new Date(today);
  if (todayStatus === "none") chk.setDate(chk.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const dn  = DAY_LABELS[chk.getDay()];
    const key = bangkokKey(chk);  // must match logMap keys
    const ok  = habit.frequency === "daily" || scheduled.includes(dn);
    if (!ok) { chk.setDate(chk.getDate() - 1); continue; }
    if (logMap.get(key) === "done") { streak++; chk.setDate(chk.getDate() - 1); }
    else break;
  }

  // Success rate — count partial as 0.5 credit
  const scheduledLogs = logs.filter(l => {
    const dn = DAY_LABELS[toDate(l.date).getDay()];
    return habit.frequency === "daily" || scheduled.includes(dn);
  });
  const doneLogs = scheduledLogs.filter(l => l.status === "done").length;
  const successRate = scheduledLogs.length > 0
    ? Math.round((doneLogs / scheduledLogs.length) * 100) : 0;

  // buildChart — now includes partial data + pct for bar height
  function buildChart(days) {
    return Array.from({ length: days }, (_, i) => {
      const d     = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key   = bangkokKey(d);  // must match logMap keys
      const dn    = DAY_LABELS[d.getDay()];
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
      const partial = partialMap.get(key) ?? null;
      const label   = days <= 7 ? DAY_LABELS[d.getDay()].slice(0, 3) : `${d.getDate()}`;
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
      const dn    = DAY_LABELS[cur.getDay()];
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
      const partial = partialMap.get(key) ?? null;
      result.push({
        date: key, day: cur.getDate(), dayName: dn,
        month: cur.getMonth(), status, scheduled: sched, partial,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  const dow    = today.getDay();
  const monOff = (dow + 6) % 7;
  const mon    = new Date(today);
  mon.setDate(today.getDate() - monOff);
  const weeklyDays = WEEK_DAYS.map((label, i) => {
    const d     = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key   = bangkokKey(d);  // must match logMap keys
    const sched = habit.frequency === "daily" || scheduled.includes(label);
    const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
    const partial = partialMap.get(key) ?? null;
    return { day: label, done: status === "done", scheduled: sched, partial };
  });

  return {
    todayStatus, streak, successRate,
    chartData7d:  buildChart(7),
    chartData30d: buildChart(30),
    weeklyDays, buildChart, buildCalendar,
    totalDone: doneLogs, totalLogged: scheduledLogs.length, logMap,
  };
}

// ─── READS ────────────────────────────────────────────────────
export async function fetchUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    await setDoc(doc(db, "users", uid), { name: "Tam", createdAt: serverTimestamp() }, { merge: true });
    return { name: "Tam", avatarInitial: "T" };
  }
  const d = snap.data();
  return { name: d.name ?? "Friend", avatarInitial: (d.name ?? "F")[0].toUpperCase() };
}

export function subscribeToHabits(userId, onUpdate, onError) {
  return onSnapshot(
    collection(db, "users", userId, "habits"),
    async (snap) => {
      try {
        const habits = await Promise.all(
          snap.docs.map(async (hDoc, idx) => {
            const hd    = hDoc.data();
            const lSnap = await getDocs(
              query(collection(db, "users", userId, "habits", hDoc.id, "logs"), orderBy("date", "asc"))
            );
            const logs = lSnap.docs.map(d => d.data());
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
          })
        );
        onUpdate(habits);
      } catch (e) { onError(e); }
    },
    onError
  );
}

export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  const w             = habits.filter(h => h._rawLogs.length > 0);
  const successRate   = w.length > 0
    ? Math.round(w.reduce((s, h) => s + h.successRate, 0) / w.length) : 0;
  return { totalHabits, doneToday, currentStreak, successRate };
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
    await setDoc(ref, { date: Timestamp.fromDate(new Date(dateStr)), status });
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
