export type Lang = "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl";

export const LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  al: "SQ",
  gr: "ΕΛ",
  it: "IT",
  es: "ES",
  de: "DE",
  fr: "FR",
  ar: "AR",
  sl: "SL",
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
  sl: "Slovenščina",
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
  myPassport: "My Passport",
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
  myPassport: "Pasaporta Ime",
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
  myPassport: "Διαβατήριό μου",
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
export const TRANSLATIONS: Record<Lang, Translations> = {
  en: EN, al: AL, gr: GR,
  it: EN, es: EN, de: EN, fr: EN, ar: EN, sl: EN,
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
