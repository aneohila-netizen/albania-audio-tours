import fs from "fs";
import path from "path";
import type { TourSite, UserProgress, InsertUserProgress, InsertTourSite } from "@shared/schema";

// ─── Default site data (declared first so loadSites can reference it) ────────
const DEFAULT_SITES: TourSite[] = [
  {
    id: 1, slug: "butrint", nameEn: "Butrint National Park", nameAl: "Parku Kombëtar i Butrintit", nameGr: "Εθνικό Πάρκο Βουθρωτού",
    descEn: "A UNESCO World Heritage Site, Butrint is one of Albania's most important archaeological sites. Founded as a Greek colony, it later became a thriving Roman city. Explore the amphitheatre, baptistery with stunning 6th-century mosaics, and the Venetian Tower overlooking the lagoon.",
    descAl: "Një Vend i Trashëgimisë Botërore UNESCO, Butrinti është një nga vendet më të rëndësishme arkeologjike të Shqipërisë. I themeluar si kolonizim grek, u bë më vonë një qytet romak i lulëzuar.",
    descGr: "Τόπος Παγκόσμιας Κληρονομιάς UNESCO, το Βουθρωτό είναι ένα από τα σημαντικότερα αρχαιολογικά τοπία της Αλβανίας.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 39.7447, lng: 20.0175,
    region: "Sarandë", category: "archaeology", difficulty: "easy", points: 150,
    imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800", visitDuration: 120,
    funFactEn: "The Butrint amphitheatre could seat over 2,500 spectators in its heyday!",
    funFactAl: "Amfiteatri i Butrintit mund të strehonte mbi 2,500 spektatorë!",
    funFactGr: "Το αμφιθέατρο του Βουθρωτού χωρούσε πάνω από 2.500 θεατές!",
  },
  {
    id: 2, slug: "gjirokaster", nameEn: "Gjirokastër Castle", nameAl: "Kalaja e Gjirokastrës", nameGr: "Κάστρο Αργυροκάστρου",
    descEn: "Perched high above the 'City of Stone', Gjirokastër Castle is a massive Ottoman-era fortress that dominates the skyline. Home to a fascinating military museum, the castle holds captured US spy planes and ancient weaponry.",
    descAl: "E ngritur lart mbi 'Qytetin e Gurit', Kalaja e Gjirokastrës është një fortesë e madhe osmane që dominon horizontin.",
    descGr: "Στην κορυφή της 'Πόλης από Πέτρα', το Κάστρο του Αργυροκάστρου είναι ένα τεράστιο οθωμανικό φρούριο.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 40.0757, lng: 20.1394,
    region: "Gjirokastër", category: "castle", difficulty: "moderate", points: 130,
    imageUrl: "https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=800", visitDuration: 90,
    funFactEn: "The castle has been continuously used for over 2,500 years — from the Illyrians to the Communists!",
    funFactAl: "Kalaja është përdorur vazhdimisht për mbi 2,500 vjet!",
    funFactGr: "Το κάστρο χρησιμοποιείται αδιάλειπτα για πάνω από 2.500 χρόνια!",
  },
  {
    id: 3, slug: "apollonia", nameEn: "Apollonia Archaeological Park", nameAl: "Parku Arkeologjik i Apolonisë", nameGr: "Αρχαιολογικό Πάρκο Απολλωνίας",
    descEn: "Founded in 588 BC by Greek colonists, Apollonia was once one of the most important cities in the ancient world. Julius Caesar himself studied philosophy here.",
    descAl: "E themeluar në 588 para Krishtit nga kolonistët grekë, Apolonia ishte dikur një nga qytetet më të rëndësishme në botën antike.",
    descGr: "Ιδρύθηκε το 588 π.Χ. από Έλληνες αποικιστές, η Απολλωνία ήταν κάποτε μια από τις σημαντικότερες πόλεις του αρχαίου κόσμου.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 40.7167, lng: 19.4667,
    region: "Fier", category: "archaeology", difficulty: "easy", points: 140,
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800", visitDuration: 90,
    funFactEn: "The ancient city had a population of over 60,000 people at its peak!",
    funFactAl: "Qyteti antik kishte një popullsi prej mbi 60,000 njerëzish!",
    funFactGr: "Η αρχαία πόλη είχε πληθυσμό πάνω από 60.000 κατοίκους!",
  },
  {
    id: 4, slug: "ksamil", nameEn: "Ksamil Beaches", nameAl: "Plazhet e Ksamilit", nameGr: "Παραλίες Κσαμίλ",
    descEn: "Often called the 'Albanian Maldives', Ksamil is a paradise of crystal-clear turquoise waters, white sand beaches, and three small islands you can swim to.",
    descAl: "Shpesh quajtur 'Maldivat Shqiptare', Ksamili është një parajsë me ujëra të tejdukshëm blu dhe tre ishuj të vegjël.",
    descGr: "Αποκαλούμενο συχνά τα 'Αλβανικά Μαλδίβες', το Κσαμίλ είναι παράδεισος με κρυστάλλινα τιρκουάζ νερά.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 39.7723, lng: 20.0025,
    region: "Sarandë", category: "beach", difficulty: "easy", points: 80,
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800", visitDuration: 180,
    funFactEn: "Ksamil's waters are so clear you can see the seabed from 10 meters above!",
    funFactAl: "Ujërat e Ksamilit janë aq të tejdukshëm sa mund të shihni fundin e detit nga 10 metra lart!",
    funFactGr: "Τα νερά του Κσαμίλ είναι τόσο διαυγή που βλέπεις τον πυθμένα από 10 μέτρα ύψος!",
  },
  {
    id: 5, slug: "berat", nameEn: "Berat — City of a Thousand Windows", nameAl: "Berati — Qyteti i Një Mijë Dritareve", nameGr: "Μπεράτι — Πόλη με Χίλια Παράθυρα",
    descEn: "Berat is a UNESCO-listed 'city of a thousand windows'. Explore the Kalaja, the Mangalem and Gorica quarters, and the remarkable Onufri Museum of Byzantine icons.",
    descAl: "Berati është 'qyteti i një mijë dritareve' i listuar nga UNESCO, me rreshtat e dritareve të mëdha në shtëpitë e bardha osmane.",
    descGr: "Το Μπεράτι είναι η UNESCO-καταγεγραμμένη 'πόλη με χίλια παράθυρα'.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 40.7058, lng: 19.9522,
    region: "Berat", category: "historic-town", difficulty: "moderate", points: 120,
    imageUrl: "https://images.unsplash.com/photo-1555217851-6141535bd771?w=800", visitDuration: 150,
    funFactEn: "Berat has been continuously inhabited for over 2,400 years!",
    funFactAl: "Berati ka qenë i banuar vazhdimisht për mbi 2,400 vjet!",
    funFactGr: "Το Μπεράτι κατοικείται αδιάλειπτα για πάνω από 2.400 χρόνια!",
  },
  {
    id: 6, slug: "valbona", nameEn: "Valbona Valley", nameAl: "Lugina e Valbonës", nameGr: "Κοιλάδα Βαλμπόνα",
    descEn: "The Valbona Valley National Park in the Albanian Alps is one of Europe's last true wilderness areas. Towering peaks, glacial rivers, and the legendary Valbona-Theth trek.",
    descAl: "Parku Kombëtar i Luginës së Valbonës në Alpet Shqiptare është një nga zonat e fundit të egërsisë së vërtetë të Europës.",
    descGr: "Το Εθνικό Πάρκο Κοιλάδας Βαλμπόνα στις Αλβανικές Άλπεις είναι μια από τις τελευταίες άγριες περιοχές της Ευρώπης.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 42.4667, lng: 19.8833,
    region: "Shkodër", category: "nature", difficulty: "hard", points: 200,
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800", visitDuration: 480,
    funFactEn: "The Valbona-Theth trail is part of the famous 'Peaks of the Balkans' long-distance trek!",
    funFactAl: "Shtegtimi Valbonë-Theth është pjesë e shtegtimit të famshëm 'Majat e Ballkanit'!",
    funFactGr: "Το μονοπάτι Βαλμπόνα-Θεθ είναι μέρος του 'Κορυφές των Βαλκανίων'!",
  },
  {
    id: 7, slug: "rozafa", nameEn: "Rozafa Castle", nameAl: "Kalaja e Rozafës", nameGr: "Κάστρο Ρόζαφα",
    descEn: "Perched on a rocky hilltop near Shkodër, Rozafa Castle carries one of Albania's most poignant legends and offers panoramic views across Lake Shkodër to Montenegro.",
    descAl: "E vendosur në krye të një kodre shkëmbore pranë Shkodrës, Kalaja e Rozafës bart një nga legjendat më prekëse të Shqipërisë.",
    descGr: "Ακουμπισμένο σε βραχώδη λόφο κοντά στο Σκόδρα, το Κάστρο Ρόζαφα φέρει έναν από τους πιο συγκινητικούς θρύλους.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 42.0533, lng: 19.4828,
    region: "Shkodër", category: "castle", difficulty: "moderate", points: 110,
    imageUrl: "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800", visitDuration: 90,
    funFactEn: "Legend says a woman was built into the castle walls to appease the spirits!",
    funFactAl: "Legjenda thotë se një grua u gdhend në muret e kalasë!",
    funFactGr: "Η παράδοση λέει ότι μια γυναίκα χτίστηκε στα τείχη του κάστρου!",
  },
  {
    id: 8, slug: "theth", nameEn: "Theth Village", nameAl: "Fshati i Thetit", nameGr: "Χωριό Θεθ",
    descEn: "Hidden in a remote valley of the Accursed Mountains, Theth is a traditional Albanian highland village with the famous Kulla lock-in tower and the Blue Eye waterfall.",
    descAl: "E fshehur në një luginë të largët të Bjeshkëve të Namuna, Thethi është një fshat tradicional malësor shqiptar.",
    descGr: "Κρυμμένο σε μια απομακρυσμένη κοιλάδα των Βεραχτών Βουνών, το Θεθ είναι ένα παραδοσιακό αλβανικό ορεινό χωριό.",
    audioUrlEn: null, audioUrlAl: null, audioUrlGr: null, lat: 42.3833, lng: 19.7833,
    region: "Shkodër", category: "nature", difficulty: "hard", points: 180,
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800", visitDuration: 360,
    funFactEn: "Theth was cut off from the world for about 6 months every year until the road was built in the 1990s!",
    funFactAl: "Thethi ishte i izoluar nga bota e jashtme për rreth 6 muaj çdo vit deri në vitet '90!",
    funFactGr: "Το Θεθ ήταν αποκομμένο από τον έξω κόσμο για περίπου 6 μήνες κάθε χρόνο μέχρι τη δεκαετία του 1990!",
  },
];

