// Lots de la chambre : calendrier des phases et des contrôles, perte de poids, pH, stock.
// Un lot garde une copie de sa recette et de sa technique : ses dates ne changent pas si les données changent.

import { nombre } from '../lib/format';
import { cibleDuPh, controlesDeLaRecette, delaiPhJeter, phaseCave, PH_JETER, type CiblePh, type ControleRecette } from './recettes';
import { aHeure, apres, joursCalendaires } from './temps';
import type {
  ArticleStock,
  Congelation,
  Conservation,
  Controle,
  ControleCoche,
  EtapeReglage,
  IdMode,
  Lot,
  MesurePh,
  RecetteChambre,
  Technique,
} from './types';

const JOUR = 86_400_000;

export interface NouveauLot {
  entree: Date;
  quantiteBase: number;
  poidsEntree?: number;
  notes?: string;
}

export function nouveauLot(r: RecetteChambre, technique: Technique | undefined, n: NouveauLot, id: string): Lot {
  const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return {
    id,
    recetteId: r.id,
    recette: copie(r),
    technique: technique ? copie(technique) : undefined,
    nom: r.nom,
    entree: n.entree.toISOString(),
    quantiteBase: n.quantiteBase,
    poidsEntree: n.poidsEntree,
    notes: n.notes?.trim() || undefined,
    phases: (r.phases ?? []).map(() => ({})),
    phaseCourante: 0,
    controles: {},
    pesees: [],
    ph: [],
    statut: 'en-cours',
    modifieLe: Date.now(),
  };
}

// ───── Phases et fin ─────

export interface DebutsPhases {
  /** Début au plus tôt (réel, ou estimé avec les durées minimales). */
  min: Date[];
  /** Début au plus tard (réel, ou estimé avec les durées maximales). */
  max: Date[];
  reel: boolean[];
}

export function debutsDesPhases(lot: Lot): DebutsPhases {
  const phases = lot.recette.phases ?? [];
  const entree = new Date(lot.entree);
  if (!phases.length) return { min: [entree], max: [entree], reel: [true] };
  const d: DebutsPhases = { min: [], max: [], reel: [] };
  phases.forEach((p, i) => {
    const reel = i === 0 ? lot.entree : lot.phases[i]?.debut;
    if (reel) {
      d.min.push(new Date(reel));
      d.max.push(new Date(reel));
      d.reel.push(true);
    } else {
      d.min.push(apres(d.min[i - 1], phases[i - 1].min_j));
      d.max.push(apres(d.max[i - 1], phases[i - 1].max_j));
      d.reel.push(false);
    }
  });
  return d;
}

/** Fin prévue du lot : au plus tôt, au plus tard. */
export function finPrevue(lot: Lot): { min: Date; max: Date } {
  const phases = lot.recette.phases ?? [];
  if (!phases.length) return { min: apres(lot.entree, lot.recette.duree.min_j), max: apres(lot.entree, lot.recette.duree.max_j) };
  const d = debutsDesPhases(lot);
  const n = phases.length - 1;
  return { min: apres(d.min[n], phases[n].min_j), max: apres(d.max[n], phases[n].max_j) };
}

/** Mode de la chambre dont le lot a besoin en ce moment (null : hors de la chambre). */
export function modeDuLot(lot: Lot): IdMode | null {
  const phases = lot.recette.phases;
  if (phases?.length) return phases[lot.phaseCourante]?.mode ?? null;
  return lot.recette.lieu === 'chambre' ? lot.recette.mode : null;
}

// ───── Contrôles ─────

export type TypeOccurrence = 'controle' | 'pesee' | 'ph';

export interface Occurrence {
  /** Clé stable de l'occurrence : « technique:2:0 » (source, rang du contrôle, répétition). */
  cle: string;
  serie: string;
  controle: Controle;
  source: ControleRecette['source'];
  ancre: ControleRecette['ancre'];
  k: number;
  quand: Date;
  /** À l'heure exacte (koji, pH à 48 et 72 h), sinon à l'heure des rappels. */
  exacte: boolean;
  type: TypeOccurrence;
  coche?: ControleCoche;
}

