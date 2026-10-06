// Fiches AFPA complétées par La Cuisine de référence (demande de Paul, 06/10/2026).
// Les fiches AFPA ne donnent qu'un plan de travail en étapes courtes ; le livre détaille la méthode
// du même plat (ou d'un plat proche). On garde les étapes, les ingrédients et les quantités de l'AFPA
// et on ajoute sous chaque étape les explications du livre. Rien n'est enregistré : la fiche est
// complétée à l'ouverture, à partir des deux fiches de l'archive importée.
//
// Paires vérifiées une à une (titres, étapes et ingrédients comparés). Comme pour les pages écartées,
// l'appli publiée ne contient que des empreintes FNV-1a des identifiants (notés en commentaire).

import { empreinte } from './exclusions';
import { MOTS_VIDES, normaliser, radical } from './texte';
import type { Etape, Fiche, MethodeLivre } from './types';

export type LienLivre = MethodeLivre['lien'];

/** [empreinte de la fiche AFPA, empreinte de la fiche du livre, lien] */
const PAIRES: [string, string, LienLivre][] = [
  // Même plat dans le livre : sa méthode détaillée remplace le plan AFPA (qui reste consultable).
  ['8055ec3f', 'b88a89d8', 'meme'], // afpa-legumes-a-la-grecque → cr-legumes-a-la-grecque
  ['0ed34dd3', '98e0c261', 'meme'], // afpa-pommes-de-terre-a-langlaise → cr-pommes-de-terre-a-l-anglaise
  ['555b64ff', '33c70c54', 'meme'], // afpa-oeufs-a-la-neige → cr-oeufs-a-la-neige
  ['65e094c1', 'd7262a36', 'meme'], // afpa-potage-cultivateur → cr-potage-cultivateur
  ['30e33f7f', 'e7eac3eb', 'meme'], // afpa-riz-a-limperatrice → cr-riz-a-l-imperatrice
  ['c74d7df5', '69b881ac', 'meme'], // afpa-potage-saint-germain-aux-croutons → cr-potage-saint-germain-aux-croutons
  ['337476a8', '71999db3', 'meme'], // afpa-pommes-puree-ou-puree-parmentier → cr-pommes-puree-ou-puree-parmentier
  ['439d18fd', 'ba7a7fda', 'meme'], // afpa-pommes-sautees-a-cru → cr-pommes-sautees-a-cru
  ['e4098cb6', 'cce7af15', 'meme'], // afpa-navarin-aux-pommes → cr-navarin-aux-pommes
  ['dc900317', '37688f52', 'meme'], // afpa-potage-julienne-darblay → cr-potage-julienne-darblay
  ['f576b40f', 'ac1694c2', 'meme'], // afpa-oeufs-farcis-chimay → cr-oeufs-farcis-chimay
  ['bd4707a4', 'a96906ae', 'meme'], // afpa-flan-de-legumes → cr-flans-de-legumes
  ['3fbbe8fe', 'e78d8fa7', 'meme'], // afpa-choux-a-la-creme-et-eclairs-cafe-chocolat → cr-choux-a-la-creme-eclairs-cafe-chocolat
  ['37cd95bf', '57681b3a', 'meme'], // afpa-poulet-saute-chasseur → cr-poulets-sautes-chasseur
  ['0f13c200', '16d399ff', 'meme'], // afpa-oeuf-mollet-florentine → cr-oeufs-mollets-florentine
  ['13288b82', 'b5c1dcdd', 'meme'], // afpa-coq-au-vin → cr-coq-au-vin
  ['2f652511', 'b7c8cebe', 'meme'], // afpa-salade-facon-nicoise → cr-salade-facon-nicoise
  ['d32dcaf3', 'de155f91', 'meme'], // afpa-blanquette-de-veau-a-lancienne → cr-blanquette-de-veau-a-l-ancienne
  ['35e3f8df', '64199fb8', 'meme'], // afpa-creme-renversee-au-caramel → cr-creme-renversee-au-caramel
  ['5dceaa2b', 'e2397a02', 'meme'], // afpa-estouffade-de-boeuf-bourguignonne → cr-estouffade-de-boeuf-bourguignonne
  ['ad7cbb54', 'df71184d', 'meme'], // afpa-veloute-dubarry → cr-veloute-dubarry
  ['bb022687', '15e1f79b', 'meme'], // afpa-mille-feuilles → cr-mille-feuille
  ['dba55eb5', 'd64550f3', 'meme'], // afpa-steak-au-poivre → cr-steaks-au-poivre
  ['c16ce7ac', '8fe040aa', 'meme'], // afpa-fricassee-de-volaille-a-lancienne → cr-fricassee-de-volaille-a-l-ancienne
  ['d3ee21c4', '8585afec', 'meme'], // afpa-pommes-croquette → cr-pommes-croquettes
  ['38c4c3a9', '13ce874b', 'meme'], // afpa-oeufs-brouille-a-la-portugaise → cr-oeufs-brouilles-portugaise
  ['b0cbe1c4', '8991ae2f', 'meme'], // afpa-moules-mariniere → cr-moules-mariniere
  ['032768c2', '024c4843', 'meme'], // afpa-quiche-lorraine → cr-quiche-lorraine
  ['27f5a03b', 'a60de66b', 'meme'], // afpa-pommes-boulangeres → cr-pommes-boulangere
  ['7011db1d', '7652adee', 'meme'], // afpa-tarte-aux-pommes → cr-tarte-aux-pommes
  ['4d6bc2bb', '0bfbd24b', 'meme'], // afpa-poulet-saute-vallee-dauge → cr-poulets-sautes-facon-vallee-d-auge
  ['4544c492', '296bb9ed', 'meme'], // afpa-petits-pois-a-la-francaise → cr-petits-pois-a-la-francaise
  ['857ab473', '4f7e873d', 'meme'], // afpa-tarte-a-loignon → cr-tarte-a-l-oignon
  ['bd979634', '1e53ef37', 'meme'], // afpa-tarte-a-lalsacienne → cr-tarte-aux-pommes-a-l-alsacienne
  ['87365638', '3b757a54', 'meme'], // afpa-saute-de-veau-marengo → cr-veau-marengo
  ['9157f428', 'c49f47eb', 'meme'], // afpa-poulet-roti-et-son-jus → cr-poulets-rotis
  ['ddc0d357', '1ddd3d2f', 'meme'], // afpa-osso-bucco-milanaise → cr-osso-buco-milanaise
  ['b9d66d00', '72ac3c76', 'meme'], // afpa-rognons-de-veau → cr-rognons-de-veau-sautes-aux-champignons-et-au-madere
  ['b2a16107', 'da3cf2f6', 'meme'], // afpa-bavarois-a-base-de → cr-bavarois-rubanne
  ['e54a9caa', 'b7b71595', 'meme'], // afpa-riz-pilaf → cr-riz-pilaf-ou-pilaw-nature-et-creole
  // Plat proche : seules les étapes AFPA qui ont leur équivalent dans le livre sont détaillées.
  ['e255713c', '8b2fc3d3', 'proche'], // afpa-goujonnette-de-merlans-a-langlaise → cr-merlans-a-l-anglaise
  ['1e023591', '8a75ea99', 'proche'], // afpa-carre-de-porc-roti → cr-carre-de-porc-roti-boulangere
  ['a8fd21fb', '98e0c261', 'proche'], // afpa-pomme-de-terre-a-langlaise-au-safran → cr-pommes-de-terre-a-l-anglaise
  ['c5a7b00f', 'ecbd52e3', 'proche'], // afpa-choux-craquelin-chantilly → cr-choux-chantilly
  ['0f6ed402', 'ae0d86aa', 'proche'], // afpa-filets-de-limande-bonne-femme → cr-filets-de-sole-bonne-femme
  ['aa1fc810', '491cbaa0', 'proche'], // afpa-mousse-au-chocolat-en-corolle → cr-mousse-au-chocolat
  ['e9d8e51c', '21252a39', 'proche'], // afpa-foret-noire → cr-entremets-facon-foret-noire
  ['a851cc99', '79166dfa', 'proche'], // afpa-cotes-de-porc-charcutiere → cr-cotes-de-porc-charcutieres-pomme-puree
  ['116bec4f', 'd68dfb59', 'proche'], // afpa-medaillons-de-porc-duroc → cr-medaillons-de-veau-duroc
  ['7ba2cfb4', '70365120', 'proche'], // afpa-macedoine-de-legumes-oeufs-mollets → cr-macedoine-de-legumes-mayonnaise
  ['c8358cdd', '0868de02', 'proche'], // afpa-soupe-de-poissons → cr-soupe-de-poissons-facon-bouillabaisse
  ['7fc18278', 'f937965e', 'proche'], // afpa-tarte-citron-meringuee → cr-tarte-au-citron
  ['5005d1f0', '5b5b4c4b', 'proche'], // afpa-merlans-colbert → cr-soles-colbert
  ['ee31d144', '130fa5df', 'proche'], // afpa-tiramisu → cr-entremets-facon-tiramisu
  ['bc76f521', '8fe040aa', 'proche'], // afpa-fricassee-de-volaille-au-curry → cr-fricassee-de-volaille-a-l-ancienne
  ['c737c7c2', '71999db3', 'proche'], // afpa-puree-mousseline → cr-pommes-puree-ou-puree-parmentier
  ['c8309369', 'efbd2447', 'proche'], // afpa-charlotte-aux-fruits → cr-charlotte-aux-poires
  ['4937ab09', 'b055eff1', 'proche'], // afpa-crepes-suzette → cr-crepes-au-sucre
  ['39cda582', '069f996f', 'proche'], // afpa-pave-de-merlu-roti-a-lamericaine → cr-lotte-a-l-americaine
  ['dc499490', 'c20c0d5d', 'proche'], // afpa-faux-filet-grille-sauce-bearnaise → cr-steaks-grilles-sauce-bearnaise-pommes-pont-neuf
  ['30ef325d', 'e6672a8e', 'proche'], // afpa-pave-de-saumon-poche-sauce-hollandaise → cr-troncons-de-turbot-ou-turbotins-poches-sauce-hollandaise
  ['ae30b9bf', 'c453c409', 'proche'], // afpa-echine-de-porc-braisee → cr-aiguillette-de-boeuf-braisee-bourgeoise
  ['e8943a88', 'f935b65c', 'proche'], // afpa-carre-de-porc-poele → cr-carre-de-veau-poele-choisy
  ['515197ae', 'd142093e', 'proche'], // afpa-coquelet-grille-sauce-diable → cr-poulets-grilles-a-l-americaine
  ['ed59e226', 'fd41842b', 'proche'], // afpa-pomme-gaufrette-chips-paille → cr-pommes-paille-chips-gaufrettes-allumettes-et-pont-neuf
  ['8ad8fc43', 'fd41842b', 'proche'], // afpa-pommes-pont-neuf-mignonnette-allumette → cr-pommes-paille-chips-gaufrettes-allumettes-et-pont-neuf
  ['e6ae4687', '957c08ea', 'proche'], // afpa-pommes-de-terre-rissolees-cocotte-noisettes-chateau → cr-pommes-de-terres-rissolees
  ['454a828c', '1a2d4d0a', 'proche'], // afpa-tarte-en-bande-aux-fruits → cr-tarte-feuilletees-aux-fruits
  // Préparations de base : le livre les explique dans une fiche technique (lien).
  ['128a5fe6', 'a7a81f06', 'technique'], // afpa-pommes-duchesse → cr-les-preparations-appareils-et-farces-de-base-pommes-duchesse
  ['7a9843a4', '9d4b264a', 'technique'], // afpa-la-farce-mousseline → cr-les-preparations-appareils-et-farces-de-base-farce-mousseline
  ['d7ee3a08', '9d4b264a', 'technique'], // afpa-mousseline-de-poisson → cr-les-preparations-appareils-et-farces-de-base-farce-mousseline
  ['8fec4f8d', '2ec47964', 'technique'], // afpa-fumet-de-poisson → cr-les-fonds-fumet-de-poisson
  ['162cdf8e', '06c788af', 'technique'], // afpa-les-vinaigrettes → cr-les-sauces-emulsionnees-la-sauce-vinaigrette
  ['3b7fac29', '13be4349', 'technique'], // afpa-creme-damande → cr-les-cremes-de-base-creme-d-amandes
  ['968880b7', '1898074b', 'technique'], // afpa-creme-anglaise → cr-les-cremes-de-base-creme-anglaise
  ['105a5421', '792f8265', 'technique'], // afpa-creme-au-beurre → cr-les-cremes-de-base-creme-au-beurre
  ['d003d10d', '15ce2799', 'technique'], // afpa-creme-chantilly → cr-les-cremes-de-base-creme-chantilly
  ['55c64c29', '02d92c17', 'technique'], // afpa-pate-a-brioche → cr-les-pates-de-base-pate-a-brioche
  ['24c96c81', 'bd9b03ef', 'technique'], // afpa-pate-brisee → cr-les-pates-de-base-pate-brisee
  ['61a7ee6a', 'bc0d6c08', 'technique'], // afpa-pate-a-choux → cr-les-pates-de-base-pate-a-choux
  ['ae003113', '5057aaeb', 'technique'], // afpa-la-pate-a-crepes → cr-les-pates-de-base-pate-a-crepes
  ['4927cddc', '987255de', 'technique'], // afpa-tuile-aux-amandes → cr-les-petits-fours-secs-tuiles-aux-amandes
  ['455a0897', '605cb088', 'technique'], // afpa-le-fond-blanc-de-veau-clair-2 → cr-les-fonds-fond-brun
  ['02cc1869', 'a9915e03', 'technique'], // afpa-le-fond-blanc-de-volaille → cr-les-fonds-fond-blanc
  ['597e4aa8', 'a9915e03', 'technique'], // afpa-le-fond-blanc-de-veau-clair → cr-les-fonds-fond-blanc
  ['e02c6eb2', 'e63d5305', 'technique'], // afpa-appareil-a-bavarois-aux-oeufs → cr-appareils-a-creme-prises-ou-a-flan-sucre-appareil-a-bavarois
  ['a057f35c', '9aafd29a', 'technique'], // afpa-creme-patissiere → cr-les-cremes-de-base-creme-patissiere-et-derivees
  ['bebecfb9', 'bd5c10c7', 'technique'], // afpa-pate-a-genoise → cr-les-pates-de-base-pate-ou-appareil-a-genoise
  ['45dd16b1', 'e3334b6d', 'technique'], // afpa-sauce-mayonnaise-et-derives → cr-les-sauces-emulsionnees-la-sauce-mayonnaise
  ['5a7943f6', 'f903fac5', 'technique'], // afpa-sauce-bechamel-et-derives → cr-les-grandes-sauces-de-base-sauce-bechamel
  ['cfd12b79', '4f472554', 'technique'], // afpa-sauce-tomate-et-derives → cr-les-grandes-sauces-de-base-sauce-tomate
  ['2771747a', '7ca16d6a', 'technique'], // afpa-fond-damericaine → cr-les-grandes-sauces-de-base-sauce-americaine
  ['9683680a', '302cf0e9', 'technique'], // afpa-meringue-seches → cr-monter-des-blancs-d-oeufs-meringue-francaise
  ['78845fed', '2e814725', 'technique'], // afpa-biscuit-a-la-cuillere → cr-les-pates-de-base-appareil-a-biscuits
  ['5abdb2d3', '9eb7212e', 'technique'], // afpa-pate-feuilletee → cr-les-pates-de-base-pate-feuillete
  ['01c67a46', 'f0d0f0f7', 'technique'], // afpa-les-marinades-crues-et-cuites → cr-les-preparations-appareils-et-farces-de-base-les-marinades
  ['a2f72022', '0ee707bc', 'technique'], // afpa-duxelles-de-champignons → cr-les-preparations-appareils-et-farces-de-base-duxelles
  ['c594d460', 'bea4fc87', 'technique'], // afpa-pate-a-beignets → cr-les-pates-de-base-pate-a-frire
];

