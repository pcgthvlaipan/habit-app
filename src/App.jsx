// src/App.jsx
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/shared/Toast'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import AuthPage from '@/components/auth/AuthPage'
import AppShell from '@/components/shared/AppShell'
import Dashboard from '@/components/dashboard/Dashboard'
import HabitsPage from '@/components/habits/HabitsPage'
import HabitDetailPage from '@/components/habits/HabitDetailPage'
import AnalyticsPage from '@/components/analytics/AnalyticsPage'
import CalendarPage from '@/components/analytics/CalendarPage'
import CoachPage from '@/components/coach/CoachPage'
import SettingsPage from '@/components/settings/SettingsPage'
import LoadingScreen, { devLog } from '@/components/shared/LoadingScreen'
import Onboarding from '@/components/onboarding/Onboarding'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'

// ─── Protected route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return <LoadingScreen message="Checking authentication…" />
  }
  if (!user) {
    return <Navigate to="/auth" replace />
  }
  return children
}

// ─── Onboarding gate ─────────────────────────────────────────────────────────
// BUG fixed: previously `checkingOnboarding` started true but the useEffect
// had a guard `if (!user) return` that could leave it true forever when the
// user state hadn't resolved yet. Now we only mount this component after the
// user is confirmed (inside ProtectedRoute), so user is always non-null here.
const ONBOARDING_TIMEOUT_MS = 6000

function AppWithOnboarding() {
  const { user } = useAuth()
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)
  const [needsOnboarding,    setNeedsOnboarding]    = useState(false)

  useEffect(() => {
    devLog('onboarding check started')

    // Safety timeout – if Firestore read hangs, continue to the app anyway.
    const timeout = setTimeout(() => {
      devLog('onboarding check timed out – skipping')
      setCheckingOnboarding(false)
    }, ONBOARDING_TIMEOUT_MS)

    const check = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        const data = snap.data()
        setNeedsOnboarding(!data?.onboardingComplete)
        devLog(`onboarding check done – needs: ${!data?.onboardingComplete}`)
      } catch (err) {
        // Firestore unavailable / rules not deployed yet – skip onboarding.
        console.warn('[Onboarding] Firestore read failed:', err?.code)
        devLog(`onboarding check failed (${err?.code}) – skipping`)
        setNeedsOnboarding(false)
      } finally {
        clearTimeout(timeout)
        setCheckingOnboarding(false)
      }
    }

    check()

    return () => clearTimeout(timeout)
  // user.uid is stable once we're inside ProtectedRoute – safe dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  if (checkingOnboarding) {
    return <LoadingScreen message="Setting up your account…" />
  }

  return (
    <>
      {needsOnboarding && (
        <Onboarding
          uid={user.uid}
          onComplete={() => setNeedsOnboarding(false)}
        />
      )}
      <AppShell />
    </>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  // Log that React has mounted – useful to confirm JS executed on Safari.
  useEffect(() => {
    devLog('React root mounted')
    devLog(`platform: ${navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'other'}`)
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppWithOnboarding />
              </ProtectedRoute>
            }
          >
            <Route index                  element={<Dashboard />} />
            <Route path="habits"          element={<HabitsPage />} />
            <Route path="habits/:habitId" element={<HabitDetailPage />} />
            <Route path="analytics"       element={<AnalyticsPage />} />
            <Route path="calendar"        element={<CalendarPage />} />
            <Route path="coach"           element={<CoachPage />} />
            <Route path="settings"        element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  )
}
