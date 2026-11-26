import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { getDb, getFirebaseStorage } from './client'
import type { Complaint } from '@/lib/complaints/types'
import type { Place, Helper } from '@/state/places'

/**
 * Firestore/Storage persistence for a signed-in citizen.
 *
 * Model (kept simple + secure via rules):
 *   users/{uid}                    → profile & accessibility settings
 *   users/{uid}/data/complaints    → the complaint list
 *   users/{uid}/data/places        → places + trusted helpers
 *   avatars/{uid}                  → avatar image (Storage)
 *
 * The local stores stay the source of truth offline; this layer mirrors them
 * to the cloud when a user is signed in.
 */

export interface ProfileDoc {
  uiLang?: string
  speechLang?: string
  languageChoice?: string
  voiceSpeed?: number
  textScale?: number
  reduceMotion?: boolean
  readAloud?: boolean
  highContrast?: boolean
  vibrate?: boolean
  mixedLanguages?: boolean
  name?: string | null
  avatarId?: string
  updatedAt?: unknown
}

export async function loadProfile(uid: string): Promise<ProfileDoc | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid))
  return snap.exists() ? (snap.data() as ProfileDoc) : null
}

export async function saveProfile(uid: string, data: ProfileDoc): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export async function loadComplaints(uid: string): Promise<Complaint[] | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid, 'data', 'complaints'))
  if (!snap.exists()) return null
  const list = (snap.data() as { list?: Complaint[] }).list
  return Array.isArray(list) ? list : null
}

export async function saveComplaints(uid: string, list: Complaint[]): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid, 'data', 'complaints'), {
    list,
    updatedAt: serverTimestamp(),
  })
}

export async function loadPlaces(uid: string): Promise<{ places: Place[]; helpers: Helper[] } | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid, 'data', 'places'))
  if (!snap.exists()) return null
  const d = snap.data() as { places?: Place[]; helpers?: Helper[] }
  return { places: d.places ?? [], helpers: d.helpers ?? [] }
}

export async function savePlaces(uid: string, places: Place[], helpers: Helper[]): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid, 'data', 'places'), {
    places,
    helpers,
    updatedAt: serverTimestamp(),
  })
}

/** Upload a data-URL (or remote URL) avatar and return its download URL. */
export async function uploadAvatar(uid: string, dataUrlOrUrl: string): Promise<string> {
  const storageRef = ref(getFirebaseStorage(), `avatars/${uid}`)
  await uploadString(storageRef, dataUrlOrUrl, 'data_url')
  return getDownloadURL(storageRef)
}