const PAR_AFPA = new Map(PAIRES.map(([a, l, lien]) => [a, { livre: l, lien }]));

export const NOMBRE_PAIRES = PAIRES.length;

/** Fiche du livre associée à une fiche AFPA (empreinte de son identifiant), s'il y en a une. */
export function paireDuLivre(idAfpa: string): { livre: string; lien: LienLivre } | undefined {
  return PAR_AFPA.get(empreinte(idAfpa));
}

// ───── Rapprochement des étapes (plat proche) ─────

/** Verbes trop généraux pour dire de quelle étape il s'agit (« réaliser », « confectionner »…). */
const VERBES_VAGUES = new Set([
  'realiser', 'confectionner', 'preparer', 'faire', 'mettre', 'terminer', 'finir', 'finition', 'reserver', 'chaud',
  'necessaire', 'besoin', 'min', 'mn',
]);

/** Mots fréquents qui comptent moitié : « l'appareil à cigarettes » n'est pas « l'appareil à bombe ». */
const MOTS_FAIBLES = new Set(['appare', 'sauce', 'creme', 'pate', 'garnit', 'elemen', 'montag', 'legume', 'dresse', 'marque', 'cuisso']);

const SYNONYMES: Record<string, string> = { cuire: 'cuisso', cuit: 'cuisso', cuite: 'cuisso' };

