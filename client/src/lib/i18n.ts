export type Lang = "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "ru" | "pt" | "cn";

export const LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  al: "SQ",
  gr: "ΕΛ",
  it: "IT",
  es: "ES",
  de: "DE",
  fr: "FR",
  ar: "AR",
  ru: "RU",
  pt: "PT",
  cn: "中文",
};

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  al: "Shqip",
  gr: "Ελληνικά",
  it: "Italiano",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  ar: "العربية",
  ru: "Русский",
  pt: "Português",
  cn: "中文 (简体)",
};

export interface Translations {
  appName: string;
  tagline: string;
  exploreMap: string;
  tourSites: string;
  myPassport: string;
  leaderboard: string;
  startAudioTour: string;
  pauseAudio: string;
  resumeAudio: string;
  visitedSites: string;
  totalPoints: string;
  rank: string;
  markVisited: string;
  alreadyVisited: string;
  difficulty: { easy: string; moderate: string; hard: string };
  categories: {
    archaeology: string;
    castle: string;
    beach: string;
    nature: string;
    "historic-town": string;
  };
  duration: string;
  points: string;
  region: string;
  funFact: string;
  audioTourTitle: string;
  noAudio: string;
  // Onboarding guide popup
  guideGreeting: string;
  guideSubtitle: string;
  guideSkip: string;
  guideNext: string;
  guideDone: string;
  // Animated Quick Guide (mascot walkthrough)
  guideAnimS0: string;
  guideAnimS1: string;
  guideAnimS2: string;
  guideAnimS3: string;
  guideAnimS4: string;
  guideAnimS5: string;
  guidePauseLabel: string;
  guidePlayLabel: string;
  filterAll: string;
  searchPlaceholder: string;
  passportTitle: string;
  passportSubtitle: string;
  stampsEarned: string;
  nextBadge: string;
  lbTitle: string;
  lbYou: string;
  lbEmpty: string;
  loading: string;
  congratulations: string;
  youEarned: string;
  close: string;
  xpProgress: string;
  minuteRead: string;
  backToMap: string;
  allRegions: string;
}

const EN: Translations = {
  appName: "AlbaniaAudioTours",
  tagline: "Discover Albania — One Story at a Time",
  exploreMap: "Explore Map",
  tourSites: "Tour Sites",
  myPassport: "My Journey",
  leaderboard: "Leaderboard",
  startAudioTour: "Start Audio Tour",
  pauseAudio: "Pause",
  resumeAudio: "Resume",
  visitedSites: "Sites Visited",
  totalPoints: "Total Points",
  rank: "Rank",
  markVisited: "Mark as Visited",
  alreadyVisited: "Visited ✓",
  difficulty: { easy: "Easy", moderate: "Moderate", hard: "Challenging" },
  categories: {
    archaeology: "Archaeology",
    castle: "Castle",
    beach: "Beach",
    nature: "Nature",
    "historic-town": "Historic Town",
  },
  duration: "Duration",
  points: "Points",
  region: "Region",
  funFact: "Did You Know?",
  audioTourTitle: "Audio Guide",
  noAudio: "Audio guide coming soon for this site.",
  guideGreeting: "Quick Guide",
  guideSubtitle: "Here's how to explore Albania with this app",
  guideSkip: "Skip",
  guideNext: "Next",
  guideDone: "Got it \u2713",
  guideAnimS0: "Hey! I'm Aeti \u2014 15 seconds and you'll know this app inside out.",
  guideAnimS1: "Lost? Tap Share Location \u2014 I'll show you what's around you right now.",
  guideAnimS2: "Only into beaches? Castles? Tap a pill. Boom \u2014 filtered.",
  guideAnimS3: "Want the full list? 43 destinations, one tap away.",
  guideAnimS4: "Tap a pin, hit Play \u2014 the story plays right there. Works offline too.",
  guideAnimS5: "That's it. Go find your first story!",
  guidePauseLabel: "Pause",
  guidePlayLabel: "Play",
  filterAll: "All",
  searchPlaceholder: "Search sites...",
  passportTitle: "Your Travel Passport",
  passportSubtitle: "Collect stamps by visiting Albania's treasures",
  stampsEarned: "Stamps Earned",
  nextBadge: "Next badge at",
  lbTitle: "Top Explorers",
  lbYou: "You",
  lbEmpty: "No explorers yet — be the first!",
  loading: "Loading...",
  congratulations: "Congratulations!",
  youEarned: "You earned",
  close: "Close",
  xpProgress: "Explorer Progress",
  minuteRead: "min visit",
  backToMap: "Back to Map",
  allRegions: "All Regions",
};

