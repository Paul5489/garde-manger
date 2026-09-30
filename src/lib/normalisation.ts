// Normalisation des noms d'ingrédients pour « Avec ce que j'ai » (et le placard des courses).
//
// Un nom devient un ensemble de « jetons » : minuscules sans accents, au singulier, sans mots vides
// ni mots de préparation (« émincé », « gros »…). Les noms composés qu'il ne faut pas confondre
// (« pomme de terre » ≠ « pomme ») deviennent un seul jeton, et les synonymes (éditables par Paul)
// sont ramenés à leur nom principal. Deux ingrédients correspondent quand les jetons de l'un sont
// tous dans l'autre : « poireau » ↔ « blancs de poireaux », « crème » ↔ « crème liquide ».

import { MOTS_VIDES, normaliser, radical } from './texte';

// ───── Réglages par défaut (modifiables dans l'appli) ─────

/** Toujours à la maison : jamais « manquants », jamais proposés aux courses. */
export const PLACARD_DEFAUT = ['Eau', 'Sel', 'Poivre', 'Huile', 'Sucre'];

/** Groupes de synonymes : le premier nom est le nom principal. */
export const SYNONYMES_DEFAUT: string[][] = [
  ['Échalote', 'Échalotte', 'Échalion'],
  ['Oignon nouveau', 'Oignon vert', 'Jeune oignon', 'Jeune pousse d’oignon', 'Pousse d’oignon', 'Cébette', 'Oignon frais', 'Oignon printanier'],
  ['Crème liquide', 'Crème fleurette', 'Crème liquide entière', 'Crème entière liquide', 'Crème UHT'],
  ['Crème fraîche', 'Crème épaisse', 'Crème double', 'Crème fraîche épaisse'],
  ['Maïzena', 'Fécule de maïs', 'Amidon de maïs'],
  ['Sauce soja claire', 'Sauce soja light', 'Sauce soja salée'],
  ['Sauce soja foncée', 'Sauce soja dark', 'Sauce soja noire'],
  ['Sauce poisson', 'Sauce de poisson', 'Nuoc-mâm', 'Nam pla'],
  ['Sauce huître', 'Sauce d’huître', 'Sauce aux huîtres'],
  ['Pomme de terre', 'Patate'],
  ['Lait de coco', 'Lait de noix de coco'],
  ['Crème de coco', 'Crème de noix de coco'],
  ['Piment de Cayenne', 'Poivre de Cayenne', 'Cayenne'],
  ['Germes de soja', 'Pousses de soja', 'Pousses de haricot mungo', 'Germes de haricot mungo'],
  ['Saint-Jacques', 'St-Jacques', 'Coquille Saint-Jacques', 'Noix de Saint-Jacques'],
  ['Sucre semoule', 'Sucre en poudre', 'Sucre poudre', 'Sucre blanc', 'Sucre cristal'],
  ['Sucre roux', 'Sucre brun', 'Cassonade'],
  ['Huile neutre', 'Huile végétale', 'Huile de tournesol', 'Huile d’arachide', 'Huile de colza', 'Huile de pépins de raisin'],
  ['Huile de friture', 'Friture', 'Bain de friture', 'Huile pour friture'],
  ['Vinaigre blanc', 'Vinaigre d’alcool', 'Vinaigre cristal'],
  ['Citron vert', 'Lime'],
  ['Champignon de Paris', 'Champignon blanc', 'Champignon de couche'],
  ['Farine', 'Farine de blé', 'Farine type 55', 'Farine T55', 'Farine type 45', 'Farine T45'],
  ['Parmesan', 'Parmigiano reggiano'],
  ['Bouillon de volaille', 'Bouillon de poulet', 'Fond blanc de volaille', 'Fond de volaille'],
  ['Fond brun de veau', 'Fond de veau'],
  ['Cinq-épices', '5 épices', 'Cinq épices chinoises', '5 épices chinoises'],
];

// ───── Noms composés (fixes) ─────

/**
 * Expressions qui forment un seul ingrédient. « famille » : ingrédient plus général qu'elles contiennent
 * (« huile d'olive » est une huile ; « lait de coco » n'est pas du lait, « pomme de terre » pas une pomme).
 */
