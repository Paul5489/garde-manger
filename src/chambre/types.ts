// Chambre de fermentation : format des données fournies par Paul (src/chambre/contenu/, lecture seule)
// et des données personnelles (lots, stock), gardées dans le téléphone.

export type IdMode = 'koji' | 'sechage' | 'biltong' | 'froid' | 'cave' | 'tempere' | 'pause';
export type Prise = 'itc_chauffage' | 'itc_froid' | 'ihc_work1' | 'ihc_work2' | 'prise_murale';
export const PRISES: Prise[] = ['itc_chauffage', 'itc_froid', 'ihc_work1', 'ihc_work2', 'prise_murale'];

export const CODES_ITC = ['TS', 'HD', 'CD', 'AH', 'AL', 'PT', 'CA', 'CF'] as const;
export const CODES_IHC = ['HS', 'HD', 'DD', 'AH', 'AL', 'PT', 'CA'] as const;
export type CodeItc = (typeof CODES_ITC)[number];
export type CodeIhc = (typeof CODES_IHC)[number];

export type ReglageItc = Record<Exclude<CodeItc, 'CF'>, number> & { CF: 'C' | 'F' };
export type PhaseIhc = Record<CodeIhc, number> & { nom: string; note?: string };

export interface Mode {
  id: IdMode;
  nom: string;
  couleur: string;
  cible: string;
  itc: ReglageItc | null;
  seuils: string;
  ihc_phases: PhaseIhc[];
  branchements: Record<Prise, string>;
  thermostat_frigo: string;
  ventilateur: { vitesse: 'lente' | 'moyenne' | 'rapide' | 'arrêt'; orientation: string };
  deshumidificateur?: string;
  bac_de_sel?: string;
  reservoir: { tous_les_j: number | null; texte: string };
  sonde_itc?: string;
  pourquoi: string[];
  alarmes: Partial<Record<'temperature_haute' | 'temperature_basse' | 'humidite_haute' | 'humidite_basse', string>>;
  energie: { estimation_kwh_jour: string; ce_qui_consomme: string; leviers: string[] };
  passagers: string[];
  notes: string[];
}

export interface Appareil {
  id: string;
  nom: string;
  role: string;
  caracteristiques: string;
  a_savoir: string[];
}

export interface RegleExpliquee {
  regle: string;
  pourquoi: string;
}

export interface EntreeGlossaire {
  code: string;
  nom: string;
  explication: string;
}

export type Nettoyage = 'leger' | 'moyen' | 'grand';

export interface Transition {
  de: IdMode;
  vers: IdMode;
  nettoyage: Nettoyage | null;
  note: string;
}

export interface ContenuModes {
  version: string;
  role_de_l_appli: string;
  installation: {
    materiel: Appareil[];
    humidificateur: string;
    prises: { prise: string; appareil: string }[];
    sondes: string[];
    cables: string;
    calibrage: string[];
    notes: string[];
  };
  mise_en_service: { titre: string; texte: string; si_echec: string }[];
  menager_le_materiel: RegleExpliquee[];
  economiser_energie: { budget: string; regles: RegleExpliquee[] };
  guide_itc: Record<string, string>;
  guide_ihc: Record<string, string>;
  glossaire: { itc: EntreeGlossaire[]; ihc: EntreeGlossaire[] };
  changement_de_mode: string[];
  verification_hebdomadaire: string[];
  coupure_de_courant: string;
  modes: Mode[];
  nettoyage: Record<Nettoyage, string>;
  transitions: Transition[];
  cohabitation: {
    etiquettes: Record<string, string>;
    conflits: [string, string][];
    capacite: number;
    regle: string;
  };
}

export interface Controle {
  /** Jours après le début (0,75 = 18 h). */
  j: number;
  repeter_j?: number;
  fin_j?: number;
  titre: string;
  observer: string;
  normal: string;
  probleme: string;
  action: string;
}

export interface Technique {
  nom: string;
  principe: string;
  conseils: string[];
  controles: Controle[];
  securite: string[];
}

