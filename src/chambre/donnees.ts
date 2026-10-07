// Contenu de la chambre de fermentation, préparé par Paul avec Claude (dossier « dossier-chambre », 07/10/2026).
// Embarqué dans l'appli en lecture seule (Paul : ces recettes ne sont pas confidentielles) et vérifié au démarrage :
// mêmes contrôles que son script outils/valider_donnees.py. Une seule retouche : le titre d'étape « Cuire à la
// vapeur » (koji de riz) est devenu « Cuisson à la vapeur », identique sinon à un titre de La Cuisine de référence.

import calendrierJson from './contenu/calendrier.json';
import materielJson from './contenu/materiel.json';
import modesJson from './contenu/modes.json';
import champignons from './contenu/recettes/champignons.json';
import charcuterie from './contenu/recettes/charcuterie.json';
import koji from './contenu/recettes/koji.json';
import lacto from './contenu/recettes/lacto.json';
import pain from './contenu/recettes/pain.json';
import sechage from './contenu/recettes/sechage.json';
import vinaigre from './contenu/recettes/vinaigre.json';
import techniquesJson from './contenu/techniques.json';
import {
  CODES_IHC,
  CODES_ITC,
  PRISES,
  type Achats,
  type ContenuCalendrier,
  type ContenuModes,
  type IdMode,
  type Mode,
  type RecetteChambre,
  type Technique,
} from './types';

export interface Contenu {
  modes: ContenuModes;
  techniques: Record<string, Technique>;
  calendrier: ContenuCalendrier;
  materiel: Achats[];
  recettes: RecetteChambre[];
}

const brut = <T>(v: unknown) => v as T;

export const CONTENU: Contenu = {
  modes: brut<ContenuModes>(modesJson),
  techniques: brut<Record<string, Technique>>(techniquesJson),
  calendrier: brut<ContenuCalendrier>(calendrierJson),
  materiel: brut<Achats[]>(materielJson),
  recettes: brut<RecetteChambre[]>([...koji, ...lacto, ...charcuterie, ...champignons, ...pain, ...vinaigre, ...sechage]),
};

export const MODES: Mode[] = CONTENU.modes.modes;
export const MODES_PAR_ID = new Map<IdMode, Mode>(MODES.map((m) => [m.id, m]));
export const RECETTES_PAR_ID = new Map(CONTENU.recettes.map((r) => [r.id, r]));

export function mode(id: IdMode): Mode {
  return MODES_PAR_ID.get(id)!;
}

export function recette(id: string): RecetteChambre | undefined {
  return RECETTES_PAR_ID.get(id);
}

export const NOMS_FAMILLES: Record<RecetteChambre['famille'], string> = {
  koji: 'Koji',
  lacto: 'Lacto-fermentation',
  charc: 'Charcuterie',
  champ: 'Champignons',
  pain: 'Pain et levains',
  vin: 'Vinaigres',
  sech: 'Séchage',
};

export const NOMS_LIEUX: Record<RecetteChambre['lieu'], string> = {
  chambre: 'Chambre',
  cuisine: 'Cuisine',
  frigo: 'Frigo',
  placard: 'Placard',
  thermoplongeur: 'Thermoplongeur',
  air: 'À l’air',
};

// ───── Vérification (reprise de outils/valider_donnees.py) ─────

export interface Verification {
  erreurs: string[];
  avertissements: string[];
}

const nb = (v: number) => String(v).replace('.', ',');

function joursDansLeMois(annee: number, mois: number): number {
  return new Date(annee, mois, 0).getDate();
}

