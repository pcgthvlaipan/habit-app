// ═══════════════════════════════════════════════════════════════
// src/firebase/habitService.js  — v6
// New: reward badges, calendar history, enhanced period stats
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

const auth = getAuth();

// ─── AUTH ────────────────────────────────────────────────────
export async function registerUser(e, p) { return createUserWithEmailAndPassword(auth, e, p); }
export async function loginUser(e, p)    { return signInWithEmailAndPassword(auth, e, p); }
export async function logoutUser()       { return signOut(auth); }
export function subscribeToAuth(cb)      { return onAuthStateChanged(auth, cb); }
export async function ensureUserDoc(uid, name) {
  await setDoc(doc(db,"users",uid), { name, createdAt: serverTimestamp() }, { merge: true });
}

// ─── 50 ICONS ────────────────────────────────────────────────
export const HABIT_ICON_OPTIONS = [
  // Fitness & Health
  { icon:"🏃", label:"Run"        },
  { icon:"💪", label:"Gym"        },
  { icon:"🚴", label:"Cycling"    },
  { icon:"🏊", label:"Swim"       },
  { icon:"🧘", label:"Yoga"       },
  { icon:"🚶", label:"Walk"       },
  { icon:"⛹️", label:"Sport"      },
  { icon:"🤸", label:"Stretch"    },
  { icon:"🏋️", label:"Weights"    },
  { icon:"🥊", label:"Boxing"     },
  // Food & Body
  { icon:"💧", label:"Water"      },
  { icon:"🥗", label:"Diet"       },
  { icon:"🍎", label:"Eat well"   },
  { icon:"🥤", label:"Smoothie"   },
  { icon:"🍵", label:"Tea"        },
  { icon:"☕", label:"Coffee"     },
  { icon:"💊", label:"Medicine"   },
  { icon:"🫀", label:"Cardio"     },
  { icon:"😴", label:"Sleep"      },
  { icon:"🛁", label:"Self care"  },
  // Mind & Learning
  { icon:"📖", label:"Read"       },
  { icon:"📚", label:"Study"      },
  { icon:"💻", label:"Code"       },
  { icon:"📝", label:"Journal"    },
  { icon:"🧠", label:"Learn"      },
  { icon:"🎓", label:"Course"     },
  { icon:"🗣️", label:"Language"   },
  { icon:"♟️", label:"Chess"      },
  { icon:"📰", label:"News"       },
  { icon:"🔬", label:"Research"   },
  // Creative
  { icon:"🎨", label:"Art"        },
  { icon:"🎵", label:"Music"      },
  { icon:"🎸", label:"Guitar"     },
  { icon:"🎹", label:"Piano"      },
  { icon:"✍️", label:"Write"      },
  { icon:"📸", label:"Photo"      },
  { icon:"🎬", label:"Video"      },
  { icon:"🧶", label:"Craft"      },
  { icon:"🎭", label:"Perform"    },
  { icon:"🖌️", label:"Paint"      },
  // Wellbeing & Life
  { icon:"🙏", label:"Gratitude"  },
  { icon:"🌿", label:"Nature"     },
  { icon:"🧹", label:"Clean"      },
  { icon:"💰", label:"Finance"    },
  { icon:"🌙", label:"Evening"    },
  { icon:"☀️", label:"Morning"    },
  { icon:"❤️", label:"Love"       },
  { icon:"👨‍👩‍👧", label:"Family"    },
  { icon:"🐾", label:"Pet"        },
  { icon:"🌍", label:"Eco"        },
];