const COMPOSES: [string, string?][] = [
  ['pomme de terre'],
  ['patate douce'],
  ['chou fleur'],
  ['chou de bruxelles'],
  ['chou rave'],
  ['fécule de pomme de terre', 'fécule'],
  ['noix de coco'],
  ['lait de coco'],
  ['lait de noix de coco'],
  ['crème de coco'],
  ['crème de noix de coco'],
  ['noix de muscade'],
  ['noix de cajou'],
  ['noix de pécan'],
  ['noix de veau', 'veau'],
  ['beurre de cacahuète'],
  ['concentré de tomate'],
  ['sauce tomate'],
  ['huile d’olive', 'huile'],
  ['huile de sésame'],
  ['huile de noix'],
  ['huile de noisette'],
  ['huile de truffe'],
  ['huile pimentée'],
  ['vinaigre de vin', 'vinaigre'],
  ['vinaigre de riz', 'vinaigre'],
  ['vinaigre de cidre', 'vinaigre'],
  ['vinaigre de xérès', 'vinaigre'],
  ['vinaigre balsamique', 'vinaigre'],
  ['vin shaoxing'],
  ['petit pois'],
  ['pois chiche'],
  ['pois gourmand'],
  ['pois cassé'],
  ['eau de vie'],
  ['eau de rose'],
  ['eau de fleur d’oranger'],
  ['eau gazeuse'],
  ['sucre de palme'],
  ['sucre de coco'],
  ['poivre du sichuan'],
  ['piment de cayenne'],
  ['germe de soja'],
  ['sauce soja'],
  ['sauce poisson'],
  ['sauce huître'],
  ['pâte de crevette'],
  ['farine de riz', 'farine'],
  ['vermicelle de riz', 'vermicelle'],
  ['nouille de riz', 'nouille'],
  ['galette de riz'],
  ['feuille de riz'],
  ['fond brun de veau', 'fond brun'],
  ['fond brun de volaille', 'fond brun'],
  ['fond blanc de veau', 'fond blanc'],
  ['fond blanc de volaille', 'fond blanc'],
  ['fond brun'],
  ['fond blanc'],
  ['fumet de poisson'],
  ['bouillon de volaille', 'bouillon'],
  ['bouillon de poulet', 'bouillon'],
  ['bouillon de légume', 'bouillon'],
  ['bouillon de boeuf', 'bouillon'],
  ['5 épice'],
  ['cinq épice'],
];

/** Mots qui précisent sans identifier (préparation, taille, qualité). Les couleurs et « frais » restent. */
const PRECISIONS = new Set(
  [
    'pele', 'pelee', 'rape', 'rapee', 'hache', 'hachee', 'emince', 'emincee', 'cisele', 'ciselee', 'concasse',
    'concassee', 'coupe', 'coupee', 'tranche', 'tranchee', 'epluche', 'epluchee', 'ecrase', 'ecrasee', 'presse',
    'pressee', 'egoutte', 'egouttee', 'rince', 'rincee', 'lave', 'lavee', 'pare', 'paree', 'desosse', 'desossee',
    'denoyaute', 'denoyautee', 'epepine', 'epepinee', 'effeuille', 'effeuillee', 'blanchi', 'blanchie', 'fondu',
    'fondue', 'ramolli', 'ramollie', 'tamise', 'tamisee', 'battu', 'battue', 'mixe', 'mixee', 'pommade', 'finement',
    'grossierement', 'froid', 'froide', 'chaud', 'chaude', 'tiede', 'bouillant', 'bouillante', 'facultatif',
    'facultative', 'optionnel', 'optionnelle', 'environ', 'reduit', 'reduite', 'detaille', 'detaillee', 'lamelle',
    'segment', 'quartier', 'rondelle', 'julienne', 'brunoise', 'morceau', 'cube', 'batonnet', 'gros', 'grosse',
    'petit', 'petite', 'grand', 'grande', 'moyen', 'moyenne', 'beau', 'belle', 'bien', 'mur', 'mure', 'point', 'bon',
    'bonne', 'qualite', 'extra', 'entier', 'entiere', 'jeune', 'bio', 'maison', 'gousse', 'botte', 'brin', 'tige',
    'branche', 'poignee', 'pincee', 'cuillere', 'chair', 'ferme', 'conservation', 'type', 'garniture', 'dur', 'dure',
    'surgele', 'surgelee', 'cuit', 'cuite', 'precuit', 'precuite', 'sec', 'seche', 'seches', 'secs', 'fines',
  ].map(radical),
);

// ───── Découpage ─────

/** Mots à chercher quand on tape un nom (« Avocats mûrs » → avocat ; pas « mûr »). */
export function motsCherches(nom: string, jetons: Jetons): string[] {
  const affiches = mots(nom).filter((m) => !PRECISIONS.has(m));
  return [...new Set([...affiches, ...[...jetons].flatMap((j) => j.split('_'))])];
}

/** Mot tapé → forme cherchée (« Oignons » → oignon). */
export function motTape(mot: string): string {
  return radical(normaliser(mot));
}

/** « Olives vertes ou noires » → ["olives vertes", "olives noires"] ; enlève parenthèses et précisions. */
export function alternativesDuNom(nom: string): string[] {
  const propre = (nom ?? '')
    .replace(/\([^)]*\)?/g, ' ')
    .replace(/\s+(ou\s+)?(selon (le|les|votre|ton|vos|tes) go[uû]ts?|au go[uû]t|à volonté|de préférence|si possible|au choix).*$/i, '')
    .split(/[,;:]|\. | \+ | - | – | pour /)[0];
  const parts = propre
    .split(/\s+(?:et\/)?ou\s+/i)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (parts.length < 2) return parts;
  // « crème fleurette ou double » : l'alternative d'un seul mot remplace le dernier mot de la première.
  const premiers = parts[0].split(' ');
  return parts.map((p, i) =>
    i > 0 && !p.includes(' ') && premiers.length > 1 ? [...premiers.slice(0, -1), p].join(' ') : p,
  );
}