export function verifierContenu(c: Contenu = CONTENU): Verification {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const E = (t: string) => erreurs.push(t);
  const W = (t: string) => avertissements.push(t);
  const m = c.modes;

  const idsModes = new Set(m.modes.map((x) => x.id as string));
  const etiquettes = new Set(Object.keys(m.cohabitation.etiquettes));
  for (const [a, b] of m.cohabitation.conflits)
    if (!etiquettes.has(a) || !etiquettes.has(b)) E(`cohabitation : conflit avec une étiquette inconnue (${a}, ${b})`);

  for (const cle of [
    'role_de_l_appli',
    'installation',
    'mise_en_service',
    'menager_le_materiel',
    'economiser_energie',
    'guide_itc',
    'guide_ihc',
    'glossaire',
    'changement_de_mode',
    'verification_hebdomadaire',
    'coupure_de_courant',
    'nettoyage',
    'transitions',
  ] as const) {
    const v = m[cle] as unknown;
    if (!v || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Object.keys(v).length))
      E(`modes.json : section « ${cle} » absente ou vide`);
  }
  for (const e of m.mise_en_service ?? [])
    for (const k of ['titre', 'texte', 'si_echec'] as const) if (!(k in e)) E(`mise en service « ${e.titre} » : champ ${k} manquant`);
  if ((m.glossaire?.itc ?? []).map((g) => g.code).join() !== CODES_ITC.join()) E('glossaire ITC : codes inattendus');
  if ((m.glossaire?.ihc ?? []).map((g) => g.code).join() !== CODES_IHC.join()) E('glossaire IHC : codes inattendus');

  // Modes : réglages et protection du matériel.
  for (const x of m.modes) {
    const id = x.id;
    const br = x.branchements ?? ({} as Mode['branchements']);
    for (const p of PRISES) if (!(p in br)) E(`${id} : branchement ${p} manquant`);
    if (!['lente', 'moyenne', 'rapide', 'arrêt'].includes(x.ventilateur?.vitesse)) E(`${id} : vitesse du ventilateur inconnue`);
    const t = x.reservoir?.tous_les_j;
    if (!x.reservoir || !(t === null || Number.isInteger(t))) E(`${id} : reservoir.tous_les_j doit être un entier ou null`);
    for (const k of ['thermostat_frigo', 'energie', 'pourquoi', 'seuils'] as const) if (!(k in x)) E(`${id} : champ ${k} manquant`);
    const deshu = PRISES.filter((p) => (br[p] ?? '').includes('Déshumidificateur'));
    if (deshu.length > 1) E(`${id} : déshumidificateur branché à deux endroits`);
    if (PRISES.some((p) => p !== 'itc_froid' && (br[p] ?? '').includes('Frigo')))
      E(`${id} : le frigo ne se branche que sur la prise froid de l’ITC`);
    const i = x.itc;
    if (id === 'pause') {
      if (i !== null || PRISES.some((p) => br[p] !== 'Rien')) E('pause : tout doit être débranché');
      continue;
    }
    if (!i) {
      E(`${id} : réglages ITC manquants`);
      continue;
    }
    for (const k of CODES_ITC) if (!(k in i)) E(`${id} : ITC sans ${k}`);
    if (i.CF !== 'C') E(`${id} : CF doit valoir C`);
    const frigo = br.itc_froid === 'Frigo';
    if (i.PT !== 10) E(`${id} : PT vaut ${i.PT}, il doit valoir 10`);
    if (i.HD + i.CD < 3) E(`${id} : moins de 3 °C entre le tapis et le frigo (${nb(i.HD + i.CD)})`);
    if (frigo && i.CD < 1.5) E(`${id} : CD inférieur à 1,5 °C avec le frigo branché`);
    if (!(i.AL <= i.TS - i.HD && i.AH >= i.TS + Math.min(i.CD, 3))) W(`${id} : alarmes ITC proches des seuils (AL ${i.AL}, AH ${i.AH})`);
    for (const v of [i.TS - i.HD, i.TS]) if (!x.seuils.includes(`${nb(v)} °C`)) E(`${id} : seuil de chauffe ${nb(v)} °C absent de « ${x.seuils} »`);
    if (frigo && !x.seuils.includes(`${nb(i.TS + i.CD)} °C`)) E(`${id} : seuil du frigo ${nb(i.TS + i.CD)} °C absent de « ${x.seuils} »`);
    if (!frigo && !x.seuils.includes('débranché')) E(`${id} : seuils sans mention du frigo débranché`);
    const deshuIhc = br.ihc_work2 === 'Déshumidificateur';
    for (const ph of x.ihc_phases) {
      for (const k of CODES_IHC) if (!(k in ph)) E(`${id} ${ph.nom} : IHC sans ${k}`);
      if (deshuIhc && ph.DD < 4) E(`${id} : DD inférieur à 4 avec le déshumidificateur branché`);
      if (ph.PT < 3) E(`${id} : PT de l’IHC inférieur à 3`);
      if (!(ph.AL < ph.HS && ph.HS < ph.HS + ph.DD && ph.HS + ph.DD <= ph.AH)) E(`${id} ${ph.nom} : alarmes IHC incohérentes`);
      if (x.bac_de_sel && ph.HS < 76) E(`${id} : avec le bac de sel, HS doit rester au-dessus de 75 % (${ph.HS})`);
    }
  }
  for (const t of m.transitions) {
    for (const k of ['de', 'vers'] as const) if (!idsModes.has(t[k])) E(`transition : mode inconnu ${t[k]}`);
    if (![null, 'leger', 'moyen', 'grand'].includes(t.nettoyage)) E(`transition : nettoyage inconnu ${t.nettoyage}`);
  }

  // Recettes.
  const FAMILLES = new Set(['lacto', 'charc', 'koji', 'champ', 'pain', 'vin', 'sech']);
  const LIEUX = new Set(['chambre', 'cuisine', 'frigo', 'placard', 'thermoplongeur', 'air']);
  const FINS = new Set(['aspect', 'gout', 'odeur', 'temps', 'ph', 'perte_poids', 'temperature_coeur']);
  const ids = new Set<string>();
  for (const r of c.recettes) {
    if (ids.has(r.id)) E(`identifiant en double : ${r.id}`);
    ids.add(r.id);
  }
  for (const r of c.recettes) {
    const id = r.id;
    for (const k of [
      'nom',
      'famille',
      'lieu',
      'mode',
      'etiquettes',
      'place',
      'difficulte',
      'rendement',
      'base',
      'duree',
      'fin',
      'materiel',
      'ingredients',
      'etapes',
      'controles',
      'conservation',
    ] as const)
      if (!(k in r)) E(`${id} : champ ${k} manquant`);
    if (!FAMILLES.has(r.famille)) E(`${id} : famille ${r.famille}`);
    if (!LIEUX.has(r.lieu)) E(`${id} : lieu ${r.lieu}`);
    if ('mois' in r === !!r.toute_annee) E(`${id} : renseigner soit mois, soit toute_annee`);
    for (const mo of r.mois ?? []) if (!(mo >= 1 && mo <= 12)) E(`${id} : mois ${mo}`);
    if (r.mode !== null && !idsModes.has(r.mode)) E(`${id} : mode ${r.mode}`);
    if (r.lieu === 'chambre' && r.mode === null) E(`${id} : recette en chambre sans mode`);
    for (const ph of r.phases ?? []) {
      if (ph.mode && !idsModes.has(ph.mode)) E(`${id} : phase en mode inconnu ${ph.mode}`);
      if (ph.lieu && !LIEUX.has(ph.lieu)) E(`${id} : phase en lieu inconnu ${ph.lieu}`);
      if (ph.min_j > ph.max_j) E(`${id} : phase avec min_j > max_j`);
    }
    if (r.technique && !(r.technique in c.techniques)) E(`${id} : technique inconnue ${r.technique}`);
    for (const t of r.etiquettes) if (!etiquettes.has(t)) E(`${id} : étiquette inconnue ${t}`);
    if (!(r.place >= 0 && r.place <= 1)) E(`${id} : place hors de 0 à 1`);
    if (r.duree.min_j > r.duree.max_j) E(`${id} : durée min_j > max_j`);
    if (!FINS.has(r.fin.type)) E(`${id} : type de fin ${r.fin.type}`);
    if (['perte_poids', 'ph', 'temperature_coeur'].includes(r.fin.type) && r.fin.cible === undefined) E(`${id} : cible manquante`);
    for (const ct of r.controles)
      for (const k of ['j', 'titre', 'observer', 'normal', 'probleme', 'action'] as const) if (!(k in ct)) E(`${id} : contrôle sans ${k}`);
    for (const cs of r.conservation) if (!Number.isInteger(cs.jours)) E(`${id} : conservation sans nombre de jours`);
    for (const l of r.liens ?? []) if (!ids.has(l)) E(`${id} : lien vers une recette inconnue (${l})`);
    for (const ing of r.ingredients) if (typeof ing.qte !== 'number') E(`${id} : quantité non numérique (${ing.nom})`);
    const texte = JSON.stringify(r).toLowerCase();
    for (const mot of ['nitrit', 'nitrat', 'poudre de céleri', 'céleri en poudre', 'curing salt', 'prague'])
      for (let k = texte.indexOf(mot); k >= 0; k = texte.indexOf(mot, k + 1)) {
        const contexte = texte.slice(Math.max(0, k - 12), k + mot.length + 5);
        if (!contexte.includes('sans nitrit') && !contexte.includes('pas de sel nitrit')) E(`${id} : « ${mot} » trouvé (…${contexte}…)`);
      }
  }
  for (const [cle, t] of Object.entries(c.techniques))
    for (const ct of t.controles ?? [])
      for (const k of ['j', 'titre', 'observer', 'normal', 'probleme', 'action'] as const)
        if (!(k in ct)) E(`technique ${cle} : contrôle sans ${k}`);

  // Calendrier.
  for (const [mo, v] of Object.entries(c.calendrier.mois)) {
    const n = Number(mo);
    const annee = c.calendrier.annee_de_depart + (n < 10 ? 1 : 0);
    const nbJours = joursDansLeMois(annee, n);
    const jours: number[] = [];
    for (const seg of v.chambre ?? []) {
      if (seg.mode !== 'nettoyage' && !idsModes.has(seg.mode)) E(`calendrier ${mo} : mode inconnu ${seg.mode}`);
      if (!(1 <= seg.du && seg.du <= seg.au && seg.au <= nbJours)) E(`calendrier ${mo} : jours ${seg.du}–${seg.au} hors du mois`);
      for (let j = seg.du; j <= seg.au; j++) jours.push(j);
    }
    if (v.chambre?.length && jours.sort((a, b) => a - b).join() !== Array.from({ length: nbJours }, (_, k) => k + 1).join())
      W(`calendrier ${mo} : les segments ne couvrent pas exactement le mois`);
    for (const cle of ['rendez_vous', 'sorties'] as const)
      for (const e of v[cle] ?? []) for (const rid of e.recettes) if (!ids.has(rid)) E(`calendrier ${mo} : recette inconnue ${rid}`);
  }
  return { erreurs, avertissements };
}
