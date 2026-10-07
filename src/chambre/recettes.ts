// Recettes de la chambre : calculateur, saison, contrôles (technique puis recette), durées lisibles.

import { nombre } from '../lib/format';
import { CONTENU } from './donnees';
import type { Controle, IngredientChambre, RecetteChambre } from './types';

// ───── Calculateur ─────

/** Unités comptées : recalculées à la demi-unité près, avec « environ ». [singulier, pluriel] */
const COMPTEES: Record<string, [string, string]> = {
  pièce: ['pièce', 'pièces'],
  pièces: ['pièce', 'pièces'],
  gousse: ['gousse', 'gousses'],
  gousses: ['gousse', 'gousses'],
  brin: ['brin', 'brins'],
  brins: ['brin', 'brins'],
  bouquet: ['bouquet', 'bouquets'],
  bouquets: ['bouquet', 'bouquets'],
  citron: ['citron', 'citrons'],
  citrons: ['citron', 'citrons'],
  bloc: ['bloc', 'blocs'],
  blocs: ['bloc', 'blocs'],
  pincée: ['pincée', 'pincées'],
  pincées: ['pincée', 'pincées'],
  cm: ['cm', 'cm'],
};

export interface LigneCalculee {
  nom: string;
  /** « 1 300 g », « environ 2,5 gousses ». */
  quantite: string;
  valeur: number;
  unite: string;
  environ: boolean;
  note?: string;
}

/** Arrondi des grammes : au gramme, au dixième sous 10 g. */
export function arrondiGrammes(g: number): number {
  return g < 10 ? Math.round(g * 10) / 10 : Math.round(g);
}

export function quantiteCalculee(ing: IngredientChambre, coef: number): LigneCalculee {
  const brut = ing.qte * coef;
  const comptee = COMPTEES[ing.unite];
  if (comptee) {
    const valeur = Math.max(0.5, Math.round(brut * 2) / 2);
    const environ = coef !== 1;
    const unite = valeur >= 2 ? comptee[1] : comptee[0];
    return {
      nom: ing.nom,
      valeur,
      unite,
      environ,
      note: ing.note,
      quantite: `${environ ? 'environ ' : ''}${nombre(valeur, 1)} ${unite}`,
    };
  }
  const valeur = ing.unite === 'g' ? arrondiGrammes(brut) : Math.round(brut * 10) / 10;
  return { nom: ing.nom, valeur, unite: ing.unite, environ: false, note: ing.note, quantite: `${nombre(valeur, 1)} ${ing.unite}` };
}

/** Toutes les quantités pour un poids réel de la base (dans l'unité de la base). */
export function calculer(r: RecetteChambre, quantiteBase: number): LigneCalculee[] {
  const coef = quantiteBase > 0 ? quantiteBase / r.base.quantite : 1;
  return r.ingredients.map((i) => quantiteCalculee(i, coef));
}

// ───── Saison ─────

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nomMois = (m: number) => NOMS_MOIS[m - 1];
export const NomMois = (m: number) => nomMois(m).charAt(0).toUpperCase() + nomMois(m).slice(1);

/** Rang d'un mois dans le cycle (octobre = 0 … septembre = 11). */
export const rangDansLeCycle = (m: number) => CONTENU.calendrier.cycle.indexOf(m);

/**
 * Fenêtres de mois consécutifs, dans l'ordre du cycle, qui est circulaire : [9, 10] est une seule fenêtre
 * (septembre puis octobre). Chaque fenêtre est rangée du premier au dernier mois.
 */
export function fenetres(mois: number[]): number[][] {
  const cycle = CONTENU.calendrier.cycle;
  const dans = new Set(mois);
  if (dans.size === 12) return [cycle.slice()];
  // On part d'un mois absent : aucune fenêtre ne peut alors chevaucher le point de départ.
  const depart = cycle.findIndex((m) => !dans.has(m));
  const res: number[][] = [];
  let courante: number[] = [];
  for (let k = 1; k <= 12; k++) {
    const m = cycle[(depart + k) % 12];
    if (dans.has(m)) courante.push(m);
    else if (courante.length) {
      res.push(courante);
      courante = [];
    }
  }
  if (courante.length) res.push(courante);
  return res.sort((a, b) => rangDansLeCycle(a[0]) - rangDansLeCycle(b[0]));
}

export type Repere = 'ce-mois' | 'dernier-mois';

/** « À faire ce mois-ci » si la fenêtre ne dure qu'un mois, « Dernier mois » à la fin d'une fenêtre plus longue. */
export function repereDuMois(r: RecetteChambre, m: number): Repere | undefined {
  const f = fenetres(r.mois ?? []).find((x) => x.includes(m));
  if (!f) return undefined;
  if (f.length === 1) return 'ce-mois';
  return f.at(-1) === m ? 'dernier-mois' : undefined;
}

