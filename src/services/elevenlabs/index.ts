export {
  loadVoiceConfig,
  peekVoiceConfig,
  isElevenLabsActive,
  type VoiceConfig,
} from './config'
export {
  speakWithElevenLabs,
  cancelElevenLabsSpeech,
  isElevenLabsSpeaking,
  unlockElevenLabsAudio,
  type ElevenLabsSpeakOptions,
} from './tts'
export { transcribeWithElevenLabs } from './stt'
