/** Static UI copy for the AI assistant page, keyed by the selected regional language. */

export type AssistantCopy = {
  title: string;
  intro: string;
  languageLabel: string;
  patientLabel: string;
  empty: string;
  thinking: string;
  placeholder: string;
  ask: string;
  listen: string;
  questionLabel: string;
  workerPrompts: string[];
  doctorPrompts: string[];
};

const EN: AssistantCopy = {
  title: "AI assistant",
  intro:
    "Ask general health questions, or pick a patient to scope answers to that case. It never diagnoses and cannot change a risk tier, a decision or a note.",
  languageLabel: "Answer language",
  patientLabel: "Patient case (optional)",
  empty:
    "Ask any general health question, or select a patient to get answers grounded in that case record. Tap the mic to ask by voice, and Listen to hear the answer in your language.",
  thinking: "Reading the case record…",
  placeholder: "Ask a health question, or about the selected patient…",
  ask: "Ask",
  listen: "Listen",
  questionLabel: "Question",
  workerPrompts: [
    "How do I clean and dress a minor wound?",
    "What are the danger signs in a child with fever?",
    "How should ORS be prepared and given?",
  ],
  doctorPrompts: [
    "Summarize current first-line management of dehydration.",
    "What are red-flag features of chest pain?",
    "Key counselling points for a newly diagnosed diabetic.",
  ],
};

const HI: AssistantCopy = {
  title: "एआई सहायक",
  intro:
    "सामान्य स्वास्थ्य प्रश्न पूछें, या किसी मरीज़ को चुनकर उसी केस से जुड़े उत्तर पाएँ। यह कभी निदान नहीं करता और जोखिम स्तर, निर्णय या नोट नहीं बदल सकता।",
  languageLabel: "उत्तर की भाषा",
  patientLabel: "मरीज़ का केस (वैकल्पिक)",
  empty:
    "कोई भी सामान्य स्वास्थ्य प्रश्न पूछें, या मरीज़ चुनें ताकि उत्तर उसी रिकॉर्ड पर आधारित हों। आवाज़ से पूछने के लिए माइक दबाएँ, और उत्तर सुनने के लिए ‘सुनें’ दबाएँ।",
  thinking: "केस रिकॉर्ड पढ़ा जा रहा है…",
  placeholder: "स्वास्थ्य प्रश्न पूछें, या चुने गए मरीज़ के बारे में…",
  ask: "पूछें",
  listen: "सुनें",
  questionLabel: "प्रश्न",
  workerPrompts: [
    "छोटे घाव को कैसे साफ़ करें और पट्टी बाँधें?",
    "बुखार वाले बच्चे में खतरे के लक्षण क्या हैं?",
    "ओआरएस कैसे बनाएँ और कैसे दें?",
  ],
  doctorPrompts: [
    "निर्जलीकरण के वर्तमान प्रथम-पंक्ति प्रबंधन का सारांश दें।",
    "सीने में दर्द के रेड-फ्लैग लक्षण क्या हैं?",
    "नए मधुमेह रोगी के लिए मुख्य परामर्श बिंदु।",
  ],
};

const HINGLISH: AssistantCopy = {
  title: "AI sahayak",
  intro:
    "General health sawaal poochhein, ya kisi patient ko chunkar usi case ke hisaab se jawab paayein. Ye kabhi diagnosis nahi karta aur risk tier, decision ya note nahi badal sakta.",
  languageLabel: "Jawab ki bhasha",
  patientLabel: "Patient case (optional)",
  empty:
    "Koi bhi general health sawaal poochhein, ya patient chunein taaki jawab usi record par based ho. Awaaz se poochhne ke liye mic dabayein, aur jawab sunne ke liye ‘Sunein’ dabayein.",
  thinking: "Case record padha ja raha hai…",
  placeholder: "Health sawaal poochhein, ya chune gaye patient ke baare mein…",
  ask: "Poochhein",
  listen: "Sunein",
  questionLabel: "Sawaal",
  workerPrompts: [
    "Chhote ghaav ko kaise saaf karein aur patti baandhein?",
    "Bukhar wale bachche mein khatre ke lakshan kya hain?",
    "ORS kaise banayein aur kaise dein?",
  ],
  doctorPrompts: [
    "Dehydration ke current first-line management ka summary dein.",
    "Chest pain ke red-flag features kya hain?",
    "Naye diabetic patient ke liye mukhya counselling points.",
  ],
};