/** Mots normalisés d'un texte : sans accents, au singulier, sans mots vides (les chiffres restent). */
function mots(texte: string): string[] {
  return normaliser(texte)
    .replace(/[’'-]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((m) => m && !MOTS_VIDES.has(m))
    .map(radical);
}

interface Remplacement {
  motif: string[];
  par: string[];
}

/** Remplace les suites de mots connues (la plus longue d'abord), sans revenir sur un remplacement. */
function remplacer(liste: string[], regles: Remplacement[]): string[] {
  const res: string[] = [];
  for (let i = 0; i < liste.length; ) {
    const r = regles.find((x) => x.motif.every((m, k) => liste[i + k] === m));
    if (r) {
      res.push(...r.par);
      i += r.motif.length;
    } else res.push(liste[i++]);
  }
  return res;
}

const parLongueur = (a: Remplacement, b: Remplacement) => b.motif.length - a.motif.length;

const REGLES_COMPOSES: Remplacement[] = COMPOSES.map(([expr, famille]) => {
  const motif = mots(expr);
  return { motif, par: [motif.join('_'), ...(famille ? mots(famille) : [])] };
})
  .sort(parLongueur);

// La famille d'un composé peut être elle-même un composé (« fond brun de veau » → « fond brun »).
for (const r of REGLES_COMPOSES) r.par = [r.par[0], ...remplacer(r.par.slice(1), REGLES_COMPOSES.filter((x) => x !== r))];

function composes(liste: string[]): string[] {
  return remplacer(liste, REGLES_COMPOSES);
}

export type Jetons = Set<string>;

/** Traduit les noms d'ingrédients en jetons, avec une liste de synonymes donnée. */
export class Dictionnaire {
  #synonymes: Remplacement[];
  #cache = new Map<string, Jetons[]>();

  constructor(groupes: string[][] = SYNONYMES_DEFAUT) {
    const regles: Remplacement[] = [];
    for (const g of groupes) {
      const [principal, ...autres] = g.map((n) => composes(mots(n))).filter((m) => m.length);
      if (!principal) continue;
      for (const motif of autres) if (motif.join(' ') !== principal.join(' ')) regles.push({ motif, par: principal });
    }
    this.#synonymes = regles.sort(parLongueur);
  }

  /** Jetons d'un nom simple (sans « ou »). */
  jetons(nom: string): Jetons {
    const liste = remplacer(composes(mots(nom)), this.#synonymes);
    // Les nombres seuls (« 2 », « 1cm ») ne comptent pas ; « 5_epice » (composé) reste.
    return new Set(liste.filter((m) => !(/^\d/.test(m) && !m.includes('_')) && !PRECISIONS.has(m)));
  }

  /** Jetons de chaque alternative d'un nom (« ciboule ou ciboulette » → 2 ensembles) ; ensembles vides écartés. */
  alternatives(nom: string): Jetons[] {
    let r = this.#cache.get(nom);
    if (!r) {
      r = alternativesDuNom(nom)
        .map((a) => this.jetons(a))
        .filter((j) => j.size > 0);
      this.#cache.set(nom, r);
    }
    return r;
  }
}

/** Deux ingrédients se correspondent si les jetons de l'un sont tous dans l'autre. */
export function correspond(a: Jetons, b: Jetons): boolean {
  if (!a.size || !b.size) return false;
  const [petit, grand] = a.size <= b.size ? [a, b] : [b, a];
  for (const j of petit) if (!grand.has(j)) return false;
  return true;
}

/** Au moins une alternative de l'un correspond à une alternative de l'autre. */
export function correspondAlternatives(a: Jetons[], b: Jetons[]): boolean {
  return a.some((x) => b.some((y) => correspond(x, y)));
}

// ───── Synonymes sous forme de texte (édition dans les Réglages) ─────

/** Une ligne par groupe, noms séparés par des virgules (le premier est le nom principal). */
export function lireSynonymes(texte: string): string[][] {
  return texte
    .split('\n')
    .map((l) =>
      l
        .split(/[,;=]/)
        .map((n) => n.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    )
    .filter((g) => g.length >= 2);
}

export function ecrireSynonymes(groupes: string[][]): string {
  return groupes.map((g) => g.join(', ')).join('\n');
}

/** « Est-ce dans cette liste ? » (placard) : prépare les jetons de la liste une fois pour toutes. */
export function predicatListe(dico: Dictionnaire, liste: string[]): (nom: string) => boolean {
  const jetons = liste.map((n) => dico.alternatives(n)).filter((a) => a.length);
  return (nom) => {
    const alts = dico.alternatives(nom);
    return jetons.some((j) => correspondAlternatives(j, alts));
  };
}
