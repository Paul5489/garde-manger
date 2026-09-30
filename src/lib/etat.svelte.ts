// État global de l'application : catalogue des fiches, index de recherche, infos d'import.

import type MiniSearch from 'minisearch';
import type { DocRecherche } from './archive';
import { db } from './db';
import { chargerIndex } from './moteur';
import type { Fiche, InfosArchive, Resume } from './types';

class EtatApp {
  statut = $state<'chargement' | 'vide' | 'pret' | 'erreur'>('chargement');
  erreur = $state<string | null>(null);
  archive = $state<InfosArchive | null>(null);
  catalogue = $state.raw<Resume[]>([]);
  parId = $derived(new Map(this.catalogue.map((r) => [r.id, r])));
  index = $state.raw<MiniSearch<DocRecherche> | null>(null);
  #chargementIndex: Promise<MiniSearch<DocRecherche> | null> | null = null;

  /** Au démarrage : charge la liste légère des fiches (les fiches complètes restent en base). */
  async demarrer() {
    try {
      const [archive, catalogue] = await Promise.all([db.meta.get('archive'), db.meta.get('catalogue')]);
      if (!archive || !catalogue) {
        this.statut = 'vide';
        return;
      }
      this.archive = archive.valeur as InfosArchive;
      this.catalogue = catalogue.valeur as Resume[];
      this.index = null;
      this.#chargementIndex = null;
      this.statut = 'pret';
    } catch (e) {
      this.erreur = e instanceof Error ? e.message : String(e);
      this.statut = 'erreur';
    }
  }

  /** L'index de recherche est chargé à la première recherche (≈ 1,5 Mo). */
  chargerIndex(): Promise<MiniSearch<DocRecherche> | null> {
    if (this.index) return Promise.resolve(this.index);
    this.#chargementIndex ??= db.meta.get('index').then((e) => {
      if (typeof e?.valeur !== 'string') return null;
      this.index = chargerIndex(e.valeur);
      return this.index;
    });
    return this.#chargementIndex;
  }

  async fiche(id: string): Promise<Fiche | undefined> {
    return db.fiches.get(id);
  }
}

export const etat = new EtatApp();
