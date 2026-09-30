// Recherche et filtres (état conservé tant que l'application est ouverte).

import { NOMS_SOURCES, NOMS_TYPES, UNIVERS } from './archive';
import { etat } from './etat.svelte';
import { chercher } from './moteur';
import { perso } from './perso.svelte';
import { collator } from './texte';
import type { Resume, SourceId, Univers } from './types';

export type TypeFiltre = 'recette' | 'technique' | 'chapitre';
export type TempsFiltre = '30' | '60' | '120' | 'long';
export type PersoFiltre = 'favoris' | 'cuisinees';

export interface Filtres {
  perso: PersoFiltre[];
  univers: Univers[];
  sources: SourceId[];
  types: TypeFiltre[];
  categories: string[];
  cuisines: string[];
  typesDePlat: string[];
  temps: TempsFiltre[];
}

export type CleFiltre = keyof Filtres;

export const filtresVides = (): Filtres => ({
  perso: [],
  univers: [],
  sources: [],
  types: [],
  categories: [],
  cuisines: [],
  typesDePlat: [],
  temps: [],
});

export const NOMS_TEMPS: Record<TempsFiltre, string> = {
  '30': '30 min ou moins',
  '60': '1 h ou moins',
  '120': '2 h ou moins',
  long: 'Plus de 2 h',
};

export const NOMS_PERSO: Record<PersoFiltre, string> = {
  favoris: 'Favoris',
  cuisinees: 'Déjà cuisinées',
};

export const NOMS_FILTRES: Record<CleFiltre, string> = {
  perso: 'Mes fiches',
  univers: 'Univers',
  types: 'Type de fiche',
  sources: 'Source',
  temps: 'Temps total',
  categories: 'Catégorie',
  cuisines: 'Cuisine',
  typesDePlat: 'Type de plat',
};

function typeFiltre(r: Resume): TypeFiltre {
  return r.type === 'annexe' ? 'chapitre' : r.type;
}

function tempsCorrespond(r: Resume, t: TempsFiltre): boolean {
  if (r.minutes === undefined) return false;
  return t === 'long' ? r.minutes > 120 : r.minutes <= Number(t);
}

/** Valeurs d'une fiche pour un filtre donné. */
function valeurs(r: Resume, cle: CleFiltre): string[] {
  switch (cle) {
    case 'univers':
      return r.univers;
    case 'sources':
      return [r.source];
    case 'types':
      return [typeFiltre(r)];
    case 'categories':
      return r.categorie ? [r.categorie] : [];
    case 'cuisines':
      return r.cuisines;
    case 'typesDePlat':
      return r.typesDePlat;
    case 'perso':
      return [...(perso.estFavori(r.id) ? ['favoris'] : []), ...(perso.aCuisine(r.id) ? ['cuisinees'] : [])];
    case 'temps':
      return (Object.keys(NOMS_TEMPS) as TempsFiltre[]).filter((t) => tempsCorrespond(r, t));
  }
}

function correspond(r: Resume, f: Filtres, sauf?: CleFiltre): boolean {
  for (const cle of Object.keys(f) as CleFiltre[]) {
    if (cle === sauf) continue;
    const choisis = f[cle] as string[];
    if (!choisis.length) continue;
    const v = valeurs(r, cle);
    if (!choisis.some((c) => v.includes(c))) return false;
  }
  return true;
}

export function libelleValeur(cle: CleFiltre, v: string): string {
  if (cle === 'univers') return UNIVERS.find((u) => u.id === v)?.titre ?? v;
  if (cle === 'sources') return NOMS_SOURCES[v as SourceId] ?? v;
  if (cle === 'types') return NOMS_TYPES[v as TypeFiltre] ?? v;
  if (cle === 'temps') return NOMS_TEMPS[v as TempsFiltre] ?? v;
  if (cle === 'perso') return NOMS_PERSO[v as PersoFiltre] ?? v;
  return v;
}

class EtatRecherche {
  requete = $state('');
  filtres = $state<Filtres>(filtresVides());

  /** Fiches trouvées par le texte (null = pas de texte saisi, ou index pas encore prêt). */
  #parTexte = $derived.by((): Resume[] | null => {
    const q = this.requete.trim();
    if (!q) return null;
    const index = etat.index;
    if (!index) return null;
    const parId = etat.parId;
    return chercher(index, q)
      .map((id) => parId.get(id))
      .filter((r): r is Resume => !!r);
  });

  /** Base avant filtres : résultats du texte, ou tout le catalogue trié par titre. */
  #base = $derived.by((): Resume[] => {
    if (this.#parTexte) return this.#parTexte;
    if (this.requete.trim()) return []; // index en cours de chargement
    return [...etat.catalogue].sort((a, b) => collator.compare(a.titre, b.titre));
  });

  resultats = $derived(this.#base.filter((r) => correspond(r, this.filtres)));

  enAttenteIndex = $derived(!!this.requete.trim() && !etat.index);

  nbFiltres = $derived(Object.values(this.filtres).reduce((n, v) => n + v.length, 0));

  /** Options d'un filtre avec le nombre de fiches correspondantes (compte tenu des autres filtres). */
  options(cle: CleFiltre): { valeur: string; libelle: string; nombre: number }[] {
    const compte = new Map<string, number>();
    for (const r of this.#base) {
      if (!correspond(r, this.filtres, cle)) continue;
      for (const v of valeurs(r, cle)) compte.set(v, (compte.get(v) ?? 0) + 1);
    }
    const choisis = this.filtres[cle] as string[];
    for (const c of choisis) if (!compte.has(c)) compte.set(c, 0);
    const ordreFixe: Partial<Record<CleFiltre, string[]>> = {
      univers: UNIVERS.map((u) => u.id),
      sources: Object.keys(NOMS_SOURCES),
      types: ['recette', 'technique', 'chapitre'],
      temps: Object.keys(NOMS_TEMPS),
      perso: Object.keys(NOMS_PERSO),
    };
    const ordre = ordreFixe[cle];
    return [...compte.entries()]
      .map(([valeur, nombre]) => ({ valeur, libelle: libelleValeur(cle, valeur), nombre }))
      .sort((a, b) =>
        ordre ? ordre.indexOf(a.valeur) - ordre.indexOf(b.valeur) : collator.compare(a.libelle, b.libelle),
      );
  }

  basculer(cle: CleFiltre, valeur: string) {
    const liste = this.filtres[cle] as string[];
    const nouvelle = liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
    this.filtres = { ...this.filtres, [cle]: nouvelle };
  }

  effacerFiltres() {
    this.filtres = filtresVides();
  }

  /** Depuis l'accueil : ouvrir un univers. */
  ouvrirUnivers(u: Univers) {
    this.requete = '';
    this.filtres = { ...filtresVides(), univers: [u] };
  }
}

export const recherche = new EtatRecherche();
