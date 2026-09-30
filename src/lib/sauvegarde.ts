// Sauvegarde des données personnelles (favoris, notes, carnet, courses, réglages) dans un fichier JSON,
// pour changer de téléphone sans rien perdre. Les recettes n'y figurent jamais (elles viennent de l'archive).

import { db as baseParDefaut, TABLES_PERSO, type BaseGardeManger, type TablePerso } from './db';
import { aujourdhui } from './format';

export const FORMAT_SAUVEGARDE = 'garde-manger-sauvegarde';
const VERSION = 1;

type Enregistrement = Record<string, unknown>;

export interface Sauvegarde {
  format: typeof FORMAT_SAUVEGARDE;
  version: number;
  exporteLe: string;
  application?: string;
  donnees: Record<TablePerso, Enregistrement[]>;
}

export class ErreurSauvegarde extends Error {}

/** Clé de chaque table (un enregistrement de même clé est le même). */
const CLES: Record<TablePerso, string> = {
  favoris: 'ficheId',
  notes: 'ficheId',
  realisations: 'id',
  courses: 'id',
  recettesCourses: 'ficheId',
  reglages: 'cle',
  bocaux: 'id',
  journal: 'id',
  modelesBocaux: 'id',
};

/** Champs indispensables en plus de la clé. */
const CHAMPS: Partial<Record<TablePerso, [string, 'string' | 'object' | 'number'][]>> = {
  notes: [['texte', 'string']],
  realisations: [['ficheId', 'string'], ['date', 'string']],
  courses: [['nom', 'string'], ['cle', 'string'], ['apports', 'object']],
  recettesCourses: [['titre', 'string'], ['coef', 'number']],
  bocaux: [['nom', 'string'], ['debut', 'string'], ['etapes', 'object'], ['statut', 'string']],
  journal: [['bocalId', 'string'], ['date', 'string']],
  modelesBocaux: [['nom', 'string'], ['etapes', 'object']],
};

export const NOMS_TABLES: Record<TablePerso, [string, string]> = {
  favoris: ['favori', 'favoris'],
  notes: ['note', 'notes'],
  realisations: ['plat cuisiné', 'plats cuisinés'],
  courses: ['article de courses', 'articles de courses'],
  recettesCourses: ['recette dans les courses', 'recettes dans les courses'],
  reglages: ['réglage', 'réglages'],
  bocaux: ['bocal', 'bocaux'],
  journal: ['note de bocal', 'notes de bocaux'],
  modelesBocaux: ['modèle de bocal', 'modèles de bocaux'],
};

export function nomFichierSauvegarde(d: Date = new Date()): string {
  return `garde-manger-sauvegarde-${aujourdhui(d)}.json`;
}

/** Lit toutes les données personnelles du téléphone. */
export async function exporter(base: BaseGardeManger = baseParDefaut, application?: string): Promise<Sauvegarde> {
  const donnees = {} as Sauvegarde['donnees'];
  await base.transaction(
    'r',
    TABLES_PERSO.map((t) => base.table(t)),
    async () => {
      for (const t of TABLES_PERSO) donnees[t] = (await base.table(t).toArray()) as Enregistrement[];
    },
  );
  return { format: FORMAT_SAUVEGARDE, version: VERSION, exporteLe: new Date().toISOString(), application, donnees };
}

/** Vérifie un fichier de sauvegarde et écarte les enregistrements incomplets. */
export function lireSauvegarde(json: unknown): Sauvegarde {
  const obj = json as Partial<Sauvegarde> & { fiches?: unknown };
  if (obj && typeof obj === 'object' && Array.isArray(obj.fiches))
    throw new ErreurSauvegarde(
      "Ce fichier est l'archive des recettes, pas une sauvegarde. Pour l'importer, utilise « Mettre à jour les recettes ».",
    );
  if (!obj || typeof obj !== 'object' || obj.format !== FORMAT_SAUVEGARDE || typeof obj.donnees !== 'object')
    throw new ErreurSauvegarde("Ce fichier n'est pas une sauvegarde de Garde-manger.");
  if (typeof obj.version !== 'number' || obj.version > VERSION)
    throw new ErreurSauvegarde(
      "Cette sauvegarde vient d'une version plus récente de l'application : mets d'abord l'appli à jour.",
    );
  const donnees = {} as Sauvegarde['donnees'];
  for (const t of TABLES_PERSO) {
    const liste = (obj.donnees as Record<string, unknown>)?.[t];
    donnees[t] = (Array.isArray(liste) ? liste : [])
      .filter((e): e is Enregistrement => {
        if (!e || typeof e !== 'object') return false;
        const r = e as Enregistrement;
        if (typeof r[CLES[t]] !== 'string' || !r[CLES[t]]) return false;
        return (CHAMPS[t] ?? []).every(([champ, type]) => typeof r[champ] === type && r[champ] !== null);
      })
      .map((e) => ({ ...e, modifieLe: typeof e.modifieLe === 'number' ? e.modifieLe : 0 }));
  }
  return {
    format: FORMAT_SAUVEGARDE,
    version: obj.version,
    exporteLe: typeof obj.exporteLe === 'string' ? obj.exporteLe : '',
    application: typeof obj.application === 'string' ? obj.application : undefined,
    donnees,
  };
}

export function compter(s: Sauvegarde): Record<TablePerso, number> {
  return Object.fromEntries(TABLES_PERSO.map((t) => [t, s.donnees[t].length])) as Record<TablePerso, number>;
}

export interface BilanRestauration {
  ajoutes: number;
  misAJour: number;
  inchanges: number;
}

/**
 * Ajoute le contenu d'une sauvegarde aux données du téléphone, sans rien effacer :
 * un élément absent est ajouté ; présent des deux côtés, c'est la version la plus récente qui reste.
 */
export async function restaurer(s: Sauvegarde, base: BaseGardeManger = baseParDefaut): Promise<BilanRestauration> {
  const bilan: BilanRestauration = { ajoutes: 0, misAJour: 0, inchanges: 0 };
  await base.transaction(
    'rw',
    TABLES_PERSO.map((t) => base.table(t)),
    async () => {
      for (const t of TABLES_PERSO) {
        const table = base.table(t);
        const recus = s.donnees[t];
        if (!recus.length) continue;
        const existants = (await table.bulkGet(recus.map((r) => r[CLES[t]] as string))) as (Enregistrement | undefined)[];
        const aEcrire: Enregistrement[] = [];
        recus.forEach((r, i) => {
          const e = existants[i];
          if (!e) {
            bilan.ajoutes++;
            aEcrire.push(r);
          } else if ((r.modifieLe as number) > ((e.modifieLe as number | undefined) ?? 0)) {
            bilan.misAJour++;
            aEcrire.push(r);
          } else bilan.inchanges++;
        });
        if (aEcrire.length) await table.bulkPut(aEcrire);
      }
    },
  );
  return bilan;
}
