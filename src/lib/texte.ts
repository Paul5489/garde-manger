// Outils de texte : normalisation pour la recherche (accents, ligatures, pluriels).

const LIGATURES: Record<string, string> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae', ß: 'ss' };

/** Minuscules, sans accents ni ligatures : « Œuf à la Crème » → « oeuf a la creme ». */
export function normaliser(texte: string): string {
  return texte
    .replace(/[œŒæÆß]/g, (c) => LIGATURES[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase();
}

/** Mots trop courants pour être utiles à la recherche (déjà normalisés). */
export const MOTS_VIDES = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'cette', 'd', 'dans', 'de', 'des', 'du', 'en', 'et', 'l', 'la',
  'le', 'les', 'leur', 'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur',
  'un', 'une', 'y', 'est', 'sont', 'il', 'elle', 'on', 'ne', 'plus', 'tres', 'bien', 'peu', 'puis', 'si',
]);

/**
 * Réduit un mot à une forme simple pour que singulier et pluriel se retrouvent :
 * « tomates » → « tomate », « poireaux » → « poireau ». Volontairement prudent.
 */
export function radical(mot: string): string {
  if (mot.length <= 3) return mot;
  if (mot.endsWith('aux') && mot.length > 4) return mot.slice(0, -1); // poireaux → poireau, chevaux → chevau (sans gravité)
  if (mot.endsWith('eux')) return mot.slice(0, -1); // cheveux → cheveu
  if (mot.endsWith('s') && !mot.endsWith('ss')) return mot.slice(0, -1);
  return mot;
}

/** Transforme un mot brut en terme de recherche (ou null s'il faut l'ignorer). */
export function termeDeRecherche(mot: string): string | null {
  const n = normaliser(mot).replace(/'/g, '');
  if (!n || MOTS_VIDES.has(n)) return null;
  if (n.length < 2 && !/\d/.test(n)) return null;
  return radical(n);
}

/** Découpe en mots (espaces, ponctuation, apostrophes). */
export function decouper(texte: string): string[] {
  return texte.split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
}

/** « SAUCE » → « Sauce » ; laisse intacts les textes déjà en casse mixte. */
export function casseLisible(texte: string): string {
  const t = texte.trim();
  if (t.length > 1 && t === t.toUpperCase() && /\p{L}/u.test(t)) {
    const bas = t.toLowerCase();
    return bas.charAt(0).toUpperCase() + bas.slice(1);
  }
  return t;
}

/** Première lettre en majuscule. */
export function majuscule(texte: string): string {
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte;
}

/** Tri alphabétique français (ignore accents et casse, « œ » bien placé). */
export const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Espaces insécables à la française : « 20 % », « 18 °C », « 45 min » ne sont jamais coupés. */
export function insecables(texte: string): string {
  return texte
    .replace(/(\d) (?=(%|°C|°|°Bx|kg|g|mg|ml|cl|l|min|h|s|cm|mm|jours?|semaines?|mois|heures?)(?![\p{L}]))/gu, '$1 ')
    .replace(/ ([:;!?»])/g, ' $1')
    .replace(/« /g, '« ');
}
