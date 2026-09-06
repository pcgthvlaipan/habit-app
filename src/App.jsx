// ═══════════════════════════════════════════════════════════════
// App.jsx — Habit App by Tam  v9
// New in v9:
//   • EN/TH language toggle (default Thai) — see src/i18n.jsx
//   • Registration captures name + email + department (dropdown)
//   • Admin-managed department list (Settings tab)
//   • Today screen: removed "This Week" + per-habit progress chart,
//     replaced with a Rewards card (points, weekly goal, next badge)
//   • Small-win rewards: points on every check-in + weekly consistency
//   • Calendar always reads the live habit (check-ins stay in sync)
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import "./App.css";
import {
  loginUser, registerUser, logoutUser,
  subscribeToAuth, fetchUser, ensureUserDoc,
  subscribeToHabits, computeSummary,
  logHabitToday, logHabitDate, addHabit, editHabit, deleteHabit,
  HABIT_ICON_OPTIONS, WEEK_DAYS,
  REWARD_BADGES, computeEarnedBadges, badgeProgress,
  POINTS_FULL, POINTS_PARTIAL,
  DEFAULT_DEPARTMENTS, fetchDepartments, subscribeToDepartments,
  addDepartment, removeDepartment,
  bangkokKey,
  auth,  // ← we need this for sendPasswordResetEmail
} from "./firebase/habitService";
import { sendPasswordResetEmail } from "firebase/auth";
import { useT } from "./i18n";
import { badgeText, LANGS, MONTH_NAMES, WEEKDAY_LABELS } from "./i18n-util";
import {
  requestNotificationPermission,
  showTestNotification,
  scheduleDailyNotification,
  cancelNotification,
  cancelAllReminders,
  rescheduleAllReminders,
  openGoogleCalendar,
} from "./reminderService";

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "header.morning" : h < 17 ? "header.afternoon" : "header.evening";
}