const AL: Translations = {
  appName: "AlbaniaAudioTours",
  tagline: "Zbulo Shqipërinë — Një Histori nga Ana",
  exploreMap: "Eksploro Hartën",
  tourSites: "Vendet e Turneut",
  myPassport: "Udhëtimi Im",
  leaderboard: "Klasifikimi",
  startAudioTour: "Fillo Udhërrëfyesin Audio",
  pauseAudio: "Pauzë",
  resumeAudio: "Vazhdo",
  visitedSites: "Vende të Vizituara",
  totalPoints: "Pikë Totale",
  rank: "Renditja",
  markVisited: "Shëno si Vizituar",
  alreadyVisited: "Vizituar ✓",
  difficulty: { easy: "Lehtë", moderate: "Mesatar", hard: "Sfidues" },
  categories: {
    archaeology: "Arkeologji",
    castle: "Kala",
    beach: "Plazh",
    nature: "Natyrë",
    "historic-town": "Qytet Historik",
  },
  duration: "Kohëzgjatja",
  points: "Pikë",
  region: "Rajoni",
  funFact: "A e Dinit?",
  audioTourTitle: "Udhërrëfyes Audio",
  noAudio: "Udhërrëfyesi audio po vjen së shpejti.",
  guideGreeting: "Udhëzues i Shpejtë",
  guideSubtitle: "Ja si të eksplorosh Shqipërinë me këtë aplikacion",
  guideSkip: "Kalo",
  guideNext: "Tjetër",
  guideDone: "Kuptova \u2713",
  guideAnimS0: "Hej! Jam Aeti \u2014 n\u00eb 15 sekonda do ta njohsh k\u00ebt\u00eb aplikacion si pallm\u00ebn e dor\u00ebs.",
  guideAnimS1: "T\u00eb humbur? Prek \u201cShare Location\u201d \u2014 do t\u00eb tregoj \u00e7far\u00eb ke afr\u00eb tani.",
  guideAnimS2: "Vet\u00ebm plazhe? Kshtjella? Prek nj\u00eb pilul\u00eb. Bam \u2014 u filtrua.",
  guideAnimS3: "Do list\u00ebn e plot\u00eb? 43 destinacione, nj\u00eb prekje larg.",
  guideAnimS4: "Prek nj\u00eb pik\u00eb, shtyp Play \u2014 historia luhet aty. Punon dhe offline.",
  guideAnimS5: "Kaq ishte. Shko gjej histori\u00ebn tënde t\u00eb par\u00eb!",
  guidePauseLabel: "Pauz\u00eb",
  guidePlayLabel: "Luaj",
  filterAll: "Të Gjitha",
  searchPlaceholder: "Kërko vende...",
  passportTitle: "Pasaporta Juaj e Udhëtimit",
  passportSubtitle: "Mblidhni vula duke vizituar thesaret e Shqipërisë",
  stampsEarned: "Vula të Fituara",
  nextBadge: "Insinja tjetër në",
  lbTitle: "Eksploruesit Kryesorë",
  lbYou: "Ju",
  lbEmpty: "Ende asnjë eksplorues — jini të parët!",
  loading: "Duke ngarkuar...",
  congratulations: "Urime!",
  youEarned: "Fituat",
  close: "Mbylle",
  xpProgress: "Progresi i Eksplorimit",
  minuteRead: "min vizitë",
  backToMap: "Kthehu te Harta",
  allRegions: "Të Gjithë Rajonet",
};

