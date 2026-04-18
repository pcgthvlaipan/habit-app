// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  v6
// New: 50 icons, calendar history, lively colors, reward badges
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
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
  logHabitDate,
  addHabit,
  editHabit,
  deleteHabit,
  HABIT_ICON_OPTIONS,
  WEEK_DAYS,
  REWARD_BADGES,
  computeEarnedBadges,
} from "./firebase/habitService";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(undefined);
  useEffect(() => subscribeToAuth(setAuthUser), []);
  if (authUser === undefined) return <Spinner />;
  if (!authUser) return <AuthScreen />;
  return <Dashboard authUser={authUser} />;
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, p, setP] = useState("login"),
    [pass, setPass] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const [loading, setL] = useState(false),
    [error, setE] = useState(""),
    [show, setShow] = useState(false);
  const [mode2, setMode] = [mode, p];

  async function submit() {
    setE("");
    if (!email.trim() || !pass) {
      setE("Please fill in all fields.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setE("Please enter your name.");
      return;
    }
    if (pass.length < 6) {
      setE("Password must be at least 6 characters.");
      return;
    }
    setL(true);
    try {
      if (mode === "login") {
        await loginUser(email.trim(), pass);
      } else {
        const c = await registerUser(email.trim(), pass);
        await ensureUserDoc(c.user.uid, name.trim());
      }
    } catch (e) {
      setE(
        e.code === "auth/user-not-found"
          ? "No account found."
          : e.code === "auth/wrong-password"
          ? "Incorrect password."
          : e.code === "auth/email-already-in-use"
          ? "Email already registered."
          : e.code === "auth/invalid-credential"
          ? "Incorrect email or password."
          : e.message
      );
    } finally {
      setL(false);
    }
  }

  return (
    <div className="shell">
      <div className="phone">
        <div className="auth-hero">
          <div className="auth-hero-orb orb1" />
          <div className="auth-hero-orb orb2" />
          <div className="auth-logo">h</div>
          <p className="auth-app-name">Habit App</p>
          <p className="auth-tagline">
            Build better habits, one day at a time ✦
          </p>
        </div>
        <div className="auth-card">
          <p className="auth-title">
            {mode === "login" ? "Welcome back 👋" : "Create account ✦"}
          </p>
          <p className="auth-sub">
            {mode === "login"
              ? "Sign in to your habits"
              : "Start your journey today"}
          </p>
          {mode === "register" && (
            <div className="field-wrap">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Tam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </div>
          )}
          <div className="field-wrap">
            <label className="field-label">Email</label>
            <input
              className="field-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
            />
          </div>
          <div className="field-wrap">
            <label className="field-label">Password</label>
            <div className="pass-wrap">
              <input
                className="field-input pass-input"
                type={show ? "text" : "password"}
                placeholder="Min 6 characters"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                className="pass-toggle"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
              >
                {show ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {error && <p className="auth-error">⚠️ {error}</p>}
          <button className="submit-btn" onClick={submit} disabled={loading}>
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating…"
              : mode === "login"
              ? "Sign In →"
              : "Create Account →"}
          </button>
          <p className="auth-switch">
            {mode === "login" ? "No account? " : "Have an account? "}
            <button
              className="auth-link"
              onClick={() => {
                setMode((m) => (m === "login" ? "register" : "login"));
                setE("");
              }}
            >
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
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ authUser }) {
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [period, setPeriod] = useState("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("today");
  const [calHabit, setCalHabit] = useState(null); // habit shown in calendar
  const uid = authUser.uid;

  useEffect(() => {
    fetchUser(uid)
      .then(setUser)
      .catch((e) => setError(e.message));
  }, [uid]);
  useEffect(
    () =>
      subscribeToHabits(
        uid,
        (fresh) => {
          setHabits(fresh);
          setSummary(computeSummary(fresh));
          setSelected((p) =>
            p
              ? fresh.find((h) => h.id === p.id) ?? fresh[0] ?? null
              : fresh[0] ?? null
          );
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        }
      ),
    [uid]
  );

  const earnedBadges = useMemo(
    () => computeEarnedBadges(habits, summary),
    [habits, summary]
  );

  // Optimistic update — UI changes instantly, Firestore saves in background
  function handleLog(hid, status) {
    // 1. Update UI immediately — user sees instant response
    setHabits((prev) =>
      prev.map((h) => (h.id !== hid ? h : { ...h, todayStatus: status }))
    );

    // 2. Update Done Today count immediately
    setSummary((prev) => {
      if (!prev) return prev;
      const h = habits.find((x) => x.id === hid);
      const wasDone = h?.todayStatus === "done";
      const isDone = status === "done";
      const delta = isDone && !wasDone ? 1 : !isDone && wasDone ? -1 : 0;
      return { ...prev, doneToday: Math.max(0, prev.doneToday + delta) };
    });

    // 3. Save to Firestore silently — no await, no spinner, no delay
    logHabitToday(uid, hid, status).catch((e) =>
      console.error("Save failed:", e.message)
    );
  }
  async function handleAddHabit(d) {
    try {
      await addHabit(uid, d);
      setShowAdd(false);
    } catch (e) {
      alert(e.message);
    }
  }
  async function handleEditHabit(d) {
    try {
      await editHabit(uid, editing.id, d);
      setEditing(null);
    } catch (e) {
      alert(e.message);
    }
  }
  async function handleDelete(hid) {
    if (!window.confirm("Delete this habit and all its data?")) return;
    try {
      await deleteHabit(uid, hid);
      if (selected?.id === hid) setSelected(null);
    } catch (e) {
      alert(e.message);
    }
  }

  const chartData = selected
    ? period === "7"
      ? selected.chartData7d
      : selected.chartData30d
    : [];

  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="status-screen">
        <p style={{ fontSize: 36 }}>⚠️</p>
        <p className="status-msg">{error}</p>
      </div>
    );

  return (
    <div className="shell">
      <div className="phone">
        <Header
          user={
            user ?? {
              name: authUser.email?.split("@")[0] ?? "Tam",
              avatarInitial: "T",
            }
          }
          onLogout={logoutUser}
          earnedCount={earnedBadges.length}
        />

        <div className="tab-bar">
          {[
            ["today", "🏠 Today"],
            ["calendar", "📅 Calendar"],
            ["stats", "📊 Stats"],
            ["badges", "🏆 Badges"],
          ].map(([t, l]) => (
            <button
              key={t}
              className={`tab-btn${tab === t ? " tab-btn--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {l}
            </button>
          ))}
        </div>

        {/* TODAY */}
        {tab === "today" && (
          <>
            {summary && <SummaryCards data={summary} />}
            {earnedBadges.length > 0 && (
              <NewBadgeAlert badges={earnedBadges.slice(-1)} />
            )}
            <p className="section-label anim-2">My Habits</p>
            <HabitList
              habits={habits}
              selectedId={selected?.id}
              onSelect={setSelected}
              onLog={handleLog}
              onEdit={(h) => setEditing(h)}
              onDelete={handleDelete}
            />
            {selected && (
              <ProgressChart
                habit={selected}
                chartData={chartData}
                period={period}
                onPeriodChange={setPeriod}
              />
            )}
            {selected?.weeklyDays?.length > 0 && (
              <WeeklySummary days={selected.weeklyDays} />
            )}
            <AICoachCard
              habits={habits}
              summary={summary}
              earnedBadges={earnedBadges}
            />
          </>
        )}

        {/* CALENDAR */}
        {tab === "calendar" && (
          <>
            <p className="section-label" style={{ marginTop: 16 }}>
              History Calendar
            </p>
            <div className="cal-habit-picker">
              {habits.map((h) => (
                <button
                  key={h.id}
                  className={`cal-habit-chip${
                    calHabit?.id === h.id ? " active" : ""
                  }`}
                  style={
                    calHabit?.id === h.id
                      ? { background: h.color, color: "#fff" }
                      : {}
                  }
                  onClick={() => setCalHabit(h)}
                >
                  {h.icon} {h.name}
                </button>
              ))}
            </div>
            {calHabit ? (
              <CalendarView habit={calHabit} uid={uid} />
            ) : (
              <div className="cal-empty">
                👆 Select a habit above to view its history
              </div>
            )}
          </>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <>
            <p className="section-label" style={{ marginTop: 16 }}>
              Statistics
            </p>
            {habits.length === 0 ? (
              <EmptyHabits />
            ) : (
              habits.map((h) => <HabitStatCard key={h.id} habit={h} />)
            )}
          </>
        )}

        {/* BADGES */}
        {tab === "badges" && (
          <BadgesTab
            habits={habits}
            summary={summary}
            earnedBadges={earnedBadges}
          />
        )}

        <div style={{ height: 100 }} />
        <button
          className="fab"
          onClick={() => setShowAdd(true)}
          title="Add habit"
        >
          <span className="fab-icon">+</span>
        </button>
        {showAdd && (
          <HabitFormModal
            title="New Habit"
            onSave={handleAddHabit}
            onClose={() => setShowAdd(false)}
          />
        )}
        {editing && (
          <HabitFormModal
            title="Edit Habit"
            initial={editing}
            onSave={handleEditHabit}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER — lively gradient
// ═══════════════════════════════════════════════════════════════
function Header({ user, onLogout, earnedCount }) {
  return (
    <div className="header anim-1">
      <div className="header-orb h-orb1" />
      <div className="header-orb h-orb2" />
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div className="header-badge">
          <div className="header-dot" />
          <span className="header-badge-text">Active today</span>
        </div>
        <p className="header-greeting">
          {getGreeting()}, {user.name} 👋
        </p>
        <p className="header-sub">Small progress is still progress.</p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="avatar-wrap">
          <div className="avatar">{user.avatarInitial}</div>
          <div className="avatar-ring" />
          <div className="avatar-status" />
          {earnedCount > 0 && <div className="badge-count">{earnedCount}</div>}
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════════
const CARDS_CFG = [
  {
    key: "totalHabits",
    label: "Habits",
    icon: "✦",
    accent: "#4E8EF7",
    fmt: (v) => v,
  },
  {
    key: "doneToday",
    label: "Done",
    icon: "✓",
    accent: "#34C77B",
    fmt: (v) => v,
  },
  {
    key: "currentStreak",
    label: "Streak",
    icon: "🔥",
    accent: "#FF6B6B",
    fmt: (v) => `${v}d`,
  },
  {
    key: "successRate",
    label: "Success",
    icon: "◎",
    accent: "#A78BFA",
    fmt: (v) => `${v}%`,
  },
];
function SummaryCards({ data }) {
  return (
    <div className="summary-grid anim-1">
      {CARDS_CFG.map(({ key, label, icon, accent, fmt }) => (
        <div key={key} className="stat-card" style={{ borderTopColor: accent }}>
          <span className="stat-icon" style={{ color: accent }}>
            {icon}
          </span>
          <span className="stat-value">{fmt(data[key])}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW BADGE ALERT
// ═══════════════════════════════════════════════════════════════
function NewBadgeAlert({ badges }) {
  const [visible, setVisible] = useState(true);
  if (!visible || !badges.length) return null;
  const b = badges[0];
  return (
    <div className="badge-alert">
      <span className="badge-alert-icon">{b.icon}</span>
      <div>
        <p className="badge-alert-title">New Badge: {b.label}</p>
        <p className="badge-alert-desc">{b.desc}</p>
      </div>
      <button onClick={() => setVisible(false)} className="badge-alert-close">
        ✕
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT LIST
// ═══════════════════════════════════════════════════════════════
function HabitList({ habits, selectedId, onSelect, onLog, onEdit, onDelete }) {
  if (!habits.length) return <EmptyHabits />;
  return (
    <div className="habit-list anim-3">
      {habits.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          selected={h.id === selectedId}
          onSelect={() => onSelect(h)}
          onLog={onLog}
          onEdit={() => onEdit(h)}
          onDelete={() => onDelete(h.id)}
        />
      ))}
    </div>
  );
}

function HabitCard({ habit, selected, onSelect, onLog, onEdit, onDelete }) {
  const {
    id,
    todayStatus,
    color,
    icon,
    name,
    frequency,
    scheduledDays,
    streak,
  } = habit;
  const done = todayStatus === "done",
    missed = todayStatus === "missed",
    notSched = todayStatus === "not-scheduled";
  const [menu, setMenu] = useState(false);
  const freqLabel =
    frequency === "daily"
      ? "Daily"
      : frequency === "weekly"
      ? "Weekly"
      : scheduledDays?.join(", ") ?? "Custom";
  return (
    <div
      className={`habit-card${selected ? " selected" : ""}`}
      style={{
        borderColor: selected ? color : "transparent",
        boxShadow: selected ? `0 4px 20px ${color}28` : undefined,
      }}
    >
      <div
        className="habit-icon-bg"
        style={{ background: `${color}18`, cursor: "pointer" }}
        onClick={onSelect}
      >
        {icon}
      </div>
      <div
        className="habit-info"
        style={{ cursor: "pointer" }}
        onClick={onSelect}
      >
        <span className="habit-name">{name}</span>
        <span className="habit-freq">{freqLabel}</span>
      </div>
      <div className="habit-right">
        {notSched ? (
          <span className="habit-badge badge-pending">– Rest</span>
        ) : (
          <div className="log-btns">
            {/* Tapping an active button a second time unchecks it (sets to "none") */}
            <button
              className={`log-btn log-done${done ? " log-done--active" : ""}`}
              onClick={() => onLog(id, done ? "none" : "done")}
              title={done ? "Tap to uncheck" : "Mark done"}
            >
              ✓
            </button>
            <button
              className={`log-btn log-miss${missed ? " log-miss--active" : ""}`}
              onClick={() => onLog(id, missed ? "none" : "missed")}
              title={missed ? "Tap to uncheck" : "Mark missed"}
            >
              ✗
            </button>
          </div>
        )}
        {streak > 0 && <span className="habit-streak">🔥 {streak}</span>}
        <div style={{ position: "relative" }}>
          <button className="menu-btn" onClick={() => setMenu((s) => !s)}>
            ⋯
          </button>
          {menu && (
            <div className="menu-dropdown">
              <button
                onClick={() => {
                  onEdit();
                  setMenu(false);
                }}
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMenu(false);
                }}
                style={{ color: "var(--coral)" }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT FORM MODAL
// ═══════════════════════════════════════════════════════════════
function HabitFormModal({ title, initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "✨");
  const [freq, setFreq] = useState(initial?.frequency ?? "daily");
  const [days, setDays] = useState(initial?.scheduledDays ?? []);
  const [saving, setSaving] = useState(false);
  const [showIcons, setShowI] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = HABIT_ICON_OPTIONS.filter(
    (o) => !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggleDay(d) {
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  }

  async function submit() {
    if (!name.trim()) return;
    if (freq === "custom" && days.length === 0) {
      alert("Pick at least one day.");
      return;
    }
    setSaving(true);
    await onSave({
      name: name.trim(),
      icon,
      frequency: freq,
      scheduledDays: freq === "custom" ? days : WEEK_DAYS,
    });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">{title}</p>

        {/* Icon */}
        <label className="field-label">Icon</label>
        <div className="icon-picker-row">
          <div className="icon-selected">{icon}</div>
          <button
            className="icon-browse-btn"
            onClick={() => setShowI((s) => !s)}
          >
            {showIcons ? "Close ✕" : "Browse 50 icons"}
          </button>
        </div>
        {showIcons && (
          <>
            <input
              className="field-input"
              type="text"
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <div className="icon-grid">
              {filtered.map(({ icon: ic, label }) => (
                <button
                  key={ic}
                  className={`icon-option${
                    icon === ic ? " icon-option--active" : ""
                  }`}
                  onClick={() => {
                    setIcon(ic);
                    setShowI(false);
                    setSearch("");
                  }}
                  title={label}
                >
                  {ic}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="field-label" style={{ marginTop: 16 }}>
          Name
        </label>
        <input
          className="field-input"
          type="text"
          placeholder="e.g. Exercise, Reading…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <label className="field-label">Frequency</label>
        <div className="freq-row">
          {[
            ["daily", "📅 Daily"],
            ["custom", "📆 Pick days"],
          ].map(([f, l]) => (
            <button
              key={f}
              className={`freq-btn${freq === f ? " freq-btn--active" : ""}`}
              onClick={() => setFreq(f)}
            >
              {l}
            </button>
          ))}
        </div>

        {freq === "custom" && (
          <>
            <label className="field-label">Which days?</label>
            <div className="day-picker">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d}
                  className={`day-btn${
                    days.includes(d) ? " day-btn--active" : ""
                  }`}
                  onClick={() => toggleDay(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            {days.length > 0 && (
              <p className="day-summary">
                {days.length}× per week · {days.join(", ")}
              </p>
            )}
          </>
        )}

        <button
          className="submit-btn"
          onClick={submit}
          disabled={!name.trim() || saving}
          style={{ marginTop: 20 }}
        >
          {saving ? "Saving…" : initial ? "Save Changes ✦" : "Add Habit ✦"}
        </button>
        <button className="cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR VIEW — optimistic local state, instant response
// ═══════════════════════════════════════════════════════════════
function CalendarView({ habit, uid }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  // Local override map: dateStr → status  (instant UI, no waiting for Firestore)
  const [localLog, setLocalLog] = useState({});

  const FULL_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Merge Firestore data with local optimistic overrides
  const calDays = useMemo(() => {
    if (!habit?.buildCalendar) return [];
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const days = habit.buildCalendar(start, end);
    // Apply local overrides on top of Firestore data
    return days.map((d) => ({
      ...d,
      status: localLog[d.date] !== undefined ? localLog[d.date] : d.status,
    }));
  }, [habit, year, month, localLog]);

  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const isCur = year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }
  function jumpTo(off) {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() + off);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Optimistic log: update local state instantly, save to Firestore in background
  function handleDayLog(dateStr, currentStatus, newStatus) {
    const resolvedStatus = currentStatus === newStatus ? "none" : newStatus;
    // 1. Update UI immediately
    setLocalLog((prev) => ({ ...prev, [dateStr]: resolvedStatus }));
    // 2. Save to Firestore silently
    logHabitDate(uid, habit.id, dateStr, resolvedStatus).catch((e) => {
      console.error("Calendar save failed:", e.message);
      // Revert on error
      setLocalLog((prev) => ({ ...prev, [dateStr]: currentStatus }));
    });
  }

  const done = calDays.filter((d) => d.status === "done").length;
  const sched = calDays.filter((d) => d.scheduled).length;
  const rate = sched > 0 ? Math.round((done / sched) * 100) : 0;

  return (
    <div className="cal-card">
      {/* Quick jumps */}
      <div className="cal-quick-btns">
        {[
          ["This month", 0],
          ["Last month", -1],
          ["2 months ago", -2],
        ].map(([l, o]) => (
          <button
            key={l}
            className={`cal-quick-btn${
              year === today.getFullYear() && month === today.getMonth() + o
                ? "active"
                : ""
            }`}
            onClick={() => jumpTo(o)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>
          ‹
        </button>
        <div>
          <p className="cal-month-label">
            {FULL_MONTHS[month]} {year}
          </p>
          <p className="cal-month-stats">
            {done}/{sched} days · {rate}% success
          </p>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} disabled={isCur}>
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="cal-grid cal-header-row">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="cal-day-hdr">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {calDays.map((d, i) => (
          <DayCell
            key={d.date}
            d={d}
            isToday={d.date === todayStr}
            isFuture={d.date > todayStr}
            onLog={handleDayLog}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-dot done-dot" />
          Done
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot miss-dot" />
          Missed
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot rest-dot" />
          Rest
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot none-dot" />
          No Record
        </span>
      </div>
    </div>
  );
}

// Individual tappable day cell — instant optimistic response
function DayCell({ d, isToday, isFuture, onLog }) {
  const [open, setOpen] = useState(false);

  const statusClass =
    d.status === "done"
      ? "cal-done"
      : d.status === "missed"
      ? "cal-missed"
      : d.status === "not-scheduled"
      ? "cal-rest"
      : "cal-none";

  function tap(newStatus) {
    // Instantly update, close menu — no waiting
    onLog(d.date, d.status, newStatus);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        className={`cal-day ${statusClass} ${isToday ? "cal-today" : ""} ${
          isFuture ? "cal-future" : ""
        }`}
        onClick={() => !isFuture && setOpen((o) => !o)}
        style={{ cursor: isFuture ? "default" : "pointer" }}
      >
        <span className="cal-day-num">{d.day}</span>
        {d.status === "done" && <span className="cal-day-icon">✓</span>}
        {d.status === "missed" && <span className="cal-day-icon">✗</span>}
      </div>

      {open && !isFuture && (
        <div className="day-log-menu" onClick={(e) => e.stopPropagation()}>
          <p className="day-log-date">{d.date}</p>
          <div style={{ display: "flex", gap: 5 }}>
            <button
              className={`day-log-btn day-log-done${
                d.status === "done" ? " active" : ""
              }`}
              onClick={() => tap("done")}
            >
              ✓ Done
            </button>
            <button
              className={`day-log-btn day-log-miss${
                d.status === "missed" ? " active" : ""
              }`}
              onClick={() => tap("missed")}
            >
              ✗ Miss
            </button>
          </div>
          <button className="day-log-close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
      )}
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
          <span className="chart-sub">
            {period === "7" ? "Last 7 days" : "Last 30 days"}
          </span>
        </div>
        <div className="period-tabs">
          {["7", "30"].map((p) => (
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
                style={{
                  height: `${d.val * 100}%`,
                  background: d.val ? habit.color : "transparent",
                }}
              />
            </div>
            {(period === "7" || i % 5 === 0) && (
              <span className="bar-label">{d.day}</span>
            )}
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
      <p className="section-label" style={{ padding: 0, marginBottom: 14 }}>
        This Week
      </p>
      <div className="weekly-row">
        {days.map((d) => (
          <div key={d.day} className="week-day">
            <div
              className={`week-dot ${
                d.done ? "done" : d.scheduled ? "miss" : "rest"
              }`}
            >
              {d.done ? "✓" : d.scheduled ? "✗" : "–"}
            </div>
            <span className="week-label">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH — lively colors + reward hints
// ═══════════════════════════════════════════════════════════════
function AICoachCard({ habits, summary, earnedBadges }) {
  const name = habits[0]?.name ?? "your habits";
  const rate = summary?.successRate ?? 0;
  const streak = summary?.currentStreak ?? 0;
  const done = summary?.doneToday ?? 0;
  const total = summary?.totalHabits ?? 0;
  const allDone = done === total && total > 0;

  // Pick the most relevant message
  const message = allDone
    ? `🎉 All habits done today! You're on fire, keep this momentum going!`
    : streak >= 7
    ? `🔥 ${streak}-day streak! You're building real momentum — don't stop now!`
    : rate >= 80
    ? `✨ ${rate}% success rate — you're crushing it! Keep showing up every day.`
    : streak >= 3
    ? `⚡ ${streak} days in a row! Consistency is your superpower. Keep going!`
    : `💪 Every habit done is a vote for the person you want to become. You've got this!`;

  // Next badge hint
  const unearned = REWARD_BADGES.filter(
    (b) => !earnedBadges.find((e) => e.id === b.id)
  );
  const nextBadge = unearned.find((b) => b.type === "streak") || unearned[0];

  return (
    <div className="ai-card anim-6">
      <div className="ai-orb ai-orb1" />
      <div className="ai-orb ai-orb2" />
      <div className="ai-header">
        <div className="ai-icon-box">✨</div>
        <div>
          <span className="ai-title">AI Coach</span>
          <span className="ai-powered">Powered by Claude</span>
        </div>
      </div>
      <p className="ai-msg">{message}</p>

      {/* Earned badges mini display */}
      {earnedBadges.length > 0 && (
        <div className="ai-badges">
          <p className="ai-badges-label">Your badges</p>
          <div className="ai-badges-row">
            {earnedBadges.slice(0, 6).map((b) => (
              <div key={b.id} className="ai-badge-pill" title={b.label}>
                {b.icon}
              </div>
            ))}
            {earnedBadges.length > 6 && (
              <div className="ai-badge-pill">+{earnedBadges.length - 6}</div>
            )}
          </div>
        </div>
      )}

      {/* Next badge hint */}
      {nextBadge && (
        <div className="ai-next-badge">
          <span>{nextBadge.icon}</span>
          <p>
            Next: <strong>{nextBadge.label}</strong> — {nextBadge.desc}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BADGES TAB
// ═══════════════════════════════════════════════════════════════
function BadgesTab({ habits, summary, earnedBadges }) {
  const earnedIds = new Set(earnedBadges.map((b) => b.id));
  return (
    <div style={{ padding: "0 16px" }}>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          marginBottom: 16,
          marginTop: 4,
        }}
      >
        {earnedBadges.length} of {REWARD_BADGES.length} badges earned
      </p>
      {/* Progress bar */}
      <div
        style={{
          background: "#EEF0F5",
          borderRadius: 20,
          height: 8,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 20,
            background: "linear-gradient(90deg,#34C77B,#4E8EF7)",
            width: `${Math.round(
              (earnedBadges.length / REWARD_BADGES.length) * 100
            )}%`,
            transition: "width .5s ease",
          }}
        />
      </div>

      {/* Earned */}
      {earnedBadges.length > 0 && (
        <>
          <p className="section-label" style={{ padding: 0, marginBottom: 12 }}>
            🏆 Earned
          </p>
          <div className="badges-grid">
            {earnedBadges.map((b) => (
              <div key={b.id} className="badge-card earned">
                <span className="badge-icon">{b.icon}</span>
                <p className="badge-label">{b.label}</p>
                <p className="badge-desc">{b.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Locked */}
      <p
        className="section-label"
        style={{ padding: 0, marginBottom: 12, marginTop: 24 }}
      >
        🔒 Locked
      </p>
      <div className="badges-grid">
        {REWARD_BADGES.filter((b) => !earnedIds.has(b.id)).map((b) => (
          <div key={b.id} className="badge-card locked">
            <span
              className="badge-icon"
              style={{ filter: "grayscale(1)", opacity: 0.4 }}
            >
              {b.icon}
            </span>
            <p className="badge-label" style={{ color: "var(--text-3)" }}>
              {b.label}
            </p>
            <p className="badge-desc">{b.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT STAT CARD
// ═══════════════════════════════════════════════════════════════
function HabitStatCard({ habit }) {
  const {
    name,
    icon,
    color,
    streak,
    successRate,
    totalDone,
    totalLogged,
    chartData30d,
  } = habit;
  return (
    <div className="stat-detail-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          className="habit-icon-bg"
          style={{
            background: `${color}18`,
            width: 44,
            height: 44,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
            {name}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
            Last 30 days
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: 26,
              fontWeight: 800,
              color,
              letterSpacing: "-1px",
            }}
          >
            {successRate}%
          </p>
          <p style={{ fontSize: 11, color: "var(--text-2)" }}>success</p>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Streak", value: `${streak}d`, accent: "#FF6B6B" },
          { label: "Done", value: totalDone, accent: "#34C77B" },
          { label: "Logged", value: totalLogged, accent: "#4E8EF7" },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            style={{
              background: "#F7F8FC",
              borderRadius: 12,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: accent,
                letterSpacing: "-0.5px",
              }}
            >
              {value}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "var(--text-2)",
                fontWeight: 600,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}
      >
        {chartData30d.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                height: d.val ? "100%" : "15%",
                background: d.val ? color : "#EEF0F5",
                borderRadius: "2px 2px 0 0",
                opacity: d.val ? 1 : 0.5,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHabits() {
  return (
    <div className="habit-empty anim-3">
      <span className="habit-empty-icon">🌱</span>
      <p className="habit-empty-title">No habits yet</p>
      <p className="habit-empty-sub">Tap + to add your first habit!</p>
    </div>
  );
}
function Spinner() {
  return (
    <div className="status-screen">
      <div className="loading-dot" />
      <p className="status-msg">Loading…</p>
    </div>
  );
}
