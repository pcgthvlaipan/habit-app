// ═══════════════════════════════════════════════════════════════
// src/services/habitService.js  — v10 (Supabase)
// Data + auth layer. All pure stat/badge logic is unchanged from the
// Firestore version; only the I/O functions were rewritten.
// ═══════════════════════════════════════════════════════════════
import { supabase } from "../supabase/client";

// ─── AUTH ────────────────────────────────────────────────────
function shapeUser(u) {
  return u ? { uid: u.id, email: u.email ?? null } : u;
}

function normalizeAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  let code = "auth/unknown";
  if (msg.includes("invalid login credentials"))                 code = "auth/invalid-credential";
  else if (msg.includes("already registered") ||
           msg.includes("already been registered"))              code = "auth/email-already-in-use";
  else if (msg.includes("should be at least") ||
           msg.includes("password"))                             code = "auth/weak-password";
  else if (msg.includes("unable to validate email") ||
           msg.includes("invalid format") ||
           msg.includes("invalid email"))                        code = "auth/invalid-email";
  else if (msg.includes("email not confirmed"))                  code = "auth/email-not-confirmed";
  const e = new Error(error?.message || "Authentication error");
  e.code = code;
  return e;
}

// name + department ride along as user metadata; a DB trigger copies them into
// the profiles row (works even if email confirmation is on).
export async function registerUser(email, password, { name, department } = {}) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name: name ?? null, department: department ?? null } },
  });
  if (error) throw normalizeAuthError(error);
  return { user: shapeUser(data.user) };
}

