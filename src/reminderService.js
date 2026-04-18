// ═══════════════════════════════════════════════════════════════
// src/reminderService.js
// Handles:
//   1. Browser Push Notifications (in-app)
//   2. Google Calendar recurring reminder events
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// BROWSER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Request notification permission from the browser.
 * Returns: "granted" | "denied" | "default"
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Show an immediate browser notification (for testing).
 */
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

/**
 * Schedule a daily browser notification at a specific time (HH:MM).
 * Uses setTimeout — works while the browser tab is open.
 * Stores timer IDs in sessionStorage so we can cancel them.
 */
export function scheduleDailyNotification(habitId, habitName, habitIcon, timeStr) {
  cancelNotification(habitId); // cancel any existing timer for this habit

  const [hours, minutes] = timeStr.split(":").map(Number);
  const now    = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If time has already passed today, schedule for tomorrow
  if (target <= now) target.setDate(target.getDate() + 1);

  const delay  = target.getTime() - now.getTime();

  const timerId = setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`⏰ ${habitName}`, {
        body:  `Don't forget: ${habitName}! Keep your streak alive 🔥`,
        icon:  "/icon.png",
        tag:   `habit-${habitId}`,
      });
    }
    // Re-schedule for the next day
    scheduleDailyNotification(habitId, habitName, habitIcon, timeStr);
  }, delay);

  // Store timer ID
  const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
  timers[habitId] = timerId;
  sessionStorage.setItem("habitTimers", JSON.stringify(timers));

  console.log(`✅ Reminder set for "${habitName}" at ${timeStr} (in ${Math.round(delay/60000)} min)`);
}

/**
 * Cancel a scheduled browser notification for a habit.
 */
export function cancelNotification(habitId) {
  const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
  if (timers[habitId]) {
    clearTimeout(timers[habitId]);
    delete timers[habitId];
    sessionStorage.setItem("habitTimers", JSON.stringify(timers));
  }
}

/**
 * Re-schedule all active reminders on app load.
 * Call this once when the app starts.
 */
export function rescheduleAllReminders(habits) {
  if (Notification.permission !== "granted") return;
  habits.forEach(h => {
    if (h.reminderEnabled && h.reminderTime) {
      scheduleDailyNotification(h.id, h.name, h.icon, h.reminderTime);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// GOOGLE CALENDAR INTEGRATION
// ─────────────────────────────────────────────────────────────

/**
 * Builds the description for a Google Calendar habit reminder event.
 */
function buildEventDescription(habit) {
  return [
    `🎯 Habit: ${habit.name}`,
    `📅 Frequency: ${habit.frequency === "custom"
      ? habit.scheduledDays?.join(", ")
      : habit.frequency}`,
    ``,
    `Track your progress in Habit App by Tam.`,
    ``,
    `💪 Every day counts. Keep your streak going!`,
  ].join("\n");
}

/**
 * Builds the RRULE string for a habit's frequency.
 * daily   → every day
 * custom  → specific days (e.g. Mon, Wed, Fri → MO,WE,FR)
 */
function buildRRule(habit) {
  const dayMap = {
    Mon:"MO", Tue:"TU", Wed:"WE", Thu:"TH", Fri:"FR", Sat:"SA", Sun:"SU"
  };

  if (habit.frequency === "daily") {
    return "RRULE:FREQ=DAILY";
  }

  if (habit.frequency === "custom" && habit.scheduledDays?.length > 0) {
    const days = habit.scheduledDays.map(d => dayMap[d] || d).join(",");
    return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }

  return "RRULE:FREQ=DAILY";
}

/**
 * Creates a Google Calendar recurring reminder event for a habit.
 * Returns the created event object.
 *
 * NOTE: This is called from App.jsx which passes the gcal_create_event
 * function as a parameter — we don't call it directly here.
 * The actual Google Calendar API call happens in App.jsx via the
 * connected Google Calendar tool.
 */
export function buildCalendarEventPayload(habit, reminderTime, userTimezone = "Asia/Bangkok") {
  const [hours, minutes] = reminderTime.split(":").map(Number);
  const endHours         = hours === 23 ? 0 : hours;
  const endMinutes       = minutes + 15; // 15 min duration
  const today            = new Date().toISOString().slice(0, 10);

  const pad = n => String(n).padStart(2, "0");

  return {
    summary:     `${habit.icon} ${habit.name} Reminder`,
    description: buildEventDescription(habit),
    start: {
      dateTime: `${today}T${pad(hours)}:${pad(minutes)}:00`,
      timeZone: userTimezone,
    },
    end: {
      dateTime: `${today}T${pad(endHours)}:${pad(endMinutes > 59 ? endMinutes - 60 : endMinutes)}:00`,
      timeZone: userTimezone,
    },
    recurrence: [buildRRule(habit)],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 0  }, // alert exactly at reminder time
        { method: "popup", minutes: 10 }, // 10 min early warning
        { method: "email", minutes: 30 }, // email 30 min before
      ],
    },
    colorId: "11", // Tomato red — matches app theme
  };
}