function localizeDays(days, lang) {
  if (!Array.isArray(days)) return "";
  const sep = lang === "th" ? " " : ", ";
  return days.map(d => WEEKDAY_LABELS[lang]?.[d] ?? d).join(sep);
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE TOGGLE
// ═══════════════════════════════════════════════════════════════
function LangToggle({ dark = true }) {
  const { lang, setLang } = useT();
  return (
    <div style={{
      display: "inline-flex", borderRadius: 999, padding: 2, gap: 2,
      background: dark ? "rgba(255,255,255,.18)" : "#EEF0F5",
    }}>
      {LANGS.map(l => {
        const active = lang === l.code;
        return (
          <button key={l.code} onClick={() => setLang(l.code)}
            style={{
              border: "none", cursor: "pointer", borderRadius: 999, padding: "3px 10px",
              fontSize: 11, fontWeight: 800, letterSpacing: 0.5, transition: "all .15s",
              background: active ? "#fff" : "transparent",
              color: active ? "#1a1a2e" : (dark ? "#fff" : "var(--text-2)"),
            }}>
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(undefined);
  useEffect(() => subscribeToAuth(u => {
    // On logout, kill every pending reminder timer so they don't fire for a
    // signed-out user (or the next user to sign in on this device).
    if (!u) cancelAllReminders();
    setAuthUser(u);
  }), []);
  if (authUser === undefined) return <Spinner />;
  if (!authUser) return <AuthScreen />;
  return <Dashboard authUser={authUser} />;
}

// ═══════════════════════════════════════════════════════════════
// AUTH  (v9: register now captures email + department)
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const { t } = useT();
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [name, setName]       = useState("");
  const [department, setDept] = useState("");
  const [depts, setDepts]     = useState(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [show, setShow]       = useState(false);

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Load the (admin-managed) department list. Falls back to DEFAULT_DEPARTMENTS
  // if the config doc is missing or unreadable pre-auth.
  useEffect(() => { fetchDepartments().then(setDepts).catch(() => {}); }, []);

  function clearError() { setError(""); }

  // ── Sign in / Register ──────────────────────────────────────
  async function submit() {
    clearError();
    if (!email.trim() || !pass) { setError(t("auth.errFillAll")); return; }
    if (mode === "register") {
      if (!name.trim())   { setError(t("auth.errEnterName")); return; }
      if (!department)    { setError(t("auth.errEnterDept")); return; }
    }
    if (pass.length < 6) { setError(t("auth.errPassLen")); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email.trim(), pass);
      } else {
        const c = await registerUser(email.trim(), pass);
        await ensureUserDoc(c.user.uid, {
          name: name.trim(),
          email: email.trim(),
          department,
        });
      }
    } catch (e) {
      setError(
        e.code === "auth/user-not-found"      ? t("auth.errNoAccount") :
        e.code === "auth/wrong-password"      ? t("auth.errWrongPass") :
        e.code === "auth/email-already-in-use"? t("auth.errEmailInUse") :
        e.code === "auth/invalid-credential"  ? t("auth.errInvalidCred") :
        e.message
      );
    } finally { setLoading(false); }
  }

  // ── Forgot password ─────────────────────────────────────────
  async function submitForgot() {
    clearError();
    if (!email.trim()) { setError(t("auth.errEnterEmail")); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotSent(true);
    } catch (e) {
      setError(
        e.code === "auth/user-not-found"  ? t("auth.errNoAccountEmail") :
        e.code === "auth/invalid-email"   ? t("auth.errInvalidEmail") :
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
        <div style={{position:"absolute",top:14,right:14,zIndex:2}}><LangToggle/></div>
        <div className="auth-logo">h</div>
        <p className="auth-app-name">{t("auth.appName")}</p>
        <p className="auth-tagline">{t("auth.tagline")}</p>
      </div>

      <div className="auth-card">

        {/* ── Forgot password ── */}
        {forgotMode ? (
          <>
            <p className="auth-title">{forgotSent ? t("auth.resetSentTitle") : t("auth.resetTitle")}</p>
            <p className="auth-sub">
              {forgotSent ? t("auth.resetSentSub", { email }) : t("auth.resetSub")}
            </p>

            {forgotSent ? (
              <div style={{textAlign:"center",padding:"8px 0 16px"}}>
                <p style={{fontSize:13,color:"var(--text-2)",lineHeight:1.6,marginBottom:16}}>
                  {t("auth.resetHint")}
                </p>
                <button className="submit-btn" onClick={goToSignIn}>{t("auth.backToSignIn")}</button>
              </div>
            ) : (
              <>
                {error && <p className="auth-error">⚠️ {error}</p>}
                <div className="field-wrap">
                  <label className="field-label">{t("auth.email")}</label>
                  <input className="field-input" type="email" placeholder={t("auth.emailPlaceholder")}
                    value={email} onChange={e => setEmail(e.target.value)}
                    autoCapitalize="none" autoFocus />
                </div>
                <button className="submit-btn" onClick={submitForgot} disabled={loading}>
                  {loading ? t("auth.sending") : t("auth.sendResetLink")}
                </button>
                <button className="cancel-btn" onClick={goToSignIn}>{t("auth.backToSignIn")}</button>
              </>
            )}
          </>
        ) : (
          /* ── Sign in / Register ── */
          <>
            <p className="auth-title">{mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}</p>
            <p className="auth-sub">{mode === "login" ? t("auth.signInSub") : t("auth.registerSub")}</p>

            {mode === "register" && (
              <>
                <div className="field-wrap">
                  <label className="field-label">{t("auth.name")}</label>
                  <input className="field-input" type="text" placeholder={t("auth.namePlaceholder")}
                    value={name} onChange={e => setName(e.target.value)} maxLength={40}/>
                </div>
                <div className="field-wrap">
                  <label className="field-label">{t("auth.department")}</label>
                  <select className="field-input" value={department}
                    onChange={e => setDept(e.target.value)}>
                    <option value="">{t("auth.departmentPlaceholder")}</option>
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="field-wrap">
              <label className="field-label">{t("auth.email")}</label>
              <input className="field-input" type="email" placeholder={t("auth.emailPlaceholder")}
                value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none"/>
            </div>

            <div className="field-wrap">
              <label className="field-label">{t("auth.password")}</label>
              <div className="pass-wrap">
                <input className="field-input pass-input" type={show ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")} value={pass}
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
                  {t("auth.forgotPassword")}
                </button>
              </p>
            )}

            <button className="submit-btn" onClick={submit} disabled={loading}>
              {loading
                ? (mode === "login" ? t("auth.signingIn") : t("auth.creating"))
                : (mode === "login" ? t("auth.signIn") : t("auth.createBtn"))}
            </button>

            <p className="auth-switch">
              {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}
              <button className="auth-link" onClick={() => { setMode(m => m === "login" ? "register" : "login"); clearError(); }}>
                {mode === "login" ? t("auth.registerLink") : t("auth.signInLink")}
              </button>
            </p>
          </>
        )}
      </div>

      <p className="auth-footer">{t("auth.footerSecure")}</p>
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ authUser }) {
  const { t } = useT();
  const [user,setUser]             = useState(null);
  const [habits,setHabits]         = useState([]);
  const [summary,setSummary]       = useState(null);
  const [selected,setSelected]     = useState(null);
  const [loading,setLoading]       = useState(true);
  const [error,setError]           = useState(null);
  const [showAdd,setShowAdd]       = useState(false);
  const [editing,setEditing]       = useState(null);
  const [tab,setTab]               = useState("today");
  const [calHabitId,setCalHabitId] = useState(null);
  const [winToast,setWinToast]     = useState(null);
  const [notifPerm,setNotifPerm]   = useState(()=>{try{return typeof Notification!=="undefined"?Notification.permission:"unsupported"}catch(e){return "unsupported"}});
  const [gcalStatus,setGcalStatus] = useState({});
  const uid = authUser.uid;

  useEffect(() => { fetchUser(uid).then(setUser).catch(e=>setError(e.message)); },[uid]);
  // subscribeToHabits listens on each habit's `logs` subcollection too, so log
  // writes propagate here. handleLog still does an optimistic setHabits for
  // instant tap feedback in the gap before the listener fires.
  useEffect(() => subscribeToHabits(uid,
    fresh => {
      setHabits(fresh);
      setSummary(computeSummary(fresh));
      setSelected(p => p ? (fresh.find(h=>h.id===p.id)??fresh[0]??null) : (fresh[0]??null));
      setLoading(false);
    },
    e => { setError(e.message); setLoading(false); }
  ),[uid]);

  // Cancel every pending reminder timer when the dashboard unmounts (logout / nav away).
  useEffect(() => cancelAllReminders, []);

  // Only reschedule reminders when something that actually affects a reminder
  // changes — NOT on every log tap (which produces a fresh `habits` array).
  const reminderSig = useMemo(
    () => JSON.stringify(habits.map(h => ({
      id: h.id, reminderEnabled: h.reminderEnabled, reminderTime: h.reminderTime,
      name: h.name, icon: h.icon,
    }))),
    [habits]
  );
  useEffect(() => {
    if (habits.length > 0) rescheduleAllReminders(habits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderSig]);

  const earnedBadges = useMemo(() => computeEarnedBadges(habits, summary), [habits, summary]);
  const isAdmin = user?.isAdmin === true;

  // ── handleLog: partial completion + small-win reward toast ───
  function handleLog(hid, status, partial) {
    const now = new Date();
    const todayKey = bangkokKey(now);
    // A partial-done (pct < 100) is surfaced as "partial", matching computeHabitStats.
    const isPartial = status === "done" && partial && (partial.pct ?? 100) < 100;
    const optimisticStatus = status === "none" ? "none" : isPartial ? "partial" : status;

    setHabits(prev => prev.map(h => {
      if (h.id !== hid) return h;

      // Update _rawLogs immediately so calendar + stats reflect the change
      let newRawLogs = (h._rawLogs ?? []).filter(l => {
        const ld = l.date?.toDate
          ? l.date.toDate()
          : new Date(l.date?.seconds != null ? l.date.seconds * 1000 : l.date);
        return bangkokKey(ld) !== todayKey;
      });

      if (status !== "none") {
        newRawLogs = [...newRawLogs, {
          date: { seconds: Math.floor(now.getTime() / 1000) },
          status,
          partial: partial ?? null,
        }];
      }

      return {
        ...h,
        todayStatus:  optimisticStatus,
        todayPartial: partial ?? null,
        _rawLogs:     newRawLogs,
      };
    }));

    setSummary(prev => {
      if (!prev) return prev;
      const h       = habits.find(x => x.id === hid);
      const wasDone = h?.todayStatus === "done";
      const isDone  = status === "done" && !isPartial;  // partial is not a full "done"
      const delta   = isDone && !wasDone ? 1 : !isDone && wasDone ? -1 : 0;
      return { ...prev, doneToday: Math.max(0, prev.doneToday + delta) };
    });

    // Small-win reward: celebrate every check-in (full or partial).
    if (status === "done") {
      setWinToast({ partial: isPartial, points: isPartial ? POINTS_PARTIAL : POINTS_FULL, ts: Date.now() });
    }

    logHabitToday(uid, hid, status, partial)
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
    if (!window.confirm(t("form.deleteConfirm"))) return;
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

  // Always derive from the latest habits array so check-ins made on the Today
  // screen are instantly reflected in Stats and the Calendar (same source of truth).
  const calHabit = calHabitId ? (habits.find(h => h.id === calHabitId) ?? null) : null;

  if (loading) return <Spinner/>;
  if (error)   return <div className="status-screen"><p style={{fontSize:36}}>⚠️</p><p className="status-msg">{error}</p></div>;

  return (
    <div className="shell"><div className="phone">
      <Header user={user??{name:authUser.email?.split("@")[0]??"Friend",avatarInitial:"F"}} onLogout={logoutUser} earnedCount={earnedBadges.length}/>

      <div className="tab-bar">
        {[["today","🏠"],["calendar","📅"],["stats","📊"],["reminders","⏰"],["badges","🏆"],["settings","⚙️"]].map(([tb,l])=>(
          <button key={tb} className={`tab-btn${tab===tb?" tab-btn--active":""}`} onClick={()=>setTab(tb)}>{l}</button>
        ))}
      </div>

      {tab==="today"&&<>
        {notifPerm !== "granted" && (
          <NotifBanner onAllow={handleRequestNotifPermission} denied={notifPerm==="denied"}/>
        )}
        {summary&&<SummaryCards data={summary}/>}
        {earnedBadges.length>0&&<NewBadgeAlert badges={earnedBadges.slice(-1)}/>}
        <p className="section-label anim-2">{t("today.myHabits")}</p>
        <HabitList habits={habits} selectedId={selected?.id}
          onSelect={setSelected} onLog={handleLog}
          onEdit={h=>setEditing(h)} onDelete={handleDelete}/>
        {habits.length>0&&<RewardsCard summary={summary} habits={habits} earnedBadges={earnedBadges}/>}
        <AICoachCard summary={summary} earnedBadges={earnedBadges}/>
      </>}

      {tab==="calendar"&&<>
        <p className="section-label" style={{marginTop:16}}>{t("calendar.history")}</p>
        <div className="cal-habit-picker">
          {habits.map(h=>(
            <button key={h.id} className={`cal-habit-chip${calHabitId===h.id?" active":""}`}
              style={calHabitId===h.id?{background:h.color,color:"#fff"}:{}}
              onClick={()=>setCalHabitId(h.id)}>{h.icon} {h.name}</button>
          ))}
        </div>
        {calHabit
          ? <CalendarView habit={calHabit} uid={uid}/>
          : <div className="cal-empty">{t("calendar.selectHint")}</div>
        }
      </>}

      {tab==="stats"&&<>
        <p className="section-label" style={{marginTop:16}}>{t("stats.title")}</p>
        {habits.length===0?<EmptyHabits/>:habits.map(h=><HabitStatCard key={h.id} habit={h}/>)}
      </>}

      {tab==="reminders"&&<RemindersTab
        habits={habits} notifPerm={notifPerm} gcalStatus={gcalStatus}
        onRequestPermission={handleRequestNotifPermission}
        onEditHabit={h=>setEditing(h)}
        onCreateGcal={handleCreateGcalReminder}
        onTestNotif={h=>showTestNotification(h.name, h.icon)}
      />}

      {tab==="badges"&&<BadgesTab earnedBadges={earnedBadges}/>}

      {tab==="settings"&&<SettingsTab user={user} authUser={authUser} isAdmin={isAdmin}/>}

      <div style={{height:100}}/>
      <button className="fab" onClick={()=>setShowAdd(true)} title="Add habit"><span className="fab-icon">+</span></button>
      {showAdd&&<HabitFormModal title={t("form.newHabit")} onSave={handleAddHabit} onClose={()=>setShowAdd(false)}/>}
      {editing&&<HabitFormModal title={t("form.editHabit")} initial={editing} onSave={handleEditHabit} onClose={()=>setEditing(null)}/>}
      {winToast&&<WinToast data={winToast} onDone={()=>setWinToast(null)}/>}
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ user, onLogout, earnedCount }) {
  const { t } = useT();
  return (
    <div className="header anim-1">
      <div className="header-orb h-orb1"/><div className="header-orb h-orb2"/>
      <div style={{flex:1,minWidth:0,position:"relative",zIndex:1}}>
        <div className="header-badge"><div className="header-dot"/><span className="header-badge-text">{t("header.activeToday")}</span></div>
        <p className="header-greeting">{t(greetingKey())}, {user.name} 👋</p>
        <p className="header-sub">{t("header.sub")}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,position:"relative",zIndex:1}}>
        <LangToggle/>
        <div className="avatar-wrap">
          <div className="avatar">{user.avatarInitial}</div>
          <div className="avatar-ring"/><div className="avatar-status"/>
          {earnedCount>0&&<div className="badge-count">{earnedCount}</div>}
        </div>
        <button className="logout-btn" onClick={onLogout}>{t("header.signOut")}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════════
const CARDS_CFG = [
  {key:"totalHabits",  labelKey:"summary.habits",  icon:"✦",  accent:"#4E8EF7", fmt:v=>v},
  {key:"doneToday",    labelKey:"summary.done",    icon:"✓",  accent:"#34C77B", fmt:v=>v},
  {key:"currentStreak",labelKey:"summary.streak",  icon:"🔥", accent:"#FF6B6B", fmt:v=>`${v}d`},
  {key:"totalPoints",  labelKey:"summary.points",  icon:"✦",  accent:"#A78BFA", fmt:v=>v},
];
function SummaryCards({data}) {
  const { t } = useT();
  return (
    <div className="summary-grid anim-1">
      {CARDS_CFG.map(({key,labelKey,icon,accent,fmt})=>(
        <div key={key} className="stat-card" style={{borderTopColor:accent}}>
          <span className="stat-icon" style={{color:accent}}>{icon}</span>
          <span className="stat-value">{fmt(data[key] ?? 0)}</span>
          <span className="stat-label">{t(labelKey)}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW BADGE ALERT
// ═══════════════════════════════════════════════════════════════
function NewBadgeAlert({badges}) {
  const { t } = useT();
  const [visible,setVisible] = useState(true);
  if (!visible||!badges.length) return null;
  const b = badgeText(t, badges[0]);
  return (
    <div className="badge-alert">
      <span className="badge-alert-icon">{b.icon}</span>
      <div><p className="badge-alert-title">{t("badgeAlert.title",{label:b.label})}</p><p className="badge-alert-desc">{b.desc}</p></div>
      <button onClick={()=>setVisible(false)} className="badge-alert-close">✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REWARDS CARD  (v9 — replaces "This Week" + per-habit progress chart)
// Points earned + weekly-consistency goal + progress toward next badge.
// ═══════════════════════════════════════════════════════════════
function RewardsCard({ summary, habits, earnedBadges }) {
  const { t } = useT();
  const points   = summary?.totalPoints ?? 0;
  const wkDone   = summary?.weeklyDone ?? 0;
  const wkSched  = summary?.weeklyScheduled ?? 0;
  const wkDoneComplete = summary?.weeklyComplete ?? false;
  const wkRatio  = wkSched > 0 ? Math.min(1, wkDone / wkSched) : 0;

  const earnedIds  = new Set(earnedBadges.map(b => b.id));
  const nextRaw    = REWARD_BADGES.find(b => !earnedIds.has(b.id));
  const nextBadge  = nextRaw ? badgeText(t, nextRaw) : null;
  const prog       = nextRaw ? badgeProgress(nextRaw, habits, summary) : null;

  return (
    <div className="weekly-card anim-5">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <p className="section-label" style={{padding:0,margin:0}}>{t("badgeProgress.title")}</p>
        <span style={{fontSize:13,fontWeight:800,color:"#A78BFA"}}>✦ {points} {t("summary.points")}</span>
      </div>

      {/* Weekly consistency goal */}
      <div style={{marginBottom: nextBadge ? 16 : 0}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
          <span style={{fontWeight:700,color:"var(--text)"}}>{t("today.weeklyGoalTitle")}</span>
          <span style={{color:"var(--text-2)"}}>{wkDone}/{wkSched}</span>
        </div>
        <div style={{height:8,background:"#EEF0F5",borderRadius:8,overflow:"hidden"}}>
          <div style={{
            height:"100%",borderRadius:8,width:`${wkRatio*100}%`,transition:"width .5s ease",
            background: wkDoneComplete ? "linear-gradient(90deg,#34C77B,#4E8EF7)" : "#34C77B",
          }}/>
        </div>
        <p style={{fontSize:11,color:"var(--text-2)",marginTop:6,lineHeight:1.5}}>
          {wkDoneComplete
            ? t("today.weeklyGoalComplete")
            : t("today.weeklyGoalProgress",{done:wkDone,total:wkSched})}
        </p>
      </div>

      {/* Progress toward the next badge */}
      {nextBadge && prog && (
        <div style={{display:"flex",alignItems:"center",gap:12,background:"#F7F8FC",borderRadius:14,padding:"10px 12px"}}>
          <span style={{fontSize:26,flexShrink:0}}>{nextBadge.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:800,color:"var(--text)"}}>{t("badgeProgress.next")}: {nextBadge.label}</p>
            <p style={{fontSize:11,color:"var(--text-2)",margin:"2px 0 5px"}}>{nextBadge.desc}</p>
            <div style={{height:5,background:"#E6E8F0",borderRadius:5,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:5,background:"#A78BFA",width:`${prog.ratio*100}%`,transition:"width .5s"}}/>
            </div>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:"#A78BFA",whiteSpace:"nowrap"}}>
            {Math.round(prog.current)}/{prog.target}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SMALL-WIN TOAST
// ═══════════════════════════════════════════════════════════════
function WinToast({ data, onDone }) {
  const { t } = useT();
  useEffect(() => {
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ts]);
  return (
    <div style={{
      position:"fixed",left:"50%",bottom:88,transform:"translateX(-50%)",
      zIndex:200,maxWidth:340,width:"calc(100% - 40px)",
      display:"flex",alignItems:"center",gap:12,
      background:"linear-gradient(135deg,#34C77B,#4E8EF7)",color:"#fff",
      borderRadius:16,padding:"12px 16px",boxShadow:"0 10px 30px rgba(0,0,0,.2)",
      animation:"none",
    }}>
      <span style={{fontSize:24}}>{data.partial ? "◑" : "🎉"}</span>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontWeight:800,fontSize:13}}>{t("today.smallWinTitle",{points:data.points})}</p>
        <p style={{fontSize:11,opacity:.92,lineHeight:1.4}}>
          {data.partial ? t("today.partialWinMsg",{points:data.points}) : t("today.smallWinMsg")}
        </p>
      </div>
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
// HABIT CARD
// ═══════════════════════════════════════════════════════════════
function HabitCard({habit,selected,onSelect,onLog,onEdit,onDelete}) {
  const { t, lang } = useT();
  const {id,todayStatus,todayPartial,color,icon,name,frequency,scheduledDays,streak,reminderEnabled,reminderTime} = habit;
  const done    = todayStatus === "done" || todayStatus === "partial";
  const missed  = todayStatus === "missed";
  const notSched= todayStatus === "not-scheduled";
  const [menu,setMenu]           = useState(false);
  const [showPartial,setShowPartial] = useState(false);

  const freqLabel = frequency==="daily" ? t("habitCard.daily")
    : frequency==="weekly" ? t("habitCard.weekly")
    : localizeDays(scheduledDays, lang) || t("habitCard.custom");

  function formatTime(tv) {
    if (!tv) return "";
    const [h, m] = tv.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  }

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
            <span className="habit-badge badge-pending">{t("habitCard.rest")}</span>
          ) : (
            <div className="log-btns">
              <button
                className={`log-btn log-done${done?" log-done--active":""}`}
                onClick={() => {
                  if (done) {
                    onLog(id, "none", null);
                  } else if (habit.targetValue) {
                    setShowPartial(true);
                  } else {
                    onLog(id, "done", null);
                  }
                }}
                title={done ? t("habitCard.tapUncheck") : t("habitCard.markDone")}
              >✓</button>
              <button
                className={`log-btn log-miss${missed?" log-miss--active":""}`}
                onClick={() => onLog(id, missed ? "none" : "missed", null)}
                title={missed ? t("habitCard.tapUncheckMiss") : t("habitCard.markMissed")}
              >✗</button>
            </div>
          )}
          {streak>0&&<span className="habit-streak">🔥 {streak}</span>}
          <div style={{position:"relative"}}>
            <button className="menu-btn" onClick={()=>setMenu(s=>!s)}>⋯</button>
            {menu&&<div className="menu-dropdown">
              <button onClick={()=>{onEdit();setMenu(false);}}>✏️ {t("common.edit")}</button>
              <button onClick={()=>{onDelete();setMenu(false);}} style={{color:"var(--coral)"}}>🗑️ {t("common.delete")}</button>
            </div>}
          </div>
        </div>
      </div>

      {showPartial && (
        <PartialModal
          habit={habit}
          existing={todayPartial}
          onSave={(partial) => { onLog(id, "done", partial); setShowPartial(false); }}
          onFullDone={() => { onLog(id, "done", null); setShowPartial(false); }}
          onClose={() => setShowPartial(false)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARTIAL COMPLETION MODAL
// ═══════════════════════════════════════════════════════════════
function PartialModal({ habit, existing, onSave, onFullDone, onClose }) {
  const { t } = useT();
  const target = habit.targetValue || 100;
  const unit   = habit.unit || "";
  const [value, setValue] = useState(existing?.value ?? target);
  const [note,  setNote]  = useState(existing?.note  ?? "");

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
      const exactValue = Math.round(value * 10) / 10;
      onSave({ value: exactValue, target, unit, pct, note: note.trim() });
    }
  }

  const targetLabel = `${target}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <p className="modal-title">{t("partial.title",{habit:`${habit.icon} ${habit.name}`})}</p>

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
              <span style={{fontSize:10,color:"var(--text-2)",marginTop:2}}>{t("common.done")}</span>
            </div>
          </div>
        </div>

        <label className="field-label">
          {t("partial.howMuch")}
          <span style={{float:"right",color:"var(--text-2)"}}>{t("partial.target",{target:targetLabel})}</span>
        </label>
        <input
          type="range" min={0} max={target}
          step={target > 100 ? Math.ceil(target / 100) : 1}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          style={{width:"100%",margin:"8px 0 4px",accentColor:pctColor}}
        />

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

        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {[25,50,75,100].map(p => {
            const v = (p / 100) * target;
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

        {value > 0 && value < target && (
          <div style={{background:"#F0F4FF",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#4E8EF7",lineHeight:1.5}}>
            {pct >= 75 ? t("partial.msg75") : pct >= 50 ? t("partial.msg50") : t("partial.msgLow")}
          </div>
        )}
        {value >= target && (
          <div style={{background:"#F0FFF6",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#34C77B",lineHeight:1.5}}>
            {t("partial.msgFull")}
          </div>
        )}

        <label className="field-label">{t("partial.note")}</label>
        <textarea
          className="field-input"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t("partial.notePlaceholder")}
          rows={2}
          style={{resize:"none",marginBottom:16}}
          maxLength={200}
        />

        <button className="submit-btn" onClick={handleSave} disabled={value === 0}>
          {value >= target
            ? t("partial.markComplete")
            : t("partial.logAmount",{value:`${value}${unit ? " " + unit : ""}`,pct})}
        </button>
        <button className="cancel-btn" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT FORM MODAL
// ═══════════════════════════════════════════════════════════════
function HabitFormModal({title,initial,onSave,onClose}) {
  const { t } = useT();
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
    if (freq==="custom"&&days.length===0){alert(t("form.pickDayAlert"));return;}
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

        <label className="field-label">{t("form.icon")}</label>
        <div className="icon-picker-row">
          <div className="icon-selected">{icon}</div>
          <button className="icon-browse-btn" onClick={()=>setShowI(s=>!s)}>
            {showIcons?t("form.closeIcons"):t("form.browseIcons")}
          </button>
        </div>
        {showIcons&&<>
          <input className="field-input" type="text" placeholder={t("form.searchIcons")} value={search}
            onChange={e=>setSearch(e.target.value)} style={{marginBottom:10}}/>
          <div className="icon-grid">
            {filtered.map(({icon:ic,label})=>(
              <button key={ic} className={`icon-option${icon===ic?" icon-option--active":""}`}
                onClick={()=>{setIcon(ic);setShowI(false);setSearch("");}} title={label}>{ic}</button>
            ))}
          </div>
        </>}

        <label className="field-label" style={{marginTop:16}}>{t("form.name")}</label>
        <input className="field-input" type="text" placeholder={t("form.namePlaceholder")} value={name}
          onChange={e=>setName(e.target.value)} maxLength={40} onKeyDown={e=>e.key==="Enter"&&submit()}/>

        <label className="field-label" style={{marginTop:16}}>
          {t("form.dailyTarget")}
          <span style={{float:"right",fontSize:10,color:"var(--text-3)",fontWeight:400}}>{t("form.optionalPartial")}</span>
        </label>
        <div style={{display:"flex",gap:8}}>
          <input
            type="number" min={1} max={9999}
            className="field-input"
            placeholder="30"
            value={targetValue}
            onChange={e=>setTarget(e.target.value)}
            style={{flex:1}}
          />
          <input
            type="text"
            className="field-input"
            placeholder={t("form.targetUnitPlaceholder")}
            value={unit}
            onChange={e=>setUnit(e.target.value)}
            maxLength={10}
            style={{flex:1.5}}
          />
        </div>
        <p style={{fontSize:11,color:"var(--text-3)",marginTop:4,marginBottom:8}}>
          {t("form.targetExample")}
        </p>

        <label className="field-label">{t("form.frequency")}</label>
        <div className="freq-row">
          {[["daily",t("form.freqDaily")],["custom",t("form.freqPickDays")]].map(([f,l])=>(
            <button key={f} className={`freq-btn${freq===f?" freq-btn--active":""}`} onClick={()=>setFreq(f)}>{l}</button>
          ))}
        </div>

        {freq==="custom"&&<>
          <label className="field-label">{t("form.whichDays")}</label>
          <div className="day-picker">
            {WEEK_DAYS.map(d=>(
              <button key={d} className={`day-btn${days.includes(d)?" day-btn--active":""}`} onClick={()=>toggleDay(d)}>{d}</button>
            ))}
          </div>
          {days.length>0&&<p className="day-summary">{t("form.daySummary",{n:days.length,days:days.join(", ")})}</p>}
        </>}

        <div className="reminder-section">
          <div className="reminder-toggle-row">
            <div>
              <p className="reminder-toggle-label">{t("form.setReminder")}</p>
              <p className="reminder-toggle-sub">{t("form.reminderSub")}</p>
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
              <label className="field-label">{t("form.reminderTime")}</label>
              <input type="time" className="field-input time-input" value={reminderTime}
                onChange={e=>setRemTime(e.target.value)}/>
              <p className="reminder-hint">{t("form.reminderHint")}</p>
            </div>
          )}
        </div>

        <button className="submit-btn" onClick={submit} disabled={!name.trim()||saving} style={{marginTop:20}}>
          {saving?t("form.saving"):(initial?t("form.saveChanges"):t("form.addHabit"))}
        </button>
        <button className="cancel-btn" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR VIEW
// ═══════════════════════════════════════════════════════════════
function CalendarView({habit,uid}) {
  const { t, lang } = useT();
  const today    = new Date();
  const todayStr = bangkokKey();
  const [year,setYear]     = useState(today.getFullYear());
  const [month,setMonth]   = useState(today.getMonth());
  const [localLog, setLocalLog]         = useState({});
  const [localPartial, setLocalPartial] = useState({});

  const monthNames = MONTH_NAMES[lang] ?? MONTH_NAMES.en;

  const partialMap = useMemo(() => {
    const map = {};
    if (!habit?._rawLogs) return map;
    habit._rawLogs.forEach(log => {
      let d;
      if (log.date?.toDate) d = log.date.toDate();
      else if (log.date?.seconds) d = new Date(log.date.seconds * 1000);
      else d = new Date(log.date);
      if (log.partial) map[bangkokKey(d)] = log.partial;
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
  }, [habit, year, month, localLog, localPartial, partialMap]);

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
    if (resolvedStatus === "done") setLocalPartial(prev => ({ ...prev, [dateStr]: null }));
    logHabitDate(uid, habit.id, dateStr, resolvedStatus)
      .catch(e => {
        console.error("Calendar save failed:", e.message);
        setLocalLog(prev => ({ ...prev, [dateStr]: currentStatus }));
      });
  }

  const done  = calDays.filter(d=>d.status==="done").length;
  const sched = calDays.filter(d=>d.scheduled).length;
  const rate  = sched>0 ? Math.round(done/sched*100) : 0;

  const weekdayHeaders = WEEK_DAYS.map(d => WEEKDAY_LABELS[lang]?.[d] ?? d);

  return (
    <div className="cal-card">
      <div className="cal-quick-btns">
        {[[t("calendar.thisMonth"),0],[t("calendar.lastMonth"),-1],[t("calendar.twoMonthsAgo"),-2]].map(([l,o])=>(
          <button key={o}
            className={`cal-quick-btn${year===today.getFullYear()&&month===today.getMonth()+o?"active":""}`}
            onClick={()=>jumpTo(o)}>{l}</button>
        ))}
      </div>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <div>
          <p className="cal-month-label">{monthNames[month]} {year}</p>
          <p className="cal-month-stats">{t("calendar.monthStats",{done,sched,rate})}</p>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} disabled={isCur}>›</button>
      </div>
      <div className="cal-grid cal-header-row">
        {weekdayHeaders.map((d,i)=><div key={i} className="cal-day-hdr">{d}</div>)}
      </div>
      <div className="cal-grid">
        {Array.from({length:offset},(_,i)=><div key={`e${i}`}/>)}
        {calDays.map((d)=>(
          <DayCell key={d.date} d={d} isToday={d.date===todayStr} isFuture={d.date>todayStr} onLog={handleDayLog}/>
        ))}
      </div>
      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-dot done-dot"/>{t("calendar.legendDone")}</span>
        <span className="cal-legend-item"><span className="cal-dot" style={{background:"#F59E0B"}}/>{t("calendar.legendPartial")}</span>
        <span className="cal-legend-item"><span className="cal-dot miss-dot"/>{t("calendar.legendMissed")}</span>
        <span className="cal-legend-item"><span className="cal-dot rest-dot"/>{t("calendar.legendRest")}</span>
        <span className="cal-legend-item"><span className="cal-dot none-dot"/>{t("calendar.legendNone")}</span>
      </div>
    </div>
  );
}

function DayCell({ d, isToday, isFuture, onLog }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

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
          ...(isPartial ? { background: "#FFF3CD", border: "2px solid #F59E0B" } : {})
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

      {open && !isFuture && (
        <div className="day-log-menu" onClick={e=>e.stopPropagation()}>
          <p className="day-log-date">{d.date}</p>
          {isPartial && (
            <p style={{fontSize:11,color:"#F59E0B",fontWeight:700,marginBottom:6,textAlign:"center"}}>
              ◑ {partial.value}{partial.unit?" "+partial.unit:""} / {partial.target}{partial.unit?" "+partial.unit:""} ({partial.pct}%)
            </p>
          )}
          <div style={{display:"flex",gap:5}}>
            <button className={`day-log-btn day-log-done${d.status==="done"&&!isPartial?" active":""}`} onClick={()=>tap("done")}>{t("calendar.dayDone")}</button>
            <button className={`day-log-btn day-log-miss${d.status==="missed"?" active":""}`} onClick={()=>tap("missed")}>{t("calendar.dayMiss")}</button>
          </div>
          <button className="day-log-close" onClick={()=>setOpen(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH
// ═══════════════════════════════════════════════════════════════
function AICoachCard({summary,earnedBadges}) {
  const { t } = useT();
  const rate   = summary?.successRate ?? 0;
  const streak = summary?.currentStreak ?? 0;
  const done   = summary?.doneToday ?? 0;
  const total  = summary?.totalHabits ?? 0;
  const allDone= done === total && total > 0;

  const message = allDone
    ? t("coach.allDone")
    : streak >= 7
    ? t("coach.streak7",{streak})
    : rate >= 80
    ? t("coach.rate80",{rate})
    : streak >= 3
    ? t("coach.streak3",{streak})
    : t("coach.default");

  const earnedIds = new Set(earnedBadges.map(b => b.id));
  const unearned  = REWARD_BADGES.filter(b => !earnedIds.has(b.id));
  const nextRaw   = unearned.find(b => b.type==="streak") || unearned[0];
  const nextBadge = nextRaw ? badgeText(t, nextRaw) : null;

  return (
    <div className="ai-card anim-6">
      <div className="ai-orb ai-orb1"/><div className="ai-orb ai-orb2"/>
      <div className="ai-header">
        <div className="ai-icon-box">✨</div>
        <div><span className="ai-title">{t("coach.title")}</span><span className="ai-powered">{t("coach.poweredBy")}</span></div>
      </div>
      <p className="ai-msg">{message}</p>
      {earnedBadges.length>0&&(
        <div className="ai-badges">
          <p className="ai-badges-label">{t("coach.yourBadges")}</p>
          <div className="ai-badges-row">
            {earnedBadges.slice(0,6).map(b=>(
              <div key={b.id} className="ai-badge-pill" title={badgeText(t,b).label}>{b.icon}</div>
            ))}
            {earnedBadges.length>6&&<div className="ai-badge-pill">+{earnedBadges.length-6}</div>}
          </div>
        </div>
      )}
      {nextBadge&&(
        <div className="ai-next-badge">
          <span>{nextBadge.icon}</span>
          <p>{t("coach.next",{label:nextBadge.label,desc:nextBadge.desc})}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BADGES TAB
// ═══════════════════════════════════════════════════════════════
function BadgesTab({earnedBadges}) {
  const { t } = useT();
  const earnedIds = new Set(earnedBadges.map(b=>b.id));
  const pct = Math.round(earnedBadges.length/REWARD_BADGES.length*100);
  return (
    <div style={{padding:"0 16px"}}>
      <p style={{fontSize:13,color:"var(--text-2)",marginBottom:16,marginTop:4}}>
        {t("badges.earnedOf",{earned:earnedBadges.length,total:REWARD_BADGES.length})}
      </p>
      <div style={{background:"#EEF0F5",borderRadius:20,height:8,marginBottom:24,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:20,background:"linear-gradient(90deg,#34C77B,#4E8EF7)",
          width:`${pct}%`,transition:"width .5s ease"}}/>
      </div>
      {earnedBadges.length>0&&<>
        <p className="section-label" style={{padding:0,marginBottom:12}}>{t("badges.earned")}</p>
        <div className="badges-grid">
          {earnedBadges.map(b=>{
            const bt = badgeText(t,b);
            return (
              <div key={b.id} className="badge-card earned">
                <span className="badge-icon">{bt.icon}</span>
                <p className="badge-label">{bt.label}</p>
                <p className="badge-desc">{bt.desc}</p>
              </div>
            );
          })}
        </div>
      </>}
      <p className="section-label" style={{padding:0,marginBottom:12,marginTop:24}}>{t("badges.locked")}</p>
      <div className="badges-grid">
        {REWARD_BADGES.filter(b=>!earnedIds.has(b.id)).map(b=>{
          const bt = badgeText(t,b);
          return (
            <div key={b.id} className="badge-card locked">
              <span className="badge-icon" style={{filter:"grayscale(1)",opacity:.4}}>{bt.icon}</span>
              <p className="badge-label" style={{color:"var(--text-3)"}}>{bt.label}</p>
              <p className="badge-desc">{bt.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB  (v9 new)
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ user, authUser, isAdmin }) {
  const { t } = useT();
  const rows = [
    [t("settings.accountName"),  user?.name ?? "—"],
    [t("settings.accountEmail"), user?.email ?? authUser.email ?? "—"],
    [t("settings.accountDept"),  user?.department ?? "—"],
  ];
  return (
    <div style={{padding:"0 16px"}}>
      <div className="reminder-status-card" style={{marginBottom:16}}>
        <p style={{fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:12}}>{t("settings.language")}</p>
        <LangToggle dark={false}/>
      </div>

      <div className="reminder-status-card" style={{marginBottom:16}}>
        <p style={{fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:10}}>{t("settings.account")}</p>
        {rows.map(([label,value])=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"6px 0",fontSize:13}}>
            <span style={{color:"var(--text-2)"}}>{label}</span>
            <span style={{color:"var(--text)",fontWeight:600,textAlign:"right"}}>{value}</span>
          </div>
        ))}
      </div>

      {isAdmin
        ? <ManageDepartments/>
        : (
          <p style={{fontSize:11,color:"var(--text-3)",textAlign:"center",marginTop:8}}>
            {t("settings.manageDept")} · {t("settings.adminOnly")}
          </p>
        )}
    </div>
  );
}

function ManageDepartments() {
  const { t } = useT();
  const [list,setList] = useState(null);
  const [name,setName] = useState("");
  const [busy,setBusy] = useState(false);

  useEffect(() => subscribeToDepartments(setList), []);

  async function add() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addDepartment(n); setName(""); }
    catch(e) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function remove(d) {
    if (!window.confirm(t("settings.removeDeptConfirm",{name:d}))) return;
    try { await removeDepartment(d); } catch(e) { alert(e.message); }
  }

  return (
    <div className="reminder-status-card">
      <p style={{fontWeight:800,fontSize:14,color:"var(--text)"}}>{t("settings.manageDept")}</p>
      <p style={{fontSize:12,color:"var(--text-2)",margin:"4px 0 12px",lineHeight:1.5}}>{t("settings.manageDeptSub")}</p>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input className="field-input" style={{flex:1}} value={name}
          onChange={e=>setName(e.target.value)} placeholder={t("settings.newDeptPlaceholder")}
          onKeyDown={e=>e.key==="Enter"&&add()} maxLength={60}/>
        <button className="submit-btn" style={{width:"auto",padding:"0 18px",margin:0}}
          onClick={add} disabled={!name.trim()||busy}>{t("common.add")}</button>
      </div>
      {list===null ? (
        <p style={{fontSize:12,color:"var(--text-3)"}}>{t("common.loading")}</p>
      ) : list.length===0 ? (
        <p style={{fontSize:12,color:"var(--text-3)"}}>{t("settings.deptEmpty")}</p>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {list.map(d=>(
            <div key={d} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
              background:"#F7F8FC",borderRadius:10,padding:"8px 12px"}}>
              <span style={{fontSize:13,color:"var(--text)"}}>{d}</span>
              <button onClick={()=>remove(d)} title={t("common.remove")}
                style={{border:"none",background:"none",cursor:"pointer",color:"var(--coral)",fontSize:13,fontWeight:800,flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HABIT STAT CARD
// ═══════════════════════════════════════════════════════════════
function HabitStatCard({habit}) {
  const { t } = useT();
  const {name,icon,color,streak,successRate,totalDone,totalLogged} = habit;
  const chartData30d = habit.chartData30d ?? [];

  return (
    <div className="stat-detail-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{background:`${color}18`,width:44,height:44,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>{name}</p>
          <p style={{fontSize:12,color:"var(--text-2)",marginTop:2}}>{t("stats.last30")}</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:26,fontWeight:800,color,letterSpacing:"-1px"}}>{successRate}%</p>
          <p style={{fontSize:11,color:"var(--text-2)"}}>{t("stats.success")}</p>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{label:t("stats.streak"),value:`${streak}d`,accent:"#FF6B6B"},{label:t("stats.done"),value:totalDone,accent:"#34C77B"},{label:t("stats.logged"),value:totalLogged,accent:"#4E8EF7"}].map(({label,value,accent})=>(
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
              title={isFullDone?t("calendar.legendDone"):isPartial?`${d.partial.pct}%`:""}>
              <div style={{width:"100%",height:barHeight,background:barColor,borderRadius:"2px 2px 0 0",opacity,transition:"height .3s ease"}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
        <div style={{width:10,height:10,borderRadius:2,background:color}}/><span style={{fontSize:10,color:"var(--text-2)"}}>{t("calendar.legendDone")}</span>
        <div style={{width:10,height:10,borderRadius:2,background:"#F59E0B"}}/><span style={{fontSize:10,color:"var(--text-2)"}}>{t("calendar.legendPartial")}</span>
        <div style={{width:10,height:10,borderRadius:2,background:"#EEF0F5"}}/><span style={{fontSize:10,color:"var(--text-2)"}}>{t("calendar.legendMissed")}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION BANNER
// ═══════════════════════════════════════════════════════════════
function NotifBanner({ onAllow, denied }) {
  const { t } = useT();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="notif-banner">
      <span style={{fontSize:24}}>🔔</span>
      <div style={{flex:1}}>
        <p className="notif-banner-title">{t("notif.enableTitle")}</p>
        <p className="notif-banner-sub">
          {denied ? t("notif.blockedSub") : t("notif.enableSub")}
        </p>
      </div>
      {!denied && <button className="notif-allow-btn" onClick={onAllow}>{t("notif.allow")}</button>}
      <button className="notif-dismiss-btn" onClick={()=>setDismissed(true)}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REMINDERS TAB
// ═══════════════════════════════════════════════════════════════
function RemindersTab({ habits, notifPerm, gcalStatus, onRequestPermission, onEditHabit, onCreateGcal, onTestNotif }) {
  const { t } = useT();
  return (
    <div style={{padding:"0 16px"}}>
      <div className="reminder-status-card">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <span style={{fontSize:28}}>{notifPerm==="granted"?"🔔":"🔕"}</span>
          <div>
            <p style={{fontWeight:800,fontSize:14,color:"var(--text)"}}>
              {notifPerm==="granted" ? t("reminders.enabledTitle") : notifPerm==="denied" ? t("reminders.blockedTitle") : t("reminders.notEnabledTitle")}
            </p>
            <p style={{fontSize:12,color:"var(--text-2)",marginTop:2}}>
              {notifPerm==="granted" ? t("reminders.enabledSub") : notifPerm==="denied" ? t("reminders.blockedSub") : t("reminders.notEnabledSub")}
            </p>
          </div>
        </div>
        {notifPerm !== "granted" && notifPerm !== "denied" && (
          <button className="submit-btn" style={{marginBottom:0,marginTop:8}} onClick={onRequestPermission}>
            {t("reminders.enableBtn")}
          </button>
        )}
      </div>
      <p className="section-label" style={{padding:0,marginTop:20,marginBottom:12}}>{t("reminders.habitReminders")}</p>
      {habits.length === 0 ? (
        <div className="habit-empty"><span className="habit-empty-icon">⏰</span><p className="habit-empty-title">{t("reminders.noHabits")}</p><p className="habit-empty-sub">{t("reminders.addFirst")}</p></div>
      ) : habits.map(h => (
        <ReminderCard key={h.id} habit={h} notifPerm={notifPerm} gcalStatus={gcalStatus[h.id]}
          onEdit={()=>onEditHabit(h)} onCreateGcal={()=>onCreateGcal(h)} onTest={()=>onTestNotif(h)}/>
      ))}
      <div style={{background:"var(--surface)",borderRadius:"var(--r-lg)",padding:"16px",marginTop:14,boxShadow:"var(--s-sm)"}}>
        <p style={{fontWeight:800,fontSize:13,color:"var(--text)",marginBottom:8}}>{t("reminders.gcalTitle")}</p>
        <p style={{fontSize:12,color:"var(--text-2)",lineHeight:1.6,marginBottom:10}}>
          {t("reminders.gcalDesc")}
        </p>
        <p style={{fontSize:11,color:"var(--text-3)"}}>{t("reminders.gcalTimezone")}</p>
      </div>
    </div>
  );
}

function ReminderCard({ habit, notifPerm, gcalStatus, onEdit, onCreateGcal, onTest }) {
  const { t } = useT();
  const { name, icon, color, reminderEnabled, reminderTime } = habit;
  const hasReminder = reminderEnabled && reminderTime;
  return (
    <div className="reminder-card">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:hasReminder?14:0}}>
        <div style={{width:42,height:42,borderRadius:12,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{name}</p>
          <p style={{fontSize:12,color:hasReminder?"var(--green)":"var(--text-3)",marginTop:2,fontWeight:600}}>
            {hasReminder ? t("reminders.daily",{time:reminderTime}) : t("reminders.noReminder")}
          </p>
        </div>
        <button className="reminder-edit-btn" onClick={onEdit}>✏️ {t("common.edit")}</button>
      </div>
      {hasReminder && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {notifPerm==="granted" && (
            <button className="reminder-action-btn notif-test-btn" onClick={onTest}>{t("reminders.testAlert")}</button>
          )}
          <button
            className={`reminder-action-btn gcal-btn${gcalStatus==="creating"?" loading":""}`}
            onClick={onCreateGcal} disabled={gcalStatus==="creating"}>
            {gcalStatus==="creating" ? t("reminders.opening") : gcalStatus==="done" ? t("reminders.added") : t("reminders.addToGcal")}
          </button>
        </div>
      )}
      {!hasReminder && <button className="reminder-set-btn" onClick={onEdit}>{t("reminders.setReminderTime")}</button>}
    </div>
  );
}

function EmptyHabits() {
  const { t } = useT();
  return <div className="habit-empty anim-3"><span className="habit-empty-icon">🌱</span><p className="habit-empty-title">{t("empty.noHabits")}</p><p className="habit-empty-sub">{t("empty.tapPlus")}</p></div>;
}
function Spinner() {
  const { t } = useT();
  return <div className="status-screen"><div className="loading-dot"/><p className="status-msg">{t("common.loading")}</p></div>;
}
