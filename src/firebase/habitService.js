// ═══════════════════════════════════════════════════════════════
// src/firebase/habitService.js  — Full featured version
// New features:
//   ✅ Custom frequency: daily, weekly, specific days
//   ✅ Custom icons
//   ✅ Edit & delete habits
//   ✅ 30-day + custom period stats
//   ✅ Per-habit detailed statistics
// ═══════════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
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

const auth = getAuth();

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────
export async function registerUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}
export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export async function logoutUser() {
  return signOut(auth);
}
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
export async function ensureUserDoc(userId, name) {
  await setDoc(doc(db, "users", userId), {
    name, createdAt: serverTimestamp(),
  }, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// AVAILABLE ICONS for habits
// ─────────────────────────────────────────────────────────────
export const HABIT_ICON_OPTIONS = [
  { icon: "🏃", label: "Run"        },
  { icon: "💧", label: "Water"      },
  { icon: "📖", label: "Read"       },
  { icon: "🧘", label: "Meditate"   },
  { icon: "💪", label: "Gym"        },
  { icon: "🥗", label: "Diet"       },
  { icon: "😴", label: "Sleep"      },
  { icon: "📚", label: "Study"      },
  { icon: "💻", label: "Code"       },
  { icon: "📝", label: "Journal"    },
  { icon: "🚶", label: "Walk"       },
  { icon: "🎯", label: "Goal"       },
  { icon: "🎨", label: "Create"     },
  { icon: "🎵", label: "Music"      },
  { icon: "🧹", label: "Clean"      },
  { icon: "🌿", label: "Nature"     },
  { icon: "❤️", label: "Health"     },
  { icon: "🙏", label: "Gratitude"  },
  { icon: "📸", label: "Photo"      },
  { icon: "🍎", label: "Eat well"   },
  { icon: "☕", label: "Morning"    },
  { icon: "🌙", label: "Evening"    },
  { icon: "💊", label: "Medicine"   },
  { icon: "🧠", label: "Learn"      },
];

export const WEEK_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const HABIT_COLORS = [
  "#34C77B","#FF6B6B","#4E8EF7",
  "#A78BFA","#F59E0B","#E879A8",
  "#14B8A6","#F97316","#8B5CF6",
];

function pickColor(index) {
  return HABIT_COLORS[index % HABIT_COLORS.length];
}

function toDate(v) {
  if (!v) return new Date(0);
  if (v instanceof Timestamp) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
}

// ─────────────────────────────────────────────────────────────
// STAT CALCULATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Returns array of scheduled day keys ("Mon","Tue"...) for a habit.
 * daily   → all 7 days
 * weekly  → all 7 days (log any day)
 * custom  → the specific days chosen
 */
function getScheduledDays(habit) {
  if (habit.frequency === "custom" && Array.isArray(habit.scheduledDays)) {
    return habit.scheduledDays;
  }
  return WEEK_DAYS;
}

const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function computeHabitStats(logs, habit) {
  const today  = new Date();
  const logMap = new Map();

  for (const log of logs) {
    const key = toDate(log.date).toISOString().slice(0, 10);
    logMap.set(key, log.status);
  }

  const scheduledDays = getScheduledDays(habit);
  const todayKey      = today.toISOString().slice(0, 10);
  const todayDayName  = DAY_LABELS[today.getDay()];
  const isScheduledToday = habit.frequency === "daily"
    ? true
    : scheduledDays.includes(todayDayName);

  const todayStatus = isScheduledToday
    ? (logMap.get(todayKey) ?? "none")
    : "not-scheduled";

  // ── Streak ────────────────────────────────────────────────────
  let streak = 0;
  const check = new Date(today);
  if (todayStatus === "none") check.setDate(check.getDate() - 1);

  while (true) {
    const dayName = DAY_LABELS[check.getDay()];
    const key     = check.toISOString().slice(0, 10);
    const isScheduled = habit.frequency === "daily" || scheduledDays.includes(dayName);

    if (!isScheduled) {
      // skip non-scheduled days silently
      check.setDate(check.getDate() - 1);
      if (streak === 0 && check < new Date(today.getTime() - 30 * 86400000)) break;
      continue;
    }
    if (logMap.get(key) === "done") {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Success rate ──────────────────────────────────────────────
  const scheduledLogs = logs.filter(l => {
    const d       = toDate(l.date);
    const dayName = DAY_LABELS[d.getDay()];
    return habit.frequency === "daily" || scheduledDays.includes(dayName);
  });
  const doneLogs    = scheduledLogs.filter(l => l.status === "done").length;
  const successRate = scheduledLogs.length > 0
    ? Math.round(doneLogs / scheduledLogs.length * 100)
    : 0;

  // ── Chart — last N days ───────────────────────────────────────
  function buildChart(days) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d       = new Date(today);
      d.setDate(d.getDate() - i);
      const key     = d.toISOString().slice(0, 10);
      const dayName = DAY_LABELS[d.getDay()];
      const label   = days <= 7 ? dayName : String(d.getDate()).padStart(2,"0");
      const scheduled = habit.frequency === "daily" || scheduledDays.includes(dayName);
      result.push({
        day:       label,
        val:       logMap.get(key) === "done" ? 1 : 0,
        scheduled,
        missed:    scheduled && logMap.get(key) === "missed",
      });
    }
    return result;
  }

  const chartData7d  = buildChart(7);
  const chartData30d = buildChart(30);

  // ── Weekly Mon–Sun ────────────────────────────────────────────
  const dayOfWeek    = today.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday       = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const weeklyDays = WEEK_DAYS.map((label, i) => {
    const d         = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key       = d.toISOString().slice(0, 10);
    const scheduled = habit.frequency === "daily" || scheduledDays.includes(label);
    return {
      day:       label,
      done:      logMap.get(key) === "done",
      scheduled,
    };
  });

  // ── Detailed per-day history (last 30) ────────────────────────
  const history = [];
  for (let i = 29; i >= 0; i--) {
    const d         = new Date(today);
    d.setDate(d.getDate() - i);
    const key       = d.toISOString().slice(0, 10);
    const dayName   = DAY_LABELS[d.getDay()];
    const scheduled = habit.frequency === "daily" || scheduledDays.includes(dayName);
    history.push({
      date:      key,
      dayName,
      status:    logMap.get(key) ?? (scheduled ? "none" : "not-scheduled"),
      scheduled,
    });
  }

  return {
    todayStatus, streak, successRate,
    chartData7d, chartData30d,
    weeklyDays, history,
    totalDone:   doneLogs,
    totalLogged: scheduledLogs.length,
  };
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE READS
// ─────────────────────────────────────────────────────────────
export async function fetchUser(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) {
    await setDoc(doc(db, "users", userId), { name: "Tam", createdAt: serverTimestamp() }, { merge: true });
    return { name: "Tam", avatarInitial: "T" };
  }
  const data = snap.data();
  return {
    name:          data.name ?? "Friend",
    avatarInitial: (data.name ?? "F")[0].toUpperCase(),
  };
}

export function subscribeToHabits(userId, onUpdate, onError) {
  const habitsRef = collection(db, "users", userId, "habits");
  return onSnapshot(habitsRef, async (snapshot) => {
    try {
      const promises = snapshot.docs.map(async (habitDoc, index) => {
        const habitId   = habitDoc.id;
        const habitData = habitDoc.data();
        const logsRef   = collection(db, "users", userId, "habits", habitId, "logs");
        const logsSnap  = await getDocs(query(logsRef, orderBy("date", "asc")));
        const logs      = logsSnap.docs.map(d => d.data());

        const habitObj = {
          id:            habitId,
          name:          habitData.name        ?? "Unnamed",
          frequency:     habitData.frequency    ?? "daily",
          scheduledDays: habitData.scheduledDays ?? WEEK_DAYS,
          icon:          habitData.icon          ?? "✨",
          color:         pickColor(index),
          createdAt:     toDate(habitData.createdAt),
        };

        const stats = computeHabitStats(logs, habitObj);

        return { ...habitObj, ...stats, _rawLogs: logs };
      });
      onUpdate(await Promise.all(promises));
    } catch(err) { onError(err); }
  }, onError);
}

export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h =>
    h.todayStatus === "done" || h.todayStatus === "not-scheduled"
      ? false : h.todayStatus === "done"
  ).length;
  const scheduledToday = habits.filter(h => h.todayStatus !== "not-scheduled").length;
  const actualDone     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak  = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const withLogs       = habits.filter(h => h._rawLogs.length > 0);
  const successRate    = withLogs.length > 0
    ? Math.round(withLogs.reduce((s, h) => s + h.successRate, 0) / withLogs.length)
    : 0;
  return { totalHabits, doneToday: actualDone, scheduledToday, currentStreak, successRate };
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE WRITES
// ─────────────────────────────────────────────────────────────

/** Log today's status */
export async function logHabitToday(userId, habitId, status) {
  const todayKey = new Date().toISOString().slice(0, 10);
  await setDoc(
    doc(db, "users", userId, "habits", habitId, "logs", todayKey),
    { date: Timestamp.fromDate(new Date()), status }
  );
}

/** Add new habit */
export async function addHabit(userId, { name, frequency, scheduledDays, icon }) {
  await addDoc(collection(db, "users", userId, "habits"), {
    name,
    frequency,
    scheduledDays: scheduledDays ?? WEEK_DAYS,
    icon:          icon ?? "✨",
    createdAt:     serverTimestamp(),
  });
}

/** Edit existing habit */
export async function editHabit(userId, habitId, { name, frequency, scheduledDays, icon }) {
  await updateDoc(doc(db, "users", userId, "habits", habitId), {
    name,
    frequency,
    scheduledDays: scheduledDays ?? WEEK_DAYS,
    icon,
  });
}

/** Delete habit and all its logs */
export async function deleteHabit(userId, habitId) {
  // Delete all logs first
  const logsRef  = collection(db, "users", userId, "habits", habitId, "logs");
  const logsSnap = await getDocs(logsRef);
  const deletes  = logsSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletes);
  // Then delete the habit document
  await deleteDoc(doc(db, "users", userId, "habits", habitId));
}