const BN: AssistantCopy = {
  title: "এআই সহকারী",
  intro:
    "সাধারণ স্বাস্থ্য প্রশ্ন করুন, অথবা একজন রোগী বেছে নিয়ে সেই কেস অনুযায়ী উত্তর নিন। এটি কখনও রোগ নির্ণয় করে না এবং ঝুঁকির স্তর, সিদ্ধান্ত বা নোট বদলাতে পারে না।",
  languageLabel: "উত্তরের ভাষা",
  patientLabel: "রোগীর কেস (ঐচ্ছিক)",
  empty:
    "যেকোনো সাধারণ স্বাস্থ্য প্রশ্ন করুন, অথবা রোগী নির্বাচন করুন যাতে উত্তর সেই রেকর্ড অনুযায়ী হয়। কণ্ঠে জিজ্ঞাসা করতে মাইক চাপুন, উত্তর শুনতে ‘শুনুন’ চাপুন।",
  thinking: "কেস রেকর্ড পড়া হচ্ছে…",
  placeholder: "স্বাস্থ্য প্রশ্ন করুন, বা নির্বাচিত রোগী সম্পর্কে…",
  ask: "জিজ্ঞাসা",
  listen: "শুনুন",
  questionLabel: "প্রশ্ন",
  workerPrompts: [
    "ছোট ক্ষত কীভাবে পরিষ্কার করে ব্যান্ডেজ করব?",
    "জ্বরে আক্রান্ত শিশুর বিপদচিহ্ন কী কী?",
    "ওআরএস কীভাবে তৈরি ও খাওয়াতে হয়?",
  ],
  doctorPrompts: [
    "ডিহাইড্রেশনের বর্তমান প্রথম-সারির ব্যবস্থাপনার সারসংক্ষেপ দিন।",
    "বুকে ব্যথার রেড-ফ্ল্যাগ বৈশিষ্ট্য কী?",
    "নতুন ডায়াবেটিস রোগীর জন্য প্রধান পরামর্শ বিষয়।",
  ],
};

const TA: AssistantCopy = {
  title: "AI உதவியாளர்",
  intro:
    "பொது சுகாதார கேள்விகளைக் கேளுங்கள், அல்லது ஒரு நோயாளியைத் தேர்ந்தெடுத்து அந்த வழக்கிற்கேற்ப பதில் பெறுங்கள். இது நோயறிதல் செய்யாது; ஆபத்து நிலை, முடிவு அல்லது குறிப்பை மாற்ற முடியாது.",
  languageLabel: "பதில் மொழி",
  patientLabel: "நோயாளி வழக்கு (விருப்பம்)",
  empty:
    "எந்த பொது சுகாதார கேள்வியையும் கேளுங்கள், அல்லது நோயாளியைத் தேர்ந்தெடுங்கள். குரலில் கேட்க மைக்கை அழுத்துங்கள், பதிலைக் கேட்க ‘கேளுங்கள்’ அழுத்துங்கள்.",
  thinking: "வழக்கு பதிவு படிக்கப்படுகிறது…",
  placeholder: "சுகாதார கேள்வி கேளுங்கள், அல்லது தேர்ந்தெடுத்த நோயாளி பற்றி…",
  ask: "கேள்",
  listen: "கேளுங்கள்",
  questionLabel: "கேள்வி",
  workerPrompts: [
    "சிறிய காயத்தை எப்படி சுத்தம் செய்து கட்டு போடுவது?",
    "காய்ச்சல் உள்ள குழந்தையின் ஆபத்து அறிகுறிகள் என்ன?",
    "ORS எப்படி தயாரித்து கொடுப்பது?",
  ],
  doctorPrompts: [
    "நீரிழப்புக்கான தற்போதைய முதல்-வரிசை சிகிச்சையை சுருக்கவும்.",
    "மார்பு வலியின் ரெட்-ஃபிளாக் அறிகுறிகள் என்ன?",
    "புதிய நீரிழிவு நோயாளிக்கான முக்கிய ஆலோசனை புள்ளிகள்.",
  ],
};