const GR: Translations = {
  appName: "AlbaniaAudioTours",
  tagline: "Ανακαλύψτε την Αλβανία — Μια Ιστορία τη Φορά",
  exploreMap: "Εξερευνήστε Χάρτη",
  tourSites: "Αξιοθέατα",
  myPassport: "Το Ταξίδι μου",
  leaderboard: "Κατάταξη",
  startAudioTour: "Έναρξη Ηχητικής Ξενάγησης",
  pauseAudio: "Παύση",
  resumeAudio: "Συνέχεια",
  visitedSites: "Τοποθεσίες που Επισκέφθηκα",
  totalPoints: "Συνολικοί Πόντοι",
  rank: "Κατάταξη",
  markVisited: "Σήμανση ως Επισκέφθηκα",
  alreadyVisited: "Επισκέφθηκα ✓",
  difficulty: { easy: "Εύκολο", moderate: "Μέτριο", hard: "Απαιτητικό" },
  categories: {
    archaeology: "Αρχαιολογία",
    castle: "Κάστρο",
    beach: "Παραλία",
    nature: "Φύση",
    "historic-town": "Ιστορική Πόλη",
  },
  duration: "Διάρκεια",
  points: "Πόντοι",
  region: "Περιοχή",
  funFact: "Γνωρίζατε ότι;",
  audioTourTitle: "Ηχητικός Οδηγός",
  noAudio: "Ο ηχητικός οδηγός έρχεται σύντομα.",
  guideGreeting: "Γρήγορος Οδηγός",
  guideSubtitle: "Πώς να εξερευνήσετε την Αλβανία με αυτή την εφαρμογή",
  guideSkip: "Παράλειψη",
  guideNext: "Επόμενο",
  guideDone: "Εντάξει \u2713",
  guideAnimS0: "\u0393\u03b5\u03b9\u03b1! \u0395\u03af\u03bc\u03b1\u03b9 \u03bf Aeti \u2014 \u03c3\u03b5 15 \u03b4\u03b5\u03c5\u03c4\u03b5\u03c1\u03cc\u03bb\u03b5\u03c1\u03b1 \u03b8\u03b1 \u03be\u03ad\u03c1\u03b5\u03b9\u03c2 \u03c4\u03b7\u03bd \u03b5\u03c6\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03b1\u03c0\u2019 \u03ad\u03be\u03c9.",
  guideAnimS1: "\u0388\u03c7\u03b1\u03c3\u03b5\u03c2; \u03a0\u03ac\u03c4\u03b7\u03c3\u03b5 \u201cShare Location\u201d \u2014 \u03b8\u03b1 \u03c3\u03bf\u03c5 \u03b4\u03b5\u03af\u03be\u03c9 \u03c4\u03b9 \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u03ba\u03bf\u03bd\u03c4\u03ac \u03c3\u03bf\u03c5 \u03c4\u03ce\u03c1\u03b1.",
  guideAnimS2: "\u039c\u03cc\u03bd\u03bf \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b5\u03c2; \u039a\u03ac\u03c3\u03c4\u03c1\u03b1; \u03a0\u03ac\u03c4\u03b7\u03c3\u03b5 \u03bc\u03b9\u03b1 \u03b5\u03c4\u03b9\u03ba\u03ad\u03c4\u03b1. \u039c\u03c0\u03b1\u03bc \u2014 \u03c6\u03b9\u03bb\u03c4\u03c1\u03b1\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5.",
  guideAnimS3: "\u0398\u03ad\u03bb\u03b5\u03b9\u03c2 \u03cc\u03bb\u03b7 \u03c4\u03b7 \u03bb\u03af\u03c3\u03c4\u03b1; 43 \u03c0\u03c1\u03bf\u03bf\u03c1\u03b9\u03c3\u03bc\u03bf\u03af, \u03ad\u03bd\u03b1 \u03ac\u03b3\u03b3\u03b9\u03b3\u03bc\u03b1 \u03bc\u03b1\u03ba\u03c1\u03b9\u03ac.",
  guideAnimS4: "\u03a0\u03ac\u03c4\u03b7\u03c3\u03b5 \u03bc\u03b9\u03b1 \u03ba\u03b1\u03c1\u03c6\u03af\u03c4\u03c3\u03b1, \u03c0\u03ac\u03c4\u03b7\u03c3\u03b5 Play \u2014 \u03b7 \u03b9\u03c3\u03c4\u03bf\u03c1\u03af\u03b1 \u03c0\u03b1\u03af\u03b6\u03b5\u03b9 \u03b1\u03bc\u03ad\u03c3\u03c9\u03c2. \u0394\u03bf\u03c5\u03bb\u03b5\u03cd\u03b5\u03b9 \u03ba\u03b1\u03b9 offline.",
  guideAnimS5: "\u0391\u03c5\u03c4\u03cc \u03ae\u03c4\u03b1\u03bd. \u03a0\u03ae\u03b3\u03b1\u03b9\u03bd\u03b5 \u03b2\u03c1\u03b5\u03c2 \u03c4\u03b7\u03bd \u03c0\u03c1\u03ce\u03c4\u03b7 \u03c3\u03bf\u03c5 \u03b9\u03c3\u03c4\u03bf\u03c1\u03af\u03b1!",
  guidePauseLabel: "\u03a0\u03b1\u03cd\u03c3\u03b7",
  guidePlayLabel: "\u0391\u03bd\u03b1\u03c0\u03b1\u03c1\u03b1\u03b3\u03c9\u03b3\u03ae",
  filterAll: "Όλα",
  searchPlaceholder: "Αναζήτηση τοποθεσιών...",
  passportTitle: "Το Ταξιδιωτικό σας Διαβατήριο",
  passportSubtitle: "Μαζέψτε σφραγίδες επισκεπτόμενοι τους θησαυρούς της Αλβανίας",
  stampsEarned: "Σφραγίδες που Κερδήθηκαν",
  nextBadge: "Επόμενο σήμα στους",
  lbTitle: "Κορυφαίοι Εξερευνητές",
  lbYou: "Εσείς",
  lbEmpty: "Δεν υπάρχουν εξερευνητές ακόμα — γίνετε οι πρώτοι!",
  loading: "Φόρτωση...",
  congratulations: "Συγχαρητήρια!",
  youEarned: "Κερδίσατε",
  close: "Κλείσιμο",
  xpProgress: "Πρόοδος Εξερευνητή",
  minuteRead: "λεπτά επίσκεψη",
  backToMap: "Πίσω στο Χάρτη",
  allRegions: "Όλες οι Περιοχές",
};

