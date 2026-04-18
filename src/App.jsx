// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  (Auth + Interactive version)
// Features:
//   ✅ Email + Password login & register
//   ✅ Secure: each user only sees their own data
//   ✅ Auto login if already signed in
//   ✅ Logout button
//   ✅ Add habit, log done/missed
//   ✅ Real-time Firestore sync
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import "./App.css";
import {
  loginUser,
  registerUser,
  logoutUser,
  subscribeToAuth,
  fetchUser,
  ensureUserDoc,
  subscribeToHabits,
  computeSummary,
  logHabitToday,
  addHabit,
} from "./firebase/habitService";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ═══════════════════════════════════════════════════════════════
// ROOT — decides whether to show Auth or Dashboard
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = checking

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsub = subscribeToAuth((firebaseUser) => {
      setAuthUser(firebaseUser); // null = logged out, object = logged in
    });
    return () => unsub();
  }, []);

  // Still checking auth state
  if (authUser === undefined) return (
    <div className="status-screen">
      <div className="loading-dot" />
      <p className="status-msg">Loading…</p>
    </div>
  );

  // Not logged in → show auth screen
  if (!authUser) return <AuthScreen />;

  // Logged in → show dashboard
  return <Dashboard authUser={authUser} />;
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN — Login & Register
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode,     setMode]     = useState("login"); // "login" | "register"
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields."); return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name."); return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email.trim(), password);
      } else {
        const cred = await registerUser(email.trim(), password);
        // Create the user profile document in Firestore
        await ensureUserDoc(cred.user.uid, name.trim());
      }
    } catch (e) {
      // Make Firebase error messages friendlier
      const msg = e.code === "auth/user-not-found"       ? "No account found with this email."
                : e.code === "auth/wrong-password"        ? "Incorrect password. Try again."
                : e.code === "auth/email-already-in-use"  ? "An account already exists with this email."
                : e.code === "auth/invalid-email"          ? "Please enter a valid email address."
                : e.code === "auth/weak-password"          ? "Password must be at least 6 characters."
                : e.code === "auth/invalid-credential"     ? "Incorrect email or password."
                : e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(m => m === "login" ? "register" : "login");
    setError("");
    setName(""); setEmail(""); setPassword("");
  }

  return (
    <div className="shell">
      <div className="phone">

        {/* Top hero */}
        <div className="auth-hero">
          <div className="auth-hero-glow" />
          <div className="auth-logo">✦</div>
          <p className="auth-app-name">Habit App</p>
          <p className="auth-tagline">Build better habits, one day at a time.</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <p className="auth-title">
            {mode === "login" ? "Welcome back 👋" : "Create account ✦"}
          </p>
          <p className="auth-sub">
            {mode === "login"
              ? "Sign in to see your habits"
              : "Start your habit journey today"}
          </p>

          {/* Name field (register only) */}
          {mode === "register" && (
            <div className="field-wrap">
              <label className="field-label">Your name</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Tam"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={40}
              />
            </div>
          )}

          {/* Email */}
          <div className="field-wrap">
            <label className="field-label">Email</label>
            <input
              className="field-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoCapitalize="none"
            />
          </div>

          {/* Password */}
          <div className="field-wrap">
            <label className="field-label">Password</label>
            <div className="pass-wrap">
              <input
                className="field-input pass-input"
                type={showPass ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
              <button
                className="pass-toggle"
                onClick={() => setShowPass(s => !s)}
                tabIndex={-1}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && <p className="auth-error">⚠️ {error}</p>}

          {/* Submit */}
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign In →" : "Create Account →")}
          </button>

          {/* Switch mode */}
          <p className="auth-switch">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button className="auth-link" onClick={switchMode}>
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </p>
        </div>

        <p className="auth-footer">🔒 Your data is private and secure</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD — shown after login
// ═══════════════════════════════════════════════════════════════
function Dashboard({ authUser }) {
  const [user,          setUser]         = useState(null);
  const [habits,        setHabits]       = useState([]);
  const [summary,       setSummary]      = useState(null);
  const [selectedHabit, setSelectedHabit]= useState(null);
  const [chartPeriod,   setChartPeriod]  = useState("7");
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState(null);
  const [showAddModal,  setShowAddModal] = useState(false);
  const [logging,       setLogging]      = useState({});

  const userId = authUser.uid; // ← comes from Firebase Auth, not hardcoded

  // Load user profile
  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(e => setError(e.message));
  }, [userId]);

  // Real-time habit subscription
  useEffect(() => {
    const unsub = subscribeToHabits(
      userId,
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
  }, [userId]);

  async function handleLog(habitId, status) {
    setLogging(prev => ({ ...prev, [habitId]: true }));
    try {
      await logHabitToday(userId, habitId, status);
    } catch(e) {
      alert("Could not save: " + e.message);
    } finally {
      setLogging(prev => ({ ...prev, [habitId]: false }));
    }
  }

  async function handleAddHabit(name, frequency) {
    try {
      await addHabit(userId, name, frequency);
      setShowAddModal(false);
    } catch(e) {
      alert("Could not add habit: " + e.message);
    }
  }

  const chartData     = selectedHabit
    ? (chartPeriod === "7" ? selectedHabit.chartData7d : selectedHabit.chartData30d)
    : [];
  const weeklySummary = selectedHabit?.weeklyDays ?? [];
  const aiMessage     = user
    ? `You're doing great, ${user.name}. Consistency is your superpower — keep showing up! 🌟`
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

        <Header
          user={user ?? { name: authUser.email?.split("@")[0] ?? "Tam", avatarInitial: "T" }}
          onLogout={logoutUser}
        />

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

        {/* FAB */}
        <button className="fab" onClick={() => setShowAddModal(true)} title="Add habit">
          <span className="fab-icon">+</span>
        </button>

        {/* Add Habit Modal */}
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
// HEADER  (with logout button)
// ═══════════════════════════════════════════════════════════════
function Header({ user, onLogout }) {
  return (
    <div className="header anim-1">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="header-badge">
          <div className="header-dot" />
          <span className="header-badge-text">Active today</span>
        </div>
        <p className="header-greeting">{getGreeting()}, {user.name} 👋</p>
        <p className="header-sub">Small progress is still progress. Keep going.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div className="avatar-wrap">
          <div className="avatar">{user.avatarInitial}</div>
          <div className="avatar-ring" />
          <div className="avatar-status" />
        </div>
        <button className="logout-btn" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════════
const CARDS_CFG = [
  { key:"totalHabits",   label:"Total Habits", icon:"✦", accent:"#4E8EF7", fmt: v => v        },
  { key:"doneToday",     label:"Done Today",   icon:"✓", accent:"#34C77B", fmt: v => v        },
  { key:"currentStreak", label:"Streak",       icon:"🔥", accent:"#FF6B6B", fmt: v => `${v}d`  },
  { key:"successRate",   label:"Success",      icon:"◎", accent:"#A78BFA", fmt: v => `${v}%`  },
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
// HABIT LIST & CARD
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
          key={h.id} habit={h}
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
      <div className="habit-icon-bg" style={{ background:`${color}18`, cursor:"pointer" }} onClick={onSelect}>
        {icon}
      </div>
      <div className="habit-info" style={{ cursor:"pointer" }} onClick={onSelect}>
        <span className="habit-name">{name}</span>
        <span className="habit-freq">{frequency}</span>
      </div>
      <div className="habit-right">
        {isLogging ? (
          <span className="habit-saving">saving…</span>
        ) : (
          <div className="log-btns">
            <button
              className={`log-btn log-done${done ? " log-done--active" : ""}`}
              onClick={() => onLog(id, "done")}
              title="Mark done"
            >✓</button>
            <button
              className={`log-btn log-miss${missed ? " log-miss--active" : ""}`}
              onClick={() => onLog(id, "missed")}
              title="Mark missed"
            >✗</button>
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
  const [name,      setName]   = useState("");
  const [frequency, setFreq]   = useState("daily");
  const [saving,    setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), frequency);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
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
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        <label className="field-label">Frequency</label>
        <div className="freq-row">
          {["daily","weekly"].map(f => (
            <button
              key={f}
              className={`freq-btn${frequency===f ? " freq-btn--active":""}`}
              onClick={() => setFreq(f)}
            >
              {f==="daily" ? "📅 Daily" : "📆 Weekly"}
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
  return (
    <div className="chart-card anim-4">
      <div className="chart-header">
        <div>
          <span className="chart-title">{habit.name} Progress</span>
          <span className="chart-sub">{period==="7" ? "Last 7 days" : "Last 30 days"}</span>
        </div>
        <div className="period-tabs">
          {["7","30"].map(p => (
            <button
              key={p}
              className={`period-btn${period===p?" active":""}`}
              style={period===p ? { background: habit.color } : undefined}
              onClick={() => onPeriodChange(p)}
            >{p}D</button>
          ))}
        </div>
      </div>
      <div className="bar-chart">
        {chartData.map((d,i) => (
          <div key={i} className="bar-col">
            <div className="bar-track">
              <div className="bar-fill" style={{ height:`${d.val*100}%`, background: d.val ? habit.color : "transparent" }} />
            </div>
            {(period==="7" || i%5===0) && <span className="bar-label">{d.day}</span>}
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
      <p className="section-label" style={{ padding:0, marginBottom:14 }}>This Week</p>
      <div className="weekly-row">
        {days.map(d => (
          <div key={d.day} className="week-day">
            <div className={`week-dot ${d.done?"done":"miss"}`}>{d.done?"✓":"✗"}</div>
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
