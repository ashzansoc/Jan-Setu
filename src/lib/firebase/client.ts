import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { Capacitor } from '@capacitor/core'

/**
 * Firebase backend for JANSETU.
 *
 * The web config values (apiKey, projectId, …) are PUBLIC identifiers — they
 * are safe in the client bundle. Access is controlled by Firebase Security
 * Rules (see firestore.rules / storage.rules), never by hiding these.
 *
 * Values come from VITE_FIREBASE_* env vars, falling back to the project's
 * public config so the app works out of the box.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyC1SCtRPZMXCdN-ZjVJtKqy6fvHc7ME6b4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'jansetu-d4e35.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'jansetu-d4e35',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'jansetu-d4e35.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '393384436037',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:393384436037:web:d35ee129968dd7b034de2c',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-WVNRD92QPV',
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp())
  return auth
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp())
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp())
  return storage
}

/** Analytics is browser-only; skip it in the native webview and when blocked. */
export async function initAnalytics(): Promise<void> {
  if (Capacitor.isNativePlatform()) return
  if (typeof window === 'undefined') return
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(getFirebaseApp())
  } catch {
    /* analytics unavailable (adblock / unsupported) — non-fatal */
  }
}