const estPh = (c: Controle) => /\bpH\b/.test(`${c.titre} ${c.observer}`);
const estPesee = (c: Controle) => /pes[ée]e/i.test(c.titre);

/** Tous les contrôles du lot, répétitions comprises, dans l'ordre des dates. */
export function occurrences(lot: Lot, heureRappels = 8): Occurrence[] {
  const r = lot.recette;
  const liste = controlesDeLaRecette(r, lot.technique);
  const debuts = debutsDesPhases(lot);
  const iCave = phaseCave(r);
  const finLot = lot.finLe ? new Date(lot.finLe) : finPrevue(lot).max;
  const courte = r.duree.max_j <= 3;
  const res: Occurrence[] = [];
  liste.forEach((c, i) => {
    const ct = c.controle;
    const ancre = c.ancre === 'cave' && iCave >= 0 ? debuts.min[iCave] : new Date(lot.entree);
    const type: TypeOccurrence = estPh(ct) ? 'ph' : estPesee(ct) ? 'pesee' : 'controle';
    const exacte =
      courte || ct.j === 0 || !Number.isInteger(ct.j) || (ct.repeter_j !== undefined && !Number.isInteger(ct.repeter_j)) || type === 'ph';
    const finSerie = ct.fin_j !== undefined ? apres(ancre, ct.fin_j) : finLot;
    const serie = `${c.source}:${i}`;
    for (let k = 0; k < 800; k++) {
      let quand = apres(ancre, ct.j + (ct.repeter_j ?? 0) * k);
      if (!exacte) quand = aHeure(quand, heureRappels);
      if (k > 0 && quand > finSerie) break;
      const cle = `${serie}:${k}`;
      res.push({ cle, serie, controle: ct, source: c.source, ancre: c.ancre, k, quand, exacte, type, coche: lot.controles[cle] });
      if (!ct.repeter_j) break;
    }
  });
  return res.sort((a, b) => a.quand.getTime() - b.quand.getTime());
}

function finDuJour(d: Date | number): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/**
 * Contrôles à faire aujourd'hui (ou en retard), non cochés. Pour un contrôle qui se répète, seulement la dernière
 * occurrence due. Les contrôles comptés depuis l'entrée en Cave attendent que le lot y soit entré.
 */
export function aFaire(lot: Lot, maintenant: Date | number, heureRappels = 8): Occurrence[] {
  if (lot.statut !== 'en-cours') return [];
  const iCave = phaseCave(lot.recette);
  const enCave = iCave < 0 || lot.phaseCourante >= iCave;
  const limite = finDuJour(maintenant);
  const dues = occurrences(lot, heureRappels).filter((o) => !o.coche && o.quand <= limite && (o.ancre !== 'cave' || enCave));
  const derniere = new Map<string, Occurrence>();
  for (const o of dues) derniere.set(o.serie, o);
  return [...derniere.values()].sort((a, b) => a.quand.getTime() - b.quand.getTime());
}

/** Prochains contrôles (après maintenant), non cochés. */
export function aVenir(lot: Lot, maintenant: Date | number, combien = 5, heureRappels = 8): Occurrence[] {
  const limite = finDuJour(maintenant);
  return occurrences(lot, heureRappels)
    .filter((o) => !o.coche && o.quand > limite)
    .slice(0, combien);
}

// ───── Perte de poids ─────

export interface Reference {
  g: number;
  le: Date;
}

/** Poids de référence : à l'entrée en Cave pour les recettes à phases, sinon à l'entrée du lot. */
export function referencePoids(lot: Lot): Reference | undefined {
  const iCave = phaseCave(lot.recette);
  if (iCave >= 0) {
    const p = lot.phases[iCave];
    return p?.poids && p.debut ? { g: p.poids, le: new Date(p.debut) } : undefined;
  }
  return lot.poidsEntree ? { g: lot.poidsEntree, le: new Date(lot.entree) } : undefined;
}

export interface Perte {
  reference: Reference;
  /** Points de la courbe : jours depuis la référence, perte en %. */
  points: { jours: number; pct: number; le: Date; g: number }[];
  pct: number;
  cible?: number;
  atteinte: boolean;
  /** Date où la cible devrait être atteinte, d'après la tendance des dernières pesées. */
  finEstimee?: Date;
}

