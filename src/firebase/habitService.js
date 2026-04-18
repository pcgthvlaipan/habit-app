// ═══════════════════════════════════════════════════════════════
// src/firebase/habitService.js
// DATA LAYER — Firestore reads AND writes
//
// Exports:
//   fetchUser(userId)                     → user profile
//   subscribeToHabits(userId, cb, errCb)  → real-time listener
//   computeSummary(habits)                → dashboard KPIs
//   logHabitToday(userId, habitId, status)→ write today's log
//   addHabit(userId, name, frequency)     → create new habit
// ═══════════════════════════════════════════════════════════════

import {
  doc, getDoc,
  collection, getDocs, addDoc,
  onSnapshot, query, orderBy,
  Timestamp, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// 🔑 Replace with your actual Firestore user document ID
export const USER_ID = "RRAUyTCZbrmoWHuWMgfB";

// ── Visual config ────────────────────────────────────────────────
const HABIT_COLORS = ["#34C77B","#FF6B6B","#4E8EF7","#A78BFA","#F59E0B","#E879A8"];
const HABIT_ICONS  = {
  exercise:"🏃", running:"🏃", reading:"📖", read:"📖",
  water:"💧", "drink water":"💧", meditation:"🧘", sleep:"😴",
  diet:"🥗", study:"📚", coding:"💻", journal:"📝",
  walk:"🚶", yoga:"🧘", gym:"🏋️",
};

function toDate(v) {
  if (!v) return new Date(0);
  if (v instanceof Timestamp) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
}
function pickIcon(name="")  { return HABIT_ICONS[name.toLowerCase().trim()] ?? "✨"; }
function pickColor(i)        { return HABIT_COLORS[i % HABIT_COLORS.length]; }

// ── Stat calculations ────────────────────────────────────────────
function computeHabitStats(logs) {
  const today = new Date();
  const logMap = new Map();
  for (const log of logs) {
    const key = toDate(log.date).toISOString().slice(0,10);
    logMap.set(key, log.status);
  }

  const todayKey    = today.toISOString().slice(0,10);
  const todayStatus = logMap.get(todayKey) ?? "none";

  // Streak
  let streak = 0;
  const checkDate = new Date(today);
  if (todayStatus === "none") checkDate.setDate(checkDate.getDate()-1);
  while (true) {
    const key = checkDate.toISOString().slice(0,10);
    if (logMap.get(key) === "done") { streak++; checkDate.setDate(checkDate.getDate()-1); }
    else break;
  }

  // Success rate
  const totalLogs = logs.length;
  const doneLogs  = logs.filter(l => l.status==="done").length;
  const successRate = totalLogs > 0 ? Math.round(doneLogs/totalLogs*100) : 0;

  // Chart 7d
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const chartData7d = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    chartData7d.push({ day: DAYS[d.getDay()], val: logMap.get(d.toISOString().slice(0,10))==="done"?1:0 });
  }

  // Chart 30d
  const chartData30d = [];
  for (let i=29; i>=0; i--) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    chartData30d.push({ day: String(d.getDate()).padStart(2,"0"), val: logMap.get(d.toISOString().slice(0,10))==="done"?1:0 });
  }

  // Weekly (Mon–Sun)
  const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayOfWeek    = today.getDay();
  const mondayOffset = (dayOfWeek+6)%7;
  const monday = new Date(today); monday.setDate(today.getDate()-mondayOffset);
  const weeklyDays = WEEK.map((label,i) => {
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    return { day: label, done: logMap.get(d.toISOString().slice(0,10))==="done" };
  });

  return { todayStatus, streak, successRate, chartData7d, chartData30d, weeklyDays };
}

// ── READ: user profile ───────────────────────────────────────────
export async function fetchUser(userId) {
  const snap = await getDoc(doc(db,"users",userId));
  if (!snap.exists()) throw new Error(`User not found: users/${userId}`);
  const data = snap.data();
  return { name: data.name??"Friend", avatarInitial: (data.name??"F")[0].toUpperCase() };
}

// ── READ: real-time habit subscription ──────────────────────────
export function subscribeToHabits(userId, onUpdate, onError) {
  const habitsRef = collection(db,"users",userId,"habits");
  return onSnapshot(habitsRef, async (snapshot) => {
    try {
      const habitPromises = snapshot.docs.map(async (habitDoc, index) => {
        const habitId   = habitDoc.id;
        const habitData = habitDoc.data();
        const logsRef   = collection(db,"users",userId,"habits",habitId,"logs");
        const logsSnap  = await getDocs(query(logsRef, orderBy("date","asc")));
        const logs      = logsSnap.docs.map(d => d.data());
        const stats     = computeHabitStats(logs);
        return {
          id: habitId,
          name:         habitData.name      ?? "Unnamed Habit",
          frequency:    habitData.frequency  ?? "Daily",
          createdAt:    toDate(habitData.createdAt),
          icon:         pickIcon(habitData.name),
          color:        pickColor(index),
          todayStatus:  stats.todayStatus,
          streak:       stats.streak,
          successRate:  stats.successRate,
          chartData7d:  stats.chartData7d,
          chartData30d: stats.chartData30d,
          weeklyDays:   stats.weeklyDays,
          _rawLogs:     logs,
        };
      });
      onUpdate(await Promise.all(habitPromises));
    } catch(err) { onError(err); }
  }, onError);
}

// ── READ: summary KPIs ───────────────────────────────────────────
export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus==="done").length;
  const currentStreak = habits.reduce((max,h) => Math.max(max,h.streak), 0);
  const withLogs      = habits.filter(h => h._rawLogs.length>0);
  const successRate   = withLogs.length>0
    ? Math.round(withLogs.reduce((s,h)=>s+h.successRate,0)/withLogs.length)
    : 0;
  return { totalHabits, doneToday, currentStreak, successRate };
}

// ── WRITE: log today's status for a habit ───────────────────────
// Creates or overwrites a log document for today's date.
export async function logHabitToday(userId, habitId, status) {
  const today  = new Date().toISOString().slice(0,10); // "YYYY-MM-DD"
  const logRef = doc(
    db, "users", userId, "habits", habitId, "logs", today
  );
  // setDoc with merge:false ensures one document per day (keyed by date string)
  await setDoc(logRef, {
    date:   Timestamp.fromDate(new Date()),
    status: status, // "done" or "missed"
  });
}

// ── WRITE: add a new habit ───────────────────────────────────────
export async function addHabit(userId, name, frequency) {
  const habitsRef = collection(db, "users", userId, "habits");
  await addDoc(habitsRef, {
    name:      name,
    frequency: frequency, // "daily" or "weekly"
    createdAt: serverTimestamp(),
  });
}
