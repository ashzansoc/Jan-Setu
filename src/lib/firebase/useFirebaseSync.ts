import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { useSettings } from '@/state/settings'
import { useComplaints } from '@/state/complaints'
import { usePlaces } from '@/state/places'
import { initAnalytics } from './client'
import {
  loadProfile,
  saveProfile,
  loadComplaints,
  saveComplaints,
  loadPlaces,
  savePlaces,
  uploadAvatar,
} from './sync'

/**
 * Bridges the local persisted stores to Firestore for the signed-in citizen.
 *
 * - On sign-in: pulls cloud profile/complaints/places into the local stores
 *   (cloud wins when it has data), and uploads a pending avatar data-URL.
 * - On any store change while signed in: debounced write-through to Firestore.
 *
 * All cloud calls fail soft — the app keeps working offline from local state.
 */
export function useFirebaseSync() {
  const { user } = useAuth()
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    void initAnalytics()
  }, [])

  // ---- pull cloud → local on sign-in ----
  useEffect(() => {
    if (!user) return
    if (loadedFor.current === user.uid) return
    loadedFor.current = user.uid
    void (async () => {
      try {
        const profile = await loadProfile(user.uid)
        if (profile) {
          const { updatedAt: _drop, ...rest } = profile
          useSettings.setState(rest as never)
        }
        const complaints = await loadComplaints(user.uid)
        if (complaints && complaints.length) {
          useComplaints.setState({ complaints, hydrated: true })
        }
        const places = await loadPlaces(user.uid)
        if (places && (places.places.length || places.helpers.length)) {
          usePlaces.setState({ places: places.places, helpers: places.helpers })
        }
        // upload a pending data-URL avatar to Storage, then store the URL
        const photo = useSettings.getState().avatarPhoto
        if (photo && photo.startsWith('data:')) {
          const url = await uploadAvatar(user.uid, photo)
          useSettings.setState({ avatarPhoto: url })
        }
      } catch {
        /* offline / rules — keep local state */
      }
    })()
  }, [user])

  // ---- write-through local → cloud (debounced) ----
  useEffect(() => {
    if (!user) return
    let timers: Record<string, number> = {}
    const debounce = (key: string, fn: () => void) => {
      window.clearTimeout(timers[key])
      timers[key] = window.setTimeout(fn, 900)
    }

    const unsubSettings = useSettings.subscribe((s) => {
      debounce('settings', () => {
        void saveProfile(user.uid, {
          uiLang: s.uiLang,
          speechLang: s.speechLang,
          languageChoice: s.languageChoice,
          voiceSpeed: s.voiceSpeed,
          textScale: s.textScale,
          reduceMotion: s.reduceMotion,
          readAloud: s.readAloud,
          highContrast: s.highContrast,
          vibrate: s.vibrate,
          mixedLanguages: s.mixedLanguages,
          name: s.name,
          avatarId: s.avatarId,
        }).catch(() => {})
      })
    })

    const unsubComplaints = useComplaints.subscribe((s) => {
      debounce('complaints', () => {
        void saveComplaints(user.uid, s.complaints).catch(() => {})
      })
    })

    const unsubPlaces = usePlaces.subscribe((s) => {
      debounce('places', () => {
        void savePlaces(user.uid, s.places, s.helpers).catch(() => {})
      })
    })

    return () => {
      unsubSettings()
      unsubComplaints()
      unsubPlaces()
      Object.values(timers).forEach((t) => window.clearTimeout(t))
      timers = {}
    }
  }, [user])
}