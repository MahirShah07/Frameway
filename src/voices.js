export const LANGUAGES = [
  { id: "en", name: "English", flag: "🇺🇸" },
  { id: "es", name: "Spanish", flag: "🇪🇸" },
  { id: "fr", name: "French", flag: "🇫🇷" },
  { id: "de", name: "German", flag: "🇩🇪" },
  { id: "it", name: "Italian", flag: "🇮🇹" },
  { id: "hi", name: "Hindi", flag: "🇮🇳" },
  { id: "ja", name: "Japanese", flag: "🇯🇵" },
  { id: "pt", name: "Portuguese", flag: "🇧🇷" },
  { id: "zh", name: "Chinese", flag: "🇨🇳" },
  { id: "ar", name: "Arabic", flag: "🇸🇦" },
];

export const VOICES = [
  // --- English (Edge Neural - Free Studio Quality) ---
  {
    id: "en-US-ChristopherNeural",
    name: "Christopher",
    lang: "en",
    gender: "Male",
    provider: "edge",
    desc: "Deep, authoritative classic documentary narrator",
    sampleText: "The sequence begins with an unexpected reading logged at dawn.",
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy",
    lang: "en",
    gender: "Male",
    provider: "edge",
    desc: "Neutral, calm investigative journalist",
    sampleText: "The initial records showed nothing unusual until late afternoon.",
  },
  {
    id: "en-US-JennyNeural",
    name: "Jenny",
    lang: "en",
    gender: "Female",
    provider: "edge",
    desc: "Clear, engaging modern documentary narrator",
    sampleText: "Each piece of evidence narrows the timeline down to minutes.",
  },
  {
    id: "en-US-AriaNeural",
    name: "Aria",
    lang: "en",
    gender: "Female",
    provider: "edge",
    desc: "Expressive, poised investigative tone",
    sampleText: "The question that remains is who made the final authorization.",
  },
  {
    id: "en-GB-RyanNeural",
    name: "Ryan",
    lang: "en",
    gender: "Male",
    provider: "edge",
    desc: "British BBC-style serious investigative delivery",
    sampleText: "At zero six hundred hours, the team arrived at the perimeter.",
  },
  {
    id: "en-GB-SoniaNeural",
    name: "Sonia",
    lang: "en",
    gender: "Female",
    provider: "edge",
    desc: "British, measured and composed storyteller",
    sampleText: "No one at the time recognized the true scale of the anomaly.",
  },

  // --- Spanish ---
  {
    id: "es-ES-AlvaroNeural",
    name: "Álvaro",
    lang: "es",
    gender: "Male",
    provider: "edge",
    desc: "Deep, cinematic Spanish documentary voice",
    sampleText: "La secuencia comienza con una lectura inesperada al amanecer.",
  },
  {
    id: "es-ES-ElviraNeural",
    name: "Elvira",
    lang: "es",
    gender: "Female",
    provider: "edge",
    desc: "Precise, formal documentary voice (Spain)",
    sampleText: "Los primeros informes no mostraron nada fuera de lo común.",
  },
  {
    id: "es-MX-JorgeNeural",
    name: "Jorge",
    lang: "es",
    gender: "Male",
    provider: "edge",
    desc: "Natural, measured Latin American narrator",
    sampleText: "Cada decisión redujo drásticamente las opciones disponibles.",
  },

  // --- French ---
  {
    id: "fr-FR-HenriNeural",
    name: "Henri",
    lang: "fr",
    gender: "Male",
    provider: "edge",
    desc: "Sophisticated, investigative French tone",
    sampleText: "La séquence commence par une anomalie enregistrée à l'aube.",
  },
  {
    id: "fr-FR-DeniseNeural",
    name: "Denise",
    lang: "fr",
    gender: "Female",
    provider: "edge",
    desc: "Calm, cultured and articulate French narrator",
    sampleText: "Les registres officiels révèlent la suite sans aucun commentaire.",
  },

  // --- German ---
  {
    id: "de-DE-KillianNeural",
    name: "Killian",
    lang: "de",
    gender: "Male",
    provider: "edge",
    desc: "Authoritative, deep German investigation voice",
    sampleText: "Die Aufzeichnungen zeigen genau, was als Nächstes geschah.",
  },
  {
    id: "de-DE-KatjaNeural",
    name: "Katja",
    lang: "de",
    gender: "Female",
    provider: "edge",
    desc: "Precise, journalistic delivery (Germany)",
    sampleText: "Niemand erkannte zu diesem Zeitpunkt die Tragweite des Vorfalls.",
  },

  // --- Italian ---
  {
    id: "it-IT-DiegoNeural",
    name: "Diego",
    lang: "it",
    gender: "Male",
    provider: "edge",
    desc: "Dramatic, measured Italian narrator",
    sampleText: "La sequenza inizia con un segnale inaspettato all'alba.",
  },
  {
    id: "it-IT-ElsaNeural",
    name: "Elsa",
    lang: "it",
    gender: "Female",
    provider: "edge",
    desc: "Warm, articulate Italian storyteller",
    sampleText: "I primi documenti non mostravano alcuna anomalia evidente.",
  },

  // --- Hindi ---
  {
    id: "hi-IN-MadhurNeural",
    name: "Madhur",
    lang: "hi",
    gender: "Male",
    provider: "edge",
    desc: "Deep, resonant Hindi documentary narrator",
    sampleText: "घटना की शुरुआत सुबह दर्ज किए गए एक अप्रत्याशित संकेत से हुई।",
  },
  {
    id: "hi-IN-SwaraNeural",
    name: "Swara",
    lang: "hi",
    gender: "Female",
    provider: "edge",
    desc: "Clear, melodious Hindi narration",
    sampleText: "उस समय किसी ने भी इस बदलाव के महत्व को नहीं समझा था।",
  },

  // --- Japanese ---
  {
    id: "ja-JP-KeitaNeural",
    name: "Keita",
    lang: "ja",
    gender: "Male",
    provider: "edge",
    desc: "Calm, dignified Japanese narrator",
    sampleText: "記録によれば、異常は夜明け直後に確認されていました。",
  },
  {
    id: "ja-JP-NanamiNeural",
    name: "Nanami",
    lang: "ja",
    gender: "Female",
    provider: "edge",
    desc: "Articulate, polite documentary tone (Japan)",
    sampleText: "当時の担当者は、その重大さにまだ気づいていませんでした。",
  },

  // --- Portuguese ---
  {
    id: "pt-BR-AntonioNeural",
    name: "Antônio",
    lang: "pt",
    gender: "Male",
    provider: "edge",
    desc: "Engaging, rhythmic documentary tone (Brazil)",
    sampleText: "A sequência começa com uma leitura inesperada ao amanhecer.",
  },
  {
    id: "pt-BR-FranciscaNeural",
    name: "Francisca",
    lang: "pt",
    gender: "Female",
    provider: "edge",
    desc: "Clear, composed Portuguese narration",
    sampleText: "Os primeiros registos não mostraram nada fora do comum.",
  },

  // --- Chinese ---
  {
    id: "zh-CN-YunxiNeural",
    name: "Yunxi",
    lang: "zh",
    gender: "Male",
    provider: "edge",
    desc: "Deep, solemn Chinese documentary narrator",
    sampleText: "事件始于清晨记录到的一个异常读数。",
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "Xiaoxiao",
    lang: "zh",
    gender: "Female",
    provider: "edge",
    desc: "Clear, articulate Mandarin narration",
    sampleText: "当时没有人意识到这一变化的重要性。",
  },

  // --- Arabic ---
  {
    id: "ar-SA-HamedNeural",
    name: "Hamed",
    lang: "ar",
    gender: "Male",
    provider: "edge",
    desc: "Authoritative broadcast narration (Arabic)",
    sampleText: "بدأت السلسلة بقراءة غير متوقعة تم تسجيلها عند الفجر.",
  },
  {
    id: "ar-SA-ZariyahNeural",
    name: "Zariyah",
    lang: "ar",
    gender: "Female",
    provider: "edge",
    desc: "Clear, poised Arabic documentary voice",
    sampleText: "لم تظهر السجلات الأولى أي شيء غير عادي في البداية.",
  },

  // --- ElevenLabs (Official API Tier) ---
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    lang: "en",
    gender: "Male",
    provider: "elevenlabs",
    desc: "Studio deep American voice (needs API key)",
    sampleText: "The sequence begins with an unexpected reading logged at dawn.",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    lang: "en",
    gender: "Male",
    provider: "elevenlabs",
    desc: "Dramatic storytelling voice (needs API key)",
    sampleText: "No one at the time recognized the true significance of the event.",
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    lang: "en",
    gender: "Female",
    provider: "elevenlabs",
    desc: "Calm, professional narrator (needs API key)",
    sampleText: "Each decision narrows down the timeline available to the team.",
  },

  // --- Kokoro (Local ONNX) ---
  {
    id: "bm_george",
    name: "George",
    lang: "en",
    gender: "Male",
    provider: "kokoro",
    desc: "Local WebAssembly ONNX British voice",
    sampleText: "The sequence begins with an unexpected reading logged at dawn.",
  },
  {
    id: "af_sarah",
    name: "Sarah",
    lang: "en",
    gender: "Female",
    provider: "kokoro",
    desc: "Local WebAssembly ONNX American voice",
    sampleText: "No one at the time recognized the significance of the anomaly.",
  },
];

export const DEFAULT_VOICE_ID = "en-US-ChristopherNeural";

export function getVoice(id) {
  return VOICES.find((v) => v.id === id) || VOICES[0];
}

export function getVoicesForLang(lang = "en", provider = "") {
  return VOICES.filter((v) => {
    if (provider === "elevenlabs") return v.provider === "elevenlabs";
    if (provider === "kokoro") return v.provider === "kokoro";
    const langMatch = v.lang === lang;
    const provMatch = !provider || v.provider === provider;
    return langMatch && provMatch;
  });
}
