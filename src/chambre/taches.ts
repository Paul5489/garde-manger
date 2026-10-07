// Mode actif de la chambre et tâches d'entretien qui reviennent (réservoir, vérification de la semaine,
// calibrage des sondes, étalonnage du pH-mètre, sauvegarde du mois).

import { debutPeriode, modeApresNettoyage, modePrevu, type ModeOuNettoyage } from './calendrier';
import { mode as modeParId } from './donnees';
import { joursCalendaires } from './temps';
import type { IdMode, Mode } from './types';

/** Mode choisi à la main (il reste jusqu'au prochain changement de mode, ou au retour au calendrier). */
export interface ModeManuel {
  mode: IdMode;
  /** Date du choix (ISO). */
  le: string;
}

export interface ModeActif {
  id: ModeOuNettoyage;
  /** Absent un jour de nettoyage. */
  mode?: Mode;
  manuel: boolean;
  /** Début de ce mode (minuit du premier jour prévu, ou date du choix à la main). */
  depuis: Date;
  /** Ce que prévoit le calendrier aujourd'hui (utile si le mode a été choisi à la main). */
  prevu: ModeOuNettoyage;
  /** Un jour de nettoyage : le mode qui suit. */
  apres?: IdMode;
}

export function modeActif(maintenant: Date | number, manuel: ModeManuel | null): ModeActif {
  const prevu = modePrevu(maintenant);
  if (manuel) return { id: manuel.mode, mode: modeParId(manuel.mode), manuel: true, depuis: new Date(manuel.le), prevu };
  const depuis = debutPeriode(maintenant);
  if (prevu === 'nettoyage') return { id: prevu, manuel: false, depuis, prevu, apres: modeApresNettoyage(maintenant) };
  return { id: prevu, mode: modeParId(prevu), manuel: false, depuis, prevu };
}

export type Tache = 'reservoir' | 'verification' | 'calibrage' | 'etalonnage-ph';
/** Dernière fois que chaque tâche a été faite (ISO). */
export type DatesTaches = Partial<Record<Tache, string>>;

/** Durée de la « vague » de Cave : réservoir tous les 3 jours et IHC à 80 % pendant 3 semaines après une entrée. */
export const VAGUE_CAVE_J = 21;

/**
 * Rythme du réservoir du déshumidificateur, en jours (null : débranché).
 * En Cave, « tous les 3 jours pendant les 3 premières semaines d'une vague, puis chaque semaine ».
 */
export function rythmeReservoir(m: Mode, maintenant: Date | number, debutVague?: Date | string): number | null {
  const n = m.reservoir.tous_les_j;
  if (n === null) return null;
  if (m.id === 'cave') return debutVague && joursCalendaires(debutVague, maintenant) < VAGUE_CAVE_J ? n : 7;
  return n;
}

/** Phase de l'IHC en Cave : la première (80 %) pendant 3 semaines après une entrée, la seconde ensuite. */
export function phaseIhcCave(maintenant: Date | number, debutVague?: Date | string): 0 | 1 {
  return debutVague && joursCalendaires(debutVague, maintenant) < VAGUE_CAVE_J ? 0 : 1;
}

export interface EtatTache {
  tache: Tache;
  /** À faire aujourd'hui (ou en retard). */
  due: boolean;
  /** Jours depuis la dernière fois (ou depuis le début du mode). */
  depuis: number;
  /** Tous les combien de jours. */
  rythme: number;
}

function etat(tache: Tache, rythme: number, base: Date | string | undefined, maintenant: Date | number): EtatTache {
  const depuis = base ? joursCalendaires(base, maintenant) : Infinity;
  return { tache, due: depuis >= rythme, depuis, rythme };
}

const plusRecente = (...dates: (Date | string | undefined)[]) =>
  dates.filter((d): d is Date | string => !!d).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

export interface Contexte {
  maintenant: Date | number;
  actif: ModeActif;
  faites: DatesTaches;
  /** Dernière entrée d'un produit en Cave (lot ou changement de mode). */
  debutVague?: Date | string;
  /** Mise en service terminée (calibrage et étalonnage comptent depuis elle). */
  miseEnService: boolean;
}

/** Tâches d'entretien du jour (seulement celles qui s'appliquent au mode actif). */
export function tachesDuJour(c: Contexte): EtatTache[] {
  const res: EtatTache[] = [];
  const m = c.actif.mode;
  if (m) {
    const r = rythmeReservoir(m, c.maintenant, c.debutVague ?? c.actif.depuis);
    // Le jour d'un changement de mode, le nettoyage vide le réservoir : on compte depuis le début du mode.
    if (r !== null) res.push(etat('reservoir', r, plusRecente(c.faites.reservoir, c.actif.depuis), c.maintenant));
    if (m.id !== 'pause') res.push(etat('verification', 7, plusRecente(c.faites.verification, c.actif.depuis), c.maintenant));
  }
  if (c.miseEnService) {
    if (c.faites.calibrage) res.push(etat('calibrage', 365, c.faites.calibrage, c.maintenant));
    if (c.faites['etalonnage-ph']) res.push(etat('etalonnage-ph', 30, c.faites['etalonnage-ph'], c.maintenant));
  }
  return res;
}