// New languages fall back to English UI strings (content is translated separately)
const PT: Translations = {
  appName: "AlbaniaAudioTours",
  tagline: "Descubra a Albânia — Uma História de Cada Vez",
  exploreMap: "Explorar Mapa",
  tourSites: "Locais do Tour",
  myPassport: "Minha Jornada",
  leaderboard: "Classificação",
  startAudioTour: "Start Audio Tour",
  pauseAudio: "Pausar",
  resumeAudio: "Retomar",
  visitedSites: "Sites Visited",
  totalPoints: "Total Points",
  rank: "Rank",
  markVisited: "Marcar como Visitado",
  alreadyVisited: "Visited ✓",
  difficulty: { easy: "Easy", moderate: "Moderate", hard: "Challenging" },
  categories: {
    archaeology: "Archaeology",
    castle: "Castle",
    beach: "Beach",
    nature: "Nature",
    "historic-town": "Historic Town",
  },
  duration: "Duration",
  points: "Points",
  region: "Region",
  funFact: "Você Sabia?",
  audioTourTitle: "Guia de Áudio",
  noAudio: "Guia de áudio em breve.",
  guideGreeting: "Guia Rápido",
  guideSubtitle: "Como explorar a Albânia com esta aplicação",
  guideSkip: "Pular",
  guideNext: "Próximo",
  guideDone: "Entendi \u2713",
  guideAnimS0: "Ol\u00e1! Sou o Aeti \u2014 em 15 segundos vais conhecer esta app por dentro.",
  guideAnimS1: "Perdido? Toca em \u201cShare Location\u201d \u2014 mostro-te o que h\u00e1 perto de ti agora mesmo.",
  guideAnimS2: "S\u00f3 praias? Castelos? Toca num filtro. Pronto \u2014 filtrado.",
  guideAnimS3: "Queres a lista completa? 43 destinos, a um toque de dist\u00e2ncia.",
  guideAnimS4: "Toca num pino, aperta Play \u2014 a hist\u00f3ria toca ali mesmo. Funciona offline tamb\u00e9m.",
  guideAnimS5: "\u00c9 isso. Vai descobrir a tua primeira hist\u00f3ria!",
  guidePauseLabel: "Pausa",
  guidePlayLabel: "Reproduzir",
  filterAll: "All",
  searchPlaceholder: "Search sites...",
  passportTitle: "Your Travel Passport",
  passportSubtitle: "Collect stamps by visiting Albania's treasures",
  stampsEarned: "Stamps Earned",
  nextBadge: "Next badge at",
  lbTitle: "Top Explorers",
  lbYou: "You",
  lbEmpty: "No explorers yet — be the first!",
  loading: "Loading...",
  congratulations: "Congratulations!",
  youEarned: "You earned",
  close: "Fechar",
  xpProgress: "Explorer Progress",
  minuteRead: "min visit",
  backToMap: "Voltar ao Mapa",
  allRegions: "All Regions",
};


