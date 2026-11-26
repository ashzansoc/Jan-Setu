/**
 * Onboarding copy.
 *
 * These screens are deliberately bilingual — the citizen hears Hindi first and
 * sees the English gloss underneath, exactly as the designs specify. Copy lives
 * here rather than in the three-locale dictionary because every string is a
 * Hindi/English pair rather than a translation.
 */

export interface ObString {
  hi: string
  en: string
}

export const OB = {
  brand: { hi: 'जनसेतु • Voice to Action', en: 'JANSETU • Voice to Action' },
  listen: { hi: 'सुनें • Listen', en: 'Listen • सुनें' },
  tipToListen: { hi: 'सुनकर समझें • Tap to listen', en: 'Tap to listen • सुनकर समझें' },
  namaste: { hi: 'नमस्ते • Welcome', en: 'Welcome • नमस्ते' },
  speakOpen: { hi: 'बोलिए, काम होगा।', en: 'Speak and it is done.' },
  voiceAction: { hi: 'Your voice, official civic action.', en: 'Aapki awaaz, sarkari kaam.' },
  google: { hi: 'Continue with Google', en: 'गूगल से सुरक्षित शुरू करें' },
  googleSub: { hi: 'Continue with Google', en: 'गूगल से सुरक्षित शुरू करें' },
  noPassword: { hi: 'No passwords needed • पासवर्ड की ज़रूरत नहीं', en: '' },
  preferredLanguage: { hi: 'भाषा / Preferred Language', en: '' },
  govIntegrated: { hi: 'सत्यमेव जयते • Government Integrated', en: '' },
  encrypted: { hi: 'सुरक्षित डिजिटल नागरिक सेवा', en: 'Official 256-bit encrypted civic portal' },

  next: { hi: 'आगे बढ़ें • Next', en: 'आगे बढ़ें • Next' },
  back: { hi: 'वापस • Back', en: 'वापस • Back' },
  stepOf: (a: number, b: number) => ({ hi: `चरण ${a} / ${b}`, en: `Step ${a} of ${b}` }),
  step4of5: { hi: 'चरण 4 / 5 • Step 4 of 5', en: 'चरण 4 / 5 • Step 4 of 5' },
  required: { hi: 'आवश्यक • Required', en: 'Required • आवश्यक' },
  nameRequired: { hi: 'कृपया अपना नाम लिखें।', en: 'Please enter your name.' },
  phoneRequired: { hi: 'कृपया अपना मोबाइल नंबर लिखें।', en: 'Please enter your mobile number.' },
  phoneInvalid: {
    hi: '10 अंकों का मोबाइल नंबर डालिए (जैसे 98110 54421)।',
    en: 'Enter a 10-digit mobile number, for example 98110 54421.',
  },
  nameHint: { hi: 'जैसे कमला देवी', en: 'e.g. Kamla Devi' },
  phoneHint: { hi: 'जैसे 98110 54421', en: 'e.g. 98110 54421' },
  finalStep: { hi: 'अंतिम चरण • Final Step', en: 'अंतिम चरण • Final Step' },

  speaking: { hi: 'जनसेतु बोल रहा है', en: 'JANSETU is speaking' },
  chooseLanguage: { hi: 'अपनी भाषा चुनें', en: 'Choose your language' },
  typeInstead: { hi: 'कीबोर्ड से लिखें (Type instead)', en: '' },

  listening: { hi: 'सुन रहे हैं... • Listening', en: '' },
  atHome: { hi: 'क्या आप अभी अपने घर पर हैं?', en: 'Are you at home right now?' },
  yesAtHome: { hi: 'हाँ, घर पर हूँ', en: 'Yes, I am at home' },
  wardDetected: { hi: 'स्वतः पहचाना • detected', en: 'Detected from your area' },
  elsewhere: { hi: 'नहीं, कहीं और', en: 'Somewhere else' },
  chooseWard: { hi: 'अपना वार्ड चुनें', en: 'Choose your ward' },

  confirmInfo: { hi: 'आपकी जानकारी की पुष्टि करें', en: 'Confirm your details' },
  fromGoogle: { hi: 'Google खाते से प्राप्त जानकारी', en: 'Received from your Google account' },
  connected: { hi: 'Google खाते से जुड़ा • Connected', en: '' },
  fullName: { hi: 'पूरा नाम • Full Name', en: '' },
  email: { hi: 'ईमेल • Email ID', en: '' },
  mobile: { hi: 'मोबाइल नंबर • Mobile', en: '' },
  mobileNote: { hi: 'शिकायत अपडेट और WhatsApp सूचना हेतु', en: 'For complaint updates and WhatsApp alerts' },
  verified: { hi: 'सत्यापित • Verified', en: '' },
  editByVoice: { hi: 'बोलकर बदलें (Edit by voice)', en: '' },
  privacyNote: {
    hi: 'यह जानकारी केवल आधिकारिक नागरिक शिकायतों और समाधान सूचना के लिए सुरक्षित रखी जाएगी।',
    en: 'Used strictly for official municipal grievance redressal updates.',
  },

  ready: (name: string | null) => ({
    hi: name ? `सब तैयार है, ${name} जी!` : 'सब तैयार है!',
    en: name ? `All set & verified, ${name} ji!` : 'All set & verified!',
  }),
  readySub: { hi: 'All set & verified, ready for civic action.', en: 'Aap taiyaar hain.' },
  speakToFile: {
    hi: 'अब आप केवल बोलकर अपनी नागरिक समस्या दर्ज कर सकती हैं — पानी, सड़क, बिजली या सफाई।',
    en: 'Simply tap and speak in your mother tongue anytime.',
  },
  verifiedDetails: { hi: 'सत्यापित विवरण • Your Profile', en: '' },
  active: { hi: 'सक्रिय (Active)', en: '' },
  mcd: { hi: 'दक्षिण दिल्ली नगर निगम (MCD)', en: 'South Delhi Municipal Corporation' },
  hindiVoice: { hi: '🗣️ हिन्दी • Hindi Voice', en: '' },
  sampleCommand: { hi: 'एक बार बोलकर देखें • Sample Command', en: '' },
  sampleGarbage: { hi: '“मेरे घर के बाहर कचरा पड़ा है”', en: 'Garbage outside my gate' },
  start: { hi: 'जनसेतु शुरू करें', en: 'Enter JANSETU' },
  dataSafe: { hi: 'नागरिक डेटा पूर्णतः सुरक्षित एवं एन्क्रिप्टेड है', en: '' },
  signedOut: { hi: 'बिना खाते के जारी रखें • Continue without an account', en: 'Continue without an account • बिना खाते के जारी रखें' },
  signInFailed: {
    hi: 'गूगल साइन-इन पूरा नहीं हो सका। आप बिना खाते के भी जारी रख सकती हैं।',
    en: 'Google sign-in did not complete. You can still continue without an account.',
  },
} as const

export type ObKey = keyof typeof OB

/** Primary line for the interface language. */
export function primary(key: ObKey, lang: 'hi' | 'en'): string {
  const entry = OB[key] as unknown as ObString
  return entry[lang] || entry.hi
}

/** The other line, when the reference shows a bilingual pair. */
export function secondary(key: ObKey, lang: 'hi' | 'en'): string | null {
  const entry = OB[key] as unknown as ObString
  const other = lang === 'hi' ? entry.en : entry.hi
  return other && other !== entry[lang] ? other : null
}