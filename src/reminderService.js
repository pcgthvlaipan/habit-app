function getNotifPermission() {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  } catch(e) { return "unsupported"; }
}

export async function requestNotificationPermission() {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    const result = await Notification.requestPermission();
    return result;
  } catch(e) { return "unsupported"; }
}

export function showTestNotification(habitName, icon = "✨") {
  try {
    if (getNotifPermission() !== "granted") return;
    new Notification(`Habit Reminder: ${habitName}`, {
      body: `Time to ${habitName}! Keep your streak going 🔥`,
      icon: "/icon.png",
      tag: `habit-${habitName}`,
    });
  } catch(e) {}
}

export function scheduleDailyNotification(habitId, habitName, habitIcon, timeStr) {
  try {
    cancelNotification(habitId);
    if (getNotifPermission() !== "granted") return;
    const [hours, minutes] = timeStr.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - now.getTime();
    const timerId = setTimeout(() => {
      try {
        new Notification(`⏰ ${habitName}`, {
          body: `Don't forget: ${habitName}! Keep your streak alive 🔥`,
          icon: "/icon.png",
          tag: `habit-${habitId}`,
        });
      } catch(e) {}
      scheduleDailyNotification(habitId, habitName, habitIcon, timeStr);
    }, delay);
    const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
    timers[habitId] = timerId;
    sessionStorage.setItem("habitTimers", JSON.stringify(timers));
  } catch(e) {}
}

export function cancelNotification(habitId) {
  try {
    const timers = JSON.parse(sessionStorage.getItem("habitTimers") || "{}");
    if (timers[habitId]) {
      clearTimeout(timers[habitId]);
      delete timers[habitId];
      sessionStorage.setItem("habitTimers", JSON.stringify(timers));
    }
  } catch(e) {}
}

export function rescheduleAllReminders(habits) {
  try {
    if (getNotifPermission() !== "granted") return;
    habits.forEach(h => {
      if (h.reminderEnabled && h.reminderTime) {
        scheduleDailyNotification(h.id, h.name, h.icon, h.reminderTime);
      }
    });
  } catch(e) {}
}

const DAY_MAP = { Mon:"MO",Tue:"TU",Wed:"WE",Thu:"TH",Fri:"FR",Sat:"SA",Sun:"SU" };

function buildRRule(habit) {
  if (habit.frequency === "custom" && habit.scheduledDays?.length > 0) {
    const days = habit.scheduledDays.map(d => DAY_MAP[d] || d).join(",");
    return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }
  return "RRULE:FREQ=DAILY";
}

export function openGoogleCalendar(habit) {
  try {
    const { reminderTime, name, icon, frequency, scheduledDays } = habit;
    if (!reminderTime) return;
    const pad = n => String(n).padStart(2, "0");
    const [hours, minutes] = reminderTime.split(":").map(Number);
    const totalEndMinutes = hours * 60 + minutes + 15;
    const endH = Math.floor(totalEndMinutes / 60) % 24;
    const endM = totalEndMinutes % 60;
    const now = new Date();
    const dateStr  = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    const startStr = `${dateStr}T${pad(hours)}${pad(minutes)}00`;
    const endStr   = `${dateStr}T${pad(endH)}${pad(endM)}00`;
    const description = `🎯 Habit: ${name}\n📅 Frequency: ${frequency === "custom" && scheduledDays?.length ? scheduledDays.join(", ") : "daily"}\n\nTrack your progress in Habit App by Tam.`;
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
  } catch(e) {}
}

export function buildCalendarEventPayload() { return {}; }
