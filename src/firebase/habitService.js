// ═══════════════════════════════════════════════════════════════
// src/firebase/habitService.js
// DATA LAYER — Auth + Firestore reads & writes
//
// Auth exports:
//   loginUser(email, password)
//   registerUser(email, password)
//   logoutUser()
//   subscribeToAuth(callback)
//   ensureUserDoc(userId, name)
//
// Data exports:
//   fetchUser(userId)
//   subscribeToHabits(userId, onUpdate, onError)
//   computeSummary(habits)
//   logHabitToday(userId, habitId, status)
//   addHabit(userId, name, frequency)
// ═══════════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, addDoc,
  collection, getDocs,
  onSnapshot, query, orderBy,
  Timestamp, serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { db } from "./firebaseConfig";

// Get the Firebase Auth instance
const auth = getAuth();

// ─────────────────────────────────────────────────────────────
// AUTH FUNCTIONS
// ─────────────────────────────────────────────────────────────

/** Register a new user with email + password */
export async function registerUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Sign in an existing user */
export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Sign out the current user */
export async function logoutUser() {
  return signOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Callback receives: Firebase User object (logged in) or null (logged out)
 * Returns unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Creates the user profile document in Firestore after registration.
 * Safe to call multiple times — uses setDoc with merge:true.
 */
export async function ensureUserDoc(userId, name) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    name:      name,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// VISUAL CONFIG
// ─────────────────────────────────────────────────────────────
const HABIT_COLORS = [
  "#34C77B", "#FF6B6B", "#4E8EF7",
  "#A78BFA", "#F59E0B", "#E879A8",
];

const HABIT_ICONS = {
  exercise:"🏃", running:"🏃", reading:"📖", read:"📖",
  water:"💧", "drink water":"💧", meditation:"🧘",
  sleep:"😴", diet:"🥗", study:"📚", coding:"💻",
  journal:"📝", walk:"🚶", yoga:"🧘", gym:"🏋️",
};

function toDate(v) {
  if (!v) return new Date(0);
  if (v instanceof Timestamp) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
}
function pickIcon(name = "")  { return HABIT_ICONS[name.toLowerCase().trim()] ?? "✨"; }
function pickColor(index)      { return HABIT_COLORS[index % HABIT_COLORS.length]; }

// ─────────────────────────────────────────────────────────────
// STAT CALCULATIONS
// ─────────────────────────────────────────────────────────────
function computeHabitStats(logs) {
  const today  = new Date();
  const logMap = new Map();

  for (const log of logs) {
    const key = toDate(log.date).toISOString().slice(0, 10);
    logMap.set(key, log.status);
  }

  const todayKey    = today.toISOString().slice(0, 10);
  const todayStatus = logMap.get(todayKey) ?? "none";

  // Streak: walk backwards from today
  let streak = 0;
  const check = new Date(today);
  if (todayStatus === "none") check.setDate(check.getDate() - 1);
  while (true) {
    const key = check.toISOString().slice(0, 10);
    if (logMap.get(key) === "done") { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }

  // Success rate
  const total       = logs.length;
  const done        = logs.filter(l => l.status === "done").length;
  const successRate = total > 0 ? Math.round(done / total * 100) : 0;

  // 7-day chart
  const DAYS      = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const chartData7d = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    chartData7d.push({
      day: DAYS[d.getDay()],
      val: logMap.get(d.toISOString().slice(0,10)) === "done" ? 1 : 0,
    });
  }

  // 30-day chart
  const chartData30d = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    chartData30d.push({
      day: String(d.getDate()).padStart(2, "0"),
      val: logMap.get(d.toISOString().slice(0,10)) === "done" ? 1 : 0,
    });
  }

  // Weekly Mon–Sun
  const WEEK         = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayOfWeek    = today.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday       = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const weeklyDays = WEEK.map((label, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { day: label, done: logMap.get(d.toISOString().slice(0,10)) === "done" };
  });

  return { todayStatus, streak, successRate, chartData7d, chartData30d, weeklyDays };
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE READS
// ─────────────────────────────────────────────────────────────

/** Fetch the user profile document once */
export async function fetchUser(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) {
    // Auto-create a minimal doc if missing (e.g. older accounts)
    await setDoc(doc(db, "users", userId), { name: "Tam", createdAt: serverTimestamp() }, { merge: true });
    return { name: "Tam", avatarInitial: "T" };
  }
  const data = snap.data();
  return {
    name:          data.name ?? "Friend",
    avatarInitial: (data.name ?? "F")[0].toUpperCase(),
  };
}

/** Real-time subscription to habits + computed stats */
export function subscribeToHabits(userId, onUpdate, onError) {
  const habitsRef = collection(db, "users", userId, "habits");

  return onSnapshot(habitsRef, async (snapshot) => {
    try {
      const promises = snapshot.docs.map(async (habitDoc, index) => {
        const habitId   = habitDoc.id;
        const habitData = habitDoc.data();

        const logsRef  = collection(db, "users", userId, "habits", habitId, "logs");
        const logsSnap = await getDocs(query(logsRef, orderBy("date", "asc")));
        const logs     = logsSnap.docs.map(d => d.data());
        const stats    = computeHabitStats(logs);

        return {
          id:           habitId,
          name:         habitData.name      ?? "Unnamed Habit",
          frequency:    habitData.frequency  ?? "daily",
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

      onUpdate(await Promise.all(promises));
    } catch (err) {
      onError(err);
    }
  }, onError);
}

/** Compute dashboard-level summary from enriched habits array */
export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const withLogs      = habits.filter(h => h._rawLogs.length > 0);
  const successRate   = withLogs.length > 0
    ? Math.round(withLogs.reduce((s, h) => s + h.successRate, 0) / withLogs.length)
    : 0;
  return { totalHabits, doneToday, currentStreak, successRate };
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE WRITES
// ─────────────────────────────────────────────────────────────

/**
 * Log today's status for a habit.
 * Uses today's date as the document ID — one log per day per habit.
 * Calling this again today overwrites the previous entry.
 */
export async function logHabitToday(userId, habitId, status) {
  const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const logRef   = doc(db, "users", userId, "habits", habitId, "logs", todayKey);
  await setDoc(logRef, {
    date:   Timestamp.fromDate(new Date()),
    status: status, // "done" or "missed"
  });
}

/**
 * Add a new habit document to the user's habits sub-collection.
 */
export async function addHabit(userId, name, frequency) {
  const habitsRef = collection(db, "users", userId, "habits");
  await addDoc(habitsRef, {
    name:      name,
    frequency: frequency,
    createdAt: serverTimestamp(),
  });
}
