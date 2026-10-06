// Affichage des quantités d'ingrédients : unités lisibles (0,040 kg → « 40 g », 0,25 l → « 25 cl »),
// mise à l'échelle par un coefficient, PM laissés tels quels.

import { estSourceFermentation } from './archive';
import { nombre } from './format';
import { majuscule, normaliser } from './texte';
import type { Ingredient, SourceId } from './types';

const ALIAS_UNITES: Record<string, string> = {
  kilogram: 'kg', kilograms: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  gram: 'g', grams: 'g', gramme: 'g', grammes: 'g', gr: 'g',
  litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  p: 'pièce', pc: 'pièce', pce: 'pièce', pcs: 'pièce', piece: 'pièce', piéce: 'pièce', pièces: 'pièce',
  '1': 'l', // Cuisine de référence : « l » lu comme « 1 » à l'extraction
  'bt 4/4': 'boîte 4/4',
};

/** Unité normalisée (minuscules, alias résolus), ou undefined. */
export function normaliserUnite(unite?: string): string | undefined {
  if (!unite) return undefined;
  const u = unite.trim().toLowerCase().replace(/\.$/, '');
  return ALIAS_UNITES[u] ?? u;
}

const ABREVIATIONS: Record<string, string> = {
  'cuillère à soupe': 'c. à soupe',
  'cuillère à café': 'c. à café',
};

/** Unités qu'on n'accorde pas au pluriel (abréviations, symboles). */
const INVARIABLES = new Set(['kg', 'g', 'l', 'cl', 'ml', 'cm', 'bt', 'fg', 'c. à soupe', 'c. à café']);

function accorder(unite: string, valeur: number): string {
  if (valeur < 2 || INVARIABLES.has(unite)) return unite;
  const [premier, ...reste] = unite.split(' ');
  let pl: string;
  if (/[sxz]$/.test(premier)) pl = premier;
  else if (/(eau|au)$/.test(premier)) pl = premier + 'x';
  else pl = premier + 's';
  return [pl, ...reste].join(' ');
}

/** Convertit vers l'unité la plus lisible : 0,04 kg → [40, 'g'] ; 0,25 l → [25, 'cl']. */
export function versAffichage(valeur: number, unite: string): [number, string] {
  switch (unite) {
    case 'kg':
      return valeur >= 1 ? [valeur, 'kg'] : [valeur * 1000, 'g'];
    case 'g':
      return valeur >= 1000 ? [valeur / 1000, 'kg'] : [valeur, 'g'];
    case 'l':
      if (valeur >= 1) return [valeur, 'l'];
      return valeur * 1000 >= 10 ? [valeur * 100, 'cl'] : [valeur * 1000, 'ml'];
    case 'cl':
      return valeur >= 100 ? [valeur / 100, 'l'] : [valeur, 'cl'];
    case 'ml':
      return valeur >= 1000 ? [valeur / 1000, 'l'] : [valeur, 'ml'];
    default:
      return [valeur, unite];
  }
}

function decimalesPour(valeur: number, unite: string): number {
  switch (unite) {
    case 'g':
    case 'ml':
      return valeur >= 10 ? 0 : valeur >= 1 ? 1 : 2;
    case 'cl':
      return 1;
    case 'kg':
      return 3;
    case 'l':
      return 2;
    default:
      return 2;
  }
}

function assembler(valeurTexte: string, valeur: number, unite: string | undefined): string {
  if (!unite || unite === 'pièce') return valeurTexte;
  const u = ABREVIATIONS[unite] ?? unite;
  return `${valeurTexte} ${accorder(u, valeur)}`;
}

/** 0.04, 'kg' → « 40 g » ; 3, 'cuillère à soupe' → « 3 c. à soupe » ; 2, 'pièce' → « 2 ». */
export function formaterMesure(valeur: number, unite?: string): string {
  const u = normaliserUnite(unite);
  if (!u) return nombre(valeur, 2);
  const [v, ua] = versAffichage(valeur, u);
  return assembler(nombre(v, decimalesPour(v, ua)), v, ua);
}

