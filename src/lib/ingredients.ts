// Normalisation des noms d'ingrédients (base, enrichie à l'étape « Avec ce que j'ai »)
// et repérage des ingrédients cités dans une étape (mode cuisine).

import { decouper, MOTS_VIDES, normaliser, radical } from './texte';
import type { Etape, Fiche, Ingredient } from './types';

/** Mots qui précisent un ingrédient sans l'identifier (« blanc », « frais », « haché »…). */
const PRECISIONS = new Set(
  [
    'blanc', 'blanche', 'jaune', 'vert', 'verte', 'rouge', 'noir', 'noire', 'brun', 'brune', 'frais', 'fraiche',
    'fin', 'fine', 'gros', 'grosse', 'petit', 'petite', 'grand', 'grande', 'double', 'entier', 'entiere', 'liquide',
    'sec', 'seche', 'moulu', 'moulue', 'hache', 'hachee', 'emince', 'emincee', 'rape', 'rapee', 'cisele', 'ciselee',
    'concasse', 'concassee', 'coupe', 'coupee', 'tranche', 'tranchee', 'epluche', 'epluchee', 'cuit', 'cuite', 'cru',
    'crue', 'beau', 'belle', 'jeune', 'nouveau', 'nouvelle', 'morceau', 'piece', 'feuille', 'branche', 'gousse',
    'botte', 'cuillere', 'soupe', 'cafe', 'pincee', 'poignee', 'tige', 'boite', 'sachet', 'paquet', 'portion',
    'environ', 'facultatif', 'optionnel', 'selon', 'gout', 'type', 'qualite', 'extra', 'bien', 'mur', 'mure',
    'surgele', 'surgelee', 'bio', 'nature', 'doux', 'douce', 'fort', 'forte', 'leger', 'legere', 'chaud', 'chaude',
    'froid', 'froide', 'tiede', 'bouillant', 'bouillante', 'demi', 'quart', 'reste', 'autre', 'pour', 'garnir',
    'decor', 'decoration', 'finition', 'choix', 'kg', 'g', 'ml', 'cl', 'l', 'cm', 'mm',
  ].map((m) => radical(m)),
);

/** Nom d'ingrédient simplifié : sans précisions après la virgule ou entre parenthèses. */
export function nomSimplifie(nom: string): string {
  return normaliser(nom)
    .replace(/\([^)]*\)?/g, ' ')
    .split(/,|;|:| ou | pour | - /)[0]
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mots qui identifient l'ingrédient (« blancs de poireaux » → [poireau]). */
export function motsCles(nom: string): string[] {
  const mots = decouper(nomSimplifie(nom))
    .map((m) => m.replace(/'/g, ''))
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m) && !/^\d/.test(m))
    .map(radical)
    .filter((m) => !PRECISIONS.has(m));
  return [...new Set(mots)];
}

function motsDuTexte(texte: string): Set<string> {
  return new Set(decouper(normaliser(texte)).map((m) => radical(m.replace(/'/g, ''))));
}

export interface IngredientCite {
  item: Ingredient;
  groupe?: string;
}

/** Ingrédients de la fiche cités dans le texte d'une étape (et ses détails). */
export function ingredientsDeLEtape(fiche: Pick<Fiche, 'ingredients'>, etape: Etape): IngredientCite[] {
  const texte = [etape.texte, ...(etape.details ?? [])].join(' ');
  const mots = motsDuTexte(texte);
  const res: IngredientCite[] = [];
  for (const g of fiche.ingredients ?? []) {
    for (const item of g.items ?? []) {
      const cles = motsCles(item.nom ?? '');
      if (cles.some((c) => mots.has(c))) res.push({ item, groupe: g.groupe });
    }
  }
  return res;
}
