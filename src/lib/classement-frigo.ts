// « Avec ce que j'ai » : index léger des ingrédients de chaque recette (construit à l'import),
// classement des recettes selon la part des ingrédients possédés, suggestions pendant la frappe.

import { nomPourCourses } from './liste-courses';
import { correspond, correspondAlternatives, motsCherches, motTape, type Dictionnaire, type Jetons } from './normalisation';
import { mentionneFacultatif } from './quantites';
import { collator, normaliser } from './texte';
import type { Fiche } from './types';

/** À augmenter quand la construction de l'index change : il est alors reconstruit. */
export const VERSION_INDEX_INGREDIENTS = 1;

/** Un ingrédient de la recette (avec ses alternatives « ou … » de la fiche). */
export interface Place {
  /** Noms bruts de l'archive (le premier, puis les alternatives). */
  noms: string[];
  facultatif?: true;
}

export interface FicheIngredients {
  id: string;
  places: Place[];
}

export interface IndexIngredients {
  version: number;
  fiches: FicheIngredients[];
}

/** Index des ingrédients des recettes (sans les quantités : quelques centaines de Ko). */
export function construireIndexIngredients(fiches: Fiche[]): IndexIngredients {
  const res: FicheIngredients[] = [];
  for (const f of fiches) {
    if (f.type !== 'recette') continue;
    const groupes = [...(f.ingredients ?? []), ...(f.ingredients_supplementaires ?? []).flatMap((t) => t.ingredients ?? [])];
    const places: Place[] = [];
    for (const g of groupes)
      for (const item of g.items ?? []) {
        const nom = (item.nom ?? item.texte_original ?? '').trim();
        if (!nom) continue;
        const precedente = places[places.length - 1];
        if (item.alternative_du_precedent && precedente) {
          precedente.noms.push(nom);
          continue;
        }
        const p: Place = { noms: [nom] };
        if (item.optionnel || mentionneFacultatif(nom)) p.facultatif = true;
        places.push(p);
      }
    if (places.length) res.push({ id: f.id, places });
  }
  return { version: VERSION_INDEX_INGREDIENTS, fiches: res };
}

// ───── Préparation (dépend des synonymes) ─────

interface PlacePreparee {
  nom: string;
  alternatives: Jetons[];
  facultatif: boolean;
}

export interface FichePreparee {
  id: string;
  places: PlacePreparee[];
}

const signature = (alts: Jetons[]) =>
  alts
    .map((a) => [...a].sort().join(' '))
    .sort()
    .join('|');

/** Traduit les noms en jetons et fusionne les ingrédients en double d'une même recette. */
export function preparer(index: IndexIngredients, dico: Dictionnaire): FichePreparee[] {
  return index.fiches.map((f) => {
    const vues = new Set<string>();
    const places: PlacePreparee[] = [];
    for (const p of f.places) {
      const alternatives = p.noms.flatMap((n) => dico.alternatives(n));
      if (!alternatives.length) continue;
      const sig = signature(alternatives);
      if (vues.has(sig)) continue;
      vues.add(sig);
      places.push({ nom: nomPourCourses(p.noms[0]), alternatives, facultatif: !!p.facultatif });
    }
    return { id: f.id, places };
  });
}

// ───── Classement ─────

export interface ResultatFrigo {
  id: string;
  /** Ingrédients comptés (hors placard et facultatifs). */
  total: number;
  possedes: number;
  manquants: string[];
  /** Part possédée, de 0 à 1. */
  part: number;
}

/**
 * Recettes où l'on possède au moins un ingrédient, rangées par nombre de manquants puis par part possédée.
 * Le placard (sel, eau…) et les ingrédients facultatifs ne comptent ni comme possédés ni comme manquants.
 */