// ─── Persist sites to a JSON file so edits survive restarts ───────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const SITES_FILE = path.join(DATA_DIR, "sites.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSites(): TourSite[] {
  ensureDataDir();
  if (fs.existsSync(SITES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SITES_FILE, "utf8"));
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_SITES;
}

function saveSites(sites: TourSite[]) {
  ensureDataDir();
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2));
}

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  getAllSites(): Promise<TourSite[]>;
  getSiteBySlug(slug: string): Promise<TourSite | undefined>;
  getSiteById(id: number): Promise<TourSite | undefined>;
  createSite(data: InsertTourSite): Promise<TourSite>;
  updateSite(id: number, data: Partial<InsertTourSite>): Promise<TourSite | undefined>;
  deleteSite(id: number): Promise<boolean>;
  getProgress(sessionId: string): Promise<UserProgress[]>;
  addProgress(data: InsertUserProgress): Promise<UserProgress>;
  getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]>;
}

const progressMap = new Map<string, UserProgress[]>();

export class MemStorage implements IStorage {
  private sites: TourSite[];
  private nextId: number;

  constructor() {
    this.sites = loadSites();
    this.nextId = this.sites.length > 0 ? Math.max(...this.sites.map(s => s.id)) + 1 : 1;
  }

  async getAllSites(): Promise<TourSite[]> {
    return [...this.sites];
  }

