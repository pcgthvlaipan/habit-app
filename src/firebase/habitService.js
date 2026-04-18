// ─────────────────────────────────────────────────────────────────────────────
// src/firebase/habitService.js
//
// DATA LAYER — every Firestore read and all stat calculations live here.
// The UI components never import firebase directly; they only use functions
// and the real-time subscription exported from this file.
//
// Firestore structure used:
//   users/{userId}                              ← user profile
//   users/{userId}/habits/{habitId}             ← habit metadata
//   users/{userId}/habits/{habitId}/logs/{logId} ← daily log entries
// ─────────────────────────────────────────────────────────────────────────────

import {
  doc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ─────────────────────────────────────────────
// USER ID
// ─────────────────────────────────────────────
// 🔑 Replace with your actual Firestore user document ID.
//    After adding Firebase Auth, change this to:
//      import { getAuth } from "firebase/auth";
//      const userId = getAuth().currentUser?.uid;
export const USER_ID = "RRAUyTCZbrmoWHuWMgfB"; // e.g. "tam_user_001"

// ─────────────────────────────────────────────
// VISUAL PALETTE  (assigned to habits by index)
// ─────────────────────────────────────────────
const HABIT_COLORS = [
  "#4CAF82", // green
  "#F4845F", // coral
  "#5B9BD5", // blue
  "#A78BFA", // violet
  "#F4C542", // amber
  "#E879A8", // pink
];

// Emoji icon map — extend as you add more habits
const HABIT_ICONS = {
  exercise:      "🏃",
  running:       "🏃",
  reading:       "📖",
  read:          "📖",
  water:         "💧",
  "drink water": "💧",
  meditation:    "🧘",
  sleep:         "😴",
  diet:          "🥗",
  study:         "📚",
  coding:        "💻",
  journal:       "📝",
  walk:          "🚶",
  yoga:          "🧘",
  gym:           "🏋️",
};

// ─────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────

/** Converts a Firestore Timestamp (or plain JS Date) to a JS Date. */
function toDate(value) {
  if (!value) return new Date(0);
  if (value instanceof Timestamp) return value.toDate();
  if (value?.seconds)             return new Date(value.seconds * 1000);
  return new Date(value);
}

/** Returns emoji icon matching the habit name, or a default. */
function pickIcon(name = "") {
  return HABIT_ICONS[name.toLowerCase().trim()] ?? "✨";
}

/** Cycles through the color palette by array index. */
function pickColor(index) {
  return HABIT_COLORS[index % HABIT_COLORS.length];
}

// ─────────────────────────────────────────────
// STATISTICS ENGINE
// ─────────────────────────────────────────────

/**
 * Given raw log documents for ONE habit, computes every derived metric
 * needed by the dashboard UI.
 *
 * @param {Array<{date: Timestamp, status: string}>} logs
 * @returns {{
 *   todayStatus: "done"|"missed"|"none",
 *   streak: number,
 *   successRate: number,
 *   chartData7d: Array<{day:string, val:number}>,
 *   chartData30d: Array<{day:string, val:number}>,
 *   weeklyDays: Array<{day:string, done:boolean}>,
 * }}
 */
function computeHabitStats(logs) {
  const today = new Date();

  // ── Build a Map of "YYYY-MM-DD" → status for O(1) lookups ────────────────
  const logMap = new Map();
  for (const log of logs) {
    const d   = toDate(log.date);
    const key = d.toISOString().slice(0, 10);
    logMap.set(key, log.status); // last write wins if duplicate dates exist
  }

  // ── Today's status ────────────────────────────────────────────────────────
  const todayKey    = today.toISOString().slice(0, 10);
  const todayStatus = logMap.get(todayKey) ?? "none";

  // ── Current streak ────────────────────────────────────────────────────────
  // Walk backwards from today.  If today has no entry yet, start from
  // yesterday so an un-logged morning doesn't break an intact streak.
  let streak      = 0;
  const checkDate = new Date(today);
  if (todayStatus === "none") checkDate.setDate(checkDate.getDate() - 1);

  while (true) {
    const key = checkDate.toISOString().slice(0, 10);
    if (logMap.get(key) === "done") {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Success rate ──────────────────────────────────────────────────────────
  const totalLogs   = logs.length;
  const doneLogs    = logs.filter((l) => l.status === "done").length;
  const successRate = totalLogs > 0 ? Math.round((doneLogs / totalLogs) * 100) : 0;

  // ── Chart data — last 7 days ──────────────────────────────────────────────
  const DAY_LABELS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const chartData7d = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(d.getDate() - i);
    chartData7d.push({
      day: DAY_LABELS[d.getDay()],
      val: logMap.get(d.toISOString().slice(0, 10)) === "done" ? 1 : 0,
    });
  }

  // ── Chart data — last 30 days ─────────────────────────────────────────────
  const chartData30d = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(d.getDate() - i);
    chartData30d.push({
      day: String(d.getDate()).padStart(2, "0"),
      val: logMap.get(d.toISOString().slice(0, 10)) === "done" ? 1 : 0,
    });
  }

  // ── Weekly summary (Mon → Sun of the current week) ────────────────────────
  const WEEK_LABELS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayOfWeek    = today.getDay();          // 0 = Sun … 6 = Sat
  const mondayOffset = (dayOfWeek + 6) % 7;    // days since Monday
  const monday       = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const weeklyDays = WEEK_LABELS.map((label, i) => {
    const d   = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { day: label, done: logMap.get(d.toISOString().slice(0, 10)) === "done" };
  });

  return { todayStatus, streak, successRate, chartData7d, chartData30d, weeklyDays };
}

// ─────────────────────────────────────────────
// PUBLIC API — FIRESTORE READS
// ─────────────────────────────────────────────

/**
 * Fetches the user profile document once.
 * @param {string} userId
 * @returns {Promise<{ name: string, avatarInitial: string }>}
 */
export async function fetchUser(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) throw new Error(`User not found: users/${userId}`);
  const data = snap.data();
  return {
    name:          data.name ?? "Friend",
    avatarInitial: (data.name ?? "F")[0].toUpperCase(),
  };
}

