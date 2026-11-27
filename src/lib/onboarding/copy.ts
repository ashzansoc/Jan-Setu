/**
 * Onboarding copy.
 *
 * Every string is a Hindi/English pair. The interface shows the citizen's
 * chosen language only — the other language is available through
 * `secondary()` for the few places that deliberately show a gloss, but it is
 * never mixed in by default.
 */

export interface ObString {
  hi: string
  en: string
}

export const OB = {
  brand: { hi: 'जनसेतु • Voice to Action', en: 'Jansetu • Voice to Action' },
  listen: { hi: 'सुनें • Listen', en: 'Listen' },
  tipToListen: { hi: 'सुनकर समझें • Tap to listen', en: 'Tap to listen' },
  namaste: { hi: 'नमस्ते • Welcome', en: 'Welcome' },
  speakOpen: { hi: 'बोलिए, काम होगा।', en: 'Speak and it is done.' },
  voiceAction: { hi: 'आपकी आवाज़, सरकारी काम।', en: 'Your voice, official civic action.' },
  google: { hi: 'Continue with Google', en: 'Continue with Google' },
  googleSub: { hi: 'गूगल से सुरक्षित शुरू करें', en: 'Secure sign-in with Google' },
  noPassword: { hi: 'No passwords needed • पासवर्ड की ज़रूरत नहीं', en: 'No passwords needed' },
  preferredLanguage: { hi: 'भाषा / Preferred Language', en: 'Preferred language' },
  languageHint: { hi: 'भाषा कभी भी बदल सकती हैं', en: 'You can change this any time' },
  govIntegrated: { hi: 'सत्यमेव जयते • Government Integrated', en: 'Government Integrated' },
  encrypted: { hi: 'सुरक्षित डिजिटल नागरिक सेवा', en: 'Official 256-bit encrypted civic portal' },

  next: { hi: 'आगे बढ़ें • Next', en: 'Next' },
  back: { hi: 'वापस • Back', en: 'Back' },
  stepOf: (a: number, b: number) => ({ hi: `चरण ${a} / ${b}`, en: `Step ${a} of ${b}` }),
  step4of5: { hi: 'चरण 4 / 5 • Step 4 of 5', en: 'Step 4 of 5' },
  required: { hi: 'आवश्यक • Required', en: 'Required' },
  nameRequired: { hi: 'कृपया अपना नाम लिखें।', en: 'Please enter your name.' },
  phoneRequired: { hi: 'कृपया अपना मोबाइल नंबर लिखें।', en: 'Please enter your mobile number.' },
  phoneInvalid: {
    hi: '10 अंकों का मोबाइल नंबर डालिए (जैसे 98110 54421)।',
    en: 'Enter a 10-digit mobile number, for example 98110 54421.',
  },
  nameHint: { hi: 'जैसे कमला देवी', en: 'e.g. Kamla Devi' },
  phoneHint: { hi: 'जैसे 98110 54421', en: 'e.g. 98110 54421' },
  finalStep: { hi: 'अंतिम चरण • Final Step', en: 'Final Step' },

  speaking: { hi: 'जनसेतु बोल रहा है', en: 'Jansetu is speaking' },
  chooseLanguage: { hi: 'अपनी भाषा चुनें', en: 'Choose your language' },
  typeInstead: { hi: 'कीबोर्ड से लिखें (Type instead)', en: 'Type instead' },

  listening: { hi: 'सुन रहे हैं... • Listening', en: 'Listening…' },
  atHome: { hi: 'क्या आप अभी अपने घर पर हैं?', en: 'Are you at home right now?' },
  yesAtHome: { hi: 'हाँ, घर पर हूँ', en: 'Yes, I am at home' },
  wardDetected: { hi: 'स्वतः पहचाना • detected', en: 'Detected from your area' },
  elsewhere: { hi: 'नहीं, कहीं और', en: 'Somewhere else' },
  chooseWard: { hi: 'अपना वार्ड चुनें', en: 'Choose your area' },

  confirmInfo: { hi: 'आपकी जानकारी की पुष्टि करें', en: 'Confirm your details' },
  detailsEditable: { hi: 'इन विवरणों में बदलाव कर सकती हैं', en: 'You can edit these details' },
  cancel: { hi: 'रद्द', en: 'Cancel' },
  save: { hi: 'सहेजें', en: 'Save' },
  emailMissing: { hi: 'ईमेल उपलब्ध नहीं', en: 'Email not available' },
  editName: { hi: 'बदलें / Edit Name', en: 'Edit name' },
  editMobile: { hi: 'बदलें / Edit Mobile Number', en: 'Edit mobile number' },
  fromGoogle: { hi: 'Google खाते से प्राप्त जानकारी', en: 'Received from your Google account' },
  connected: { hi: 'Google खाते से जुड़ा • Connected', en: 'Connected' },
  fullName: { hi: 'पूरा नाम • Full Name', en: 'Full Name' },
  email: { hi: 'ईमेल • Email ID', en: 'Email ID' },
  mobile: { hi: 'मोबाइल नंबर • Mobile', en: 'Mobile number' },
  mobileNote: { hi: 'शिकायत अपडेट और WhatsApp सूचना हेतु', en: 'For complaint updates and WhatsApp alerts' },
  verified: { hi: 'सत्यापित • Verified', en: 'Verified' },
  editByVoice: { hi: 'बोलकर बदलें (Edit by voice)', en: 'Edit by voice' },
  privacyNote: {
    hi: 'यह जानकारी केवल आधिकारिक नागरिक शिकायतों और समाधान सूचना के लिए सुरक्षित रखी जाएगी।',
    en: 'Used strictly for official municipal grievance redressal updates.',
  },

  ready: (name: string | null) => ({
    hi: name ? `सब तैयार है, ${name} जी!` : 'सब तैयार है!',
    en: name ? `All set & verified, ${name} ji!` : 'All set & verified!',
  }),
  readySub: { hi: 'All set & verified, ready for civic action.', en: 'All set & verified, ready for civic action.' },
  speakToFile: {
    hi: 'अब आप केवल बोलकर अपनी नागरिक समस्या दर्ज कर सकती हैं — पानी, सड़क, बिजली या सफाई।',
    en: 'Simply tap and speak in your mother tongue anytime.',
  },
  verifiedDetails: { hi: 'सत्यापित विवरण • Your Profile', en: 'Your Profile' },
  active: { hi: 'सक्रिय (Active)', en: 'Active' },
  mcd: { hi: 'दक्षिण दिल्ली नगर निगम (MCD)', en: 'South Delhi Municipal Corporation' },
  hindiVoice: { hi: '🗣️ हिन्दी • Hindi Voice', en: 'Hindi Voice' },
  sampleCommand: { hi: 'एक बार बोलकर देखें • Sample Command', en: 'Sample Command' },
  sampleGarbage: { hi: '“मेरे घर के बाहर कचरा पड़ा है”', en: '“Garbage outside my gate”' },
  start: { hi: 'जनसेतु शुरू करें', en: 'Enter Jansetu' },
  dataSafe: { hi: 'नागरिक डेटा पूर्णतः सुरक्षित एवं एन्क्रिप्टेड है', en: 'Citizen data is fully secure and encrypted' },
  signedOut: { hi: 'बिना खाते के जारी रखें • Continue without an account', en: 'Continue without an account' },
  signInFailed: {
    hi: 'गूगल साइन-इन पूरा नहीं हो सका। आप बिना खाते के भी जारी रख सकती हैं।',
    en: 'Google sign-in did not complete. You can still continue without an account.',
  },
} as const

export type ObKey = keyof typeof OB

/** Copy for the interface language. Never falls back to the other language. */
export function primary(key: ObKey, lang: 'hi' | 'en'): string {
  const entry = OB[key] as unknown as ObString
  return entry[lang] || entry.en
}

/** The other language, for the few places that deliberately show a gloss. */
export function secondary(key: ObKey, lang: 'hi' | 'en'): string | null {
  const entry = OB[key] as unknown as ObString
  const other = lang === 'hi' ? entry.en : entry.hi
  return other && other !== entry[lang] ? other : null
}