// ─── REWARD BADGES ────────────────────────────────────────────
export const REWARD_BADGES = [
  // Streak rewards
  { id:"streak3",    icon:"🔥",   label:"3-Day Streak",      desc:"3 days in a row!",        type:"streak",  threshold:3   },
  { id:"streak7",    icon:"⚡",   label:"Week Warrior",       desc:"7 days streak!",          type:"streak",  threshold:7   },
  { id:"streak14",   icon:"💎",   label:"2-Week Champion",    desc:"14 days streak!",         type:"streak",  threshold:14  },
  { id:"streak30",   icon:"👑",   label:"Monthly Legend",     desc:"30 days streak!",         type:"streak",  threshold:30  },
  { id:"streak100",  icon:"🏆",   label:"Century Club",       desc:"100 days streak!",        type:"streak",  threshold:100 },
  // Completion rewards
  { id:"done10",     icon:"⭐",   label:"First 10",           desc:"Completed 10 habits",     type:"total",   threshold:10  },
  { id:"done50",     icon:"🌟",   label:"50 Done!",           desc:"Completed 50 habits",     type:"total",   threshold:50  },
  { id:"done100",    icon:"💫",   label:"Century Done",       desc:"100 habits completed",    type:"total",   threshold:100 },
  // Success rate rewards
  { id:"rate80",     icon:"🎯",   label:"Sharp Shooter",      desc:"80%+ success rate",       type:"rate",    threshold:80  },
  { id:"rate100",    icon:"✨",   label:"Perfect Week",       desc:"100% success this week",  type:"rate",    threshold:100 },
  // Collection rewards
  { id:"habit3",     icon:"🌈",   label:"Habit Collector",    desc:"Tracking 3+ habits",      type:"habits",  threshold:3   },
  { id:"habit5",     icon:"🦋",   label:"Habit Master",       desc:"Tracking 5+ habits",      type:"habits",  threshold:5   },
  // Special
  { id:"comeback",   icon:"💪",   label:"Comeback Kid",       desc:"Back after a miss!",      type:"special"                },
  { id:"morning",    icon:"🌅",   label:"Early Bird",         desc:"Logged before 8am",       type:"special"                },
  { id:"allday",     icon:"🌙",   label:"Full Day",           desc:"All habits done today",   type:"special"                },
];

/**
 * Computes which badges the user has earned based on their habit data.
 */
export function computeEarnedBadges(habits, summary) {
  const earned = [];
  const maxStreak     = habits.reduce((m,h) => Math.max(m, h.streak), 0);
  const totalDoneAll  = habits.reduce((s,h) => s + (h.totalDone ?? 0), 0);
  const avgRate       = summary?.successRate ?? 0;
  const habitCount    = habits.length;
  const allDoneToday  = habits.length > 0 && habits.every(h =>
    h.todayStatus === "done" || h.todayStatus === "not-scheduled"
  );

  for (const badge of REWARD_BADGES) {
    let earn = false;
    if (badge.type === "streak"  && maxStreak    >= badge.threshold) earn = true;
    if (badge.type === "total"   && totalDoneAll >= badge.threshold) earn = true;
    if (badge.type === "rate"    && avgRate       >= badge.threshold) earn = true;
    if (badge.type === "habits"  && habitCount    >= badge.threshold) earn = true;
    if (badge.id   === "allday"  && allDoneToday)                    earn = true;
    if (earn) earned.push(badge);
  }
  return earned;
}

// ─── CONSTANTS ────────────────────────────────────────────────
export const WEEK_DAYS    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_LABELS          = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HABIT_COLORS        = ["#34C77B","#FF6B6B","#4E8EF7","#A78BFA","#F59E0B","#E879A8","#14B8A6","#F97316","#8B5CF6","#06B6D4"];

function pickColor(i)  { return HABIT_COLORS[i % HABIT_COLORS.length]; }
function toDate(v)     {
  if (!v) return new Date(0);
  if (v instanceof Timestamp) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
}

// ─── STAT ENGINE ──────────────────────────────────────────────
function getScheduled(habit) {
  if (habit.frequency === "custom" && Array.isArray(habit.scheduledDays)) return habit.scheduledDays;
  return WEEK_DAYS;
}

