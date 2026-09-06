// ═══════════════════════════════════════════════════════════════
// src/i18n-util.js — plain data + helpers for i18n
// Kept separate from i18n.jsx so that file only exports React
// components/hooks (keeps Fast Refresh happy).
// ═══════════════════════════════════════════════════════════════

export const LANGS = [
  { code: "th", label: "TH" },
  { code: "en", label: "EN" },
];

// Month names for the calendar header.
export const MONTH_NAMES = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  th: ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],
};

// Weekday short labels, Monday-first (matches WEEK_DAYS in habitService).
export const WEEKDAY_LABELS = {
  en: { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun" },
  th: { Mon: "จ.", Tue: "อ.", Wed: "พ.", Thu: "พฤ.", Fri: "ศ.", Sat: "ส.", Sun: "อา." },
};

// Resolve a REWARD_BADGES entry (id + icon) to display text in the active
// language. `t` is the translate fn from useT().
export function badgeText(t, badge) {
  return {
    ...badge,
    label: t(`badgeDefs.${badge.id}.label`),
    desc: t(`badgeDefs.${badge.id}.desc`),
  };
}