const TE: AssistantCopy = {
  title: "AI సహాయకుడు",
  intro:
    "సాధారణ ఆరోగ్య ప్రశ్నలు అడగండి, లేదా ఒక రోగిని ఎంచుకొని ఆ కేసుకు అనుగుణంగా సమాధానాలు పొందండి. ఇది ఎప్పుడూ నిర్ధారణ చేయదు, రిస్క్ స్థాయిని, నిర్ణయాన్ని లేదా నోట్‌ను మార్చలేదు.",
  languageLabel: "సమాధాన భాష",
  patientLabel: "రోగి కేసు (ఐచ్ఛికం)",
  empty:
    "ఏదైనా సాధారణ ఆరోగ్య ప్రశ్న అడగండి, లేదా రోగిని ఎంచుకోండి. వాయిస్‌తో అడగడానికి మైక్ నొక్కండి, సమాధానం వినడానికి ‘వినండి’ నొక్కండి.",
  thinking: "కేసు రికార్డు చదువుతోంది…",
  placeholder: "ఆరోగ్య ప్రశ్న అడగండి, లేదా ఎంచుకున్న రోగి గురించి…",
  ask: "అడగండి",
  listen: "వినండి",
  questionLabel: "ప్రశ్న",
  workerPrompts: [
    "చిన్న గాయాన్ని ఎలా శుభ్రం చేసి కట్టు కట్టాలి?",
    "జ్వరం ఉన్న పిల్లలలో ప్రమాద సంకేతాలు ఏమిటి?",
    "ORS ఎలా తయారు చేసి ఇవ్వాలి?",
  ],
  doctorPrompts: [
    "డీహైడ్రేషన్‌కు ప్రస్తుత ఫస్ట్-లైన్ చికిత్సను సంక్షిప్తం చేయండి.",
    "ఛాతీ నొప్పి రెడ్-ఫ్లాగ్ లక్షణాలు ఏమిటి?",
    "కొత్త మధుమేహ రోగికి ముఖ్య కౌన్సెలింగ్ అంశాలు.",
  ],
};

const MR: AssistantCopy = {
  title: "एआय सहाय्यक",
  intro:
    "सामान्य आरोग्य प्रश्न विचारा, किंवा रुग्ण निवडून त्या केसनुसार उत्तरे मिळवा. हे कधीही निदान करत नाही आणि जोखीम स्तर, निर्णय किंवा नोंद बदलू शकत नाही.",
  languageLabel: "उत्तराची भाषा",
  patientLabel: "रुग्ण केस (ऐच्छिक)",
  empty:
    "कोणताही सामान्य आरोग्य प्रश्न विचारा, किंवा रुग्ण निवडा जेणेकरून उत्तरे त्याच नोंदीवर आधारित असतील. आवाजाने विचारण्यासाठी माइक दाबा, उत्तर ऐकण्यासाठी ‘ऐका’ दाबा.",
  thinking: "केस नोंद वाचली जात आहे…",
  placeholder: "आरोग्य प्रश्न विचारा, किंवा निवडलेल्या रुग्णाबद्दल…",
  ask: "विचारा",
  listen: "ऐका",
  questionLabel: "प्रश्न",
  workerPrompts: [
    "लहान जखम कशी स्वच्छ करून बांधावी?",
    "ताप असलेल्या मुलात धोक्याची लक्षणे कोणती?",
    "ORS कसे तयार करून द्यावे?",
  ],
  doctorPrompts: [
    "निर्जलीकरणाच्या सध्याच्या प्रथम-श्रेणी उपचारांचा सारांश द्या.",
    "छातीत दुखण्याची रेड-फ्लॅग लक्षणे कोणती?",
    "नव्या मधुमेही रुग्णासाठी महत्त्वाचे समुपदेशन मुद्दे.",
  ],
};

const COPY: Record<string, AssistantCopy> = {
  English: EN,
  Hindi: HI,
  Hinglish: HINGLISH,
  Bangla: BN,
  Tamil: TA,
  Telugu: TE,
  Marathi: MR,
};

export function assistantCopy(language: string): AssistantCopy {
  return COPY[language] ?? EN;
}