/**
 * Opens a real-time Firestore listener on the user's habits collection.
 * Whenever any habit document changes, re-fetches all logs and recomputes stats,
 * then calls onUpdate with the fully enriched habits array.
 *
 * @param {string}   userId
 * @param {Function} onUpdate  — receives Array of enriched habit objects
 * @param {Function} onError   — receives Error
 * @returns {Function} unsubscribe — call this in useEffect cleanup
 */
export function subscribeToHabits(userId, onUpdate, onError) {
  const habitsRef = collection(db, "users", userId, "habits");

  const unsubscribe = onSnapshot(
    habitsRef,
    async (snapshot) => {
      try {
        const habitPromises = snapshot.docs.map(async (habitDoc, index) => {
          const habitId   = habitDoc.id;
          const habitData = habitDoc.data();

          // Fetch this habit's log sub-collection, ordered oldest → newest
          const logsRef  = collection(db, "users", userId, "habits", habitId, "logs");
          const logsSnap = await getDocs(query(logsRef, orderBy("date", "asc")));
          const logs     = logsSnap.docs.map((d) => d.data());

          const stats = computeHabitStats(logs);

          return {
            id:           habitId,
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
      } catch (err) {
        onError(err);
      }
    },
    onError
  );

  return unsubscribe;
}

/**
 * Computes dashboard-level summary stats from the enriched habits array.
 * @param {Array} habits
 */
export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter((h) => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

  const habitsWithLogs = habits.filter((h) => h._rawLogs.length > 0);
  const successRate    =
    habitsWithLogs.length > 0
      ? Math.round(habitsWithLogs.reduce((s, h) => s + h.successRate, 0) / habitsWithLogs.length)
      : 0;

  return { totalHabits, doneToday, currentStreak, successRate };
}