export async function loginUser(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw normalizeAuthError(error);
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

// onUser(user|null) — user is null when signed out, called once with the initial
// session then on every change. onRecovery() fires when the user arrives via a
// password-reset link (App then shows the "set new password" screen).
export function subscribeToAuth(onUser, onRecovery) {
  supabase.auth.getSession().then(({ data }) => onUser(shapeUser(data.session?.user ?? null)));
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { onRecovery?.(); return; }
    onUser(shapeUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

export async function sendPasswordReset(email) {
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw normalizeAuthError(error);
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw normalizeAuthError(error);
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
export const POINTS_FULL = 10;
export const POINTS_PARTIAL = 5;

export const REWARD_BADGES = [
  { id: "firststep",  icon: "🌱", type: "milestone", threshold: 1 },
  { id: "smallwins",  icon: "🪜", type: "milestone", threshold: 5 },
  { id: "partialhero",icon: "◑",  type: "partial",   threshold: 3 },
  { id: "points100",  icon: "⚡", type: "points",    threshold: 100 },
  { id: "points500",  icon: "💠", type: "points",    threshold: 500 },
  { id: "perfectweek",icon: "✨", type: "week" },
  { id: "streak3",   icon: "🔥", type: "streak", threshold: 3 },
  { id: "streak7",   icon: "⭐", type: "streak", threshold: 7 },
  { id: "streak14",  icon: "💎", type: "streak", threshold: 14 },
  { id: "streak30",  icon: "👑", type: "streak", threshold: 30 },
  { id: "streak100", icon: "🏆", type: "streak", threshold: 100 },
  { id: "done10",    icon: "✅", type: "total",  threshold: 10 },
  { id: "done50",    icon: "🌟", type: "total",  threshold: 50 },
  { id: "done100",   icon: "💫", type: "total",  threshold: 100 },
  { id: "rate80",    icon: "🎯", type: "rate",   threshold: 80 },
  { id: "habit3",    icon: "🌈", type: "habits", threshold: 3 },
  { id: "habit5",    icon: "🦋", type: "habits", threshold: 5 },
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
export function bangkokDate(utcDate = new Date()) {
  return new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
}

export function bangkokKey(utcDate = new Date()) {
  const bkk = bangkokDate(utcDate);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bkk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bangkokDayLabel(utcDate) {
  return DAY_LABELS[bangkokDate(utcDate).getUTCDay()];
}

// Weekday label for a "YYYY-MM-DD" key (a Bangkok calendar day). Parsed at UTC
// noon so it can never roll to a neighbouring day.
function dayLabelFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

// ─── CONSTANTS ────────────────────────────────────────────────
export const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_LABELS        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HABIT_COLORS      = [
  "#34C77B","#FF6B6B","#4E8EF7","#A78BFA","#F59E0B",
  "#E879A8","#14B8A6","#F97316","#8B5CF6","#06B6D4",
];
function pickColor(i) { return HABIT_COLORS[i % HABIT_COLORS.length]; }

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

// ─── PARTIAL-COMPLETION CREDIT ───────────────────────────────
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

// `logs` here is an array of { date: "YYYY-MM-DD", status, partial, loggedAt }.
// `date` is already the Bangkok calendar day, so it is used directly as the key.
function computeHabitStats(logs, habit) {
  const today  = new Date();
  const logMap     = new Map(); // key → status
  const partialMap = new Map(); // key → partial object

  for (const log of logs) {
    logMap.set(log.date, log.status);
    if (log.partial) partialMap.set(log.date, log.partial);
  }

  const scheduled    = getScheduled(habit);
  const todayKey     = bangkokKey(today);
  const todayDayName = bangkokDayLabel(today);
  const isSchedToday = habit.frequency === "daily" || scheduled.includes(todayDayName);
  const rawToday     = isSchedToday ? (logMap.get(todayKey) ?? "none") : "not-scheduled";
  const todayPartial = partialMap.get(todayKey) ?? null;
  const todayStatus  = isFullDone(rawToday, todayPartial) || rawToday !== "done"
    ? rawToday
    : "partial";

  // Streak — a partial day BREAKS the streak (same as a miss).
  let streak = 0;
  const chk = new Date(today);
  if (rawToday === "none") chk.setDate(chk.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const dn  = bangkokDayLabel(chk);
    const key = bangkokKey(chk);
    const ok  = habit.frequency === "daily" || scheduled.includes(dn);
    if (!ok) { chk.setDate(chk.getDate() - 1); continue; }
    if (isFullDone(logMap.get(key), partialMap.get(key))) { streak++; chk.setDate(chk.getDate() - 1); }
    else break;
  }

  // Success rate — partial (pct < 100) worth 0.5, full done 1.
  const scheduledLogs = logs.filter(l => {
    const dn = dayLabelFromKey(l.date);
    return habit.frequency === "daily" || scheduled.includes(dn);
  });
  const doneCreditTotal = scheduledLogs.reduce((s, l) => s + doneCredit(l.status, l.partial), 0);
  const fullDoneLogs    = scheduledLogs.filter(l => isFullDone(l.status, l.partial)).length;
  const successRate = scheduledLogs.length > 0
    ? Math.round((doneCreditTotal / scheduledLogs.length) * 100) : 0;

  function buildChart(days) {
    return Array.from({ length: days }, (_, i) => {
      const d     = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key   = bangkokKey(d);
      const dn    = bangkokDayLabel(d);
      const sched = habit.frequency === "daily" || scheduled.includes(dn);
      const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
      const partial = partialMap.get(key) ?? null;
      const label   = days <= 7 ? dn.slice(0, 3) : `${d.getDate()}`;
      const val = status === "done"
        ? (partial ? (partial.pct / 100) : 1)
        : 0;
      return { day: label, date: key, val, status, partial, scheduled: sched, fullDate: d };
    });
  }

  function buildCalendar(startDate, endDate) {
    const result = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key   = bangkokKey(cur);
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
    const key   = bangkokKey(d);
    const sched = habit.frequency === "daily" || scheduled.includes(label);
    const status  = logMap.get(key) ?? (sched ? "none" : "not-scheduled");
    const partial = partialMap.get(key) ?? null;
    if (sched && key <= todayKey) {
      weekScheduled++;
      if (status === "done") weekDone++;
    }
    return { day: label, done: status === "done", scheduled: sched, partial };
  });

  // ── Small-win signals ──
  const points = logs.reduce((s, l) => {
    if (isFullDone(l.status, l.partial)) return s + POINTS_FULL;
    if (l.status === "done") return s + POINTS_PARTIAL;
    return s;
  }, 0);
  const partialCount = logs.filter(
    l => l.status === "done" && l.partial && (l.partial.pct ?? 100) < 100
  ).length;
  const hasEarlyLog = logs.some(l => {
    if (l.status !== "done" || !l.loggedAt) return false;
    return bangkokDate(new Date(l.loggedAt)).getUTCHours() < 8;
  });
  const chronological = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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
    totalDone: fullDoneLogs, totalLogged: scheduledLogs.length, logMap,
    points, partialCount, weekScheduled, weekDone, hasEarlyLog, hasComeback,
  };
}

// ─── READS ────────────────────────────────────────────────────
export async function fetchUser(uid) {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  if (!data) return { name: "Friend", avatarInitial: "F", email: null, department: null, isAdmin: false };
  const name = data.name || "Friend";
  return {
    name,
    avatarInitial: name[0].toUpperCase(),
    email: data.email ?? null,
    department: data.department ?? null,
    isAdmin: data.is_admin === true,
  };
}

function toRawLog(row) {
  return { date: row.log_date, status: row.status, partial: row.partial ?? null, loggedAt: row.logged_at };
}

function shapeHabit(row, idx) {
  return {
    id:              row.id,
    name:            row.name ?? "Unnamed",
    frequency:       row.frequency ?? "daily",
    scheduledDays:   row.scheduled_days ?? WEEK_DAYS,
    icon:            row.icon ?? "✨",
    color:           pickColor(idx),
    createdAt:       row.created_at ? new Date(row.created_at) : new Date(0),
    reminderEnabled: row.reminder_enabled ?? false,
    reminderTime:    row.reminder_time ?? "08:00",
    gcalEventId:     row.gcal_event_id ?? null,
    targetValue:     row.target_value ?? null,
    unit:            row.unit ?? null,
  };
}

// Live habits + logs. Realtime channels on both tables trigger a reload; every
// emit runs the full stat engine so the UI always has fresh chart/streak data.
export function subscribeToHabits(userId, onUpdate, onError) {
  let habitRows = [];
  let logRows   = [];
  let closed    = false;

  function emit() {
    if (closed) return;
    try {
      const logsByHabit = new Map();
      for (const lr of logRows) {
        if (!logsByHabit.has(lr.habit_id)) logsByHabit.set(lr.habit_id, []);
        logsByHabit.get(lr.habit_id).push(toRawLog(lr));
      }
      const habits = habitRows.map((row, idx) => {
        const obj  = shapeHabit(row, idx);
        const raw  = logsByHabit.get(row.id) ?? [];
        const stats = computeHabitStats(raw, obj);
        return { ...obj, ...stats, _rawLogs: raw };
      });
      onUpdate(habits);
    } catch (e) { onError(e); }
  }

  async function reload() {
    const [h, l] = await Promise.all([
      supabase.from("habits").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("logs").select("*").eq("user_id", userId).order("log_date", { ascending: true }),
    ]);
    if (closed) return;
    if (h.error) { onError(h.error); return; }
    if (l.error) { onError(l.error); return; }
    habitRows = h.data ?? [];
    logRows   = l.data ?? [];
    emit();
  }

  reload();

  const channel = supabase
    .channel(`habits:${userId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${userId}` }, reload)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "logs", filter: `user_id=eq.${userId}` }, reload)
    .subscribe();

  return () => { closed = true; supabase.removeChannel(channel); };
}

export function computeSummary(habits) {
  const totalHabits   = habits.length;
  const doneToday     = habits.filter(h => h.todayStatus === "done").length;
  const currentStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  const w             = habits.filter(h => h._rawLogs.length > 0);
  const successRate   = w.length > 0
    ? Math.round(w.reduce((s, h) => s + h.successRate, 0) / w.length) : 0;

  const totalPoints     = habits.reduce((s, h) => s + (h.points ?? 0), 0);
  const weeklyScheduled = habits.reduce((s, h) => s + (h.weekScheduled ?? 0), 0);
  const weeklyDone      = habits.reduce((s, h) => s + (h.weekDone ?? 0), 0);
  const weeklyComplete  = weeklyScheduled > 0 && weeklyDone >= weeklyScheduled;

  return {
    totalHabits, doneToday, currentStreak, successRate,
    totalPoints, weeklyScheduled, weeklyDone, weeklyComplete,
  };
}

// ─── DEPARTMENTS ─────────────────────────────────────────────
export async function fetchDepartments() {
  try {
    const { data } = await supabase
      .from("app_config").select("value").eq("key", "departments").maybeSingle();
    const list = data?.value?.list;
    if (Array.isArray(list) && list.length) return list;
  } catch { /* fall through */ }
  return DEFAULT_DEPARTMENTS;
}

export function subscribeToDepartments(cb) {
  let cancelled = false;
  fetchDepartments().then(l => { if (!cancelled) cb(l); });
  const channel = supabase
    .channel("app_config:departments")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "app_config", filter: "key=eq.departments" },
      payload => {
        const list = payload.new?.value?.list;
        if (!cancelled) cb(Array.isArray(list) && list.length ? list : DEFAULT_DEPARTMENTS);
      })
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