function computeHabitStats(logs, habit) {
  const today      = new Date();
  const logMap     = new Map();
  for (const log of logs) {
    logMap.set(toDate(log.date).toISOString().slice(0,10), log.status);
  }

  const scheduled      = getScheduled(habit);
  const todayKey       = today.toISOString().slice(0,10);
  const todayDayName   = DAY_LABELS[today.getDay()];
  const isSchedToday   = habit.frequency === "daily" || scheduled.includes(todayDayName);
  const todayStatus    = isSchedToday ? (logMap.get(todayKey) ?? "none") : "not-scheduled";

  // Streak
  let streak = 0;
  const chk  = new Date(today);
  if (todayStatus === "none") chk.setDate(chk.getDate()-1);
  for (let i = 0; i < 400; i++) {
    const dn  = DAY_LABELS[chk.getDay()];
    const key = chk.toISOString().slice(0,10);
    const ok  = habit.frequency === "daily" || scheduled.includes(dn);
    if (!ok)                         { chk.setDate(chk.getDate()-1); continue; }
    if (logMap.get(key) === "done")  { streak++; chk.setDate(chk.getDate()-1); }
    else break;
  }

  // Success rate (last 30 days)
  const scheduledLogs = logs.filter(l => {
    const dn = DAY_LABELS[toDate(l.date).getDay()];
    return habit.frequency === "daily" || scheduled.includes(dn);
  });
  const doneLogs    = scheduledLogs.filter(l => l.status === "done").length;
  const successRate = scheduledLogs.length > 0 ? Math.round(doneLogs/scheduledLogs.length*100) : 0;

  // Build chart for any number of days
  function buildChart(days) {
    return Array.from({length:days}, (_,i) => {
      const d        = new Date(today);
      d.setDate(d.getDate() - (days-1-i));
      const key      = d.toISOString().slice(0,10);
      const dn       = DAY_LABELS[d.getDay()];
      const sched    = habit.frequency === "daily" || scheduled.includes(dn);
      const monthDay = `${d.getDate()}`;
      const label    = days <= 7 ? DAY_LABELS[d.getDay()].slice(0,3) : monthDay;
      return { day:label, date:key, val: logMap.get(key)==="done"?1:0, scheduled:sched, status: logMap.get(key) ?? (sched?"none":"not-scheduled"), fullDate: d };
    });
  }

  // Calendar history: build any date range
  function buildCalendar(startDate, endDate) {
    const result = [];
    const cur    = new Date(startDate);
    while (cur <= endDate) {
      const key  = cur.toISOString().slice(0,10);
      const dn   = DAY_LABELS[cur.getDay()];
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      result.push({
        date:      key,
        day:       cur.getDate(),
        dayName:   dn,
        month:     cur.getMonth(),
        status:    logMap.get(key) ?? (sched ? "none" : "not-scheduled"),
        scheduled: sched,
      });
      cur.setDate(cur.getDate()+1);
    }
    return result;
  }

  // Weekly Mon–Sun
  const dow    = today.getDay();
  const monOff = (dow+6)%7;
  const mon    = new Date(today); mon.setDate(today.getDate()-monOff);
  const weeklyDays = WEEK_DAYS.map((label,i) => {
    const d    = new Date(mon); d.setDate(mon.getDate()+i);
    const key  = d.toISOString().slice(0,10);
    const sched = habit.frequency === "daily" || scheduled.includes(label);
    return { day:label, done: logMap.get(key)==="done", scheduled:sched };
  });

  return {
    todayStatus, streak, successRate,
    chartData7d:  buildChart(7),
    chartData30d: buildChart(30),
    weeklyDays,
    buildChart,
    buildCalendar,
    totalDone:   doneLogs,
    totalLogged: scheduledLogs.length,
    logMap,
  };
}