  async getSiteBySlug(slug: string): Promise<TourSite | undefined> {
    return this.sites.find(s => s.slug === slug);
  }

  async getSiteById(id: number): Promise<TourSite | undefined> {
    return this.sites.find(s => s.id === id);
  }

  async createSite(data: InsertTourSite): Promise<TourSite> {
    const site: TourSite = { id: this.nextId++, ...data } as TourSite;
    this.sites.push(site);
    saveSites(this.sites);
    return site;
  }

  async updateSite(id: number, data: Partial<InsertTourSite>): Promise<TourSite | undefined> {
    const idx = this.sites.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.sites[idx] = { ...this.sites[idx], ...data };
    saveSites(this.sites);
    return this.sites[idx];
  }

  async deleteSite(id: number): Promise<boolean> {
    const before = this.sites.length;
    this.sites = this.sites.filter(s => s.id !== id);
    if (this.sites.length < before) {
      saveSites(this.sites);
      return true;
    }
    return false;
  }

  async getProgress(sessionId: string): Promise<UserProgress[]> {
    return progressMap.get(sessionId) || [];
  }

  async addProgress(data: InsertUserProgress): Promise<UserProgress> {
    const record: UserProgress = { id: Date.now(), ...data };
    const existing = progressMap.get(data.sessionId) || [];
    progressMap.set(data.sessionId, [...existing, record]);
    return record;
  }

  async getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]> {
    const results: { sessionId: string; totalPoints: number; visitCount: number }[] = [];
    for (const [sessionId, records] of progressMap.entries()) {
      const totalPoints = records.reduce((sum, r) => sum + r.pointsEarned, 0);
      results.push({ sessionId, totalPoints, visitCount: records.length });
    }
    return results.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);
  }
}

export const storage = new MemStorage();