const CN: Translations = {
  appName: "AlbaniaAudioTours",
  tagline: "探索阿尔巴尼亚——每次一个故事",
  exploreMap: "探索地图",
  tourSites: "景点",
  myPassport: "我的旅程",
  leaderboard: "排行榜",
  startAudioTour: "Start Audio Tour",
  pauseAudio: "暂停",
  resumeAudio: "继续",
  visitedSites: "Sites Visited",
  totalPoints: "Total Points",
  rank: "Rank",
  markVisited: "标记为已访问",
  alreadyVisited: "Visited ✓",
  difficulty: { easy: "Easy", moderate: "Moderate", hard: "Challenging" },
  categories: {
    archaeology: "Archaeology",
    castle: "Castle",
    beach: "Beach",
    nature: "Nature",
    "historic-town": "Historic Town",
  },
  duration: "Duration",
  points: "Points",
  region: "Region",
  funFact: "你知道吗？",
  audioTourTitle: "语音导览",
  noAudio: "语音导览即将推出。",
  guideGreeting: "快速指南",
  guideSubtitle: "如何使用本应用探索阿尔巴尼亚",
  guideSkip: "跳过",
  guideNext: "下一步",
  guideDone: "明白了 \u2713",
  guideAnimS0: "\u55e8\uff01\u6211\u662fAeti\u2014\u201415\u79d2\u5e26\u4f60\u6478\u900f\u8fd9\u4e2a\u5e94\u7528\u3002",
  guideAnimS1: "\u8ff7\u8def\u4e86\uff1f\u70b9\u4e00\u4e0b\u201cShare Location\u201d\u2014\u2014\u6211\u9a6c\u4e0a\u544a\u8bc9\u4f60\u9644\u8fd1\u6709\u4ec0\u4e48\u3002",
  guideAnimS2: "\u53ea\u60f3\u770b\u6d77\u6ee9\uff1f\u57ce\u5821\uff1f\u70b9\u4e00\u4e2a\u6807\u7b7e\uff0c\u649f\u2014\u2014\u7b5b\u9009\u5b8c\u6210\u3002",
  guideAnimS3: "\u60f3\u770b\u5b8c\u6574\u5217\u8868\uff1f43\u4e2a\u76ee\u7684\u5730\uff0c\u4e00\u952e\u76f4\u8fbe\u3002",
  guideAnimS4: "\u70b9\u4e00\u4e2a\u56fe\u9489\uff0c\u6309\u4e0b\u64ad\u653e\u2014\u2014\u6545\u4e8b\u9a6c\u4e0a\u8bb2\u7ed9\u4f60\u542c\u3002\u79bb\u7ebf\u4e5f\u80fd\u7528\u3002",
  guideAnimS5: "\u5c31\u8fd9\u4e48\u7b80\u5355\u3002\u53bb\u627e\u4f60\u7684\u7b2c\u4e00\u4e2a\u6545\u4e8b\u5427\uff01",
  guidePauseLabel: "\u6682\u505c",
  guidePlayLabel: "\u64ad\u653e",
  filterAll: "All",
  searchPlaceholder: "Search sites...",
  passportTitle: "Your Travel Passport",
  passportSubtitle: "Collect stamps by visiting Albania's treasures",
  stampsEarned: "Stamps Earned",
  nextBadge: "Next badge at",
  lbTitle: "Top Explorers",
  lbYou: "You",
  lbEmpty: "No explorers yet — be the first!",
  loading: "Loading...",
  congratulations: "Congratulations!",
  youEarned: "You earned",
  close: "关闭",
  xpProgress: "Explorer Progress",
  minuteRead: "min visit",
  backToMap: "返回地图",
  allRegions: "All Regions",
};


export const TRANSLATIONS: Record<Lang, Translations> = {
  en: EN, al: AL, gr: GR,
  it: EN, es: EN, de: EN, fr: EN, ar: EN, ru: EN,
  pt: PT, cn: CN,
};

/**
 * Resolve a localised field on any object using the current language.
 * e.g. getLangText(site, "name", "it") → site.nameIt || site.nameEn || ""
 * The capitalisation follows the database column convention: nameEn, descAl, funFactGr …
 */
export function getLangText(obj: any, field: string, lang: Lang): string {
  if (!obj) return "";
  const cap = lang.charAt(0).toUpperCase() + lang.slice(1); // "en" → "En"
  return obj[`${field}${cap}`] || obj[`${field}En`] || "";
}

/**
 * Resolve the correct audioUrl for the given language with EN fallback.
 */
export function getLangAudioUrl(obj: any, lang: Lang): string | null {
  const cap = lang.charAt(0).toUpperCase() + lang.slice(1);
  return obj[`audioUrl${cap}`] || obj[`audioUrlEn`] || null;
}