function mots(texte: string): Set<string> {
  const t = normaliser(texte).replace(/\([^)]*\)/g, ' ');
  const res = new Set<string>();
  for (const m of t.split(/[^a-z0-9]+/)) {
    if (m.length < 2 || MOTS_VIDES.has(m) || VERBES_VAGUES.has(m) || /^\d+$/.test(m)) continue;
    res.add(SYNONYMES[m] ?? radical(m).slice(0, 6));
  }
  return res;
}

const poids = (m: string) => (MOTS_FAIBLES.has(m) ? 0.5 : 1);

const dressage = (texte: string) => /^\s*(dresser|servir)\b/.test(normaliser(texte));

/** Ressemblance de deux intitulés d'étape (0 à 1 : coefficient de Dice pondéré sur les mots utiles). */
export function ressemblance(a: string, b: string): number {
  const ma = mots(a);
  const mb = mots(b);
  let total = 0;
  let communs = 0;
  for (const m of ma) {
    total += poids(m);
    if (mb.has(m)) communs += poids(m);
  }
  for (const m of mb) total += poids(m);
  const dice = total ? (2 * communs) / total : 0;
  // « Dresser les saumons et le beurre d'anchois » n'est pas « Confectionner le beurre d'anchois ».
  return dressage(a) === dressage(b) ? dice : dice / 2;
}

