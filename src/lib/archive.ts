// Lecture de l'archive : validation, allègement des fiches, résumés pour les listes.
// Aucune donnée n'est incluse dans l'application : tout vient du fichier importé.

import { estExclue } from './exclusions';
import { casseLisible } from './texte';
import type { Fiche, Resume, SourceId, TypeFiche, Univers } from './types';

export const NOMS_SOURCES: Record<SourceId, string> = {
  'marc-winer': 'Marc Winer',
  afpa: 'AFPA',
  'cuisine-de-reference': 'La Cuisine de référence',
  noma: 'Noma — Fermentation',
  'notes-perso': 'Mes notes',
  perso: 'Mes recettes',
};

export const UNIVERS: { id: Univers; titre: string; sousTitre: string; emoji: string }[] = [
  { id: 'asiatique', titre: 'Cuisine asiatique', sousTitre: 'Marc Winer', emoji: '🥢' },
  { id: 'francaise', titre: 'Cuisine française', sousTitre: 'AFPA · Cuisine de référence', emoji: '🥖' },
  { id: 'techniques', titre: 'Techniques pro', sousTitre: 'Fonds, sauces, découpes…', emoji: '🔪' },
  { id: 'fermentation', titre: 'Fermentation', sousTitre: 'Noma', emoji: '🫙' },
  { id: 'perso', titre: 'Mes recettes', sousTitre: 'Ajoutées par moi', emoji: '📝' },
];

export const NOMS_TYPES: Record<TypeFiche, string> = {
  recette: 'Recette',
  technique: 'Technique',
  chapitre: 'Chapitre',
  annexe: 'Chapitre',
};

const TYPES: TypeFiche[] = ['recette', 'technique', 'chapitre', 'annexe'];
const SOURCES = Object.keys(NOMS_SOURCES) as SourceId[];

export class ErreurArchive extends Error {}

export interface ArchiveLue {
  genereLe?: string;
  fiches: Fiche[];
  ignorees: number;
  ecartees: number;
}

/** Vérifie que le JSON est bien l'archive complète et garde les fiches exploitables. */
export function lireArchive(donnees: unknown): ArchiveLue {
  if (Array.isArray(donnees)) {
    throw new ErreurArchive(
      'Ce fichier est la liste légère (index.json). Choisis plutôt « archive_complete.json », dans le dossier « donnees ».',
    );
  }
  const obj = donnees as { fiches?: unknown; genere_le?: unknown; format?: unknown } | null;
  if (obj && typeof obj === 'object' && obj.format === 'garde-manger-sauvegarde') {
    throw new ErreurArchive(
      'Ce fichier est une sauvegarde de tes données, pas les recettes. Pour la restaurer : Réglages › « Restaurer une sauvegarde ».',
    );
  }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.fiches)) {
    throw new ErreurArchive("Ce fichier n'est pas une archive de recettes. Choisis « archive_complete.json ».");
  }
  const fiches: Fiche[] = [];
  let ignorees = 0;
  let ecartees = 0;
  for (const brute of obj.fiches as unknown[]) {
    if (!ficheValide(brute)) {
      ignorees++;
      continue;
    }
    if (estExclue(brute.id)) {
      ecartees++;
      continue;
    }
    fiches.push(alleger(brute));
  }
  if (!fiches.length) throw new ErreurArchive("Aucune fiche lisible dans ce fichier.");
  return { genereLe: typeof obj.genere_le === 'string' ? obj.genere_le : undefined, fiches, ignorees, ecartees };
}

/** L'essentiel d'une fiche : identifiant, titre, type et source connus. */
export function ficheValide(brute: unknown): brute is Fiche {
  const f = brute as Partial<Fiche> | null;
  return (
    !!f &&
    typeof f === 'object' &&
    typeof f.id === 'string' &&
    !!f.id &&
    typeof f.titre === 'string' &&
    TYPES.includes(f.type as TypeFiche) &&
    !!f.source &&
    SOURCES.includes(f.source.id as SourceId)
  );
}

/** Retire ce que l'application n'affiche jamais (texte anglais d'origine, détails d'extraction). */
export function alleger(f: Fiche): Fiche {
  const { version_originale: _vo, extraction, ...reste } = f;
  const avertissements = extraction?.avertissements?.filter(
    (a) => !a.startsWith('Version française rédigée') && !a.startsWith('Fiche française'),
  );
  return avertissements?.length ? { ...reste, extraction: { avertissements } } : reste;
}

/** Clés de temps comptées dans le temps total (la fermentation est à part). */
const CLES_TEMPS = ['preparation', 'cuisson', 'realisation', 'repos', 'marinade', 'sechage', 'maceration'];

