// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  (Full featured v5)
// New features:
//   ✅ Custom frequency — specific days of week
//   ✅ Custom icons — pick from 24 options
//   ✅ Edit habit — name, icon, frequency, days
//   ✅ Delete habit
//   ✅ Detailed stats per habit — 7d / 30d / history
//   ✅ Dashboard with progress per habit
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import "./App.css";
import {
  loginUser, registerUser, logoutUser,
  subscribeToAuth, fetchUser, ensureUserDoc,
  subscribeToHabits, computeSummary,
  logHabitToday, addHabit, editHabit, deleteHabit,
  HABIT_ICON_OPTIONS, WEEK_DAYS,
} from "./firebase/habitService";

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
  const [authUser, setAuthUser] = useState(undefined);

  useEffect(() => {
    return subscribeToAuth(setAuthUser);
  }, []);

  if (authUser === undefined) return <Spinner />;
  if (!authUser) return <AuthScreen />;
  return <Dashboard authUser={authUser} />;
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode,     setMode]     = useState("login");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    if (mode === "register" && !name.trim()) { setError("Please enter your name."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email.trim(), password);
      } else {
        const cred = await registerUser(email.trim(), password);
        await ensureUserDoc(cred.user.uid, name.trim());
      }
    } catch(e) {
      const msg = e.code === "auth/user-not-found"      ? "No account found with this email."
                : e.code === "auth/wrong-password"       ? "Incorrect password."
                : e.code === "auth/email-already-in-use" ? "Account already exists with this email."
                : e.code === "auth/invalid-email"         ? "Please enter a valid email."
                : e.code === "auth/invalid-credential"    ? "Incorrect email or password."
                : e.message;
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="shell"><div className="phone">
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo">✦</div>
        <p className="auth-app-name">Habit App</p>
        <p className="auth-tagline">Build better habits, one day at a time.</p>
      </div>
      <div className="auth-card">
        <p className="auth-title">{mode==="login" ? "Welcome back 👋" : "Create account ✦"}</p>
        <p className="auth-sub">{mode==="login" ? "Sign in to see your habits" : "Start your habit journey today"}</p>
        {mode==="register" && (
          <div className="field-wrap">
            <label className="field-label">Your name</label>
            <input className="field-input" type="text" placeholder="e.g. Tam" value={name} onChange={e=>setName(e.target.value)} maxLength={40} />
          </div>
        )}
        <div className="field-wrap">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Password</label>
          <div className="pass-wrap">
            <input className="field-input pass-input" type={showPass?"text":"password"} placeholder="Minimum 6 characters" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
            <button className="pass-toggle" onClick={()=>setShowPass(s=>!s)} tabIndex={-1}>{showPass?"🙈":"👁️"}</button>
          </div>
        </div>
        {error && <p className="auth-error">⚠️ {error}</p>}
        <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? (mode==="login"?"Signing in…":"Creating account…") : (mode==="login"?"Sign In →":"Create Account →")}
        </button>
        <p className="auth-switch">
          {mode==="login" ? "Don't have an account? " : "Already have an account? "}
          <button className="auth-link" onClick={()=>{setMode(m=>m==="login"?"register":"login");setError("");}}>
            {mode==="login"?"Register":"Sign In"}
          </button>
        </p>
      </div>
      <p className="auth-footer">🔒 Your data is private and secure</p>
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ authUser }) {
  const [user,          setUser]          = useState(null);
  const [habits,        setHabits]        = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [chartPeriod,   setChartPeriod]   = useState("7");
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [editingHabit,  setEditingHabit]  = useState(null);
  const [logging,       setLogging]       = useState({});
  const [activeTab,     setActiveTab]     = useState("today"); // "today" | "stats" | "progress"

  const userId = authUser.uid;

  useEffect(() => {
    fetchUser(userId).then(setUser).catch(e => setError(e.message));
  }, [userId]);

  useEffect(() => {
    return subscribeToHabits(userId,
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
  }, [userId]);

  async function handleLog(habitId, status) {
    setLogging(prev => ({ ...prev, [habitId]: true }));
    try { await logHabitToday(userId, habitId, status); }
    catch(e) { alert("Could not save: " + e.message); }
    finally { setLogging(prev => ({ ...prev, [habitId]: false })); }
  }

  async function handleAddHabit(data) {
    try { await addHabit(userId, data); setShowAddModal(false); }
    catch(e) { alert("Could not add: " + e.message); }
  }

  async function handleEditHabit(data) {
    try { await editHabit(userId, editingHabit.id, data); setEditingHabit(null); }
    catch(e) { alert("Could not edit: " + e.message); }
  }

  async function handleDeleteHabit(habitId) {
    if (!window.confirm("Delete this habit and all its logs? This cannot be undone.")) return;
    try {
      await deleteHabit(userId, habitId);
      if (selectedHabit?.id === habitId) setSelectedHabit(null);
    } catch(e) { alert("Could not delete: " + e.message); }
  }

  const chartData = selectedHabit
    ? (chartPeriod === "7" ? selectedHabit.chartData7d : selectedHabit.chartData30d)
    : [];
  const aiMessage = user
    ? `You're doing great, ${user.name}. Consistency is your superpower — keep showing up! 🌟`
    : "Keep going — small progress is still progress. 🌟";

  if (loading) return <Spinner />;
  if (error)   return <div className="status-screen"><p style={{fontSize:36,marginBottom:12}}>⚠️</p><p className="status-title">Error</p><p className="status-msg">{error}</p></div>;

  return (
    <div className="shell"><div className="phone">
      <Header user={user ?? { name: authUser.email?.split("@")[0] ?? "Tam", avatarInitial:"T" }} onLogout={logoutUser} />

      {/* Tab bar */}
      <div className="tab-bar">
        {[["today","🏠 Today"],["stats","📊 Stats"],["progress","🎯 Progress"]].map(([t,label])=>(
          <button key={t} className={`tab-btn${activeTab===t?" tab-btn--active":""}`} onClick={()=>setActiveTab(t)}>{label}</button>
        ))}
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === "today" && <>
        {summary && <SummaryCards data={summary} />}
        <p className="section-label anim-2">My Habits</p>
        <HabitList
          habits={habits} selectedId={selectedHabit?.id} logging={logging}
          onSelect={setSelectedHabit} onLog={handleLog}
          onEdit={h => setEditingHabit(h)} onDelete={handleDeleteHabit}
        />
        {selectedHabit && (
          <ProgressChart habit={selectedHabit} chartData={chartData} period={chartPeriod} onPeriodChange={setChartPeriod} />
        )}
        {selectedHabit?.weeklyDays?.length > 0 && <WeeklySummary days={selectedHabit.weeklyDays} />}
        <AICoach message={aiMessage} />
      </>}

      {/* ── STATS TAB ── */}
      {activeTab === "stats" && <>
        <p className="section-label" style={{marginTop:16}}>Statistics</p>
        {habits.length === 0 ? <EmptyHabits /> : habits.map(h => (
          <HabitStatCard key={h.id} habit={h} />
        ))}
      </>}

      {/* ── PROGRESS TAB ── */}
      {activeTab === "progress" && <>
        <p className="section-label" style={{marginTop:16}}>30-Day Progress</p>
        {habits.length === 0 ? <EmptyHabits /> : habits.map(h => (
          <HabitProgressCard key={h.id} habit={h} />
        ))}
      </>}

      <div style={{height:100}} />

      {/* FAB */}
      <button className="fab" onClick={()=>setShowAddModal(true)} title="Add habit">
        <span className="fab-icon">+</span>
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <HabitFormModal title="New Habit" onSave={handleAddHabit} onClose={()=>setShowAddModal(false)} />
      )}

      {/* Edit Modal */}
      {editingHabit && (
        <HabitFormModal title="Edit Habit" initial={editingHabit} onSave={handleEditHabit} onClose={()=>setEditingHabit(null)} />
      )}
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ user, onLogout }) {
  return (
    <div className="header anim-1">
      <div style={{flex:1,minWidth:0}}>
        <div className="header-badge"><div className="header-dot"/><span className="header-badge-text">Active today</span></div>
        <p className="header-greeting">{getGreeting()}, {user.name} 👋</p>
        <p className="header-sub">Small progress is still progress. Keep going.</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
        <div className="avatar-wrap">
          <div className="avatar">{user.avatarInitial}</div>
          <div className="avatar-ring"/>
          <div className="avatar-status"/>
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
  {key:"totalHabits",   label:"Habits",  icon:"✦", accent:"#4E8EF7", fmt:v=>v      },
  {key:"doneToday",     label:"Done",    icon:"✓", accent:"#34C77B", fmt:v=>v      },
  {key:"currentStreak", label:"Streak",  icon:"🔥", accent:"#FF6B6B", fmt:v=>`${v}d`},
  {key:"successRate",   label:"Success", icon:"◎", accent:"#A78BFA", fmt:v=>`${v}%`},
];

function SummaryCards({ data }) {
  return (
    <div className="summary-grid anim-1">
      {CARDS_CFG.map(({key,label,icon,accent,fmt})=>(
        <div key={key} className="stat-card" style={{borderTopColor:accent}}>
          <span className="stat-icon" style={{color:accent}}>{icon}</span>
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
function HabitList({ habits, selectedId, logging, onSelect, onLog, onEdit, onDelete }) {
  if (!habits.length) return <EmptyHabits />;
  return (
    <div className="habit-list anim-3">
      {habits.map(h=>(
        <HabitCard key={h.id} habit={h} selected={h.id===selectedId}
          isLogging={logging[h.id]} onSelect={()=>onSelect(h)}
          onLog={onLog} onEdit={()=>onEdit(h)} onDelete={()=>onDelete(h.id)} />
      ))}
    </div>
  );
}

function HabitCard({ habit, selected, isLogging, onSelect, onLog, onEdit, onDelete }) {
  const { id, todayStatus, color, icon, name, frequency, scheduledDays, streak } = habit;
  const done      = todayStatus === "done";
  const missed    = todayStatus === "missed";
  const notSched  = todayStatus === "not-scheduled";
  const [showMenu, setShowMenu] = useState(false);

  const freqLabel = frequency === "daily" ? "Daily"
    : frequency === "weekly" ? "Weekly"
    : scheduledDays?.join(", ") ?? "Custom";

  return (
    <div className={`habit-card${selected?" selected":""}`}
      style={{borderColor:selected?color:"transparent",boxShadow:selected?`0 4px 20px ${color}28`:undefined}}>
      <div className="habit-icon-bg" style={{background:`${color}18`,cursor:"pointer"}} onClick={onSelect}>{icon}</div>
      <div className="habit-info" style={{cursor:"pointer"}} onClick={onSelect}>
        <span className="habit-name">{name}</span>
        <span className="habit-freq">{freqLabel}</span>
      </div>
      <div className="habit-right">
        {notSched ? (
          <span className="habit-badge badge-pending">— Rest day</span>
        ) : isLogging ? (
          <span className="habit-saving">saving…</span>
        ) : (
          <div className="log-btns">
            <button className={`log-btn log-done${done?" log-done--active":""}`} onClick={()=>onLog(id,"done")} title="Done">✓</button>
            <button className={`log-btn log-miss${missed?" log-miss--active":""}`} onClick={()=>onLog(id,"missed")} title="Missed">✗</button>
          </div>
        )}
        {streak > 0 && <span className="habit-streak">🔥 {streak}</span>}

        {/* Options menu */}
        <div style={{position:"relative"}}>
          <button className="menu-btn" onClick={()=>setShowMenu(s=>!s)}>⋯</button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={()=>{onEdit();setShowMenu(false);}}>✏️ Edit</button>
              <button onClick={()=>{onDelete();setShowMenu(false);}} style={{color:"var(--coral)"}}>🗑️ Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT FORM MODAL — Add & Edit
// ═══════════════════════════════════════════════════════════════
function HabitFormModal({ title, initial, onSave, onClose }) {
  const [name,      setName]      = useState(initial?.name ?? "");
  const [icon,      setIcon]      = useState(initial?.icon ?? "✨");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "daily");
  const [days,      setDays]      = useState(initial?.scheduledDays ?? []);
  const [saving,    setSaving]    = useState(false);
  const [iconPage,  setIconPage]  = useState(false);

  function toggleDay(d) {
    setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d]);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    if (frequency === "custom" && days.length === 0) {
      alert("Please select at least one day."); return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), icon, frequency, scheduledDays: frequency==="custom" ? days : WEEK_DAYS });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <p className="modal-title">{title}</p>

        {/* Icon picker */}
        <label className="field-label">Icon</label>
        <div className="icon-picker-row">
          <div className="icon-selected">{icon}</div>
          <button className="icon-browse-btn" onClick={()=>setIconPage(s=>!s)}>
            {iconPage ? "Close" : "Choose icon"}
          </button>
        </div>

        {iconPage && (
          <div className="icon-grid">
            {HABIT_ICON_OPTIONS.map(({icon:ic,label})=>(
              <button
                key={ic}
                className={`icon-option${icon===ic?" icon-option--active":""}`}
                onClick={()=>{setIcon(ic);setIconPage(false);}}
                title={label}
              >
                {ic}
              </button>
            ))}
          </div>
        )}

        {/* Name */}
        <label className="field-label" style={{marginTop:16}}>Habit name</label>
        <input
          className="field-input"
          type="text"
          placeholder="e.g. Exercise, Reading…"
          value={name}
          onChange={e=>setName(e.target.value)}
          maxLength={40}
          autoFocus={!iconPage}
          onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
        />

        {/* Frequency */}
        <label className="field-label">Frequency</label>
        <div className="freq-row">
          {[["daily","📅 Daily"],["custom","📆 Pick days"]].map(([f,label])=>(
            <button key={f} className={`freq-btn${frequency===f?" freq-btn--active":""}`} onClick={()=>setFrequency(f)}>{label}</button>
          ))}
        </div>

        {/* Day picker (custom only) */}
        {frequency === "custom" && (
          <>
            <label className="field-label">Which days?</label>
            <div className="day-picker">
              {WEEK_DAYS.map(d=>(
                <button
                  key={d}
                  className={`day-btn${days.includes(d)?" day-btn--active":""}`}
                  onClick={()=>toggleDay(d)}
                >{d}</button>
              ))}
            </div>
            {days.length > 0 && (
              <p className="day-summary">{days.length}x per week · {days.join(", ")}</p>
            )}
          </>
        )}

        <button className="submit-btn" onClick={handleSubmit} disabled={!name.trim()||saving} style={{marginTop:24}}>
          {saving ? "Saving…" : (initial ? "Save Changes ✦" : "Add Habit ✦")}
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
          <span className="chart-sub">{period==="7"?"Last 7 days":"Last 30 days"}</span>
        </div>
        <div className="period-tabs">
          {["7","30"].map(p=>(
            <button key={p} className={`period-btn${period===p?" active":""}`}
              style={period===p?{background:habit.color}:undefined}
              onClick={()=>onPeriodChange(p)}>{p}D</button>
          ))}
        </div>
      </div>
      <div className="bar-chart">
        {chartData.map((d,i)=>(
          <div key={i} className="bar-col">
            <div className="bar-track">
              <div className="bar-fill" style={{
                height:`${d.val*100}%`,
                background: d.val ? habit.color : "transparent",
              }}/>
            </div>
            {(period==="7"||i%5===0)&&<span className="bar-label">{d.day}</span>}
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <div className="legend-dot" style={{background:habit.color}}/>
        <span className="legend-text">Done</span>
        <div className="legend-dot legend-miss"/>
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
      <p className="section-label" style={{padding:0,marginBottom:14}}>This Week</p>
      <div className="weekly-row">
        {days.map(d=>(
          <div key={d.day} className="week-day">
            <div className={`week-dot ${d.done?"done":d.scheduled?"miss":"rest"}`}>
              {d.done?"✓":d.scheduled?"✗":"–"}
            </div>
            <span className="week-label">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT STAT CARD (Stats tab)
// ═══════════════════════════════════════════════════════════════
function HabitStatCard({ habit }) {
  const { name, icon, color, streak, successRate, totalDone, totalLogged, chartData30d } = habit;
  return (
    <div className="stat-detail-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div className="habit-icon-bg" style={{background:`${color}18`,width:44,height:44,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>{name}</p>
          <p style={{fontSize:12,color:"var(--text-2)",marginTop:2}}>Last 30 days</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:24,fontWeight:800,color,letterSpacing:"-1px"}}>{successRate}%</p>
          <p style={{fontSize:11,color:"var(--text-2)"}}>success</p>
        </div>
      </div>

      {/* Mini stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {label:"Streak",    value:`${streak}d`,   accent:"#FF6B6B"},
          {label:"Done",      value:totalDone,       accent:"#34C77B"},
          {label:"Logged",    value:totalLogged,     accent:"#4E8EF7"},
        ].map(({label,value,accent})=>(
          <div key={label} style={{background:"#F7F8FC",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <p style={{fontSize:18,fontWeight:800,color:accent,letterSpacing:"-0.5px"}}>{value}</p>
            <p style={{fontSize:10,color:"var(--text-2)",fontWeight:600,textTransform:"uppercase",marginTop:2}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:48}}>
        {chartData30d.map((d,i)=>(
          <div key={i} style={{flex:1,height:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
            <div style={{
              width:"100%",
              height: d.val ? "100%" : d.scheduled ? "20%" : "8%",
              background: d.val ? color : d.scheduled ? "#E8EAF0" : "#F5F5F5",
              borderRadius:"3px 3px 0 0",
              opacity: d.val ? 1 : 0.5,
            }}/>
          </div>
        ))}
      </div>
      <p style={{fontSize:10,color:"var(--text-3)",marginTop:6,textAlign:"center"}}>30-day activity</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT PROGRESS CARD (Progress tab)
// ═══════════════════════════════════════════════════════════════
function HabitProgressCard({ habit }) {
  const { name, icon, color, successRate, history } = habit;
  const recent = history?.slice(-14) ?? [];

  return (
    <div className="stat-detail-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{fontSize:24}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>{name}</p>
        </div>
        {/* Progress ring */}
        <div style={{position:"relative",width:52,height:52}}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#EEF0F5" strokeWidth="5"/>
            <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="5"
              strokeDasharray={`${2*Math.PI*22}`}
              strokeDashoffset={`${2*Math.PI*22*(1-successRate/100)}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
          </svg>
          <p style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color}}>{successRate}%</p>
        </div>
      </div>

      {/* 14-day calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {recent.map((d,i)=>(
          <div key={i} style={{textAlign:"center"}}>
            <div style={{
              width:"100%", aspectRatio:"1",
              borderRadius:6,
              background: d.status==="done" ? color
                        : d.status==="missed" ? "#FDECEA"
                        : d.status==="not-scheduled" ? "#F9FAFB"
                        : "#F3F4F6",
              border: d.status==="missed" ? "1px solid #FFCDD2" : "none",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,
            }}>
              {d.status==="done" ? <span style={{color:"#fff"}}>✓</span>
               : d.status==="missed" ? <span style={{color:"#F4845F"}}>✗</span>
               : d.status==="not-scheduled" ? <span style={{color:"#D1D5DB"}}>–</span>
               : null}
            </div>
            <p style={{fontSize:8,color:"var(--text-3)",marginTop:2}}>{d.dayName?.slice(0,1)}</p>
          </div>
        ))}
      </div>
      <p style={{fontSize:10,color:"var(--text-3)",marginTop:8,textAlign:"center"}}>Last 14 days · green=done · red=missed · gray=rest</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH
// ═══════════════════════════════════════════════════════════════
function AICoach({ message }) {
  return (
    <div className="ai-card anim-6">
      <div className="ai-glow"/>
      <div className="ai-header">
        <div className="ai-icon-box">✨</div>
        <div><span className="ai-title">AI Coach</span><span className="ai-powered">Powered by Claude</span></div>
      </div>
      <p className="ai-msg">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function EmptyHabits() {
  return (
    <div className="habit-empty anim-3">
      <span className="habit-empty-icon">🌱</span>
      <p className="habit-empty-title">No habits yet</p>
      <p className="habit-empty-sub">Tap the + button to add your first habit!</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="status-screen">
      <div className="loading-dot"/>
      <p className="status-msg">Loading…</p>
    </div>
  );
}
