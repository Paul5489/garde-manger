// « Que veux-tu cuisiner ? » : chaque fiche rangée dans un type de plat, toutes sources confondues.
// Les livres n'ont pas de type de plat : on le déduit de leurs chapitres (« Les desserts », « Garnitures de
// légumes »…), et pour les blogs et mes recettes, du type de plat indiqué.

import { normaliser } from './texte';
import type { Resume } from './types';

export type Rubrique =
  | 'entrees'
  | 'plats'
  | 'accompagnements'
  | 'desserts'
  | 'soupes'
  | 'sauces'
  | 'boissons'
  | 'fermentation'
  | 'techniques';

export const RUBRIQUES: { id: Rubrique; titre: string; emoji: string }[] = [
  { id: 'entrees', titre: 'Entrées', emoji: '🥗' },
  { id: 'plats', titre: 'Plats', emoji: '🍲' },
  { id: 'desserts', titre: 'Desserts', emoji: '🍰' },
  { id: 'soupes', titre: 'Soupes', emoji: '🥣' },
  { id: 'accompagnements', titre: 'Accompa\u00adgnements', emoji: '🥔' },
  { id: 'sauces', titre: 'Sauces', emoji: '🫕' },
  { id: 'boissons', titre: 'Boissons', emoji: '🍹' },
  { id: 'fermentation', titre: 'Fermentation', emoji: '🫙' },
  { id: 'techniques', titre: 'Techniques pro', emoji: '🔪' },
];

export const NOMS_RUBRIQUES = Object.fromEntries(RUBRIQUES.map((r) => [r.id, r.titre])) as Record<Rubrique, string>;

const SAUCE_DE_BASE = /sauce|beurre blanc|mayonnaise|bechamel|hollandaise|bearnaise|vinaigrette|coulis/;

export function rubriqueDe(r: Pick<Resume, 'type' | 'source' | 'categorie' | 'typesDePlat' | 'titre' | 'univers'>): Rubrique {
  if (r.source === 'noma' || r.univers.includes('fermentation')) return 'fermentation';
  const types = normaliser(r.typesDePlat.join(' | '));
  if (/fermentation/.test(types)) return 'fermentation';
  if (r.type !== 'recette') return 'techniques';
  const quoi = `${types} | ${normaliser(r.categorie ?? '')}`;
  if (/boisson|cocktail|limonade|jus|smoothie/.test(quoi)) return 'boissons';
  if (/soupe|potage|bouillon|veloute|consomme/.test(quoi)) return 'soupes';
  if (/sauce|vinaigrette|condiment|mayonnaise/.test(quoi)) return 'sauces';
  if (/dessert|patisserie|gateau|entremets|petits fours|confiserie|biscuit|viennoiserie/.test(quoi)) return 'desserts';
  if (/entree|hors d.?oeuvre|salade|aperitif|dim sum|oeuf/.test(quoi)) return 'entrees';
  if (/accompagnement|garniture|legume|feculent/.test(quoi)) return 'accompagnements';
  // AFPA « Techniques de base cuisine » : sauces de base d'un côté, fonds et appareils de l'autre.
  if (/techniques de base/.test(quoi)) return SAUCE_DE_BASE.test(normaliser(r.titre)) ? 'sauces' : 'techniques';
  return 'plats';
}