export type Famille = 'lacto' | 'charc' | 'koji' | 'champ' | 'pain' | 'vin' | 'sech';
export type Lieu = 'chambre' | 'cuisine' | 'frigo' | 'placard' | 'thermoplongeur' | 'air';
export type TypeFin = 'aspect' | 'gout' | 'odeur' | 'temps' | 'ph' | 'perte_poids' | 'temperature_coeur';

export interface PhaseRecette {
  nom: string;
  mode?: IdMode | null;
  lieu?: Lieu;
  min_j: number;
  max_j: number;
}

export interface IngredientChambre {
  nom: string;
  qte: number;
  unite: string;
  note?: string;
}

export interface Conservation {
  mode: string;
  comment: string;
  duree: string;
  /** Jours de garde après la fin du lot (0 : pas de date limite). */
  jours: number;
}

export interface RecetteChambre {
  id: string;
  nom: string;
  famille: Famille;
  mois?: number[];
  toute_annee?: boolean;
  lieu: Lieu;
  mode: IdMode | null;
  phases?: PhaseRecette[];
  technique?: string;
  etiquettes: string[];
  place: number;
  difficulte: number;
  rendement: string;
  base: { ingredient: string; quantite: number; unite: string };
  duree: { min_j: number; max_j: number };
  fin: { type: TypeFin; cible?: number; texte: string };
  materiel: string[];
  ingredients: IngredientChambre[];
  etapes: { titre: string; texte: string; duree: string }[];
  controles: Controle[];
  conservation: Conservation[];
  securite?: string[];
  liens?: string[];
  notes?: string;
}

export interface SegmentCalendrier {
  du: number;
  au: number;
  mode: IdMode | 'nettoyage';
  nom: string;
  detail: string;
}

export interface EntreeCalendrier {
  quand: string;
  quoi: string;
  recettes: string[];
}

export interface MoisCalendrier {
  chambre?: SegmentCalendrier[];
  rendez_vous?: EntreeCalendrier[];
  sorties?: EntreeCalendrier[];
}

export interface ContenuCalendrier {
  cycle: number[];
  annee_de_depart: number;
  note: string;
  mois: Record<string, MoisCalendrier>;
}

export interface Achats {
  echeance: string;
  articles: string[];
}

// ───── Données personnelles : lots et stock (tables Dexie « lots » et « stock ») ─────

export interface ControleCoche {
  etat: 'ok' | 'probleme';
  note?: string;
  /** Date où il a été coché (ISO). */
  le: string;
}

export interface Pesee {
  le: string;
  /** Poids en grammes. */
  g: number;
}

export type MomentPh = 'depart' | '48h' | '72h' | 'libre';

export interface MesurePh {
  le: string;
  valeur: number;
  moment: MomentPh;
}

export interface Lot {
  id: string;
  recetteId: string;
  /** Copie de la recette au démarrage : une mise à jour des données ne change jamais un lot en cours. */
  recette: RecetteChambre;
  /** Copie de la technique (contrôles, sécurité) au démarrage. */
  technique?: Technique;
  nom: string;
  /** Date et heure d'entrée (ISO). */
  entree: string;
  /** Quantité de la base (dans l'unité de la recette). */
  quantiteBase: number;
  /** Poids d'entrée (g), si la fin se juge à la perte de poids et sans phase avant la Cave. */
  poidsEntree?: number;
  notes?: string;
  /** Pour chaque phase (même ordre que la recette) : début réel (sauf la 1re) et poids à son entrée. */
  phases: { debut?: string; poids?: number }[];
  phaseCourante: number;
  /** Contrôles cochés, par occurrence (« technique:2:0 »). */
  controles: Record<string, ControleCoche>;
  pesees: Pesee[];
  ph: MesurePh[];
  statut: 'en-cours' | 'termine' | 'rate';
  finLe?: string;
  modifieLe: number;
}

export interface ArticleStock {
  id: string;
  lotId?: string;
  recetteId: string;
  nom: string;
  /** Quantité notée à la fin (« 1,2 kg », « 6 saucissons »). */
  quantite?: string;
  conservation: Conservation;
  /** Fin du lot (ISO) : point de départ de la date limite. */
  depuis: string;
  /** Date limite (ISO), absente si la conservation n'en a pas (jours = 0). */
  limite?: string;
  statut: 'en-stock' | 'fini';
  modifieLe: number;
}
