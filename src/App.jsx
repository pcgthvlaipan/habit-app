// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  (Interactive version)
// Features added:
//   ✅ Log "Done" or "Missed" directly from habit card
//   ✅ Add new habit via bottom sheet modal
//   ✅ Floating action button (+)
//   ✅ Real-time Firestore sync
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import "./App.css";
import {
  fetchUser,
  subscribeToHabits,
  computeSummary,
  logHabitToday,
  addHabit,
  USER_ID,
} from "./firebase/habitService";

// ─── Greeting ───────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user,          setUser]          = useState(null);
  const [habits,        setHabits]        = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [chartPeriod,   setChartPeriod]   = useState("7");
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [logging,       setLogging]       = useState({}); // habitId → true while saving

  useEffect(() => {
    fetchUser(USER_ID).then(setUser).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    const unsub = subscribeToHabits(
      USER_ID,
      (fresh) => {
        setHabits(fresh);
        setSummary(computeSummary(fresh));
        setSelectedHabit(prev => {
          if (!prev) return fresh[0] ?? null;
          return fresh.find(h => h.id === prev.id) ?? fresh[0] ?? null;
        });
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  // ── Log done/missed for a habit today ───────────────────────
  async function handleLog(habitId, status) {
    setLogging(prev => ({ ...prev, [habitId]: true }));
    try {
      await logHabitToday(USER_ID, habitId, status);
    } catch (e) {
      alert("Could not save: " + e.message);
    } finally {
      setLogging(prev => ({ ...prev, [habitId]: false }));
    }
  }

  // ── Add new habit ────────────────────────────────────────────
  async function handleAddHabit(name, frequency) {
    try {
      await addHabit(USER_ID, name, frequency);
      setShowAddModal(false);
    } catch (e) {
      alert("Could not add habit: " + e.message);
    }
  }

  const chartData     = selectedHabit ? (chartPeriod === "7" ? selectedHabit.chartData7d : selectedHabit.chartData30d) : [];
  const weeklySummary = selectedHabit?.weeklyDays ?? [];
  const aiMessage     = user
    ? `You're doing great, ${user.name}. Consistency is your superpower — keep showing up, even on the tough days. 🌟`
    : "Keep going — small progress is still progress. 🌟";

  if (loading) return (
    <div className="status-screen">
      <div className="loading-dot" />
      <p className="status-msg">Loading your habits…</p>
    </div>
  );

  if (error) return (
    <div className="status-screen">
      <p style={{ fontSize: 36, marginBottom: 12 }}>⚠️</p>
      <p className="status-title">Something went wrong</p>
      <p className="status-msg">{error}</p>
    </div>
  );

  return (
    <div className="shell">
      <div className="phone">

        <Header user={user ?? { name: "Tam", avatarInitial: "T" }} />

        {summary && <SummaryCards data={summary} />}

        <p className="section-label anim-2">My Habits</p>
        <HabitList
          habits={habits}
          selectedId={selectedHabit?.id}
          logging={logging}
          onSelect={setSelectedHabit}
          onLog={handleLog}
        />

        {selectedHabit && (
          <ProgressChart
            habit={selectedHabit}
            chartData={chartData}
            period={chartPeriod}
            onPeriodChange={setChartPeriod}
          />
        )}

        {weeklySummary.length > 0 && <WeeklySummary days={weeklySummary} />}

        <AICoach message={aiMessage} />

        <div style={{ height: 100 }} />

        {/* ── Floating Add Button ── */}
        <button className="fab" onClick={() => setShowAddModal(true)}>
          <span className="fab-icon">+</span>
        </button>

        {/* ── Add Habit Modal ── */}
        {showAddModal && (
          <AddHabitModal
            onAdd={handleAddHabit}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ user }) {
  return (
    <div className="header anim-1">
      <div>
        <div className="header-badge">
          <div className="header-dot" />
          <span className="header-badge-text">Active today</span>
        </div>
        <p className="header-greeting">{getGreeting()}, {user.name} 👋</p>
        <p className="header-sub">Small progress is still progress. Keep going.</p>
      </div>
      <div className="avatar-wrap">
        <div className="avatar">{user.avatarInitial}</div>
        <div className="avatar-ring" />
        <div className="avatar-status" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════════
const CARDS_CFG = [
  { key: "totalHabits",   label: "Total Habits", icon: "✦", accent: "#4E8EF7", fmt: v => v        },
  { key: "doneToday",     label: "Done Today",   icon: "✓", accent: "#34C77B", fmt: v => v        },
  { key: "currentStreak", label: "Streak",       icon: "🔥", accent: "#FF6B6B", fmt: v => `${v}d`  },
  { key: "successRate",   label: "Success",      icon: "◎", accent: "#A78BFA", fmt: v => `${v}%`  },
];

function SummaryCards({ data }) {
  return (
    <div className="summary-grid anim-1">
      {CARDS_CFG.map(({ key, label, icon, accent, fmt }) => (
        <div key={key} className="stat-card" style={{ borderTopColor: accent }}>
          <span className="stat-icon" style={{ color: accent }}>{icon}</span>
          <span className="stat-value">{fmt(data[key])}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT LIST
// ═══════════════════════════════════════════════════════════════
function HabitList({ habits, selectedId, logging, onSelect, onLog }) {
  if (!habits.length) return (
    <div className="habit-empty anim-3">
      <span className="habit-empty-icon">🌱</span>
      <p className="habit-empty-title">No habits yet</p>
      <p className="habit-empty-sub">Tap the + button below to add your first habit!</p>
    </div>
  );

  return (
    <div className="habit-list anim-3">
      {habits.map(h => (
        <HabitCard
          key={h.id}
          habit={h}
          selected={h.id === selectedId}
          isLogging={logging[h.id]}
          onSelect={() => onSelect(h)}
          onLog={onLog}
        />
      ))}
    </div>
  );
}

function HabitCard({ habit, selected, isLogging, onSelect, onLog }) {
  const { id, todayStatus, color, icon, name, frequency, streak } = habit;
  const done   = todayStatus === "done";
  const missed = todayStatus === "missed";

  return (
    <div
      className={`habit-card${selected ? " selected" : ""}`}
      style={{
        borderColor: selected ? color : "transparent",
        boxShadow:   selected ? `0 4px 20px ${color}28` : undefined,
      }}
    >
      {/* Left: icon — tapping selects the habit for chart */}
      <div
        className="habit-icon-bg"
        style={{ background: `${color}18`, cursor: "pointer" }}
        onClick={onSelect}
      >
        {icon}
      </div>

      {/* Middle: name + freq */}
      <div className="habit-info" style={{ cursor: "pointer" }} onClick={onSelect}>
        <span className="habit-name">{name}</span>
        <span className="habit-freq">{frequency}</span>
      </div>

      {/* Right: log buttons */}
      <div className="habit-right">
        {isLogging ? (
          <span className="habit-saving">saving…</span>
        ) : (
          <div className="log-btns">
            <button
              className={`log-btn log-done${done ? " log-done--active" : ""}`}
              onClick={() => onLog(id, "done")}
              title="Mark as done"
            >
              ✓
            </button>
            <button
              className={`log-btn log-miss${missed ? " log-miss--active" : ""}`}
              onClick={() => onLog(id, "missed")}
              title="Mark as missed"
            >
              ✗
            </button>
          </div>
        )}
        {streak > 0 && <span className="habit-streak">🔥 {streak}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADD HABIT MODAL
// ═══════════════════════════════════════════════════════════════
function AddHabitModal({ onAdd, onClose }) {
  const [name,      setName]      = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), frequency);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {/* Handle bar */}
        <div className="modal-handle" />

        <p className="modal-title">New Habit</p>
        <p className="modal-sub">What habit do you want to build?</p>

        <label className="field-label">Habit name</label>
        <input
          className="field-input"
          type="text"
          placeholder="e.g. Exercise, Reading, Drink Water…"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          maxLength={40}
        />

        <label className="field-label">Frequency</label>
        <div className="freq-row">
          {["daily", "weekly"].map(f => (
            <button
              key={f}
              className={`freq-btn${frequency === f ? " freq-btn--active" : ""}`}
              onClick={() => setFrequency(f)}
            >
              {f === "daily" ? "📅 Daily" : "📆 Weekly"}
            </button>
          ))}
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
        >
          {saving ? "Adding…" : "Add Habit ✦"}
        </button>

        <button className="cancel-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS CHART
// ═══════════════════════════════════════════════════════════════
function ProgressChart({ habit, chartData, period, onPeriodChange }) {
  if (!chartData?.length) return null;
  const showLabel = (i) => period === "7" || i % 5 === 0;

  return (
    <div className="chart-card anim-4">
      <div className="chart-header">
        <div>
          <span className="chart-title">{habit.name} Progress</span>
          <span className="chart-sub">{period === "7" ? "Last 7 days" : "Last 30 days"}</span>
        </div>
        <div className="period-tabs">
          {["7","30"].map(p => (
            <button
              key={p}
              className={`period-btn${period === p ? " active" : ""}`}
              style={period === p ? { background: habit.color } : undefined}
              onClick={() => onPeriodChange(p)}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      <div className="bar-chart">
        {chartData.map((d, i) => (
          <div key={i} className="bar-col">
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: `${d.val * 100}%`, background: d.val ? habit.color : "transparent" }}
              />
            </div>
            {showLabel(i) && <span className="bar-label">{d.day}</span>}
          </div>
        ))}
      </div>

      <div className="chart-legend">
        <div className="legend-dot" style={{ background: habit.color }} />
        <span className="legend-text">Done</span>
        <div className="legend-dot legend-miss" />
        <span className="legend-text">Missed</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY SUMMARY
// ═══════════════════════════════════════════════════════════════
function WeeklySummary({ days }) {
  return (
    <div className="weekly-card anim-5">
      <p className="section-label" style={{ padding: 0, marginBottom: 14 }}>This Week</p>
      <div className="weekly-row">
        {days.map(d => (
          <div key={d.day} className="week-day">
            <div className={`week-dot ${d.done ? "done" : "miss"}`}>{d.done ? "✓" : "✗"}</div>
            <span className="week-label">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH
// ═══════════════════════════════════════════════════════════════
function AICoach({ message }) {
  return (
    <div className="ai-card anim-6">
      <div className="ai-glow" />
      <div className="ai-header">
        <div className="ai-icon-box">✨</div>
        <div>
          <span className="ai-title">AI Coach</span>
          <span className="ai-powered">Powered by Claude</span>
        </div>
      </div>
      <p className="ai-msg">{message}</p>
    </div>
  );
}