/** Pente (perte en % par jour) par moindres carrés sur les derniers points. */
function pente(points: { jours: number; pct: number }[]): number | undefined {
  if (points.length < 2) return undefined;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.jours, 0) / n;
  const my = points.reduce((s, p) => s + p.pct, 0) / n;
  const num = points.reduce((s, p) => s + (p.jours - mx) * (p.pct - my), 0);
  const den = points.reduce((s, p) => s + (p.jours - mx) ** 2, 0);
  return den ? num / den : undefined;
}

export function perteDePoids(lot: Lot): Perte | undefined {
  const reference = referencePoids(lot);
  if (!reference) return undefined;
  const cible = lot.recette.fin.type === 'perte_poids' ? lot.recette.fin.cible : undefined;
  const points = [
    { jours: 0, pct: 0, le: reference.le, g: reference.g },
    ...lot.pesees
      .filter((p) => new Date(p.le) >= reference.le)
      .sort((a, b) => a.le.localeCompare(b.le))
      .map((p) => ({ jours: (new Date(p.le).getTime() - reference.le.getTime()) / JOUR, pct: ((reference.g - p.g) / reference.g) * 100, le: new Date(p.le), g: p.g })),
  ];
  const dernier = points.at(-1)!;
  const atteinte = cible !== undefined && points.length > 1 && dernier.pct >= cible;
  let finEstimee: Date | undefined;
  if (cible !== undefined && !atteinte) {
    const p = pente(points.slice(-4));
    if (p && p > 0.01) finEstimee = new Date(reference.le.getTime() + (dernier.jours + (cible - dernier.pct) / p) * JOUR);
  }
  return { reference, points, pct: dernier.pct, cible, atteinte, finEstimee };
}

// ───── pH ─────

export const PH_SAUCISSON = 5.3;
export const MESSAGE_PH_BLOQUE = 'Ne pas sécher : cuire en saucisses fraîches dans les 24 h, ou jeter.';

export const MESSAGE_PH_JETER = 'Jeter, sans goûter.';

export interface EtatPh {
  cible?: CiblePh;
  derniere?: MesurePh;
  /** Saucisson : pH encore au-dessus de 5,3 à 72 h. */
  bloque: boolean;
  /** Lacto : pH encore au-dessus de 4,6 après le délai de fermentation (7 jours, 5 pour les kimchis). */
  jeter: boolean;
  /** Dernière mesure à la cible ou en dessous. */
  atteinte: boolean;
  peutPasserEnCave: boolean;
  message?: string;
}

const parDate = (a: MesurePh, b: MesurePh) => a.le.localeCompare(b.le);

export function etatPh(lot: Lot): EtatPh {
  const mesures = [...lot.ph].sort(parDate);
  const derniere = mesures.at(-1);
  const cible = cibleDuPh(lot.recette);
  if (lot.recette.technique !== 'saucisson') {
    const base = { cible, derniere, bloque: false, jeter: false, atteinte: false, peutPasserEnCave: true };
    if (!derniere || !cible || cible.valeur === null) return base;
    const jours = (new Date(derniere.le).getTime() - new Date(lot.entree).getTime()) / JOUR;
    if (derniere.valeur > PH_JETER && jours >= delaiPhJeter(lot.recette))
      return { ...base, jeter: true, message: `pH encore au-dessus de 4,6 après ${delaiPhJeter(lot.recette)} jours : ${MESSAGE_PH_JETER.toLowerCase()}` };
    if (derniere.valeur > cible.valeur)
      return { ...base, message: `Au-dessus de ${nombre(cible.valeur)} : pas encore, laisse fermenter et remesure.` };
    return { ...base, atteinte: true, message: `${nombre(cible.valeur)} ou moins : c'est bon${lot.recette.ph?.quand ? ` (${lot.recette.ph.quand})` : ''}.` };
  }
  const a72 = mesures.filter((m) => m.moment === '72h').at(-1);
  const base = { cible, derniere, jeter: false };
  if (a72 && a72.valeur > PH_SAUCISSON) return { ...base, bloque: true, atteinte: false, peutPasserEnCave: false, message: MESSAGE_PH_BLOQUE };
  const apresDepart = mesures.filter((m) => m.moment !== 'depart').at(-1);
  if (!apresDepart)
    return { ...base, bloque: false, atteinte: false, peutPasserEnCave: false, message: 'Mesure le pH à 48 h : 5,3 ou moins pour passer en Cave.' };
  if (apresDepart.valeur > PH_SAUCISSON)
    return {
      ...base,
      bloque: false,
      atteinte: false,
      peutPasserEnCave: false,
      message: 'pH encore au-dessus de 5,3 : prolonge l’étuvage et remesure à 72 h.',
    };
  return { ...base, bloque: false, atteinte: true, peutPasserEnCave: true };
}

