// Base de données du téléphone (IndexedDB via Dexie).
// Les recettes importées et les données personnelles sont dans des tables séparées :
// réimporter les recettes ne touche jamais aux données personnelles (liées par id de fiche).

import Dexie, { type EntityTable } from 'dexie';
import type { Bocal, EntreeJournal, ModeleBocal } from './bocaux';
import type { Fiche } from './types';

export interface EntreeMeta {
  cle: 'archive' | 'catalogue' | 'index' | 'ingredients';
  valeur: unknown;
}

// ───── Données personnelles (sauvegardées, jamais effacées par un import) ─────
// Chaque enregistrement porte « modifieLe » (ms) : à la restauration d'une sauvegarde, le plus récent l'emporte.

export interface Favori {
  ficheId: string;
  modifieLe: number;
}

export interface NotePerso {
  ficheId: string;
  texte: string;
  modifieLe: number;
}

/** « Cuisiné le… » avec une appréciation. */
export interface Realisation {
  id: string;
  ficheId: string;
  /** Jour (AAAA-MM-JJ, heure locale). */
  date: string;
  /** Appréciation de 1 à 5 (0 = pas donnée). */
  note: number;
  commentaire?: string;
  /** Portions ou coefficient utilisés (texte lisible, ex. « 6 couverts », « ×2 »). */
  quantites?: string;
  modifieLe: number;
}

/** Part d'un article de courses (une recette ou une saisie libre). */
export interface Apport {
  /** Fiche d'origine (absent : ajout à la main). */
  ficheId?: string;
  /** Quantité (dans l'unité de base : g, ml, pièce…), absente pour « PM » ou une saisie libre. */
  valeur?: number;
  unite?: string;
}

export interface ArticleCourses {
  id: string;
  /** Nom affiché (« Oignons »). */
  nom: string;
  /** Clé de regroupement des doublons (nom simplifié, singulier, sans accents). */
  cle: string;
  rayon: string;
  apports: Apport[];
  coche: boolean;
  ajouteLe: number;
  modifieLe: number;
}

/** Recette ajoutée à la liste de courses, avec les quantités choisies. */
export interface RecetteCourses {
  ficheId: string;
  titre: string;
  coef: number;
  /** « 6 couverts », « ×2 »… */
  quantites?: string;
  modifieLe: number;
}

/** Réglages personnels : rayons choisis à la main, frigo, placard, synonymes (null = liste d'origine). */
export interface ReglagePerso {
  cle: string;
  valeur: unknown;
  modifieLe: number;
}

export class BaseGardeManger extends Dexie {
  fiches!: EntityTable<Fiche, 'id'>;
  meta!: EntityTable<EntreeMeta, 'cle'>;
  favoris!: EntityTable<Favori, 'ficheId'>;
  notes!: EntityTable<NotePerso, 'ficheId'>;
  realisations!: EntityTable<Realisation, 'id'>;
  courses!: EntityTable<ArticleCourses, 'id'>;
  recettesCourses!: EntityTable<RecetteCourses, 'ficheId'>;
  reglages!: EntityTable<ReglagePerso, 'cle'>;
  bocaux!: EntityTable<Bocal, 'id'>;
  journal!: EntityTable<EntreeJournal, 'id'>;
  modelesBocaux!: EntityTable<ModeleBocal, 'id'>;

  constructor(nom = 'garde-manger') {
    super(nom);
    this.version(1).stores({
      // Données importées (remplacées à chaque import)
      fiches: 'id',
      meta: 'cle',
    });
    this.version(2).stores({
      // Données personnelles
      favoris: 'ficheId',
      notes: 'ficheId',
      realisations: 'id, ficheId, date',
      courses: 'id, cle',
      recettesCourses: 'ficheId',
      reglages: 'cle',
    });
    this.version(3).stores({
      // Mes bocaux : bocaux, journal (notes et photos), modèles réutilisables
      bocaux: 'id, statut',
      journal: 'id, bocalId',
      modelesBocaux: 'id',
    });
  }
}

/** Tables des données personnelles (celles de la sauvegarde). */
export const TABLES_PERSO = [
  'favoris',
  'notes',
  'realisations',
  'courses',
  'recettesCourses',
  'reglages',
  'bocaux',
  'journal',
  'modelesBocaux',
] as const;
export type TablePerso = (typeof TABLES_PERSO)[number];

export const db = new BaseGardeManger();

/** Remplace les recettes importées. Ne touche qu'aux tables fiches et meta : les données personnelles restent. */
export async function remplacerRecettes(base: BaseGardeManger, fiches: Fiche[], meta: EntreeMeta[]): Promise<void> {
  await base.transaction('rw', base.fiches, base.meta, async () => {
    await base.fiches.clear();
    await base.fiches.bulkPut(fiches);
    await base.meta.bulkPut(meta);
  });
}

/** Demande à Safari de ne jamais effacer les données de l'application. */
export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Identifiant unique (crypto.randomUUID n'existe pas en http, lors des tests par le Wi-Fi). */
export function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
