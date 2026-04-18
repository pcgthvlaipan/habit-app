// ═══════════════════════════════════════════════════════════════
// src/reminderService.js
// Handles:
//   1. Browser Push Notifications (in-app)
//   2. Google Calendar recurring reminder events (direct URL)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// BROWSER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}

export function showTestNotification(habitName, icon = "✨") {
  if (Notification.permission !== "granted") return;
  new Notification(`Habit Reminder: ${habitName}`, {
    body:    `Time to ${habitName}! Keep your streak going 🔥`,
    icon:    "/icon.png",
    badge:   "/icon.png",
    tag:     `habit-${habitName}`,
    vibrate: [200, 100, 200],
  });
}

export function scheduleDailyNotification(habitId, habitName, habitIcon, timeStr) {
  cancelNotification(habitId);

  const [hours, minutes] = timeStr.split(":").map(Number);
  const now    = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) target.setDate(target.getDate() + 1);

  const delay = target.getTime() - now.getTime();

  const timerId = setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`⏰ ${habitName}`, {
        body: `Don't forget: ${habitName}! Keep your streak alive 🔥`,
        icon: "/icon.png",
        tag:  `habit-${habitId}`,
      });
    }
    scheduleDailyNotification(habitId, habitName, habitIcon, timeStr);
  }, delay);

  const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
  timers[habitId] = timerId;
  sessionStorage.setItem("habitTimers", JSON.stringify(timers));

  console.log(`✅ Reminder set for "${habitName}" at ${timeStr} (in ${Math.round(delay / 60000)} min)`);
}

export function cancelNotification(habitId) {
  const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
  if (timers[habitId]) {
    clearTimeout(timers[habitId]);
    delete timers[habitId];
    sessionStorage.setItem("habitTimers", JSON.stringify(timers));
  }
}

export function rescheduleAllReminders(habits) {
  if (Notification.permission !== "granted") return;
  habits.forEach(h => {
    if (h.reminderEnabled && h.reminderTime) {
      scheduleDailyNotification(h.id, h.name, h.icon, h.reminderTime);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// GOOGLE CALENDAR INTEGRATION — direct URL (no API key needed)
// ─────────────────────────────────────────────────────────────

const DAY_MAP = {
  Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA", Sun: "SU",
};

function buildRRule(habit) {
  if (habit.frequency === "custom" && habit.scheduledDays?.length > 0) {
    const days = habit.scheduledDays.map(d => DAY_MAP[d] || d).join(",");
    return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }
  return "RRULE:FREQ=DAILY";
}

/**
 * Opens Google Calendar in a new tab with a pre-filled recurring event.
 * No API key or OAuth needed — uses the public Google Calendar URL scheme.
 */
export function openGoogleCalendar(habit) {
  const { reminderTime, name, icon, frequency, scheduledDays } = habit;
  if (!reminderTime) return;

  const pad = n => String(n).padStart(2, "0");
  const [hours, minutes] = reminderTime.split(":").map(Number);

  // End time = start + 15 minutes
  const totalEndMinutes = hours * 60 + minutes + 15;
  const endH = Math.floor(totalEndMinutes / 60) % 24;
  const endM = totalEndMinutes % 60;

  // Today's date as YYYYMMDD
  const now       = new Date();
  const dateStr   = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const startStr  = `${dateStr}T${pad(hours)}${pad(minutes)}00`;
  const endStr    = `${dateStr}T${pad(endH)}${pad(endM)}00`;

  const freqLabel = frequency === "custom" && scheduledDays?.length
    ? scheduledDays.join(", ")
    : "daily";

  const description = [
    `🎯 Habit: ${name}`,
    `📅 Frequency: ${freqLabel}`,
    ``,
    `Track your progress in Habit App by Tam.`,
    `💪 Every day counts. Keep your streak going!`,
  ].join("\n");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action",  "TEMPLATE");
  url.searchParams.set("text",    `${icon} ${name} Reminder`);
  url.searchParams.set("dates",   `${startStr}/${endStr}`);
  url.searchParams.set("details", description);
  url.searchParams.set("recur",   buildRRule(habit));
  url.searchParams.set("ctz",     "Asia/Bangkok");
  url.searchParams.set("sf",      "true");
  url.searchParams.set("output",  "xml");

  window.open(url.toString(), "_blank");
}

// Kept for backward compatibility — no longer needed but won't break anything
export function buildCalendarEventPayload(habit, reminderTime, userTimezone = "Asia/Bangkok") {
  return {};
}