function minutesDe(d?: { minutes?: number; minutes_max?: number; minutes_min?: number }): number | undefined {
  if (!d) return undefined;
  return d.minutes ?? d.minutes_max ?? d.minutes_min;
}

/** Temps total en minutes : le total indiqué, sinon la somme des temps connus. */
export function tempsTotal(f: Fiche): number | undefined {
  const t = f.temps;
  if (!t) return undefined;
  const total = minutesDe(t.total);
  if (total) return total;
  let somme = 0;
  for (const cle of CLES_TEMPS) somme += minutesDe(t[cle]) ?? 0;
  return somme || undefined;
}

export function categorieDe(f: Fiche): string | undefined {
  const c = f.classement;
  if (!c) return undefined;
  if (c.categorie) return casseLisible(c.categorie);
  if (c.chemin?.length) return c.chemin.length > 1 ? c.chemin[1] : 'Généralités et annexes';
  return undefined;
}

export function universDe(f: Fiche): Univers[] {
  const u: Univers[] = [];
  const s = f.source.id;
  if (s === 'marc-winer') u.push('asiatique');
  if ((s === 'afpa' || s === 'cuisine-de-reference') && f.type === 'recette') u.push('francaise');
  if (s === 'noma') u.push('fermentation');
  if (s === 'perso') u.push('perso');
  if (s !== 'noma' && s !== 'perso' && f.type !== 'recette') u.push('techniques');
  if (s === 'afpa' && f.classement?.categorie?.startsWith('Techniques de base')) u.push('techniques');
  return u;
}

/** Unifie les variantes d'écriture (« sauces » / « Sauce »). */
function libelle(t: string): string {
  const l = casseLisible(t.trim());
  const cle = l.toLowerCase();
  if (cle === 'sauces') return 'Sauce';
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export function resumer(f: Fiche): Resume {
  const nbIngredients = (f.ingredients ?? []).reduce((n, g) => n + (g.items?.length ?? 0), 0);
  const fe = f.fermentation;
  let fermentationJours: [number, number] | undefined;
  if (fe?.duree_min_jours !== undefined) fermentationJours = [fe.duree_min_jours, fe.duree_max_jours ?? fe.duree_min_jours];
  const r: Resume = {
    id: f.id,
    type: f.type,
    titre: f.titre,
    source: f.source.id,
    categorie: categorieDe(f),
    cuisines: (f.classement?.cuisine ?? []).map(libelle),
    typesDePlat: [...new Set((f.classement?.type_de_plat ?? []).map(libelle))],
    univers: universDe(f),
    minutes: tempsTotal(f),
    fermentationJours,
    portions: f.portions?.nombre ? `${f.portions.nombre} ${f.portions.unite ?? 'portions'}`.trim() : undefined,
    rendement: f.rendement,
    nbIngredients,
  };
  if (f.source.id === 'cuisine-de-reference' && f.type !== 'recette' && f.source.pages?.length) r.pages = f.source.pages;
  return r;
}

/** Document indexé par le moteur de recherche. */
export interface DocRecherche {
  id: string;
  titre: string;
  ingredients: string;
  classement: string;
  texte: string;
}

export function documentDeRecherche(f: Fiche): DocRecherche {
  const items = (f.ingredients ?? []).flatMap((g) => g.items ?? []);
  const texteSource = f.source.id === 'marc-winer' || f.source.id === 'noma';
  const ingredients = items.map((i) => (texteSource && i.texte_original ? i.texte_original : i.nom)).join(' · ');
  const c = f.classement ?? {};
  const classement = [
    c.categorie,
    c.sous_categorie,
    ...(c.cuisine ?? []),
    ...(c.type_de_plat ?? []),
    c.famille_technique,
    ...(c.chemin ?? []),
    f.fermentation?.type,
  ]
    .filter(Boolean)
    .join(' · ');
  const morceaux: (string | undefined)[] = [
    f.description,
    ...(f.etapes ?? []).flatMap((e) => [e.texte, ...(e.details ?? [])]),
    ...(f.notes ?? []),
    ...(f.variantes ?? []).flatMap((v) => [v.titre, v.texte]),
    ...(f.utilisations ?? []).flatMap((v) => [v.titre, v.texte]),
    ...(f.techniques_mises_en_oeuvre ?? []),
  ];
  // Les recettes sont déjà structurées ; pour les techniques et chapitres, le texte intégral fait foi.
  if (f.type !== 'recette') {
    if (f.texte_complet) morceaux.push(f.texte_complet.replace(/<!--.*?-->/g, ' '));
    else morceaux.push(...(f.sections ?? []).flatMap((s) => [s.titre, s.texte]));
  }
  return { id: f.id, titre: f.titre, ingredients, classement, texte: morceaux.filter(Boolean).join('\n') };
}
