// Base de données du téléphone (IndexedDB via Dexie).
// Les recettes importées et les données personnelles sont dans des tables séparées :
// réimporter les recettes ne touche jamais aux données personnelles (liées par id de fiche).

import Dexie, { type EntityTable } from 'dexie';
import type { Fiche } from './types';

export interface EntreeMeta {
  cle: 'archive' | 'catalogue' | 'index';
  valeur: unknown;
}

export class BaseGardeManger extends Dexie {
  fiches!: EntityTable<Fiche, 'id'>;
  meta!: EntityTable<EntreeMeta, 'cle'>;

  constructor() {
    super('garde-manger');
    this.version(1).stores({
      // Données importées (remplacées à chaque import)
      fiches: 'id',
      meta: 'cle',
    });
  }
}

export const db = new BaseGardeManger();

/** Demande à Safari de ne jamais effacer les données de l'application. */
export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
