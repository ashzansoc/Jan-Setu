import { useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { HomeScreen } from '@/screens/HomeScreen'
import { WelcomeScreen } from '@/screens/WelcomeScreen'
import { UnderstandScreen } from '@/screens/UnderstandScreen'
import { PreviewScreen } from '@/screens/PreviewScreen'
import { ReplayDetailScreen } from '@/screens/ReplayDetailScreen'
import { ReplayListScreen } from '@/screens/ReplayListScreen'
import { ComplaintsScreen } from '@/screens/ComplaintsScreen'
import { ComplaintDetailScreen } from '@/screens/ComplaintDetailScreen'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { ActionCentreScreen } from '@/screens/ActionCentreScreen'
import { ActionTaskScreen } from '@/screens/ActionTaskScreen'
import { PlacesScreen } from '@/screens/PlacesScreen'
import { PortalLoginScreen } from '@/screens/PortalLoginScreen'
import { AssistedFilingScreen } from '@/screens/AssistedFilingScreen'
import { BottomNav } from '@/components/BottomNav'
import { useSettings } from '@/state/settings'
import { useComplaints } from '@/state/complaints'
import { bindNavigate, stopCapture, restartTurnForLanguage } from '@/lib/flow'
import { loadVoices } from '@/lib/voice/tts'
import { loadVoiceConfig, unlockElevenLabsAudio } from '@/services/elevenlabs'
import { getRedirectResult } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { useFirebaseSync } from '@/lib/firebase/useFirebaseSync'

const NAV_ROUTES = ['/', '/complaints', '/replay', '/profile', '/actions']

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const uiLang = useSettings((s) => s.uiLang)
  const textScale = useSettings((s) => s.textScale)
  const languageEpoch = useSettings((s) => s.languageEpoch)
  const reduceMotion = useSettings((s) => s.reduceMotion)
  const onboarded = useSettings((s) => s.onboarded)
  const hydrateComplaints = useComplaints((s) => s.hydrate)

  // Auth + Firestore/Storage sync for the signed-in citizen.
  useFirebaseSync()

  // Re-assert the light status bar (dark icons) once the native bridge is ready.
  // The early call in main.tsx can fire before Android's bridge attaches.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Light })
    StatusBar.setBackgroundColor({ color: '#FAF8F5' })
  }, [])

  // Re-apply on every navigation so it never drifts back to white.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Light })
  }, [location.pathname])

  // Read persisted complaints once, so any deep link renders real data.
  useEffect(() => {
    hydrateComplaints()
  }, [hydrateComplaints])

  useEffect(() => {
    bindNavigate((to) => navigate(to))
  }, [navigate])

  useEffect(() => {
    // Hinglish is Roman script, so it needs the Latin face rather than Devanagari.
    document.documentElement.lang = uiLang === 'hi' ? 'hi' : 'en'
    document.documentElement.dataset.uiLang = uiLang
    document.documentElement.style.fontSize = `${16 * textScale}px`
  }, [uiLang, textScale])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false'
  }, [reduceMotion])

  // A language switch must land mid-flow: cut queued speech and re-ask the
  // pending clarification in the new language. Skip the initial mount.
  const lastEpoch = useRef(languageEpoch)
  useEffect(() => {
    if (lastEpoch.current === languageEpoch) return
    lastEpoch.current = languageEpoch
    void restartTurnForLanguage()
  }, [languageEpoch])

  // Google sign-in returns to the app ROOT, but the auth hook only mounts on
  // /profile — so without this the redirect result is dropped and the user
  // lands back signed out. Consume it once here, whatever route we land on.
  useEffect(() => {
    void getRedirectResult(getFirebaseAuth()).catch((cause) => {
      const code = (cause as { code?: string } | null)?.code ?? ''
      if (code) console.warn('[jansetu auth] sign-in did not complete:', code)
    })
  }, [])

  // Voices load asynchronously on Chrome; warm them once. The voice-provider
  // probe must resolve before the first speak() so ElevenLabs is actually used
  // instead of silently falling back.
  useEffect(() => {
    void loadVoices()
    void loadVoiceConfig()
  }, [])

  // Browsers gate programmatic audio until a gesture; unlock once so a whole
  // spoken turn stays on the ElevenLabs voice instead of falling back mid-way.
  useEffect(() => {
    const unlock = () => unlockElevenLabsAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Leaving a screen mid-listen must not keep the microphone open.
  useEffect(() => {
    return () => stopCapture()
  }, [location.pathname])

  // The replay detail keeps the tab bar, as in the design, so the citizen can
  // leave the timeline without hunting for the back arrow.
  const showNav =
    NAV_ROUTES.includes(location.pathname) || location.pathname.startsWith('/replay/')

  if (!onboarded && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes location={location}>
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/" element={<HomeScreen />} />
            <Route path="/understand" element={<UnderstandScreen />} />
            <Route path="/preview" element={<PreviewScreen />} />
            <Route path="/complaints" element={<ComplaintsScreen />} />
            <Route path="/complaints/:id" element={<ComplaintDetailScreen />} />
            <Route path="/replay" element={<ReplayListScreen />} />
            <Route path="/replay/:id" element={<ReplayDetailScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/actions" element={<ActionCentreScreen />} />
        <Route path="/actions/:id" element={<ActionTaskScreen />} />
            <Route path="/places" element={<PlacesScreen />} />
            <Route path="/portal-login" element={<PortalLoginScreen />} />
            <Route path="/filing" element={<AssistedFilingScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {showNav && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
