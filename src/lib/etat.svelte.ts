// État global de l'application : catalogue des fiches, index de recherche, infos d'import.
// Le catalogue réunit les fiches de l'archive importée et « Mes recettes » (mes-recettes.svelte.ts).

import type MiniSearch from 'minisearch';
import type { DocRecherche } from './archive';
import { db } from './db';
import { empreinte, estExclue } from './exclusions';
import { masquees } from './masquees.svelte';
import { mesRecettes } from './mes-recettes.svelte';
import { completerAvecLeLivre, paireDuLivre } from './methode-livre';
import { chargerIndex } from './moteur';
import type { Fiche, InfosArchive, Resume } from './types';

class EtatApp {
  statut = $state<'chargement' | 'vide' | 'pret' | 'erreur'>('chargement');
  erreur = $state<string | null>(null);
  archive = $state<InfosArchive | null>(null);
  /** Fiches de l'archive importée (sans les pages « hors cuisine »). */
  catalogueArchive = $state.raw<Resume[]>([]);
  /**
   * Archive + mes recettes (une recette perso de même identifiant qu'une fiche de l'archive la remplace),
   * sans les recettes supprimées par Paul.
   */
  catalogue = $derived.by(() => {
    const perso = new Set(mesRecettes.liste.map((f) => f.id));
    const caches = masquees.ids;
    return [...this.catalogueArchive.filter((r) => !perso.has(r.id)), ...mesRecettes.resumes].filter(
      (r) => !caches.has(r.id),
    );
  });
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
      // Les pages écartées disparaissent tout de suite, même si l'archive a été importée avant le tri.
      this.catalogueArchive = (catalogue.valeur as Resume[]).filter((r) => !estExclue(r.id));
      this.index = null;
      this.#chargementIndex = null;
      this.statut = 'pret';
    } catch (e) {
      this.erreur = e instanceof Error ? e.message : String(e);
      this.statut = 'erreur';
    }
  }

  /** L'index de recherche de l'archive est chargé à la première recherche (≈ 1,5 Mo). */
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
    const mienne = mesRecettes.trouver(id) ?? (await db.mesRecettes.get(id));
    if (mienne) return mienne;
    const f = await db.fiches.get(id);
    return f && this.#completer(f);
  }

  #parEmpreinte: { catalogue: Resume[]; ids: Map<string, string> } | null = null;

  /** Fiche AFPA : les étapes sont complétées par la méthode de La Cuisine de référence (methode-livre.ts). */
  async #completer(f: Fiche): Promise<Fiche> {
    const paire = f.source.id === 'afpa' ? paireDuLivre(f.id) : undefined;
    if (!paire) return f;
    if (this.#parEmpreinte?.catalogue !== this.catalogueArchive)
      this.#parEmpreinte = {
        catalogue: this.catalogueArchive,
        ids: new Map(this.catalogueArchive.map((r) => [empreinte(r.id), r.id])),
      };
    const idLivre = this.#parEmpreinte.ids.get(paire.livre);
    const livre = idLivre ? await db.fiches.get(idLivre) : undefined;
    return livre ? completerAvecLeLivre(f, livre, paire.lien) : f;
  }
}

export const etat = new EtatApp();
