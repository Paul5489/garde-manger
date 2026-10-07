// Compatibilité (modes.json › cohabitation) : avec une recette choisie, pour un mois donné, ce qui peut partager la
// chambre, ce qui se fait en parallèle hors de la chambre, et ce qui est incompatible, avec la raison en clair.
//  - Partager la chambre : un mode commun (phases comprises), aucune paire d'étiquettes en conflit, et la somme des
//    places (plus celles des lots déjà dans la chambre) qui ne dépasse pas la capacité.
//  - Hors de la chambre : en parallèle, sans contrainte de mode.
//  - Le thermoplongeur ne fait qu'une chose à la fois.

import { CONTENU, mode as modeParId } from './donnees';
import { finPrevue, modeDuLot } from './lots';
import type { IdMode, Lot, RecetteChambre } from './types';

const CO = CONTENU.modes.cohabitation;

/** Modes de la chambre dont la recette a besoin (phases comprises) ; vide si elle se fait hors de la chambre. */
export function modesDeLaRecette(r: RecetteChambre): IdMode[] {
  if (r.phases?.length) return [...new Set(r.phases.map((p) => p.mode).filter((m): m is IdMode => !!m))];
  return r.lieu === 'chambre' && r.mode ? [r.mode] : [];
}

/** Raisons en clair pour chaque paire d'étiquettes en conflit. */
const NOMS_CONFLITS: Record<string, string> = {
  'odeur_forte|sensible_odeur': 'odeur forte et viande',
  'spores|sensible_spores': 'spores et charcuterie',
  'air_sec|air_humide': 'air sec et air humide',
};

export function conflits(a: RecetteChambre, b: RecetteChambre): string[] {
  const res: string[] = [];
  for (const [x, y] of CO.conflits) {
    if ((a.etiquettes.includes(x) && b.etiquettes.includes(y)) || (a.etiquettes.includes(y) && b.etiquettes.includes(x)))
      res.push(NOMS_CONFLITS[`${x}|${y}`] ?? `${CO.etiquettes[x]} / ${CO.etiquettes[y]}`);
  }
  return res;
}

// ───── Thermoplongeur ─────

/** « 8 à 12 h » → 0,5 jour ; « 30 min » → 0,02 ; « 10 sem. » → 70 (la durée la plus longue). */
function joursDeLaDuree(texte: string): number {
  const nombres = [...texte.matchAll(/(\d+(?:,\d+)?)/g)].map((m) => Number(m[1].replace(',', '.')));
  const n = Math.max(0, ...nombres);
  if (/sem/i.test(texte)) return n * 7;
  if (/min/i.test(texte)) return n / 1440;
  if (/\bh\b/i.test(texte)) return n / 24;
  return n;
}

const estFacultatif = (titre: string, texte: string) => /option|express|ou bien/i.test(titre) || /^ou bien|(option|version express)\s*:/i.test(texte);

/** Durée (jours) pendant laquelle la recette prend le thermoplongeur : tout le lot, ou une étape obligatoire. */
export function usageThermoplongeur(r: RecetteChambre): number | undefined {
  if (r.lieu === 'thermoplongeur') return r.duree.max_j;
  const etapes = r.etapes.filter((e) => /thermoplongeur/i.test(e.texte) && !estFacultatif(e.titre, e.texte));
  return etapes.length ? Math.max(...etapes.map((e) => joursDeLaDuree(e.duree))) : undefined;
}

/** Deux usages du thermoplongeur ne tiennent pas le même mois si l'un d'eux le prend au moins une journée. */
function thermoEnConflit(a: RecetteChambre, b: RecetteChambre): boolean {
  const x = usageThermoplongeur(a);
  const y = usageThermoplongeur(b);
  return x !== undefined && y !== undefined && Math.max(x, y) >= 1;
}

// ───── Résultat ─────

export interface Incompatible {
  recette: RecetteChambre;
  raisons: string[];
}

