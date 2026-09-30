// Détection des durées dans le texte des étapes (« 20 minutes », « 1 h 30 », « 45 à 60 min »…)
// pour proposer un minuteur d'un toucher.

import { normaliser } from './texte';

export interface DureeTrouvee {
  /** Texte d'origine reconnu (« 45 à 60 min »). */
  texte: string;
  debut: number;
  fin: number;
  /** Durée minimale en secondes. */
  min: number;
  /** Durée maximale en secondes (= min si pas de fourchette). */
  max: number;
}

const MOTS_NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

const NOMBRE = String.raw`(\d+(?:[.,]\d+)?|${Object.keys(MOTS_NOMBRES).join('|')})`;
// Unités : l'ordre compte (les plus longues d'abord).
const HEURE = String.raw`(?:heures?|hrs?|h)`;
const MINUTE = String.raw`(?:minutes?|mins?|mn|m(?![a-z]))`;
const SECONDE = String.raw`(?:secondes?|secs?|s)`;
const UNITE = String.raw`(${HEURE}|${MINUTE}|${SECONDE})`;

/**
 * Une durée simple : « 1 h 30 », « 1h30 », « 1 heure 30 minutes », « 20 min », « 30 s ».
 * Groupes : 1 = nombre, 2 = unité, 3 = minutes après les heures (optionnel).
 */
const SIMPLE = String.raw`${NOMBRE}\s*${UNITE}(?:\s*(\d{1,2})(?:\s*${MINUTE})?(?![\d,.]))?`;

const MOTIF = new RegExp(
  String.raw`(?<![\p{L}\d])(?:(?:de|entre)\s+)?` +
    // fourchette « 45 à 60 min », « 5-7 minutes », « 3 h 30 à 4 h », « 45 min à 1 h »
    String.raw`(?:${NOMBRE}\s*(?:${UNITE}(?:\s*(\d{1,2})(?![\d,.]))?)?\s*(?:à|a|-|–|et|ou)\s*)?` +
    SIMPLE +
    String.raw`(?![\p{L}])`,
  'giu',
);

function lire(n: string | undefined): number | undefined {
  if (n === undefined) return undefined;
  const mot = MOTS_NOMBRES[n.toLowerCase()];
  if (mot !== undefined) return mot;
  const v = Number(n.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

function secondes(valeur: number, unite: string, complement?: string): number {
  const u = normaliser(unite);
  let s: number;
  if (/^h/.test(u)) s = valeur * 3600 + (lire(complement) ?? 0) * 60;
  else if (/^s/.test(u)) s = valeur;
  else s = valeur * 60;
  return Math.round(s);
}

/** Trouve toutes les durées d'un texte d'étape. */
export function trouverDurees(texte: string): DureeTrouvee[] {
  const res: DureeTrouvee[] = [];
  for (const m of texte.matchAll(MOTIF)) {
    const [complet, n1, u1, c1, n2, u2, c2] = m;
    const v2 = lire(n2);
    if (v2 === undefined || !u2) continue;
    // « 1 h » seule est ambiguë avec « 1 heure » ; « 5 m » peut être des mètres : on exige une unité claire.
    if (/^m$/i.test(u2) && !n1) continue;
    const max = secondes(v2, u2, c2);
    let min = max;
    const v1 = lire(n1);
    if (v1 !== undefined) {
      // « 45 à 60 min » : même unité ; « 45 min à 1 h » : unité propre.
      min = secondes(v1, u1 ?? u2, u1 ? c1 : undefined);
    }
    if (max <= 0 || max > 3 * 24 * 3600) continue;
    // Moins de 5 secondes : pas un minuteur (et « une seconde friture » n'est pas une durée).
    if (max < 5) continue;
    // Un nombre en lettres doit être suivi d'une espace : « huits rosaces » n'est pas « huit s ».
    if (/^\p{L}/u.test(n2) && !/\s/.test(complet.charAt(complet.lastIndexOf(n2) + n2.length))) continue;
    const debut = m.index! + (complet.length - complet.trimStart().length);
    const texteTrouve = complet.trim().replace(/^(de|entre)\s+/i, '');
    const decalage = complet.trim().length - texteTrouve.length;
    res.push({
      texte: texteTrouve,
      debut: debut + decalage,
      fin: m.index! + complet.length,
      min: Math.min(min, max),
      max: Math.max(min, max),
    });
  }
  return res;
}

export type MorceauDuree = { texte: string; duree?: DureeTrouvee };

/** Découpe un texte en morceaux, les durées étant isolées pour devenir des boutons. */
export function decouperDurees(texte: string): MorceauDuree[] {
  const morceaux: MorceauDuree[] = [];
  let pos = 0;
  for (const d of trouverDurees(texte)) {
    if (d.debut > pos) morceaux.push({ texte: texte.slice(pos, d.debut) });
    morceaux.push({ texte: texte.slice(d.debut, d.fin), duree: d });
    pos = d.fin;
  }
  if (pos < texte.length) morceaux.push({ texte: texte.slice(pos) });
  return morceaux;
}

/** 1500 → « 25:00 » ; 3725 → « 1:02:05 ». */
export function chrono(totalSecondes: number): string {
  const s = Math.max(0, Math.ceil(totalSecondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 1500 → « 25 min » ; 5400 → « 1 h 30 » ; 45 → « 45 s ». */
export function libelleDuree(totalSecondes: number): string {
  const s = Math.round(totalSecondes);
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste ? `${h} h ${String(reste).padStart(2, '0')}` : `${h} h`;
}
