// Mise en forme des réglages de la chambre : codes des contrôleurs, prises, couleurs des modes.

import { nombre } from '../lib/format';
import { insecables } from '../lib/texte';
import { CONTENU } from './donnees';
import type { CodeIhc, CodeItc, Mode, Prise } from './types';

export type Appareil = 'itc' | 'ihc';

const UNITES: Record<Appareil, Record<string, string>> = {
  itc: { TS: '°C', HD: '°C', CD: '°C', AH: '°C', AL: '°C', PT: 'min', CA: '°C', CF: '' },
  ihc: { HS: '%', HD: '%', DD: '%', AH: '%', AL: '%', PT: 'min', CA: '%' },
};

/** « 32 °C », « 10 min », « 85 % », « C ». */
export function valeurCode(appareil: Appareil, code: CodeItc | CodeIhc, v: number | string): string {
  const unite = UNITES[appareil][code];
  const texte = typeof v === 'number' ? nombre(v, 1) : v;
  return unite ? `${texte} ${unite}` : texte;
}

export function glossaire(appareil: Appareil, code: string) {
  return CONTENU.modes.glossaire[appareil].find((g) => g.code === code);
}

/** Phrases qui parlent de l'humidité (IHC) plutôt que de la température (ITC). */
const estHumidite = (t: string) => /IHC|déshumidificateur|%/i.test(t);

/** Pourquoi cette valeur : phrases du mode et règles « ménager le matériel » qui citent ce code. */
export function pourquoiDuCode(m: Mode, appareil: Appareil, code: string, valeur?: number): string[] {
  const motif = new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`);
  const bonAppareil = (t: string) => (appareil === 'ihc' ? estHumidite(t) : !estHumidite(t));
  const res = m.pourquoi.filter((t) => motif.test(t) && bonAppareil(t));
  if (appareil === 'ihc' && code === 'HS' && valeur !== undefined) {
    const v = `${nombre(valeur)} %`;
    for (const t of m.pourquoi) if (t.includes(v) && !res.includes(t)) res.push(t);
  }
  for (const r of CONTENU.modes.menager_le_materiel)
    if (motif.test(r.regle) && bonAppareil(r.regle)) res.push(`${r.regle} ${r.pourquoi}`);
  return res;
}

export const NOMS_PRISES: Record<Prise, string> = {
  itc_chauffage: 'ITC · prise chauffage',
  itc_froid: 'ITC · prise froid',
  ihc_work1: 'IHC · WORK1 (humidifier)',
  ihc_work2: 'IHC · WORK2 (déshumidifier)',
  prise_murale: 'Prise murale',
};

/** « Rien » → « Rien : laisser vide ». */
export function texteBranchement(v: string): string {
  return v === 'Rien' ? 'Rien : laisser vide' : v;
}

export function couleurMode(m: Pick<Mode, 'couleur'> | undefined): string {
  return m ? `var(--m-${m.couleur})` : 'var(--texte-3)';
}

export const VITESSES: Record<Mode['ventilateur']['vitesse'], string> = {
  lente: 'Vitesse lente (L)',
  moyenne: 'Vitesse moyenne (M)',
  rapide: 'Vitesse rapide (H)',
  arrêt: 'Arrêté',
};

export const NOMS_ALARMES: Record<string, string> = {
  temperature_haute: 'Température haute',
  temperature_basse: 'Température basse',
  humidite_haute: 'Humidité haute',
  humidite_basse: 'Humidité basse',
};

/** Texte prêt à afficher (espaces insécables avant °C, %, :…). */
export const t = (texte: string | undefined) => (texte ? insecables(texte) : '');

/** On sort d'un mode chaud vers un mode où le frigo est branché : laisser d'abord la chambre refroidir. */
export function refroidirAvant(de: Mode | undefined, vers: Mode | undefined): boolean {
  return !!de?.itc && de.itc.TS >= 25 && vers?.branchements.itc_froid === 'Frigo' && (vers.itc?.TS ?? 0) < de.itc.TS;
}

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « aujourd'hui à 12:00 », « demain », « ven. 16 oct. à 08:00 » (l'heure seulement si elle compte). */
export function quandLisible(d: Date, avecHeure: boolean, maintenant: Date | number = Date.now()): string {
  const m = new Date(maintenant);
  const ecart = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(m.getFullYear(), m.getMonth(), m.getDate()).getTime()) / 86_400_000);
  const jour = ecart === 0 ? 'aujourd’hui' : ecart === 1 ? 'demain' : ecart === -1 ? 'hier' : fmtJour.format(d);
  return avecHeure ? `${jour} à ${fmtHeure.format(d)}` : jour;
}
