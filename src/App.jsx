// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  v8
// New in v8: Calendar + stats show partial completion visually
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import {
  loginUser, registerUser, logoutUser,
  subscribeToAuth, fetchUser, ensureUserDoc,
  subscribeToHabits, computeSummary,
  logHabitToday, logHabitDate, addHabit, editHabit, deleteHabit,
  HABIT_ICON_OPTIONS, WEEK_DAYS,
  REWARD_BADGES, computeEarnedBadges,
  auth,  // ← we need this for sendPasswordResetEmail
} from "./firebase/habitService";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  requestNotificationPermission,
  showTestNotification,
  scheduleDailyNotification,
  cancelNotification,
  rescheduleAllReminders,
  openGoogleCalendar,
} from "./reminderService";

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
// AUTH  (v7: added Forgot Password flow)
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [show, setShow]       = useState(false);

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  function clearError() { setError(""); }

  // ── Sign in / Register ──────────────────────────────────────
  async function submit() {
    clearError();
    if (!email.trim() || !pass) { setError("Please fill in all fields."); return; }
    if (mode === "register" && !name.trim()) { setError("Please enter your name."); return; }
    if (pass.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email.trim(), pass);
      } else {
        const c = await registerUser(email.trim(), pass);
        await ensureUserDoc(c.user.uid, name.trim());
      }
    } catch (e) {
      setError(
        e.code === "auth/user-not-found"      ? "No account found." :
        e.code === "auth/wrong-password"      ? "Incorrect password." :
        e.code === "auth/email-already-in-use"? "Email already registered." :
        e.code === "auth/invalid-credential"  ? "Incorrect email or password." :
        e.message
      );
    } finally { setLoading(false); }
  }

  // ── Forgot password ─────────────────────────────────────────
  async function submitForgot() {
    clearError();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotSent(true);
    } catch (e) {
      setError(
        e.code === "auth/user-not-found"  ? "No account found with this email." :
        e.code === "auth/invalid-email"   ? "Please enter a valid email address." :
        e.message
      );
    } finally { setLoading(false); }
  }

  function goToForgot() { setForgotMode(true); clearError(); setForgotSent(false); }
  function goToSignIn()  { setForgotMode(false); setForgotSent(false); clearError(); }

  return (
    <div className="shell"><div className="phone">
      <div className="auth-hero">
        <div className="auth-hero-orb orb1"/><div className="auth-hero-orb orb2"/>
        <div className="auth-logo">h</div>
        <p className="auth-app-name">Habit App</p>
        <p className="auth-tagline">Build better habits, one day at a time ✦</p>
      </div>

      <div className="auth-card">

        {/* ── Forgot password ── */}
        {forgotMode ? (
          <>
            <p className="auth-title">{forgotSent ? "📧 Check your email" : "Reset password"}</p>
            <p className="auth-sub">
              {forgotSent
                ? `We sent a reset link to ${email}`
                : "Enter your email to receive a reset link"}
            </p>

            {forgotSent ? (
              <div style={{textAlign:"center",padding:"8px 0 16px"}}>
                <p style={{fontSize:13,color:"var(--text-2)",lineHeight:1.6,marginBottom:16}}>
                  Click the link in the email to set a new password.
                  Check your spam folder if you don't see it.
                </p>
                <button className="submit-btn" onClick={goToSignIn}>← Back to sign in</button>
              </div>
            ) : (
              <>
                {error && <p className="auth-error">⚠️ {error}</p>}
                <div className="field-wrap">
                  <label className="field-label">Email</label>
                  <input className="field-input" type="email" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    autoCapitalize="none" autoFocus />
                </div>
                <button className="submit-btn" onClick={submitForgot} disabled={loading}>
                  {loading ? "Sending…" : "Send reset link 📧"}
                </button>
                <button className="cancel-btn" onClick={goToSignIn}>← Back to sign in</button>
              </>
            )}
          </>
        ) : (
          /* ── Sign in / Register ── */
          <>
            <p className="auth-title">{mode === "login" ? "Welcome back 👋" : "Create account ✦"}</p>
            <p className="auth-sub">{mode === "login" ? "Sign in to your habits" : "Start your journey today"}</p>

            {mode === "register" && (
              <div className="field-wrap">
                <label className="field-label">Name</label>
                <input className="field-input" type="text" placeholder="e.g. Tam"
                  value={name} onChange={e => setName(e.target.value)} maxLength={40}/>
              </div>
            )}

            <div className="field-wrap">
              <label className="field-label">Email</label>
              <input className="field-input" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none"/>
            </div>

            <div className="field-wrap">
              <label className="field-label">Password</label>
              <div className="pass-wrap">
                <input className="field-input pass-input" type={show ? "text" : "password"}
                  placeholder="Min 6 characters" value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}/>
                <button className="pass-toggle" onClick={() => setShow(s => !s)} tabIndex={-1}>
                  {show ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && <p className="auth-error">⚠️ {error}</p>}

            {/* Forgot password link — only on login mode */}
            {mode === "login" && (
              <p style={{textAlign:"right",marginTop:-4,marginBottom:8}}>
                <button className="auth-link" style={{fontSize:12,color:"var(--text-2)"}}
                  onClick={goToForgot}>
                  Forgot password?
                </button>
              </p>
            )}

            <button className="submit-btn" onClick={submit} disabled={loading}>
              {loading
                ? (mode === "login" ? "Signing in…" : "Creating…")
                : (mode === "login" ? "Sign In →" : "Create Account →")}
            </button>

            <p className="auth-switch">
              {mode === "login" ? "No account? " : "Have an account? "}
              <button className="auth-link" onClick={() => { setMode(m => m === "login" ? "register" : "login"); clearError(); }}>
                {mode === "login" ? "Register" : "Sign In"}
              </button>
            </p>
          </>
        )}
      </div>

      <p className="auth-footer">🔒 Your data is private and secure</p>
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ authUser }) {
  const [user,setUser]             = useState(null);
  const [habits,setHabits]         = useState([]);
  const [summary,setSummary]       = useState(null);
  const [selected,setSelected]     = useState(null);
  const [period,setPeriod]         = useState("7");
  const [loading,setLoading]       = useState(true);
  const [error,setError]           = useState(null);
  const [showAdd,setShowAdd]       = useState(false);
  const [editing,setEditing]       = useState(null);
  const [tab,setTab]               = useState("today");
  const [calHabit,setCalHabit]     = useState(null);
  const [notifPerm,setNotifPerm]   = useState(Notification?.permission ?? "default");
  const [gcalStatus,setGcalStatus] = useState({});
  const uid = authUser.uid;
  // Track optimistic updates — ignore Firestore re-fetch for 3 seconds after a log
  const pendingLogRef = useRef(null);

  useEffect(() => { fetchUser(uid).then(setUser).catch(e=>setError(e.message)); },[uid]);
  useEffect(() => subscribeToHabits(uid,
    fresh => {
      // If we just made an optimistic update, merge Firestore data carefully
      // to preserve our _rawLogs until Firestore catches up
      if (pendingLogRef.current && Date.now() - pendingLogRef.current < 3000) {
        // Merge: use fresh data but keep our optimistic _rawLogs for updated habits
        setHabits(prev => fresh.map(fh => {
          const ph = prev.find(h => h.id === fh.id);
          // If this habit has our optimistic _rawLogs and Firestore doesn't have
          // the new log yet, keep our optimistic version
          if (ph && ph._rawLogs?.length > fh._rawLogs?.length) {
            return { ...fh, _rawLogs: ph._rawLogs,
              todayStatus: ph.todayStatus, todayPartial: ph.todayPartial };
          }
          return fh;
        }));
      } else {
        setHabits(fresh);
      }
      setSummary(computeSummary(fresh));
      setSelected(p => p ? (fresh.find(h=>h.id===p.id)??fresh[0]??null) : (fresh[0]??null));
      setLoading(false);
    },
    e => { setError(e.message); setLoading(false); }
  ),[uid]);

  useEffect(() => {
    if (habits.length > 0) rescheduleAllReminders(habits);
  }, [habits]);

  const earnedBadges = useMemo(() => computeEarnedBadges(habits, summary), [habits, summary]);

  // ── v7: handleLog now supports partial completion ────────────
  function handleLog(hid, status, partial) {
    // Get today's Bangkok date key (must match habitService.bangkokKey logic)
    const now = new Date();
    const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayKey = `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth()+1).padStart(2,"0")}-${String(bkk.getUTCDate()).padStart(2,"0")}`;

    setHabits(prev => prev.map(h => {
      if (h.id !== hid) return h;

      // Update _rawLogs immediately so calendar + stats reflect the change
      let newRawLogs = (h._rawLogs ?? []).filter(l => {
        // Remove old log for today if exists
        const ld = l.date?.toDate ? l.date.toDate() : new Date(l.date?.seconds*1000 ?? l.date);
        const lBkk = new Date(ld.getTime() + 7*60*60*1000);
        const lKey = `${lBkk.getUTCFullYear()}-${String(lBkk.getUTCMonth()+1).padStart(2,"0")}-${String(lBkk.getUTCDate()).padStart(2,"0")}`;
        return lKey !== todayKey;
      });

      if (status !== "none") {
        // Add the new log entry
        newRawLogs = [...newRawLogs, {
          date: { seconds: Math.floor(now.getTime() / 1000) },
          status,
          partial: partial ?? null,
        }];
      }

      // Recompute stats with updated logs
      const { computeHabitStats: _ } = {}; // stats recomputed by Firestore subscription
      return {
        ...h,
        todayStatus:  status === "none" ? "none" : status,
        todayPartial: partial ?? null,
        _rawLogs:     newRawLogs,
      };
    }));

    setSummary(prev => {
      if (!prev) return prev;
      const h       = habits.find(x => x.id === hid);
      const wasDone = h?.todayStatus === "done";
      const isDone  = status === "done";
      const delta   = isDone && !wasDone ? 1 : !isDone && wasDone ? -1 : 0;
      return { ...prev, doneToday: Math.max(0, prev.doneToday + delta) };
    });

    pendingLogRef.current = Date.now();  // mark optimistic update time
    logHabitToday(uid, hid, status, partial)
      .then(() => {
        // After save, clear pending flag so next Firestore update is accepted
        setTimeout(() => { pendingLogRef.current = null; }, 1000);
      })
      .catch(e => console.error("Save failed:", e.message));
  }

  async function handleAddHabit(d) {
    try { await addHabit(uid, d); setShowAdd(false); }
    catch(e) { alert(e.message); }
  }

  async function handleEditHabit(d) {
    try {
      await editHabit(uid, editing.id, d);
      if (d.reminderEnabled && d.reminderTime && notifPerm === "granted") {
        scheduleDailyNotification(editing.id, d.name, d.icon, d.reminderTime);
      } else {
        cancelNotification(editing.id);
      }
      setEditing(null);
    } catch(e) { alert(e.message); }
  }

  async function handleDelete(hid) {
    if (!window.confirm("Delete this habit and all its data?")) return;
    try {
      cancelNotification(hid);
      await deleteHabit(uid, hid);
      if (selected?.id === hid) setSelected(null);
    } catch(e) { alert(e.message); }
  }

  async function handleRequestNotifPermission() {
    const result = await requestNotificationPermission();
    setNotifPerm(result);
    if (result === "granted") rescheduleAllReminders(habits);
    else if (result === "denied") alert("Notifications blocked. Please enable them in your browser settings.");
  }

  function handleCreateGcalReminder(habit) {
    if (!habit.reminderEnabled || !habit.reminderTime) return;
    setGcalStatus(p => ({ ...p, [habit.id]: "creating" }));
    try {
      openGoogleCalendar(habit);
      setGcalStatus(p => ({ ...p, [habit.id]: "done" }));
    } catch(e) {
      setGcalStatus(p => ({ ...p, [habit.id]: "error" }));
      alert("Could not open Google Calendar: " + e.message);
    }
  }

  // Always derive selected from latest habits array for instant updates
  const selectedHabit = selected ? (habits.find(h => h.id === selected.id) ?? selected) : null;

  // Recompute chartData directly from _rawLogs for instant updates
  const chartData = useMemo(() => {
    if (!selectedHabit) return [];
    const rawLogs = selectedHabit._rawLogs ?? [];
    const statusMap = {}, partialMap = {};
    rawLogs.forEach(log => {
      let d;
      if (log.date?.toDate) d = log.date.toDate();
      else if (log.date?.seconds) d = new Date(log.date.seconds * 1000);
      else d = new Date(log.date ?? 0);
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      statusMap[key] = log.status;
      if (log.partial) partialMap[key] = log.partial;
    });
    const days = period === "7" ? 7 : 30;
    const today = new Date();
    return Array.from({length: days}, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const dn = DAY_LABELS[d.getDay()];
      const scheduled = selectedHabit.frequency === "daily" || (selectedHabit.scheduledDays ?? WEEK_DAYS).includes(dn);
      const status  = statusMap[key] ?? (scheduled ? "none" : "not-scheduled");
      const partial = partialMap[key] ?? null;
      const label   = days <= 7 ? dn.slice(0,3) : `${d.getDate()}`;
      return { day: label, date: key, val: status==="done"?1:0, status, partial, scheduled };
    });
  }, [selectedHabit?._rawLogs, period]);

  // Recompute weeklyDays from _rawLogs for instant updates
  const weeklyDays = useMemo(() => {
    if (!selectedHabit) return [];
    const rawLogs = selectedHabit._rawLogs ?? [];
    const statusMap = {}, partialMap = {};
    rawLogs.forEach(log => {
      let d;
      if (log.date?.toDate) d = log.date.toDate();
      else if (log.date?.seconds) d = new Date(log.date.seconds * 1000);
      else d = new Date(log.date ?? 0);
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      statusMap[key] = log.status;
      if (log.partial) partialMap[key] = log.partial;
    });
    const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const today = new Date();
    const dow = today.getDay();
    const monOff = (dow + 6) % 7;
    const mon = new Date(today);
    mon.setDate(today.getDate() - monOff);
    return WEEK_DAYS.map((label, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      const sched = selectedHabit.frequency === "daily" || (selectedHabit.scheduledDays ?? WEEK_DAYS).includes(label);
      const status  = statusMap[key] ?? "none";
      const partial = partialMap[key] ?? null;
      return { day: label, done: status==="done", scheduled: sched, partial };
    });
  }, [selectedHabit?._rawLogs]);

  if (loading) return <Spinner/>;
  if (error)   return <div className="status-screen"><p style={{fontSize:36}}>⚠️</p><p className="status-msg">{error}</p></div>;

  return (
    <div className="shell"><div className="phone">
      <Header user={user??{name:authUser.email?.split("@")[0]??"Tam",avatarInitial:"T"}} onLogout={logoutUser} earnedCount={earnedBadges.length}/>

      <div className="tab-bar">
        {[["today","🏠"],["calendar","📅"],["stats","📊"],["reminders","⏰"],["badges","🏆"]].map(([t,l])=>(
          <button key={t} className={`tab-btn${tab===t?" tab-btn--active":""}`} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {tab==="today"&&<>
        {notifPerm !== "granted" && (
          <NotifBanner onAllow={handleRequestNotifPermission} denied={notifPerm==="denied"}/>
        )}
        {summary&&<SummaryCards data={summary}/>}
        {earnedBadges.length>0&&<NewBadgeAlert badges={earnedBadges.slice(-1)}/>}
        <p className="section-label anim-2">My Habits</p>
        <HabitList habits={habits} selectedId={selected?.id}
          onSelect={setSelected} onLog={handleLog}
          onEdit={h=>setEditing(h)} onDelete={handleDelete}/>
        {selectedHabit&&<ProgressChart habit={selectedHabit} chartData={chartData} period={period} onPeriodChange={setPeriod}/>}
        {weeklyDays?.length>0&&<WeeklySummary days={weeklyDays}/>}
        <AICoachCard habits={habits} summary={summary} earnedBadges={earnedBadges}/>
      </>}

      {tab==="calendar"&&<>
        <p className="section-label" style={{marginTop:16}}>History Calendar</p>
        <div className="cal-habit-picker">
          {habits.map(h=>(
            <button key={h.id} className={`cal-habit-chip${calHabit?.id===h.id?" active":""}`}
              style={calHabit?.id===h.id?{background:h.color,color:"#fff"}:{}}
              onClick={()=>setCalHabit(h)}>{h.icon} {h.name}</button>
          ))}
        </div>
        {calHabit
          ? <CalendarView habit={calHabit} uid={uid}/>
          : <div className="cal-empty">👆 Select a habit above to view its history</div>
        }
      </>}

      {tab==="stats"&&<>
        <p className="section-label" style={{marginTop:16}}>Statistics</p>
        {habits.length===0?<EmptyHabits/>:habits.map(h=><HabitStatCard key={h.id} habit={h}/>)}
      </>}

      {tab==="reminders"&&<RemindersTab
        habits={habits} notifPerm={notifPerm} gcalStatus={gcalStatus} uid={uid}
        onRequestPermission={handleRequestNotifPermission}
        onEditHabit={h=>setEditing(h)}
        onCreateGcal={handleCreateGcalReminder}
        onTestNotif={h=>showTestNotification(h.name, h.icon)}
      />}

      {tab==="badges"&&<BadgesTab habits={habits} summary={summary} earnedBadges={earnedBadges}/>}

      <div style={{height:100}}/>
      <button className="fab" onClick={()=>setShowAdd(true)} title="Add habit"><span className="fab-icon">+</span></button>
      {showAdd&&<HabitFormModal title="New Habit" onSave={handleAddHabit} onClose={()=>setShowAdd(false)}/>}
      {editing&&<HabitFormModal title="Edit Habit" initial={editing} onSave={handleEditHabit} onClose={()=>setEditing(null)}/>}
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ user, onLogout, earnedCount }) {
  return (
    <div className="header anim-1">
      <div className="header-orb h-orb1"/><div className="header-orb h-orb2"/>
      <div style={{flex:1,minWidth:0,position:"relative",zIndex:1}}>
        <div className="header-badge"><div className="header-dot"/><span className="header-badge-text">Active today</span></div>
        <p className="header-greeting">{getGreeting()}, {user.name} 👋</p>
        <p className="header-sub">Small progress is still progress.</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,position:"relative",zIndex:1}}>
        <div className="avatar-wrap">
          <div className="avatar">{user.avatarInitial}</div>
          <div className="avatar-ring"/><div className="avatar-status"/>
          {earnedCount>0&&<div className="badge-count">{earnedCount}</div>}
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
  {key:"totalHabits",label:"Habits",icon:"✦",accent:"#4E8EF7",fmt:v=>v},
  {key:"doneToday",label:"Done",icon:"✓",accent:"#34C77B",fmt:v=>v},
  {key:"currentStreak",label:"Streak",icon:"🔥",accent:"#FF6B6B",fmt:v=>`${v}d`},
  {key:"successRate",label:"Success",icon:"◎",accent:"#A78BFA",fmt:v=>`${v}%`},
];
function SummaryCards({data}) {
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
// NEW BADGE ALERT
// ═══════════════════════════════════════════════════════════════
function NewBadgeAlert({badges}) {
  const [visible,setVisible] = useState(true);
  if (!visible||!badges.length) return null;
  const b = badges[0];
  return (
    <div className="badge-alert">
      <span className="badge-alert-icon">{b.icon}</span>
      <div><p className="badge-alert-title">New Badge: {b.label}</p><p className="badge-alert-desc">{b.desc}</p></div>
      <button onClick={()=>setVisible(false)} className="badge-alert-close">✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT LIST
// ═══════════════════════════════════════════════════════════════
function HabitList({habits,selectedId,onSelect,onLog,onEdit,onDelete}) {
  if (!habits.length) return <EmptyHabits/>;
  return (
    <div className="habit-list anim-3">
      {habits.map(h=><HabitCard key={h.id} habit={h} selected={h.id===selectedId}
        onSelect={()=>onSelect(h)} onLog={onLog}
        onEdit={()=>onEdit(h)} onDelete={()=>onDelete(h.id)}/>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT CARD  (v7: added partial completion modal)
// ═══════════════════════════════════════════════════════════════
function HabitCard({habit,selected,onSelect,onLog,onEdit,onDelete}) {
  const {id,todayStatus,todayPartial,color,icon,name,frequency,scheduledDays,streak,reminderEnabled,reminderTime} = habit;
  const done    = todayStatus === "done";
  const missed  = todayStatus === "missed";
  const notSched= todayStatus === "not-scheduled";
  const [menu,setMenu]           = useState(false);
  const [showPartial,setShowPartial] = useState(false);

  const freqLabel = frequency==="daily"?"Daily":frequency==="weekly"?"Weekly":scheduledDays?.join(", ")??"Custom";

  function formatTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  }

  // Partial indicator text
  const partialText = done && todayPartial
    ? `${todayPartial.value}${todayPartial.unit ? " " + todayPartial.unit : ""} / ${todayPartial.target}${todayPartial.unit ? " " + todayPartial.unit : ""}`
    : null;

  return (
    <>
      <div className={`habit-card${selected?" selected":""}`}
        style={{borderColor:selected?color:"transparent",boxShadow:selected?`0 4px 20px ${color}28`:undefined}}>
        <div className="habit-icon-bg" style={{background:`${color}18`,cursor:"pointer"}} onClick={onSelect}>{icon}</div>

        <div className="habit-info" style={{cursor:"pointer"}} onClick={onSelect}>
          <span className="habit-name">{name}</span>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,flexWrap:"wrap"}}>
            <span className="habit-freq">{freqLabel}</span>
            {reminderEnabled && reminderTime && (
              <span className="habit-reminder-badge">⏰ {formatTime(reminderTime)}</span>
            )}
          </div>
          {/* Partial progress bar */}
          {done && todayPartial && (
            <div style={{marginTop:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:10,color:"var(--text-2)",fontWeight:600}}>{partialText}</span>
                <span style={{fontSize:10,color:color,fontWeight:700}}>{todayPartial.pct}%</span>
              </div>
              <div style={{height:4,background:"#EEF0F5",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:4,background:color,width:`${todayPartial.pct}%`,transition:"width .4s ease"}}/>
              </div>
            </div>
          )}
        </div>

        <div className="habit-right">
          {notSched ? (
            <span className="habit-badge badge-pending">– Rest</span>
          ) : (
            <div className="log-btns">
              <button
                className={`log-btn log-done${done?" log-done--active":""}`}
                onClick={() => {
                  if (done) {
                    onLog(id, "none", null);
                  } else if (habit.targetValue) {
                    setShowPartial(true); // open partial modal
                  } else {
                    onLog(id, "done", null);
                  }
                }}
                title={done ? "Tap to uncheck" : "Mark done"}
              >✓</button>
              <button
                className={`log-btn log-miss${missed?" log-miss--active":""}`}
                onClick={() => onLog(id, missed ? "none" : "missed", null)}
                title={missed ? "Tap to uncheck" : "Mark missed"}
              >✗</button>
            </div>
          )}
          {streak>0&&<span className="habit-streak">🔥 {streak}</span>}
          <div style={{position:"relative"}}>
            <button className="menu-btn" onClick={()=>setMenu(s=>!s)}>⋯</button>
            {menu&&<div className="menu-dropdown">
              <button onClick={()=>{onEdit();setMenu(false);}}>✏️ Edit</button>
              <button onClick={()=>{onDelete();setMenu(false);}} style={{color:"var(--coral)"}}>🗑️ Delete</button>
            </div>}
          </div>
        </div>
      </div>

      {/* Partial completion modal */}
      {showPartial && (
        <PartialModal
          habit={habit}
          existing={todayPartial}
          onSave={(partial) => {
            onLog(id, "done", partial);
            setShowPartial(false);
          }}
          onFullDone={() => {
            onLog(id, "done", null);
            setShowPartial(false);
          }}
          onClose={() => setShowPartial(false)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARTIAL COMPLETION MODAL  (v7 new)
// ═══════════════════════════════════════════════════════════════
function PartialModal({ habit, existing, onSave, onFullDone, onClose }) {
  const target = habit.targetValue || 100;
  const unit   = habit.unit || "";
  const [value, setValue] = useState(existing?.value ?? target);
  const [note,  setNote]  = useState(existing?.note  ?? "");

  // Round value to avoid floating point issues (e.g. 22.5 → stored as 22.5)
  const pct = Math.min(100, Math.round((value / target) * 100));

  const pctColor =
    pct >= 100 ? "#34C77B" :
    pct >= 75  ? "#4E8EF7" :
    pct >= 50  ? "#F7B731" :
                 "#FF6B6B";

  function handleSave() {
    if (pct >= 100) {
      onFullDone();
    } else {
      // Save with exact pct to avoid rounding errors
      // e.g. 75% of 30 mins: save value=22.5→display as 22.5, pct=75 exactly
      const exactValue = Math.round(value * 10) / 10; // 1 decimal max
      onSave({ value: exactValue, target, unit, pct, note: note.trim() });
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <p className="modal-title">Log Progress — {habit.icon} {habit.name}</p>

        {/* Circular progress indicator */}
        <div style={{display:"flex",justifyContent:"center",margin:"8px 0 20px"}}>
          <div style={{position:"relative",width:96,height:96}}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{transform:"rotate(-90deg)"}}>
              <circle cx="48" cy="48" r="40" fill="none" stroke="#EEF0F5" strokeWidth="8"/>
              <circle cx="48" cy="48" r="40" fill="none" stroke={pctColor} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
                style={{transition:"stroke-dashoffset .3s ease, stroke .3s ease"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:20,fontWeight:800,color:pctColor,lineHeight:1}}>{pct}%</span>
              <span style={{fontSize:10,color:"var(--text-2)",marginTop:2}}>done</span>
            </div>
          </div>
        </div>

        {/* Slider */}
        <label className="field-label">
          How much did you complete?
          <span style={{float:"right",color:"var(--text-2)"}}>Target: {target}{unit ? ` ${unit}` : ""}</span>
        </label>
        <input
          type="range" min={0} max={target}
          step={target > 100 ? Math.ceil(target / 100) : 1}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          style={{width:"100%",margin:"8px 0 4px",accentColor:pctColor}}
        />

        {/* Number input */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <input
            type="number" min={0} max={target * 2}
            value={value}
            onChange={e => setValue(Math.max(0, Number(e.target.value)))}
            className="field-input"
            style={{textAlign:"center",fontSize:20,fontWeight:800,color:pctColor,flex:1}}
          />
          {unit && <span style={{fontSize:14,color:"var(--text-2)",fontWeight:600}}>{unit}</span>}
        </div>

        {/* Quick presets */}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {[25,50,75,100].map(p => {
            // Use exact preset pct to avoid rounding errors (e.g. 75% of 30 = 22.5 → 23 → 77%)
            const v = (p / 100) * target; // keep as float, round only for display
            const isActive = Math.round(value) === Math.round(v);
            return (
              <button key={p}
                onClick={() => setValue(v)}
                style={{
                  flex:1, padding:"8px 0", borderRadius:10, fontSize:12, fontWeight:700,
                  border:"none", cursor:"pointer",
                  background: isActive ? pctColor : "#EEF0F5",
                  color: isActive ? "#fff" : "var(--text-2)",
                  transition:"all .15s",
                }}>
                {p}%
              </button>
            );
          })}
        </div>

        {/* Motivational message */}
        {value > 0 && value < target && (
          <div style={{background:"#F0F4FF",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#4E8EF7",lineHeight:1.5}}>
            {pct >= 75 ? "💪 Almost there! Every bit counts." :
             pct >= 50 ? "⚡ Halfway done is still progress!" :
             "🌱 Showing up is what matters most."}
          </div>
        )}
        {value >= target && (
          <div style={{background:"#F0FFF6",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#34C77B",lineHeight:1.5}}>
            🎉 Full completion! You hit your target!
          </div>
        )}

        {/* Note */}
        <label className="field-label">Note (optional)</label>
        <textarea
          className="field-input"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Felt tired, but still showed up 💪"
          rows={2}
          style={{resize:"none",marginBottom:16}}
          maxLength={200}
        />

        <button className="submit-btn" onClick={handleSave} disabled={value === 0}>
          {value >= target ? "Mark Complete ✓" : `Log ${value}${unit ? " " + unit : ""} (${pct}%)`}
        </button>
        <button className="cancel-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT FORM MODAL  (v7: added Target Value + Unit fields)
// ═══════════════════════════════════════════════════════════════
function HabitFormModal({title,initial,onSave,onClose}) {
  const [name,setName]             = useState(initial?.name??"");
  const [icon,setIcon]             = useState(initial?.icon??"✨");
  const [freq,setFreq]             = useState(initial?.frequency??"daily");
  const [days,setDays]             = useState(initial?.scheduledDays??[]);
  const [reminderOn,setReminderOn] = useState(initial?.reminderEnabled??false);
  const [reminderTime,setRemTime]  = useState(initial?.reminderTime??"08:00");
  const [targetValue,setTarget]    = useState(initial?.targetValue??"");
  const [unit,setUnit]             = useState(initial?.unit??"");
  const [saving,setSaving]         = useState(false);
  const [showIcons,setShowI]       = useState(false);
  const [search,setSearch]         = useState("");

  const filtered = HABIT_ICON_OPTIONS.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggleDay(d) { setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]); }

  async function submit() {
    if (!name.trim()) return;
    if (freq==="custom"&&days.length===0){alert("Pick at least one day.");return;}
    setSaving(true);
    await onSave({
      name: name.trim(), icon,
      frequency: freq,
      scheduledDays: freq==="custom" ? days : WEEK_DAYS,
      reminderEnabled: reminderOn,
      reminderTime,
      targetValue: targetValue ? Number(targetValue) : null,
      unit: unit.trim() || null,
    });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <p className="modal-title">{title}</p>

        <label className="field-label">Icon</label>
        <div className="icon-picker-row">
          <div className="icon-selected">{icon}</div>
          <button className="icon-browse-btn" onClick={()=>setShowI(s=>!s)}>
            {showIcons?"Close ✕":"Browse 50 icons"}
          </button>
        </div>
        {showIcons&&<>
          <input className="field-input" type="text" placeholder="Search icons…" value={search}
            onChange={e=>setSearch(e.target.value)} style={{marginBottom:10}}/>
          <div className="icon-grid">
            {filtered.map(({icon:ic,label})=>(
              <button key={ic} className={`icon-option${icon===ic?" icon-option--active":""}`}
                onClick={()=>{setIcon(ic);setShowI(false);setSearch("");}} title={label}>{ic}</button>
            ))}
          </div>
        </>}

        <label className="field-label" style={{marginTop:16}}>Name</label>
        <input className="field-input" type="text" placeholder="e.g. Exercise, Reading…" value={name}
          onChange={e=>setName(e.target.value)} maxLength={40} onKeyDown={e=>e.key==="Enter"&&submit()}/>

        {/* ── v7: Target value + unit ── */}
        <label className="field-label" style={{marginTop:16}}>
          Daily Target
          <span style={{float:"right",fontSize:10,color:"var(--text-3)",fontWeight:400}}>Optional — enables partial logging</span>
        </label>
        <div style={{display:"flex",gap:8}}>
          <input
            type="number" min={1} max={9999}
            className="field-input"
            placeholder="e.g. 30"
            value={targetValue}
            onChange={e=>setTarget(e.target.value)}
            style={{flex:1}}
          />
          <input
            type="text"
            className="field-input"
            placeholder="unit (mins, pages…)"
            value={unit}
            onChange={e=>setUnit(e.target.value)}
            maxLength={10}
            style={{flex:1.5}}
          />
        </div>
        <p style={{fontSize:11,color:"var(--text-3)",marginTop:4,marginBottom:8}}>
          Example: 30 mins · 20 pages · 8 glasses
        </p>

        <label className="field-label">Frequency</label>
        <div className="freq-row">
          {[["daily","📅 Daily"],["custom","📆 Pick days"]].map(([f,l])=>(
            <button key={f} className={`freq-btn${freq===f?" freq-btn--active":""}`} onClick={()=>setFreq(f)}>{l}</button>
          ))}
        </div>

        {freq==="custom"&&<>
          <label className="field-label">Which days?</label>
          <div className="day-picker">
            {WEEK_DAYS.map(d=>(
              <button key={d} className={`day-btn${days.includes(d)?" day-btn--active":""}`} onClick={()=>toggleDay(d)}>{d}</button>
            ))}
          </div>
          {days.length>0&&<p className="day-summary">{days.length}× per week · {days.join(", ")}</p>}
        </>}

        <div className="reminder-section">
          <div className="reminder-toggle-row">
            <div>
              <p className="reminder-toggle-label">⏰ Set Reminder</p>
              <p className="reminder-toggle-sub">Get notified at a specific time</p>
            </div>
            <button
              className={`toggle-btn${reminderOn?" toggle-btn--on":""}`}
              onClick={()=>setReminderOn(s=>!s)}
            >
              <div className="toggle-thumb"/>
            </button>
          </div>
          {reminderOn&&(
            <div className="reminder-time-wrap">
              <label className="field-label">Reminder time</label>
              <input type="time" className="field-input time-input" value={reminderTime}
                onChange={e=>setRemTime(e.target.value)}/>
              <p className="reminder-hint">📱 In-app + 📅 Google Calendar reminders will be set</p>
            </div>
          )}
        </div>

        <button className="submit-btn" onClick={submit} disabled={!name.trim()||saving} style={{marginTop:20}}>
          {saving?"Saving…":(initial?"Save Changes ✦":"Add Habit ✦")}
        </button>
        <button className="cancel-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR VIEW
// ═══════════════════════════════════════════════════════════════
function CalendarView({habit,uid}) {
  // Force Bangkok timezone (UTC+7) for correct date display
  // CodeSandbox preview browser may run in a different timezone
  function bangkokDateStr(date = new Date()) {
    // Add UTC+7 offset manually
    const bkk = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2,"0");
    return `${bkk.getUTCFullYear()}-${pad(bkk.getUTCMonth()+1)}-${pad(bkk.getUTCDate())}`;
  }
  const today    = new Date();
  const pad = n => String(n).padStart(2,"0");
  const todayStr = bangkokDateStr();  // Use Bangkok time for "today" highlight
  const [year,setYear]     = useState(today.getFullYear());
  const [month,setMonth]   = useState(today.getMonth());
  const [localLog, setLocalLog]         = useState({});
  const [localPartial, setLocalPartial] = useState({});

  const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Build a map of date → partial data from raw logs
  // Uses Bangkok UTC+7 to match how keys are stored
  const partialMap = useMemo(() => {
    const map = {};
    if (!habit?._rawLogs) return map;
    habit._rawLogs.forEach(log => {
      let d;
      if (log.date?.toDate) d = log.date.toDate();
      else if (log.date?.seconds) d = new Date(log.date.seconds * 1000);
      else if (typeof log.date === "string") d = new Date(log.date);
      else d = new Date(log.date);
      // Use Bangkok UTC+7 offset
      const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      const p = n => String(n).padStart(2, "0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      if (log.partial) map[key] = log.partial;
    });
    return map;
  }, [habit]);

  const calDays = useMemo(() => {
    if (!habit?.buildCalendar) return [];
    const start = new Date(year, month, 1);
    const end   = new Date(year, month+1, 0);
    const days  = habit.buildCalendar(start, end);
    return days.map(d => ({
      ...d,
      status:  localLog[d.date] !== undefined ? localLog[d.date] : d.status,
      partial: localPartial[d.date] !== undefined ? localPartial[d.date] : (partialMap[d.date] ?? null),
    }));
  }, [habit, year, month, localLog, partialMap]);

  const firstDay = new Date(year, month, 1).getDay();
  const offset   = (firstDay + 6) % 7;
  const isCur    = year===today.getFullYear() && month===today.getMonth();

  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
  function jumpTo(off) {
    const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth()+off);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }

  function handleDayLog(dateStr, currentStatus, newStatus) {
    const resolvedStatus = currentStatus === newStatus ? "none" : newStatus;
    setLocalLog(prev => ({ ...prev, [dateStr]: resolvedStatus }));
    logHabitDate(uid, habit.id, dateStr, resolvedStatus)
      .catch(e => {
        console.error("Calendar save failed:", e.message);
        setLocalLog(prev => ({ ...prev, [dateStr]: currentStatus }));
      });
  }

  const done  = calDays.filter(d=>d.status==="done").length;
  const sched = calDays.filter(d=>d.scheduled).length;
  const rate  = sched>0 ? Math.round(done/sched*100) : 0;

  return (
    <div className="cal-card">
      <div className="cal-quick-btns">
        {[["This month",0],["Last month",-1],["2 months ago",-2]].map(([l,o])=>(
          <button key={l}
            className={`cal-quick-btn${year===today.getFullYear()&&month===today.getMonth()+o?"active":""}`}
            onClick={()=>jumpTo(o)}>{l}</button>
        ))}
      </div>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <div>
          <p className="cal-month-label">{FULL_MONTHS[month]} {year}</p>
          <p className="cal-month-stats">{done}/{sched} days · {rate}% success</p>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} disabled={isCur}>›</button>
      </div>
      <div className="cal-grid cal-header-row">
        {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} className="cal-day-hdr">{d}</div>)}
      </div>
      <div className="cal-grid">
        {Array.from({length:offset},(_,i)=><div key={`e${i}`}/>)}
        {calDays.map((d)=>(
          <DayCell key={d.date} d={d} isToday={d.date===todayStr} isFuture={d.date>todayStr} onLog={handleDayLog}/>
        ))}
      </div>
      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-dot done-dot"/>Done</span>
        <span className="cal-legend-item"><span className="cal-dot" style={{background:"#F59E0B"}}/>Partial</span>
        <span className="cal-legend-item"><span className="cal-dot miss-dot"/>Missed</span>
        <span className="cal-legend-item"><span className="cal-dot rest-dot"/>Rest</span>
        <span className="cal-legend-item"><span className="cal-dot none-dot"/>No Record</span>
      </div>
    </div>
  );
}

function DayCell({ d, isToday, isFuture, onLog }) {
  const [open, setOpen] = useState(false);

  // partial data comes from d.partial (stored in Firestore log)
  const partial = d.partial ?? null;
  const isPartial = d.status === "done" && partial && partial.pct < 100;

  const statusClass = d.status==="done" && !isPartial ? "cal-done"
    : d.status==="missed"        ? "cal-missed"
    : d.status==="not-scheduled" ? "cal-rest"
    : "cal-none";

  function tap(newStatus) { onLog(d.date, d.status, newStatus); setOpen(false); }

  return (
    <div style={{position:"relative"}}>
      <div
        className={`cal-day ${statusClass} ${isToday?"cal-today":""} ${isFuture?"cal-future":""}`}
        onClick={()=>!isFuture&&setOpen(o=>!o)}
        style={{
          cursor: isFuture ? "default" : "pointer",
          // Partial days get an orange/amber background instead of green
          ...(isPartial ? {
            background: "#FFF3CD",
            border: "2px solid #F59E0B",
          } : {})
        }}
      >
        <span className="cal-day-num" style={isPartial?{color:"#92400E"}:{}}>{d.day}</span>
        {d.status==="done" && !isPartial && <span className="cal-day-icon">✓</span>}
        {d.status==="missed"             && <span className="cal-day-icon">✗</span>}
        {isPartial && (
          <span className="cal-day-icon" style={{fontSize:9,fontWeight:800,color:"#F59E0B"}}>
            {partial.pct}%
          </span>
        )}
      </div>

      {/* Popup on tap */}
      {open && !isFuture && (
        <div className="day-log-menu" onClick={e=>e.stopPropagation()}>
          <p className="day-log-date">{d.date}</p>
          {isPartial && (
            <p style={{fontSize:11,color:"#F59E0B",fontWeight:700,marginBottom:6,textAlign:"center"}}>
              ◑ {partial.value}{partial.unit?" "+partial.unit:""} / {partial.target}{partial.unit?" "+partial.unit:""} ({partial.pct}%)
            </p>
          )}
          <div style={{display:"flex",gap:5}}>
            <button className={`day-log-btn day-log-done${d.status==="done"&&!isPartial?" active":""}`} onClick={()=>tap("done")}>✓ Done</button>
            <button className={`day-log-btn day-log-miss${d.status==="missed"?" active":""}`} onClick={()=>tap("missed")}>✗ Miss</button>
          </div>
          <button className="day-log-close" onClick={()=>setOpen(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS CHART
// ═══════════════════════════════════════════════════════════════
function ProgressChart({habit,chartData,period,onPeriodChange}) {
  if (!chartData?.length) return null;
  return (
    <div className="chart-card anim-4">
      <div className="chart-header">
        <div><span className="chart-title">{habit.name} Progress</span><span className="chart-sub">{period==="7"?"Last 7 days":"Last 30 days"}</span></div>
        <div className="period-tabs">
          {["7","30"].map(p=><button key={p} className={`period-btn${period===p?" active":""}`}
            style={period===p?{background:habit.color}:undefined} onClick={()=>onPeriodChange(p)}>{p}D</button>)}
        </div>
      </div>
      <div className="bar-chart">
        {chartData.map((d,i)=>{
          const isPartial  = d.status==="done" && d.partial && d.partial.pct < 100;
          const isFullDone = d.status==="done" && !isPartial;
          const barHeight  = isFullDone ? "100%" : isPartial ? `${d.partial.pct}%` : "0%";
          const barColor   = isPartial ? "#F59E0B" : habit.color;
          return (
            <div key={i} className="bar-col" title={isPartial?`${d.partial.pct}% done`:d.status}>
              <div className="bar-track">
                <div className="bar-fill" style={{height:barHeight,background:barColor,opacity:isPartial?0.9:1}}/>
              </div>
              {(period==="7"||i%5===0)&&<span className="bar-label">{d.day}</span>}
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        <div className="legend-dot" style={{background:habit.color}}/><span className="legend-text">Done</span>
        <div className="legend-dot" style={{background:"#F59E0B"}}/><span className="legend-text">Partial</span>
        <div className="legend-dot legend-miss"/><span className="legend-text">Missed</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY SUMMARY
// ═══════════════════════════════════════════════════════════════
function WeeklySummary({days}) {
  return (
    <div className="weekly-card anim-5">
      <p className="section-label" style={{padding:0,marginBottom:14}}>This Week</p>
      <div className="weekly-row">
        {days.map(d=>{
          const isPartial = d.done && d.partial && d.partial.pct < 100;
          return (
            <div key={d.day} className="week-day">
              <div
                className={`week-dot ${isPartial?"":d.done?"done":d.scheduled?"miss":"rest"}`}
                style={isPartial?{background:"#FEF3C7",border:"2px solid #F59E0B",color:"#92400E",fontSize:9,fontWeight:800}:{}}
              >
                {isPartial ? `${d.partial.pct}%` : d.done ? "✓" : d.scheduled ? "✗" : "–"}
              </div>
              <span className="week-label">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH
// ═══════════════════════════════════════════════════════════════
function AICoachCard({habits,summary,earnedBadges}) {
  const rate   = summary?.successRate ?? 0;
  const streak = summary?.currentStreak ?? 0;
  const done   = summary?.doneToday ?? 0;
  const total  = summary?.totalHabits ?? 0;
  const allDone= done === total && total > 0;

  const message = allDone
    ? `🎉 All habits done today! You're on fire, keep this momentum going!`
    : streak >= 7
    ? `🔥 ${streak}-day streak! You're building real momentum — don't stop now!`
    : rate >= 80
    ? `✨ ${rate}% success rate — you're crushing it! Keep showing up every day.`
    : streak >= 3
    ? `⚡ ${streak} days in a row! Consistency is your superpower. Keep going!`
    : `💪 Every habit done is a vote for the person you want to become. You've got this!`;

  const unearned  = REWARD_BADGES.filter(b => !earnedBadges.find(e=>e.id===b.id));
  const nextBadge = unearned.find(b => b.type==="streak")||unearned[0];

  return (
    <div className="ai-card anim-6">
      <div className="ai-orb ai-orb1"/><div className="ai-orb ai-orb2"/>
      <div className="ai-header">
        <div className="ai-icon-box">✨</div>
        <div><span className="ai-title">AI Coach</span><span className="ai-powered">Powered by Claude</span></div>
      </div>
      <p className="ai-msg">{message}</p>
      {earnedBadges.length>0&&(
        <div className="ai-badges">
          <p className="ai-badges-label">Your badges</p>
          <div className="ai-badges-row">
            {earnedBadges.slice(0,6).map(b=>(
              <div key={b.id} className="ai-badge-pill" title={b.label}>{b.icon}</div>
            ))}
            {earnedBadges.length>6&&<div className="ai-badge-pill">+{earnedBadges.length-6}</div>}
          </div>
        </div>
      )}
      {nextBadge&&(
        <div className="ai-next-badge">
          <span>{nextBadge.icon}</span>
          <p>Next: <strong>{nextBadge.label}</strong> — {nextBadge.desc}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BADGES TAB
// ═══════════════════════════════════════════════════════════════
function BadgesTab({habits,summary,earnedBadges}) {
  const earnedIds = new Set(earnedBadges.map(b=>b.id));
  return (
    <div style={{padding:"0 16px"}}>
      <p style={{fontSize:13,color:"var(--text-2)",marginBottom:16,marginTop:4}}>
        {earnedBadges.length} of {REWARD_BADGES.length} badges earned
      </p>
      <div style={{background:"#EEF0F5",borderRadius:20,height:8,marginBottom:24,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:20,background:"linear-gradient(90deg,#34C77B,#4E8EF7)",
          width:`${Math.round(earnedBadges.length/REWARD_BADGES.length*100)}%`,transition:"width .5s ease"}}/>
      </div>
      {earnedBadges.length>0&&<>
        <p className="section-label" style={{padding:0,marginBottom:12}}>🏆 Earned</p>
        <div className="badges-grid">
          {earnedBadges.map(b=>(
            <div key={b.id} className="badge-card earned">
              <span className="badge-icon">{b.icon}</span>
              <p className="badge-label">{b.label}</p>
              <p className="badge-desc">{b.desc}</p>
            </div>
          ))}
        </div>
      </>}
      <p className="section-label" style={{padding:0,marginBottom:12,marginTop:24}}>🔒 Locked</p>
      <div className="badges-grid">
        {REWARD_BADGES.filter(b=>!earnedIds.has(b.id)).map(b=>(
          <div key={b.id} className="badge-card locked">
            <span className="badge-icon" style={{filter:"grayscale(1)",opacity:.4}}>{b.icon}</span>
            <p className="badge-label" style={{color:"var(--text-3)"}}>{b.label}</p>
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
function HabitStatCard({habit}) {
  const {name,icon,color,streak,successRate,totalDone,totalLogged} = habit;

  // Recompute chartData30d directly from _rawLogs for instant updates
  const chartData30d = useMemo(() => {
    const rawLogs = habit._rawLogs ?? [];
    // Build maps from raw logs using Bangkok UTC+7
    const statusMap = {}, partialMap = {};
    rawLogs.forEach(log => {
      let d;
      if (log.date?.toDate) d = log.date.toDate();
      else if (log.date?.seconds) d = new Date(log.date.seconds * 1000);
      else d = new Date(log.date ?? 0);
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      statusMap[key] = log.status;
      if (log.partial) partialMap[key] = log.partial;
    });
    // Build 30-day chart
    const today = new Date();
    return Array.from({length:30}, (_,i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      const bkk = new Date(d.getTime() + 7*60*60*1000);
      const p = n => String(n).padStart(2,"0");
      const key = `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth()+1)}-${p(bkk.getUTCDate())}`;
      const status  = statusMap[key] ?? "none";
      const partial = partialMap[key] ?? null;
      return { day: d.getDate(), date: key, status, partial, val: status==="done" ? 1 : 0 };
    });
  }, [habit._rawLogs]);

  return (
    <div className="stat-detail-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{background:`${color}18`,width:44,height:44,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>{name}</p>
          <p style={{fontSize:12,color:"var(--text-2)",marginTop:2}}>Last 30 days</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:26,fontWeight:800,color,letterSpacing:"-1px"}}>{successRate}%</p>
          <p style={{fontSize:11,color:"var(--text-2)"}}>success</p>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{label:"Streak",value:`${streak}d`,accent:"#FF6B6B"},{label:"Done",value:totalDone,accent:"#34C77B"},{label:"Logged",value:totalLogged,accent:"#4E8EF7"}].map(({label,value,accent})=>(
          <div key={label} style={{background:"#F7F8FC",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <p style={{fontSize:18,fontWeight:800,color:accent,letterSpacing:"-0.5px"}}>{value}</p>
            <p style={{fontSize:10,color:"var(--text-2)",fontWeight:600,textTransform:"uppercase",marginTop:2}}>{label}</p>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:2,height:40}}>
        {chartData30d.map((d,i)=>{
          const isPartial  = d.status === "done" && d.partial && d.partial.pct < 100;
          const isFullDone = d.status === "done" && !isPartial;
          const barHeight  = isFullDone ? "100%" : isPartial ? `${d.partial.pct}%` : "15%";
          const barColor   = isFullDone ? color : isPartial ? "#F59E0B" : "#EEF0F5";
          const opacity    = isFullDone || isPartial ? 1 : 0.5;
          return (
            <div key={i} style={{flex:1,height:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
              title={isFullDone?"Done":isPartial?`${d.partial.pct}% done`:""}>
              <div style={{width:"100%",height:barHeight,background:barColor,borderRadius:"2px 2px 0 0",opacity,transition:"height .3s ease"}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
        <div style={{width:10,height:10,borderRadius:2,background:color}}/><span style={{fontSize:10,color:"var(--text-2)"}}>Done</span>
        <div style={{width:10,height:10,borderRadius:2,background:"#F59E0B"}}/><span style={{fontSize:10,color:"var(--text-2)"}}>Partial</span>
        <div style={{width:10,height:10,borderRadius:2,background:"#EEF0F5"}}/><span style={{fontSize:10,color:"var(--text-2)"}}>Missed</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION BANNER
// ═══════════════════════════════════════════════════════════════
function NotifBanner({ onAllow, denied }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="notif-banner">
      <span style={{fontSize:24}}>🔔</span>
      <div style={{flex:1}}>
        <p className="notif-banner-title">Enable reminders</p>
        <p className="notif-banner-sub">
          {denied ? "Notifications blocked — enable in browser settings" : "Get notified when it's time for your habits"}
        </p>
      </div>
      {!denied && <button className="notif-allow-btn" onClick={onAllow}>Allow</button>}
      <button className="notif-dismiss-btn" onClick={()=>setDismissed(true)}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REMINDERS TAB
// ═══════════════════════════════════════════════════════════════
function RemindersTab({ habits, notifPerm, gcalStatus, uid, onRequestPermission, onEditHabit, onCreateGcal, onTestNotif }) {
  return (
    <div style={{padding:"0 16px"}}>
      <div className="reminder-status-card">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <span style={{fontSize:28}}>{notifPerm==="granted"?"🔔":"🔕"}</span>
          <div>
            <p style={{fontWeight:800,fontSize:14,color:"var(--text)"}}>
              {notifPerm==="granted" ? "Notifications enabled ✅" : notifPerm==="denied" ? "Notifications blocked ❌" : "Notifications not enabled"}
            </p>
            <p style={{fontSize:12,color:"var(--text-2)",marginTop:2}}>
              {notifPerm==="granted" ? "You will receive in-app alerts for enabled habits" : notifPerm==="denied" ? "Open browser settings → Notifications → Allow this site" : "Tap below to enable habit reminders"}
            </p>
          </div>
        </div>
        {notifPerm !== "granted" && notifPerm !== "denied" && (
          <button className="submit-btn" style={{marginBottom:0,marginTop:8}} onClick={onRequestPermission}>
            🔔 Enable Notifications
          </button>
        )}
      </div>
      <p className="section-label" style={{padding:0,marginTop:20,marginBottom:12}}>Habit Reminders</p>
      {habits.length === 0 ? (
        <div className="habit-empty"><span className="habit-empty-icon">⏰</span><p className="habit-empty-title">No habits yet</p><p className="habit-empty-sub">Add a habit first, then set reminders here.</p></div>
      ) : habits.map(h => (
        <ReminderCard key={h.id} habit={h} notifPerm={notifPerm} gcalStatus={gcalStatus[h.id]}
          onEdit={()=>onEditHabit(h)} onCreateGcal={()=>onCreateGcal(h)} onTest={()=>onTestNotif(h)}/>
      ))}
      <div style={{background:"var(--surface)",borderRadius:"var(--r-lg)",padding:"16px",marginTop:14,boxShadow:"var(--s-sm)"}}>
        <p style={{fontWeight:800,fontSize:13,color:"var(--text)",marginBottom:8}}>📅 Google Calendar Reminders</p>
        <p style={{fontSize:12,color:"var(--text-2)",lineHeight:1.6,marginBottom:10}}>
          Google Calendar reminders work even when your phone is off. Enable a reminder on any habit above, then tap "Add to Google Calendar" to create a recurring daily event with alerts.
        </p>
        <p style={{fontSize:11,color:"var(--text-3)"}}>Reminders are set to your Bangkok timezone (UTC+7)</p>
      </div>
    </div>
  );
}

function ReminderCard({ habit, notifPerm, gcalStatus, onEdit, onCreateGcal, onTest }) {
  const { name, icon, color, reminderEnabled, reminderTime } = habit;
  const hasReminder = reminderEnabled && reminderTime;
  return (
    <div className="reminder-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:hasReminder?14:0}}>
        <div style={{width:42,height:42,borderRadius:12,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{name}</p>
          <p style={{fontSize:12,color:hasReminder?"var(--green)":"var(--text-3)",marginTop:2,fontWeight:600}}>
            {hasReminder ? `⏰ ${reminderTime} daily` : "No reminder set"}
          </p>
        </div>
        <button className="reminder-edit-btn" onClick={onEdit}>✏️ Edit</button>
      </div>
      {hasReminder && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {notifPerm==="granted" && (
            <button className="reminder-action-btn notif-test-btn" onClick={onTest}>🔔 Test alert</button>
          )}
          <button
            className={`reminder-action-btn gcal-btn${gcalStatus==="creating"?" loading":""}`}
            onClick={onCreateGcal} disabled={gcalStatus==="creating"}>
            📅 {gcalStatus==="creating" ? "Opening…" : gcalStatus==="done" ? "Added ✅" : "Add to Google Calendar"}
          </button>
        </div>
      )}
      {!hasReminder && <button className="reminder-set-btn" onClick={onEdit}>+ Set reminder time</button>}
    </div>
  );
}

function EmptyHabits() {
  return <div className="habit-empty anim-3"><span className="habit-empty-icon">🌱</span><p className="habit-empty-title">No habits yet</p><p className="habit-empty-sub">Tap + to add your first habit!</p></div>;
}
function Spinner() {
  return <div className="status-screen"><div className="loading-dot"/><p className="status-msg">Loading…</p></div>;
}