/** Moment proposé pour une mesure de pH d'un saucisson, d'après le temps écoulé depuis l'entrée. */
export function momentPropose(lot: Lot, quand: Date | number): MesurePh['moment'] {
  if (lot.recette.technique !== 'saucisson') return 'libre';
  const h = (new Date(quand).getTime() - new Date(lot.entree).getTime()) / 3_600_000;
  if (h < 24) return 'depart';
  if (h < 60) return '48h';
  return '72h';
}

/** La phase suivante peut-elle commencer ? (Saucisson : jamais en Cave sans pH à 5,3 ou moins.) */
export function passageSuivant(lot: Lot): { possible: boolean; raison?: string } {
  const phases = lot.recette.phases ?? [];
  const suivante = phases[lot.phaseCourante + 1];
  if (!suivante || lot.statut !== 'en-cours') return { possible: false };
  if (lot.recette.technique === 'saucisson' && suivante.mode === 'cave') {
    const e = etatPh(lot);
    return e.peutPasserEnCave ? { possible: true } : { possible: false, raison: e.message };
  }
  return { possible: true };
}

/** Le poids est-il demandé en entrant dans cette phase ? (Perte de poids comptée depuis l'entrée en Cave.) */
export function poidsDemande(r: RecetteChambre, indexPhase: number): boolean {
  return r.fin.type === 'perte_poids' && indexPhase === phaseCave(r);
}

/** Dernière entrée d'un produit en Cave parmi les lots en cours (début d'une « vague »). */
export function debutVagueCave(lots: Lot[]): Date | undefined {
  let res: Date | undefined;
  for (const l of lots) {
    if (l.statut !== 'en-cours') continue;
    const iCave = phaseCave(l.recette);
    const d = iCave >= 0 ? l.phases[iCave]?.debut : l.recette.mode === 'cave' && l.recette.lieu === 'chambre' ? l.entree : undefined;
    if (d && (!res || new Date(d) > res)) res = new Date(d);
  }
  return res;
}

// ───── Stock ─────

export function dateLimite(depuis: Date | string, c: Conservation): string | undefined {
  return c.jours > 0 ? apres(depuis, c.jours).toISOString() : undefined;
}

export type EtatStock = 'ok' | 'bientot' | 'depasse' | 'sans-date';

/** Alerte 7 jours avant la date limite. */
export function etatStock(a: ArticleStock, maintenant: Date | number): EtatStock {
  if (!a.limite) return 'sans-date';
  const j = joursCalendaires(maintenant, a.limite);
  if (j < 0) return 'depasse';
  return j <= 7 ? 'bientot' : 'ok';
}

// ───── Réglages de la chambre, étape par étape ─────

export interface ReglageDuLot {
  index: number;
  /** Clé de l'étape cochée dans `lot.controles` (« reglage:2 »). */
  cle: string;
  etape: EtapeReglage;
  /** Date de l'étape (absente pour une étape rattachée à une étape de la recette, sans jour). */
  quand?: Date;
  exacte: boolean;
  /** Phase de la recette pendant laquelle tombe l'étape (0 sans phases). */
  phase: number;
  /** Étape d'entrée dans cette phase (ex. « Entrée en mode Cave »). */
  entree: boolean;
  coche?: ControleCoche;
}