export interface Compatibilite {
  /** Modes de la recette choisie (vide : hors de la chambre). */
  modes: IdMode[];
  /** Modes prévus au calendrier ce mois-là. */
  modesDuMois: IdMode[];
  /** Part de la chambre déjà prise par les lots en cours, par mode. */
  occupation: Partial<Record<IdMode, number>>;
  /** Lot en cours qui occupe le thermoplongeur (garum, amazake…). */
  thermoPris?: Lot;
  partage: RecetteChambre[];
  parallele: RecetteChambre[];
  incompatibles: Incompatible[];
  /** La recette choisie elle-même ne tient pas (chambre pleine, thermoplongeur pris, mode absent ce mois-ci). */
  avertissements: string[];
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

/** @param lots Lots en cours, qui occupent déjà la chambre : à ne passer que pour le mois en cours. */
export function compatibilite(x: RecetteChambre, mois: number, lots: Lot[] = [], maintenant: Date | number = Date.now()): Compatibilite {
  const modes = modesDeLaRecette(x);
  const modesDuMois = [...new Set((CONTENU.calendrier.mois[String(mois)]?.chambre ?? []).map((s) => s.mode).filter((m): m is IdMode => m !== 'nettoyage'))];
  const enCours = lots.filter((l) => l.statut === 'en-cours');
  const occupation: Partial<Record<IdMode, number>> = {};
  for (const l of enCours) {
    const m = modeDuLot(l);
    if (m && l.recetteId !== x.id) occupation[m] = arrondi((occupation[m] ?? 0) + l.recette.place);
  }
  const thermoPris = enCours.find(
    (l) => l.recette.lieu === 'thermoplongeur' && finPrevue(l).max.getTime() > new Date(maintenant).getTime() && (usageThermoplongeur(l.recette) ?? 0) >= 1,
  );

  const avertissements: string[] = [];
  for (const m of modes) {
    if (!modesDuMois.includes(m)) avertissements.push(`Le mode ${modeParId(m).nom} n’est pas prévu au calendrier ce mois-ci.`);
    else if (arrondi((occupation[m] ?? 0) + x.place) > CO.capacite) avertissements.push(`Chambre pleine en mode ${modeParId(m).nom}.`);
  }
  if (thermoPris && usageThermoplongeur(x) !== undefined) avertissements.push(`Thermoplongeur déjà pris (${thermoPris.nom}).`);

  const res: Compatibilite = { modes, modesDuMois, occupation, thermoPris, partage: [], parallele: [], incompatibles: [], avertissements };
  for (const y of CONTENU.recettes) {
    if (y.id === x.id || !y.mois?.includes(mois)) continue;
    const raisons: string[] = [];
    if (usageThermoplongeur(y) !== undefined && (thermoEnConflit(x, y) || thermoPris)) raisons.push('thermoplongeur déjà pris');
    const my = modesDeLaRecette(y);
    if (!my.length) {
      // Hors de la chambre : en parallèle.
      if (raisons.length) res.incompatibles.push({ recette: y, raisons });
      else res.parallele.push(y);
      continue;
    }
    if (!modes.length) {
      // La recette choisie se fait hors de la chambre : la chambre reste à ce qui y est prévu ce mois-ci.
      if (!my.some((m) => modesDuMois.includes(m))) raisons.push('mode pas prévu ce mois-ci');
      if (raisons.length) res.incompatibles.push({ recette: y, raisons });
      else res.partage.push(y);
      continue;
    }
    const communs = my.filter((m) => modes.includes(m));
    if (!communs.length) raisons.push('mode différent');
    else {
      raisons.push(...conflits(x, y));
      if (communs.every((m) => arrondi((occupation[m] ?? 0) + x.place + y.place) > CO.capacite)) raisons.push('chambre pleine');
    }
    if (raisons.length) res.incompatibles.push({ recette: y, raisons });
    else res.partage.push(y);
  }
  return res;
}