const SEUIL = 0.45;

/**
 * Associe les étapes du plan AFPA à celles du livre en respectant l'ordre des deux
 * (programmation dynamique : on maximise la ressemblance totale des paires retenues).
 * Renvoie, pour chaque étape AFPA, l'indice de l'étape du livre associée (ou -1).
 */
export function associer(plan: Etape[], livre: Etape[]): number[] {
  const n = plan.length;
  const m = livre.length;
  const score = plan.map((a) => livre.map((l) => ressemblance(a.texte, l.texte)));
  // meilleur[i][j] : meilleur total pour plan[i..] et livre[j..]
  const meilleur = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const s = score[i][j];
      meilleur[i][j] = Math.max(meilleur[i + 1][j], meilleur[i][j + 1], s >= SEUIL ? s + meilleur[i + 1][j + 1] : 0);
    }
  const res = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const s = score[i][j];
    if (s >= SEUIL && meilleur[i][j] === s + meilleur[i + 1][j + 1]) res[i++] = j++;
    else if (meilleur[i][j] === meilleur[i + 1][j]) i++;
    else j++;
  }
  return res;
}

/** Étapes AFPA, chacune complétée par les explications de l'étape équivalente du livre (s'il y en a une). */
export function detaillerEtapes(plan: Etape[], livre: Etape[]): Etape[] {
  const assoc = associer(plan, livre);
  return plan.map((a, i) => {
    const l = livre[assoc[i]];
    if (!l) return a;
    const e: Etape = { ...a };
    const details = [...(a.details ?? []), ...(l.details ?? [])];
    if (details.length) e.details = details;
    if (!e.duree && l.duree) e.duree = l.duree;
    if (l.renvois_pages?.length) e.renvois_pages = l.renvois_pages;
    return e;
  });
}

/** Nombre de couverts du livre, pour prévenir que les quantités citées dans le détail sont les siennes. */
function couverts(f: Fiche): string | undefined {
  const n = f.portions?.nombre;
  return n ? `${n} ${f.portions?.unite ?? 'couverts'}` : undefined;
}

/** Fiche AFPA complétée par la fiche du livre (le plan AFPA d'origine reste consultable). */
export function completerAvecLeLivre(afpa: Fiche, livre: Fiche, lien: LienLivre): Fiche {
  if (lien === 'technique' || !livre.etapes?.length || !afpa.etapes?.length)
    return { ...afpa, methode_livre: { id: livre.id, titre: livre.titre, lien: 'technique' } };
  const methode: MethodeLivre = { id: livre.id, titre: livre.titre, lien, plan: afpa.etapes };
  const portions = couverts(livre);
  if (portions) methode.portions = portions;
  const etapes =
    lien === 'meme'
      ? livre.etapes.map((e, i) => ({ ...e, numero: i + 1 }))
      : detaillerEtapes(afpa.etapes, livre.etapes);
  return { ...afpa, etapes, methode_livre: methode };
}
