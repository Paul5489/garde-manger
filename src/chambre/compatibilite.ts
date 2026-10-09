// Compatibilité (07/10/2026) : elle ne dépend que du mode, plus du mois de lancement. Chaque recette de la chambre
// donne sa liste (`partage.avec`, plus `partage.note`), chaque mode ses précautions (modes.json › partage).
// Pour une recette cochée :
//  - ce qui peut partager la chambre (sa liste), avec les précautions ;
//  - ce qui se fait en parallèle hors de la chambre le mois choisi ;
//  - ce qui est incompatible, avec la raison (règle de modes.json › cohabitation, qui a servi à faire les listes) ;
//  - ce qui est déjà dans la chambre (lots en cours, place comprise) ou prévu au même moment (calendrier, étoiles).
// Le thermoplongeur ne fait qu'une chose à la fois.

import { CONTENU, mode as modeParId, recette as recetteParId } from './donnees';
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

/** Pourquoi deux recettes de la chambre ne vont pas ensemble (vide : elles peuvent partager). */
export function raisons(x: RecetteChambre, y: RecetteChambre): string[] {
  const mx = modesDeLaRecette(x);
  const my = modesDeLaRecette(y);
  if (!mx.some((m) => my.includes(m))) return ['mode différent'];
  const res = conflits(x, y);
  if (arrondi(x.place + y.place) > CO.capacite) res.push('chambre pleine');
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

export interface Avec {
  recette: RecetteChambre;
  raisons: string[];
}

export interface Present {
  lot: Lot;
  /** Mode où le lot se trouve en ce moment. */
  mode: IdMode;
  raisons: string[];
}

export interface Prevu extends Avec {
  /** D'après le calendrier (rendez-vous du mois), ou une recette marquée d'une étoile. */
  source: 'calendrier' | 'programme';
}

export interface Compatibilite {
  /** Modes de la recette choisie (vide : hors de la chambre). */
  modes: IdMode[];
  /** Modes prévus au calendrier ce mois-là. */
  modesDuMois: IdMode[];
  /** Peut partager la chambre (liste de la recette ; si elle est hors chambre : ce qui y est prévu ce mois-là). */
  partage: RecetteChambre[];
  /** Précautions : celle de la recette, celles des recettes qui partagent, celles du mode. */
  precautions: string[];
  /** Ce qui va ensemble dans chaque mode (modes.json › partage). */
  ensemble: string[];
  parallele: RecetteChambre[];
  incompatibles: Avec[];
  /** Lots en cours, dans la chambre en ce moment. */
  presents: Present[];
  /** Part de la chambre déjà prise par les lots présents dans le mode de la recette. */
  occupation: number;
  prevus: Prevu[];
  /** Lot en cours qui occupe le thermoplongeur (garum, amazake…). */
  thermoPris?: Lot;
  avertissements: string[];
}

const arrondi = (x: number) => Math.round(x * 100) / 100;
const unique = (l: string[]) => [...new Set(l.filter(Boolean))];

/**
 * @param lots Lots en cours (ce qui est déjà dans la chambre).
 * @param etoiles Recettes prévues (« coppa@11 »).
 */
export function compatibilite(
  x: RecetteChambre,
  mois: number,
  lots: Lot[] = [],
  maintenant: Date | number = Date.now(),
  etoiles: string[] = [],
): Compatibilite {
  const modes = modesDeLaRecette(x);
  const moisCal = CONTENU.calendrier.mois[String(mois)] ?? {};
  const modesDuMois = [...new Set((moisCal.chambre ?? []).map((s) => s.mode).filter((m): m is IdMode => m !== 'nettoyage'))];
  const enCours = lots.filter((l) => l.statut === 'en-cours');
  const thermoPris = enCours.find(
    (l) => l.recette.lieu === 'thermoplongeur' && finPrevue(l).max.getTime() > new Date(maintenant).getTime() && (usageThermoplongeur(l.recette) ?? 0) >= 1,
  );
  const chambre = CONTENU.recettes.filter((r) => modesDeLaRecette(r).length);
  const avec = new Set(x.partage?.avec ?? []);

  // Peut partager : la liste de la recette (tous les mois). Hors chambre : ce qui est prévu dans la chambre ce mois-là.
  const partage = modes.length
    ? chambre.filter((r) => avec.has(r.id))
    : chambre.filter((r) => r.mois?.includes(mois) && modesDeLaRecette(r).some((m) => modesDuMois.includes(m)));
  const precautions = unique([
    x.partage?.note ?? '',
    ...partage.map((r) => r.partage?.note ?? ''),
    ...modes.flatMap((m) => modeParId(m).partage?.precautions ?? []),
  ]);
  const ensemble = unique(modes.map((m) => modeParId(m).partage?.ensemble ?? ''));

  // En parallèle hors de la chambre : recettes de saison ce mois-là (le thermoplongeur ne fait qu'une chose à la fois).
  const parallele: RecetteChambre[] = [];
  const incompatibles: Avec[] = [];
  for (const y of CONTENU.recettes) {
    if (y.id === x.id || modesDeLaRecette(y).length || !y.mois?.includes(mois)) continue;
    if (usageThermoplongeur(y) !== undefined && (thermoEnConflit(x, y) || thermoPris)) incompatibles.push({ recette: y, raisons: ['thermoplongeur déjà pris'] });
    else parallele.push(y);
  }
  // Incompatible dans la chambre : toutes les autres recettes de la chambre, avec la raison.
  if (modes.length)
    for (const y of chambre) if (y.id !== x.id && !avec.has(y.id)) incompatibles.push({ recette: y, raisons: raisons(x, y) });

  // Déjà dans la chambre : lots en cours, avec leur mode du moment.
  const presents: Present[] = [];
  let occupation = 0;
  for (const l of enCours) {
    const m = modeDuLot(l);
    if (!m) continue;
    let r: string[] = [];
    if (modes.length && l.recetteId !== x.id) {
      if (!modes.includes(m)) r = [`mode différent (${modeParId(m).nom})`];
      else if (!avec.has(l.recetteId)) r = conflits(x, l.recette).length ? conflits(x, l.recette) : ['pas dans sa liste'];
    }
    if (modes.includes(m)) occupation = arrondi(occupation + l.recette.place);
    presents.push({ lot: l, mode: m, raisons: r });
  }

  // Prévu au même moment : rendez-vous du calendrier ce mois-là, et recettes marquées d'une étoile.
  const prevus: Prevu[] = [];
  const vus = new Set<string>();
  const ajouterPrevu = (id: string, source: Prevu['source']) => {
    const y = recetteParId(id);
    if (!y || y.id === x.id || vus.has(id) || !modesDeLaRecette(y).length) return;
    vus.add(id);
    prevus.push({ recette: y, source, raisons: modes.length && !avec.has(id) ? raisons(x, y) : [] });
  };
  for (const e of moisCal.rendez_vous ?? []) for (const id of e.recettes) ajouterPrevu(id, 'calendrier');
  for (const e of etoiles) {
    const [id, mo] = e.split('@');
    if (Number(mo) === mois) ajouterPrevu(id, 'programme');
  }

  const avertissements: string[] = [];
  for (const m of modes) if (!modesDuMois.includes(m)) avertissements.push(`Le mode ${modeParId(m).nom} n’est pas prévu au calendrier ce mois-ci.`);
  if (modes.length && arrondi(occupation + x.place) > CO.capacite)
    avertissements.push(`Chambre pleine : les lots présents en prennent déjà ${Math.round(occupation * 100)} %.`);
  if (thermoPris && usageThermoplongeur(x) !== undefined) avertissements.push(`Thermoplongeur déjà pris (${thermoPris.nom}).`);

  return { modes, modesDuMois, partage, precautions, ensemble, parallele, incompatibles, presents, occupation, prevus, thermoPris, avertissements };
}