/** Jour (dans les réglages) de l'entrée dans chaque phase après la première : 1re étape datée dans le mode de la phase. */
function joursEntreePhases(r: RecetteChambre): (number | undefined)[] {
  const etapes = r.reglages?.etapes ?? [];
  return (r.phases ?? []).map((p, k) => (k === 0 || !p.mode ? undefined : (etapes.find((e) => e.j !== null && e.mode === p.mode)?.j ?? undefined)));
}

/** Rang de l'étape de réglage qui marque l'entrée dans la phase k (pour la cocher au passage de phase). */
export function indexEntreeReglage(r: RecetteChambre, k: number): number {
  const j = joursEntreePhases(r)[k];
  const mode = r.phases?.[k]?.mode;
  return j === undefined ? -1 : (r.reglages?.etapes ?? []).findIndex((e) => e.j === j && e.mode === mode);
}

/**
 * Dates des réglages d'un lot. Une étape tombée pendant une phase suivante (Cave après le salage ou l'étuvage) se
 * compte depuis la vraie entrée dans cette phase, quand elle est notée (sinon depuis le jour prévu par la recette).
 */
export function reglagesDuLot(lot: Lot, heureRappels = 8): ReglageDuLot[] {
  const r = lot.recette;
  const etapes = r.reglages?.etapes ?? [];
  const entrees = joursEntreePhases(r);
  const courte = r.duree.max_j <= 3;
  return etapes.map((e, index) => {
    const cle = `reglage:${index}`;
    const coche = lot.controles[cle];
    if (e.j === null) return { index, cle, etape: e, exacte: false, phase: 0, entree: false, coche };
    let phase = 0;
    for (let k = entrees.length - 1; k >= 1; k--)
      if (entrees[k] !== undefined && e.j >= entrees[k]!) {
        phase = k;
        break;
      }
    const jEntree = phase ? entrees[phase]! : 0;
    const debutReel = phase ? lot.phases[phase]?.debut : lot.entree;
    const base = debutReel ? new Date(debutReel) : apres(lot.entree, jEntree);
    let quand = apres(base, e.j - jEntree);
    const exacte = courte || e.j === 0 || !Number.isInteger(e.j) || (!!phase && !!lot.phases[phase]?.debut && e.j === jEntree);
    if (!exacte) quand = aHeure(quand, heureRappels);
    return { index, cle, etape: e, quand, exacte, phase, entree: !!phase && e.j === jEntree, coche };
  });
}

/**
 * Réglages à faire aujourd'hui (ou en retard) sur la chambre : étapes datées, dans un mode de la chambre, non cochées.
 * Celles du démarrage se font en lançant le lot ; une entrée de phase attend que le passage soit possible (pH du
 * saucisson) ; les étapes d'une phase suivante attendent que le lot y soit entré.
 */
export function reglagesAFaire(lot: Lot, maintenant: Date | number, heureRappels = 8): ReglageDuLot[] {
  if (lot.statut !== 'en-cours') return [];
  const limite = finDuJour(maintenant);
  return reglagesDuLot(lot, heureRappels).filter((g) => {
    if (g.coche || !g.quand || !g.etape.mode || g.etape.j === 0 || g.quand > limite) return false;
    if (g.entree) return lot.phaseCourante === g.phase - 1 && passageSuivant(lot).possible;
    return lot.phaseCourante >= g.phase;
  });
}

// ───── Congélation ─────

/** Congélation d'un produit du stock : sa copie, sinon celle de la recette. */
export function congelationDuStock(a: ArticleStock, r?: RecetteChambre): Congelation | undefined {
  return a.congelation ?? r?.congelation;
}

/** Conservation « Congélateur » d'un produit (celle de la recette, sinon d'après sa congélation), si c'est possible. */
export function conservationCongelateur(a: ArticleStock, r?: RecetteChambre): Conservation | undefined {
  const c = congelationDuStock(a, r);
  if (c?.possible !== 'oui') return undefined;
  const ligne = r?.conservation.find((x) => x.mode === 'Congélateur');
  if (ligne) return { ...ligne };
  return { mode: 'Congélateur', comment: c.texte, duree: c.duree ?? '', jours: c.jours ?? 0 };
}
