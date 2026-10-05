// État global de l'application : catalogue des fiches, index de recherche, infos d'import.
// Le catalogue réunit les fiches de l'archive importée et « Mes recettes » (ajoutées hors archive).

import type MiniSearch from 'minisearch';
import { documentDeRecherche, resumer, type DocRecherche } from './archive';
import { db } from './db';
import { chargerIndex } from './moteur';
import type { Fiche, InfosArchive, Resume } from './types';

class EtatApp {
  statut = $state<'chargement' | 'vide' | 'pret' | 'erreur'>('chargement');
  erreur = $state<string | null>(null);
  archive = $state<InfosArchive | null>(null);
  /** Mes recettes (quelques fiches : gardées entières en mémoire). */
  mesRecettes = $state.raw<Fiche[]>([]);
  catalogue = $state.raw<Resume[]>([]);
  parId = $derived(new Map(this.catalogue.map((r) => [r.id, r])));
  index = $state.raw<MiniSearch<DocRecherche> | null>(null);
  /** Change à chaque import et à chaque changement de Mes recettes (repère pour l'index du Frigo). */
  versionRecettes = $state<string | undefined>(undefined);
  #chargementIndex: Promise<MiniSearch<DocRecherche> | null> | null = null;

  /** Au démarrage : charge la liste légère des fiches (les fiches complètes restent en base). */
  async demarrer() {
    try {
      const [archive, catalogue, mesRecettes] = await Promise.all([
        db.meta.get('archive'),
        db.meta.get('catalogue'),
        db.mesRecettes.toArray(),
      ]);
      if (!archive || !catalogue) {
        this.statut = 'vide';
        return;
      }
      this.archive = archive.valeur as InfosArchive;
      this.mesRecettes = mesRecettes.map(({ modifieLe: _m, ...f }) => f);
      // Une recette perso de même identifiant qu'une fiche de l'archive la remplace.
      const ids = new Set(mesRecettes.map((f) => f.id));
      this.catalogue = [
        ...(catalogue.valeur as Resume[]).filter((r) => !ids.has(r.id)),
        ...this.mesRecettes.map(resumer),
      ];
      this.versionRecettes = `${this.archive.importeLe}|${mesRecettes.map((f) => `${f.id}:${f.modifieLe}`).join(',')}`;
      this.index = null;
      this.#chargementIndex = null;
      this.statut = 'pret';
    } catch (e) {
      this.erreur = e instanceof Error ? e.message : String(e);
      this.statut = 'erreur';
    }
  }

  /** L'index de recherche est chargé à la première recherche (≈ 1,5 Mo). Mes recettes y sont ajoutées. */
  chargerIndex(): Promise<MiniSearch<DocRecherche> | null> {
    if (this.index) return Promise.resolve(this.index);
    this.#chargementIndex ??= db.meta.get('index').then((e) => {
      if (typeof e?.valeur !== 'string') return null;
      const index = chargerIndex(e.valeur);
      for (const f of this.mesRecettes) {
        if (index.has(f.id)) index.discard(f.id);
        index.add(documentDeRecherche(f));
      }
      this.index = index;
      return index;
    });
    return this.#chargementIndex;
  }

  async fiche(id: string): Promise<Fiche | undefined> {
    return this.mesRecettes.find((f) => f.id === id) ?? db.fiches.get(id);
  }
}

export const etat = new EtatApp();
