export const UI_LANGUAGES = ["English", "Hindi", "Bangla", "Arabic"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

type Dict = Record<string, string>;

const EN: Dict = {
  dashboard: "Dashboard",
  intake: "New Patient Intake",
  queue: "Patient Queue",
  consultQueue: "Consultation Queue",
  workspace: "Doctor Workspace",
  history: "Patient History",
  myCases: "My Submitted Cases",
  analytics: "Analytics",
  reviewQueue: "Review Queue",
  referrals: "Referrals",
  followups: "Follow-ups",
  settings: "Settings",
  signOut: "Sign out",
  positioning: "AI helps organize and prioritize. Doctors make the decision.",
  trust: "AI assistance ≠ medical decision",
};

const DICTS: Record<UiLanguage, Dict> = {
  English: EN,
  Hindi: {
    ...EN,
    dashboard: "डैशबोर्ड",
    intake: "नया मरीज़ पंजीकरण",
    queue: "मरीज़ कतार",
    consultQueue: "परामर्श कतार",
    workspace: "डॉक्टर वर्कस्पेस",
    history: "मरीज़ इतिहास",
    myCases: "मेरे भेजे गए केस",
    analytics: "विश्लेषण",
    reviewQueue: "समीक्षा कतार",
    referrals: "रेफरल",
    followups: "फ़ॉलो-अप",
    settings: "सेटिंग्स",
    signOut: "साइन आउट",
    positioning: "AI व्यवस्थित और प्राथमिकता तय करने में मदद करता है। निर्णय डॉक्टर लेते हैं।",
    trust: "AI सहायता ≠ चिकित्सा निर्णय",
  },
  Bangla: {
    ...EN,
    dashboard: "ড্যাশবোর্ড",
    intake: "নতুন রোগী নিবন্ধন",
    queue: "রোগীর সারি",
    consultQueue: "পরামর্শ সারি",
    workspace: "ডাক্তার ওয়ার্কস্পেস",
    history: "রোগীর ইতিহাস",
    myCases: "আমার জমা দেওয়া কেস",
    analytics: "বিশ্লেষণ",
    reviewQueue: "পর্যালোচনা সারি",
    referrals: "রেফারেল",
    followups: "ফলো-আপ",
    settings: "সেটিংস",
    signOut: "সাইন আউট",
    positioning: "AI সাজাতে ও অগ্রাধিকার দিতে সাহায্য করে। সিদ্ধান্ত নেন ডাক্তার।",
    trust: "AI সহায়তা ≠ চিকিৎসা সিদ্ধান্ত",
  },
  Arabic: {
    ...EN,
    dashboard: "لوحة المعلومات",
    intake: "تسجيل مريض جديد",
    queue: "قائمة المرضى",
    consultQueue: "قائمة الاستشارات",
    workspace: "مساحة الطبيب",
    history: "سجل المرضى",
    myCases: "الحالات التي أرسلتها",
    analytics: "التحليلات",
    reviewQueue: "قائمة المراجعة",
    referrals: "الإحالات",
    followups: "المتابعات",
    settings: "الإعدادات",
    signOut: "تسجيل الخروج",
    positioning: "الذكاء الاصطناعي ينظّم ويرتّب الأولويات. القرار للطبيب.",
    trust: "مساعدة الذكاء الاصطناعي ≠ قرار طبي",
  },
};

export function t(lang: string | undefined, key: keyof typeof EN): string {
  const dict = DICTS[(lang as UiLanguage) ?? "English"] ?? EN;
  return dict[key] ?? EN[key] ?? key;
}
