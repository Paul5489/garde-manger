// Moteur de recherche plein texte (MiniSearch) : insensible aux accents, ligatures,
// pluriels simples, tolérant aux petites fautes de frappe.

import MiniSearch, { type Options, type SearchOptions } from 'minisearch';
import { decouper, termeDeRecherche } from './texte';
import type { DocRecherche } from './archive';

export const OPTIONS_INDEX: Options<DocRecherche> = {
  idField: 'id',
  fields: ['titre', 'ingredients', 'classement', 'texte'],
  tokenize: decouper,
  processTerm: termeDeRecherche,
};

export const OPTIONS_RECHERCHE: SearchOptions = {
  boost: { titre: 5, ingredients: 2, classement: 1.5, texte: 1 },
  combineWith: 'AND',
  // Le dernier mot est peut-être en cours de frappe : on accepte le début d'un mot.
  prefix: (_terme, i, termes) => i === termes.length - 1,
  // Fautes de frappe : 1 lettre d'écart dès 4 lettres, 2 dès 8.
  fuzzy: (terme) => (terme.length >= 8 ? 2 : terme.length >= 4 ? 1 : false),
  maxFuzzy: 2,
  weights: { fuzzy: 0.35, prefix: 0.6 },
};

export function creerIndex(docs: DocRecherche[]): MiniSearch<DocRecherche> {
  const ms = new MiniSearch<DocRecherche>(OPTIONS_INDEX);
  ms.addAll(docs);
  return ms;
}

export function chargerIndex(json: string): MiniSearch<DocRecherche> {
  return MiniSearch.loadJSON<DocRecherche>(json, OPTIONS_INDEX);
}

/** Identifiants des fiches correspondant à la requête, du plus pertinent au moins pertinent. */
export function chercher(index: MiniSearch<DocRecherche>, requete: string): string[] {
  const q = requete.trim();
  if (!q) return [];
  let res = index.search(q, OPTIONS_RECHERCHE);
  // Si tous les mots ensemble ne donnent rien, on accepte les fiches qui en contiennent une partie.
  if (!res.length) res = index.search(q, { ...OPTIONS_RECHERCHE, combineWith: 'OR' });
  return res.map((r) => String(r.id));
}
