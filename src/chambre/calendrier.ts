// Calendrier de la chambre : cycle d'octobre à septembre, qui se répète chaque année (calendrier.json).
// Le mode prévu ne dépend que du mois et du jour.

import { CONTENU } from './donnees';
import { minuit } from './temps';
import type { IdMode, SegmentCalendrier } from './types';

export type ModeOuNettoyage = IdMode | 'nettoyage';

/** Segment du calendrier qui couvre ce jour (le dernier du mois si le jour n'est pas couvert, ex. 29 février). */
export function segmentDuJour(d: Date | string | number): SegmentCalendrier | undefined {
  const x = new Date(d);
  const segs = CONTENU.calendrier.mois[String(x.getMonth() + 1)]?.chambre ?? [];
  const jour = x.getDate();
  return segs.find((s) => s.du <= jour && jour <= s.au) ?? segs.at(-1);
}

export function modePrevu(d: Date | string | number): ModeOuNettoyage {
  return segmentDuJour(d)?.mode ?? 'pause';
}

function decaler(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Premier jour (à minuit) de la période qui contient ce jour, pendant laquelle le mode prévu ne change pas. */
export function debutPeriode(d: Date | string | number): Date {
  let jour = minuit(d);
  const m = modePrevu(jour);
  for (let i = 0; i < 400; i++) {
    const veille = decaler(jour, -1);
    if (modePrevu(veille) !== m) break;
    jour = veille;
  }
  return jour;
}

export interface Changement {
  /** Premier jour du nouveau mode (minuit). */
  le: Date;
  de: ModeOuNettoyage;
  vers: ModeOuNettoyage;
  segment: SegmentCalendrier;
}

/** Prochains changements de mode prévus après ce jour. */
export function prochainsChangements(d: Date | string | number, combien = 1): Changement[] {
  const res: Changement[] = [];
  let jour = minuit(d);
  let courant = modePrevu(jour);
  for (let i = 0; i < 400 && res.length < combien; i++) {
    jour = decaler(jour, 1);
    const m = modePrevu(jour);
    if (m !== courant) {
      res.push({ le: jour, de: courant, vers: m, segment: segmentDuJour(jour)! });
      courant = m;
    }
  }
  return res;
}

/** Changement de mode prévu ce jour-là (le mode de la veille est différent). */
export function changementDuJour(d: Date | string | number): Changement | undefined {
  const jour = minuit(d);
  const veille = modePrevu(decaler(jour, -1));
  const m = modePrevu(jour);
  return m !== veille ? { le: jour, de: veille, vers: m, segment: segmentDuJour(jour)! } : undefined;
}

/** Après un jour de nettoyage, le mode qui suit (pour l'afficher pendant ce jour-là). */
export function modeApresNettoyage(d: Date | string | number): IdMode {
  for (const c of prochainsChangements(d, 3)) if (c.vers !== 'nettoyage') return c.vers;
  return 'pause';
}

/** Mode prévu avant la période qui contient ce jour (en sautant les jours de nettoyage). */
export function modeAvant(d: Date | string | number): IdMode {
  let jour = debutPeriode(d);
  for (let i = 0; i < 5; i++) {
    jour = decaler(jour, -1);
    const m = modePrevu(jour);
    if (m !== 'nettoyage') return m;
    jour = debutPeriode(jour);
  }
  return 'pause';
}