export async function addDepartment(name) {
  const clean = name.trim();
  if (!clean) return;
  const current = await fetchDepartments();
  if (current.some(d => d.toLowerCase() === clean.toLowerCase())) return;
  const next = [...current, clean].sort((a, b) => a.localeCompare(b));
  const { error } = await supabase.from("app_config")
    .upsert({ key: "departments", value: { list: next }, updated_at: new Date().toISOString() },
            { onConflict: "key" });
  if (error) throw error;
}

export async function removeDepartment(name) {
  const current = await fetchDepartments();
  const next = current.filter(d => d !== name);
  const { error } = await supabase.from("app_config")
    .update({ value: { list: next }, updated_at: new Date().toISOString() })
    .eq("key", "departments");
  if (error) throw error;
}

// ─── WRITES ───────────────────────────────────────────────────
export async function logHabitToday(uid, hid, status, partial) {
  const key = bangkokKey();
  if (status === "none") {
    const { error } = await supabase.from("logs").delete().eq("habit_id", hid).eq("log_date", key);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("logs").upsert({
    habit_id: hid, user_id: uid, log_date: key, status,
    partial: partial ?? null, logged_at: new Date().toISOString(),
  }, { onConflict: "habit_id,log_date" });
  if (error) throw error;
}

export async function logHabitDate(uid, hid, dateStr, status) {
  if (status === "none") {
    const { error } = await supabase.from("logs").delete().eq("habit_id", hid).eq("log_date", dateStr);
    if (error) throw error;
    return;
  }
  // Calendar toggle only ever sets a plain "done" or "missed".
  //  - "done"   → clear any stored partial (the day is marked fully complete).
  //  - "missed" → leave partial untouched (omitted column is preserved on upsert).
  const row = { habit_id: hid, user_id: uid, log_date: dateStr, status };
  if (status === "done") row.partial = null;
  const { error } = await supabase.from("logs").upsert(row, { onConflict: "habit_id,log_date" });
  if (error) throw error;
}

export async function addHabit(uid, {
  name, frequency, scheduledDays, icon, reminderEnabled, reminderTime, targetValue, unit,
}) {
  const { error } = await supabase.from("habits").insert({
    user_id:          uid,
    name,
    frequency,
    scheduled_days:   scheduledDays ?? WEEK_DAYS,
    icon:             icon ?? "✨",
    reminder_enabled: reminderEnabled ?? false,
    reminder_time:    reminderTime ?? "08:00",
    target_value:     targetValue ?? null,
    unit:             unit ?? null,
  });
  if (error) throw error;
}

export async function editHabit(uid, hid, {
  name, frequency, scheduledDays, icon, reminderEnabled, reminderTime, gcalEventId, targetValue, unit,
}) {
  const { error } = await supabase.from("habits").update({
    name,
    frequency,
    scheduled_days:   scheduledDays ?? WEEK_DAYS,
    icon,
    reminder_enabled: reminderEnabled ?? false,
    reminder_time:    reminderTime ?? "08:00",
    gcal_event_id:    gcalEventId ?? null,
    target_value:     targetValue ?? null,
    unit:             unit ?? null,
  }).eq("id", hid);
  if (error) throw error;
}

export async function deleteHabit(uid, hid) {
  // logs cascade via the habit_id foreign key.
  const { error } = await supabase.from("habits").delete().eq("id", hid);
  if (error) throw error;
}