/** « Octobre et avril », « Novembre à février », « Toute l'année ». */
export function saison(r: RecetteChambre): string {
  if (r.toute_annee) return 'Toute l’année';
  const parts = fenetres(r.mois ?? []).map((f) => (f.length === 1 ? nomMois(f[0]) : `${nomMois(f[0])} à ${nomMois(f.at(-1)!)}`));
  const texte = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}` : (parts[0] ?? '');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function deSaison(r: RecetteChambre, m: number): boolean {
  return !!r.mois?.includes(m);
}

// ───── Contrôles ─────

export interface ControleRecette {
  controle: Controle;
  source: 'technique' | 'recette';
  /**
   * Point de départ des jours : le début du lot, ou l'entrée en Cave pour les pesées et la surface des recettes
   * salées d'abord au froid ou étuvées (coppa, saucisson…), dont la perte de poids se compte depuis la Cave.
   */
  ancre: 'debut' | 'cave';
}

/** Index de la phase en Cave qui suit une première phase (salage, étuvage), s'il y en a une. */
export function phaseCave(r: RecetteChambre): number {
  return (r.phases ?? []).findIndex((p, i) => i > 0 && p.mode === 'cave');
}

const estPh = (c: Controle) => /\bpH\b/.test(`${c.titre} ${c.observer}`);
const estPeseeOuSurface = (c: Controle) => /pes[ée]e|surface/i.test(c.titre);

/** Contrôles de la technique puis ceux de la recette, chacun avec son point de départ, triés par jour. */
export function controlesDeLaRecette(r: RecetteChambre): ControleRecette[] {
  const cave = phaseCave(r) >= 0;
  const technique = r.technique ? (CONTENU.techniques[r.technique]?.controles ?? []) : [];
  const res: ControleRecette[] = [
    ...technique.map((controle) => ({
      controle,
      source: 'technique' as const,
      ancre: (cave && estPeseeOuSurface(controle) && !estPh(controle) ? 'cave' : 'debut') as ControleRecette['ancre'],
    })),
    ...r.controles.map((controle) => ({ controle, source: 'recette' as const, ancre: 'debut' as const })),
  ];
  // Tri stable : technique avant recette à jour égal.
  return res
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.ancre === b.c.ancre ? a.c.controle.j - b.c.controle.j : a.c.ancre === 'debut' ? -1 : 1) || a.i - b.i)
    .map(({ c }) => c);
}

/** « 18 h », « jour 2 », « jour 1 + 3 h ». */
export function libelleJour(j: number): string {
  if (j === 0) return 'au départ';
  if (j < 1) return `${nombre(Math.round(j * 24 * 10) / 10, 1)} h`;
  const entiers = Math.trunc(j);
  const heures = Math.round((j - entiers) * 24);
  return heures ? `jour ${entiers} + ${heures} h` : `jour ${entiers}`;
}

/** « puis tous les 7 jours », « toutes les 12 h jusqu'au jour 2 ». */
export function libelleRepetition(c: Controle): string {
  if (!c.repeter_j) return '';
  const r = c.repeter_j;
  const rythme = r < 1 ? `toutes les ${nombre(r * 24)} h` : r === 1 ? 'chaque jour' : `tous les ${nombre(r)} jours`;
  return c.fin_j ? `${rythme} jusqu’au jour ${nombre(c.fin_j)}` : rythme;
}

// ───── Durées, pH ─────

/** Durée lisible : « 45 min », « 8 à 12 h », « 2 jours », « 10 semaines », « 6 à 12 mois ». */
export function dureeLisible(min: number, max = min): string {
  // Moins de 3 jours, pas en jours entiers (koji : 1,7 à 2,1 jours) : en heures.
  if (max >= 1 && max <= 3 && !(Number.isInteger(min) && Number.isInteger(max)))
    return min === max ? `${Math.round(min * 24)}\u00a0h` : `${Math.round(min * 24)} à ${Math.round(max * 24)}\u00a0h`;
  if (max < 1) {
    const h = (j: number) => j * 24;
    if (h(max) < 1.5) return min === max ? `${Math.round(h(min) * 60)} min` : `${Math.round(h(min) * 60)} à ${Math.round(h(max) * 60)} min`;
    return min === max ? `${nombre(h(min), 1)} h` : `${nombre(h(min), 1)} à ${nombre(h(max), 1)} h`;
  }
  if (min >= 150) return min === max ? `${nombre(min / 30, 0)} mois` : `${nombre(min / 30, 0)} à ${nombre(max / 30, 0)} mois`;
  if (min >= 14 && min % 7 === 0 && max % 7 === 0) return min === max ? `${min / 7} semaines` : `${min / 7} à ${max / 7} semaines`;
  const j = (x: number) => nombre(x, 1);
  return min === max ? `${j(min)} ${min >= 2 ? 'jours' : 'jour'}` : `${j(min)} à ${j(max)} jours`;
}

export interface CiblePh {
  valeur: number;
  texte: string;
}

/**
 * Cible de pH d'un lot : celle de la recette (fin « ph »), 5,3 en 48 h pour le saucisson, 4,2 avant une
 * conservation longue pour les lacto et les sauces (fiche du pH-mètre, modes.json). Pas de cible pour les vinaigres.
 */
export function cibleDuPh(r: RecetteChambre): CiblePh | undefined {
  if (r.fin.type === 'ph' && r.fin.cible !== undefined) return { valeur: r.fin.cible, texte: `${nombre(r.fin.cible)} ou moins` };
  if (r.technique === 'saucisson') return { valeur: 5.3, texte: '5,3 ou moins en 48 h (72 h au plus)' };
  if (r.famille === 'lacto') return { valeur: 4.2, texte: '4,2 ou moins avant une conservation longue' };
  return undefined;
}

export const DIFFICULTES = ['', 'Facile', 'Moyenne', 'Difficile'];