/** 2.4, 2.8, 'kg' → « 2,4 à 2,8 kg » ; 0.5, 0.6, 'kg' → « 500 à 600 g ». */
export function formaterPlage(min: number, max: number, unite?: string): string {
  const u = normaliserUnite(unite);
  if (!u) return `${nombre(min, 2)} à ${nombre(max, 2)}`;
  const [vMax, ua] = versAffichage(max, u);
  const facteur = max ? vMax / max : 1;
  const vMin = min * facteur;
  const d = decimalesPour(vMin, ua);
  return assembler(`${nombre(vMin, d)} à ${nombre(vMax, decimalesPour(vMax, ua))}`, vMax, ua);
}

/** « 0,800 » → 0.8 ; « 1/4 » → 0.25 ; « ½ » → 0.5. */
export function lireNombre(texte: string): number | undefined {
  const t = texte.trim();
  const fractions: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  if (t in fractions) return fractions[t];
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export interface LigneIngredient {
  /** Quantité mise en forme (« 40 g », « PM », « 2 à 3 »), ou null. */
  quantite: string | null;
  /** Nom (fiches pro) ou reste de la ligne d'origine (fiches rédigées). */
  texte: string;
  /** « colonnes » : quantité à gauche, nom à droite ; « ligne » : phrase avec la quantité en gras. */
  mode: 'colonnes' | 'ligne';
  pm?: boolean;
  optionnel?: boolean;
  alternative?: boolean;
}

/** Sources dont les fiches donnent une quantité + une unité + un nom (format professionnel). */
export function estFormatPro(source: SourceId | string): boolean {
  return source === 'afpa' || source === 'cuisine-de-reference' || source === 'notes-perso';
}

const NOMBRE_EN_TETE = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾⅓⅔])(?=[\s\p{L}(]|$)\s*/u;
const MESURE_INTEGREE = /(\d+(?:[.,]\d+)?)(\s*)(kg|g|ml|cl|l|litres?|grammes?)(?![\p{L}])/gu;

/** Quantité relue dans la ligne d'origine d'une fiche pro (quand l'extraction ne l'a pas chiffrée). */
type QuantiteLue = { min: number; max: number } | { pm: 'PM' | 'QS' } | { pieces: number } | { brut: string };

function lireQuantitePro(item: Ingredient, source: string): QuantiteLue | null {
  const t = item.texte_original ?? '';
  let brut: string | undefined;
  if (source === 'cuisine-de-reference') {
    const parts = t.split(' — ');
    if (parts.length >= 3) brut = parts[parts.length - 1].trim();
  } else if (t && item.nom && t.startsWith(item.nom)) {
    brut = t.slice(item.nom.length).trim();
  }
  if (!brut) return null;
  if (/^pm$/i.test(brut)) return { pm: 'PM' };
  if (/^qs\b/i.test(brut)) return { pm: 'QS' };
  const plage = brut.match(/^([\d.,/]+)\s*à\s*([\d.,/]+)/);
  if (plage) {
    const a = lireNombre(plage[1]);
    const b = lireNombre(plage[2]);
    if (a !== undefined && b !== undefined) return { min: a, max: b };
  }
  // AFPA « 4 Pm » : 4 pièces, poids non précisé.
  const avecPm = brut.match(/^([\d.,/]+)\s*pm$/i);
  if (avecPm) {
    const n = lireNombre(avecPm[1]);
    if (n !== undefined) return { pieces: n };
  }
  const n = lireNombre(brut.split(/\s+/)[0]);
  if (n !== undefined) return { min: n, max: n };
  return { brut };
}

function reparerQuantitePro(item: Ingredient, source: string, coef: number): Pick<LigneIngredient, 'quantite' | 'pm'> {
  const q = lireQuantitePro(item, source);
  if (!q) return { quantite: null };
  if ('pm' in q) return { quantite: q.pm, pm: true };
  if ('pieces' in q) return { quantite: nombre(q.pieces * coef, 2) };
  if ('brut' in q) return { quantite: q.brut };
  if (q.min === q.max) return { quantite: formaterMesure(q.min * coef, item.unite) };
  return { quantite: formaterPlage(q.min * coef, q.max * coef, item.unite) };
}

function mettreAEchelleTexte(texte: string, coef: number): string {
  return texte.replace(MESURE_INTEGREE, (_m, n: string, esp: string, u: string) => {
    const v = lireNombre(n);
    return v === undefined ? _m : `${nombre(v * coef, 2)}${esp}${u}`;
  });
}

/** Prépare une ligne d'ingrédient pour l'affichage, avec un coefficient de portions. */
export function ligneIngredient(item: Ingredient, source: SourceId | string, coef = 1): LigneIngredient {
  const base = {
    optionnel: item.optionnel,
    alternative: item.alternative_du_precedent,
  };

  if (estFormatPro(source)) {
    let quantite: string | null = null;
    let pm = false;
    if (item.quantite !== undefined) quantite = formaterMesure(item.quantite * coef, item.unite);
    else if (item.quantite_min !== undefined && item.quantite_max !== undefined)
      quantite = formaterPlage(item.quantite_min * coef, item.quantite_max * coef, item.unite);
    else if (item.pour_memoire) {
      quantite = 'PM';
      pm = true;
    } else ({ quantite, pm = false } = reparerQuantitePro(item, source, coef));
    const texte = majuscule((item.nom ?? '').replace(/\s*:\s*$/, '').trim());
    return { ...base, quantite, pm, texte, mode: 'colonnes' };
  }

  // Fiches rédigées (Marc Winer, Noma) : la ligne d'origine fait foi.
  const original = (item.texte_original ?? item.nom ?? '').trim();
  const m = original.match(NOMBRE_EN_TETE);
  let quantite: string | null = null;
  let reste = original;
  if (m) {
    const v = lireNombre(m[1]);
    if (v !== undefined) {
      quantite = nombre(v * coef, 2);
      reste = original.slice(m[0].length);
    }
  } else if (item.quantite_min !== undefined && item.quantite_max !== undefined) {
    quantite = null;
  }
  // Fermentation : les masses et volumes cités dans la ligne suivent aussi le coefficient (pas les %).
  if (coef !== 1 && estSourceFermentation(source)) reste = mettreAEchelleTexte(reste, coef);
  const plage = reste.match(/^à\s+(\d+(?:[.,]\d+)?)\s*/);
  if (quantite && plage && item.quantite_max !== undefined) {
    quantite = `${quantite} à ${nombre(item.quantite_max * coef, 2)}`;
    reste = reste.slice(plage[0].length);
  }
  return { ...base, quantite, texte: reste, mode: 'ligne' };
}

/** Le texte signale-t-il déjà que l'ingrédient est facultatif ? */
export function mentionneFacultatif(texte: string): boolean {
  const n = normaliser(texte);
  return n.includes('facultati') || n.includes('optionnel');
}

export interface Mesure {
  /** Quantité dans l'unité de la fiche (valeur haute d'une fourchette). */
  valeur?: number;
  /** Unité normalisée (undefined : un nombre de pièces, ou pas de quantité). */
  unite?: string;
  /** Quantité « pour mémoire » (PM, QS) : à prévoir sans quantité précise. */
  pm?: boolean;
}

/** Quantité chiffrée d'un ingrédient, sans coefficient (liste de courses). */
export function mesureIngredient(item: Ingredient, source: SourceId | string): Mesure {
  const unite = normaliserUnite(item.unite);
  const valeur = item.quantite_max ?? item.quantite;
  if (valeur !== undefined) return { valeur, unite };
  if (estFormatPro(source)) {
    if (item.pour_memoire) return { pm: true };
    const q = lireQuantitePro(item, source);
    if (!q || 'brut' in q) return {};
    if ('pm' in q) return { pm: true };
    if ('pieces' in q) return { valeur: q.pieces, unite: 'pièce' };
    return { valeur: q.max, unite };
  }
  const m = (item.texte_original ?? '').trim().match(NOMBRE_EN_TETE);
  const n = m ? lireNombre(m[1]) : undefined;
  return n !== undefined ? { valeur: n } : {};
}