// ─── READS ────────────────────────────────────────────────────
export async function fetchUser(uid) {
  const snap = await getDoc(doc(db,"users",uid));
  if (!snap.exists()) {
    await setDoc(doc(db,"users",uid), {name:"Tam",createdAt:serverTimestamp()},{merge:true});
    return {name:"Tam",avatarInitial:"T"};
  }
  const d = snap.data();
  return { name: d.name??"Friend", avatarInitial:(d.name??"F")[0].toUpperCase() };
}

export function subscribeToHabits(userId, onUpdate, onError) {
  return onSnapshot(collection(db,"users",userId,"habits"), async snap => {
    try {
      const habits = await Promise.all(snap.docs.map(async (hDoc, idx) => {
        const hd   = hDoc.data();
        const lSnap = await getDocs(query(collection(db,"users",userId,"habits",hDoc.id,"logs"), orderBy("date","asc")));
        const logs  = lSnap.docs.map(d => d.data());
        const obj   = {
          id:              hDoc.id,
          name:            hd.name            ?? "Unnamed",
          frequency:       hd.frequency        ?? "daily",
          scheduledDays:   hd.scheduledDays    ?? WEEK_DAYS,
          icon:            hd.icon             ?? "✨",
          color:           pickColor(idx),
          createdAt:       toDate(hd.createdAt),
          reminderEnabled: hd.reminderEnabled  ?? false,
          reminderTime:    hd.reminderTime     ?? "08:00",
          gcalEventId:     hd.gcalEventId      ?? null,
        };
        const stats = computeHabitStats(logs, obj);
        return { ...obj, ...stats, _rawLogs: logs };
      }));
      onUpdate(habits);
    } catch(e) { onError(e); }
  }, onError);
}

export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((m,h) => Math.max(m,h.streak), 0);
  const w             = habits.filter(h => h._rawLogs.length > 0);
  const successRate   = w.length > 0 ? Math.round(w.reduce((s,h)=>s+h.successRate,0)/w.length) : 0;
  return { totalHabits, doneToday, currentStreak, successRate };
}

// ─── WRITES ───────────────────────────────────────────────────

/**
 * Log today's status. Passing "none" deletes the log entry (uncheck).
 */
export async function logHabitToday(uid, hid, status) {
  const key = new Date().toISOString().slice(0,10);
  const ref = doc(db,"users",uid,"habits",hid,"logs",key);
  if (status === "none") {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { date:Timestamp.fromDate(new Date()), status });
  }
}

/**
 * Log a past date's status. Passing "none" removes the log (uncheck past day).
 */
export async function logHabitDate(uid, hid, dateStr, status) {
  const ref = doc(db,"users",uid,"habits",hid,"logs",dateStr);
  if (status === "none") {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { date:Timestamp.fromDate(new Date(dateStr)), status });
  }
}
export async function addHabit(uid, {name,frequency,scheduledDays,icon,reminderEnabled,reminderTime}) {
  await addDoc(collection(db,"users",uid,"habits"), {
    name, frequency,
    scheduledDays: scheduledDays ?? WEEK_DAYS,
    icon: icon ?? "✨",
    reminderEnabled: reminderEnabled ?? false,
    reminderTime:    reminderTime    ?? "08:00",
    gcalEventId:     null,
    createdAt:       serverTimestamp(),
  });
}
export async function editHabit(uid, hid, {name,frequency,scheduledDays,icon,reminderEnabled,reminderTime,gcalEventId}) {
  await updateDoc(doc(db,"users",uid,"habits",hid), {
    name, frequency,
    scheduledDays:   scheduledDays ?? WEEK_DAYS,
    icon,
    reminderEnabled: reminderEnabled ?? false,
    reminderTime:    reminderTime    ?? "08:00",
    gcalEventId:     gcalEventId     ?? null,
  });
}
export async function deleteHabit(uid, hid) {
  const snap = await getDocs(collection(db,"users",uid,"habits",hid,"logs"));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db,"users",uid,"habits",hid));
}
