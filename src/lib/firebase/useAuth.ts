import { useCallback, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from './client'
import { Capacitor } from '@capacitor/core'
import JansetuGoogleSignIn from '@jansetu/google-sign-in'

export interface AuthState {
  user: User | null
  /** True until Firebase has reported the initial auth state. */
  loading: boolean
  error: string | null
  signInGoogle: () => Promise<void>
  signInGuest: () => Promise<void>
  signOut: () => Promise<void>
}

/**
 * The signed-in citizen.
 *
 * Production-grade notes:
 * - `browserLocalPersistence` keeps the session across reloads/relaunches.
 * - Google sign-in uses the native account sheet on iOS/Android (Google blocks
 *   OAuth in embedded WebViews) and a popup on the web, falling back to a
 *   full-page redirect when the popup is blocked. `getRedirectResult` completes
 *   a redirect flow on the next load.
 * - Errors are surfaced as short human strings, never thrown, so a failed
 *   sign-in cannot break the screen.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(() => getFirebaseAuth().currentUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getFirebaseAuth()
    // Persist the session; ignore failure (e.g. storage disabled).
    void setPersistence(auth, browserLocalPersistence).catch(() => {})

    // Finish a Google redirect sign-in if the page was reloaded mid-flow.
    void getRedirectResult(auth).catch((cause) => {
      const msg = friendlyAuthError(cause)
      if (msg) setError(msg)
    })

    const unsubscribe = onAuthStateChanged(
      auth,
      (next) => {
        setUser(next)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [])

  const signInGoogle = useCallback(async () => {
    setError(null)
    setLoading(true)
    const auth = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await setPersistence(auth, browserLocalPersistence).catch(() => {})
      // A WebView cannot host the popup, and Google refuses to run OAuth in an
      // embedded WebView at all, so the JS redirect flow can never complete on
      // a native build. iOS uses the native Google sheet and exchanges the ID
      // token it returns for a Firebase credential.
      if (Capacitor.getPlatform() === 'ios') {
        const result = await JansetuGoogleSignIn.signIn()
        const credential = GoogleAuthProvider.credential(result.idToken)
        await signInWithCredential(auth, credential)
        return
      }
      if (Capacitor.isNativePlatform()) {
        // Android has no native Google sheet wired yet; say so instead of
        // leaving the button greyed out while a redirect that cannot complete.
        setError(
          'Google sign-in is not available in the Android build yet. Continue without an account — your complaints still work on this device.',
        )
        return
      }
      await signInWithPopup(auth, provider)
    } catch (cause) {
      const message = (cause as { message?: string } | null)?.message ?? ''
      if (message === 'redirect-unavailable') {
        setError(
          'Google sign-in cannot complete inside the app. Continue without an account — your complaints still work on this device.',
        )
        return
      }
      const code = (cause as { code?: string } | null)?.code ?? ''
      // Popup blocked / unsupported (common in webviews) → redirect instead.
      if (
        code.includes('popup-blocked') ||
        code.includes('popup-closed') ||
        code.includes('operation-not-supported') ||
        code.includes('cancelled-popup-request')
      ) {
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch (redirectCause) {
          setError(friendlyAuthError(redirectCause))
        }
      } else {
        setError(friendlyAuthError(cause))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const signInGuest = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await signInAnonymously(getFirebaseAuth())
    } catch (cause) {
      setError(friendlyAuthError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    try {
      // Clear the native Google session too, otherwise the account picker
      // silently signs the same citizen back in on the next attempt.
      if (Capacitor.getPlatform() === 'ios') {
        await JansetuGoogleSignIn.signOut().catch(() => {})
      }
      await firebaseSignOut(getFirebaseAuth())
    } catch (cause) {
      setError(friendlyAuthError(cause))
    }
    setUser(null)
  }, [])

  return { user, loading, error, signInGoogle, signInGuest, signOut }
}

function friendlyAuthError(cause: unknown): string | null {
  const code = (cause as { code?: string } | null)?.code ?? ''
  if (!code) return null
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'Sign-in was cancelled.'
  if (code.includes('network')) return 'You appear to be offline. Try again when connected.'
  if (code.includes('unauthorized-domain')) {
    return 'This address is not authorised for Google sign-in yet. Add it in Firebase Console → Authentication → Settings → Authorised domains, then reload.'
  }
  if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled for this project.'
  if (code.includes('account-exists-with-different-credential')) {
    return 'This email already uses a different sign-in method.'
  }
  return 'Sign-in did not complete. Please try again.'
}