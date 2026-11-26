# JANSETU voice layer (ElevenLabs)

ElevenLabs is JANSETU's primary speech provider. The API key lives **only** in
the API process (`server/`), is never bundled into the web app, never placed in
a `VITE_` variable, and never logged.

## Configuration

```bash
ELEVENLABS_API_KEY=            # required; server-side only
ELEVENLABS_VOICE_ID=P1bg08DkjqiVEzOn76yG
ELEVENLABS_TTS_MODEL_ID=eleven_v4_turbo
ELEVENLABS_STT_MODEL_ID=scribe_v3_live
```

Run the API alongside the web app:

```bash
npm run dev:all      # vite + API on :8787
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/voice/config` | Capability probe: `{ configured, provider, voiceId, ttsModel, sttModel, issue? }` |
| POST | `/api/voice/tts` | `{ text, lang?, rate? }` → `audio/mpeg` stream |
| POST | `/api/voice/transcribe` | multipart `file` (+ `language_code`) → `{ ok, text }` |
| GET | `/api/health` | Now includes `voice: configured \| not-configured` |

`501` means "ElevenLabs not configured" — it is a signal to fall back, not an
error. `502` means the upstream call failed.

## How the client uses it

- `src/services/elevenlabs/config.ts` caches the capability probe and logs which
  provider is active.
- `src/services/elevenlabs/tts.ts` streams the MP3 into an `Audio` element and
  exposes a Web Audio `AnalyserNode` amplitude feed. That feed drives
  `useSpeakingLevel`, which the orb reads to animate on **real** audio.
- `src/services/elevenlabs/stt.ts` records with `MediaRecorder` and posts the
  clip for batch transcription.
- `src/lib/voice/tts.ts#speak()` tries ElevenLabs first and returns early on
  success. If the provider is unconfigured or fails, it falls through to the Web
  Speech path and logs `[jansetu voice] … using Web Speech`.

## Orb states

`OrbState` now covers the full set: `idle`, `listening`, `transcribing`,
`understanding`, `thinking`, `planning`, `clarifying`, `working`, `waiting`,
`speaking`, `success`, `error`. Amplitude comes from the microphone while
listening and from the ElevenLabs analyser while speaking — no timers.

## Not yet implemented

These are deliberately out of this slice and are **not** claimed as working:

- **Scribe Live realtime WebSocket relay** — only batch transcription is wired.
- **Skyvern assisted filing** — the server skeleton exists but needs
  `SKYVERN_API_KEY` and has not been exercised.
- **Database / persistence** — records still live in localStorage.
- **Auth, WebSocket event bus, push notifications.**

## Verifying

Without a key, `GET /api/health` reports `voice: not-configured` and the app logs
the fallback. A real ElevenLabs round-trip **cannot be verified without your
key**, so treat the integration as unproven until you have exercised it.