export function classer(fiches: FichePreparee[], possedes: Jetons[][], placard: Jetons[][]): ResultatFrigo[] {
  if (!possedes.length) return [];
  const res: ResultatFrigo[] = [];
  for (const f of fiches) {
    let total = 0;
    let n = 0;
    const manquants: string[] = [];
    for (const p of f.places) {
      if (placard.some((j) => correspondAlternatives(j, p.alternatives))) continue;
      if (p.facultatif) continue;
      total++;
      if (possedes.some((j) => correspondAlternatives(j, p.alternatives))) n++;
      else manquants.push(p.nom);
    }
    if (n > 0) res.push({ id: f.id, total, possedes: n, manquants, part: n / total });
  }
  return res.sort(
    (a, b) => a.manquants.length - b.manquants.length || b.part - a.part || b.possedes - a.possedes,
  );
}

// ───── Suggestions ─────

export interface MotVocabulaire {
  nom: string;
  jetons: Jetons;
  /** Nombre de recettes qui l'emploient sous ce nom. */
  n: number;
  /** Mots normalisés du nom et de ses jetons, pour chercher en tapant sans accents ni pluriel. */
  cherche: string[];
}

/** Noms d'ingrédients à proposer (un par ingrédient, sous sa forme la plus courante). */
export function construireVocabulaire(fiches: FichePreparee[], dico: Dictionnaire, synonymes: string[][] = []): MotVocabulaire[] {
  const groupes = new Map<string, { jetons: Jetons; formes: Map<string, number>; n: number }>();
  const ajouter = (nom: string, jetons: Jetons, poids: number) => {
    const cle = [...jetons].sort().join(' ');
    let g = groupes.get(cle);
    if (!g) groupes.set(cle, (g = { jetons, formes: new Map(), n: 0 }));
    g.n += poids;
    g.formes.set(nom, (g.formes.get(nom) ?? 0) + Math.max(poids, 0.5));
  };
  for (const f of fiches)
    for (const p of f.places) {
      const nom = p.nom.split(/\s+ou\s+/i)[0];
      const j = dico.jetons(nom);
      // Les restes d'extraction (« *Au choix ») ne sont pas proposés.
      if (j.size && /^\p{L}/u.test(nom)) ajouter(nom, j, 1);
    }
  // Les noms principaux des synonymes (« Oignon nouveau ») sont proposés même s'ils sont rares dans l'archive.
  for (const g of synonymes) {
    const j = g[0] ? dico.jetons(g[0]) : new Set<string>();
    if (j.size) ajouter(g[0], j, 0);
  }
  return [...groupes.values()].map((g) => {
    // La forme la plus courte (« Pommes de terre » plutôt que « … à chair ferme »), puis la plus employée.
    const nbMots = (t: string) => t.split(/\s+/).length;
    const nom = [...g.formes.entries()].sort((a, b) => nbMots(a[0]) - nbMots(b[0]) || b[1] - a[1])[0][0];
    return { nom, jetons: g.jetons, n: g.n, cherche: motsCherches(nom, g.jetons) };
  });
}

/**
 * Suggestions pour une saisie : chaque mot tapé doit commencer un mot du nom.
 * Les noms les plus simples d'abord (« Poireau » avant « Blancs de poireaux »), puis les plus employés.
 */
export function suggestions(vocabulaire: MotVocabulaire[], saisie: string, exclus: Jetons[][], max = 8): MotVocabulaire[] {
  const tapes = normaliser(saisie).split(/[^a-z0-9]+/).filter(Boolean).map(motTape);
  if (!tapes.length) return [];
  return vocabulaire
    .filter((m) => tapes.every((t) => m.cherche.some((w) => w.startsWith(t))))
    // Déjà couvert par un ingrédient choisi ou par le placard (« Sel fin » quand le sel y est).
    .filter((m) => !exclus.some((alts) => alts.some((j) => correspond(j, m.jetons))))
    .sort((a, b) => a.jetons.size - b.jetons.size || b.n - a.n || collator.compare(a.nom, b.nom))
    .slice(0, max);
}
