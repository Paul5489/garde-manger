// Données personnelles liées aux fiches : favoris, notes, « cuisiné le… ».
// Gardées en mémoire (petites) et enregistrées dans le téléphone à chaque changement.

import { SvelteMap } from 'svelte/reactivity';
import { db, nouvelId, type Favori, type NotePerso, type Realisation } from './db';

class Perso {
  favoris = new SvelteMap<string, Favori>();
  notes = new SvelteMap<string, NotePerso>();
  /** Toutes les réalisations, la plus récente d'abord. */
  realisations = $state.raw<Realisation[]>([]);
  charge = $state(false);

  /** Favoris, le dernier ajouté d'abord. */
  idsFavoris = $derived([...this.favoris.values()].reverse().sort((a, b) => b.modifieLe - a.modifieLe).map((f) => f.ficheId));
  /** Fiches cuisinées, la plus récente d'abord (sans doublon). */
  idsCuisines = $derived([...new Set(this.realisations.map((r) => r.ficheId))]);
  #cuisinees = $derived(new Set(this.idsCuisines));

  async charger() {
    const [favoris, notes, realisations] = await Promise.all([
      db.favoris.toArray(),
      db.notes.toArray(),
      db.realisations.toArray(),
    ]);
    this.favoris.clear();
    for (const f of favoris) this.favoris.set(f.ficheId, f);
    this.notes.clear();
    for (const n of notes) this.notes.set(n.ficheId, n);
    this.realisations = trierRealisations(realisations);
    this.charge = true;
  }

  estFavori(id: string): boolean {
    return this.favoris.has(id);
  }

  aCuisine(id: string): boolean {
    return this.#cuisinees.has(id);
  }

  async basculerFavori(id: string) {
    if (this.favoris.has(id)) {
      this.favoris.delete(id);
      await db.favoris.delete(id);
    } else {
      const f = { ficheId: id, modifieLe: Date.now() };
      this.favoris.set(id, f);
      await db.favoris.put(f);
    }
  }

  note(id: string): string {
    return this.notes.get(id)?.texte ?? '';
  }

  async definirNote(id: string, texte: string) {
    const propre = texte.replace(/\s+$/, '');
    if (propre === this.note(id)) return;
    if (!propre.trim()) {
      this.notes.delete(id);
      await db.notes.delete(id);
      return;
    }
    const n = { ficheId: id, texte: propre, modifieLe: Date.now() };
    this.notes.set(id, n);
    await db.notes.put(n);
  }

  realisationsDe(id: string): Realisation[] {
    return this.realisations.filter((r) => r.ficheId === id);
  }

  async ajouterRealisation(r: Omit<Realisation, 'id' | 'modifieLe'>): Promise<Realisation> {
    const nouvelle: Realisation = { ...r, id: nouvelId(), modifieLe: Date.now() };
    if (!nouvelle.commentaire?.trim()) delete nouvelle.commentaire;
    this.realisations = trierRealisations([...this.realisations, nouvelle]);
    await db.realisations.put(nouvelle);
    return nouvelle;
  }

  async supprimerRealisation(id: string) {
    this.realisations = this.realisations.filter((r) => r.id !== id);
    await db.realisations.delete(id);
  }
}

function trierRealisations(liste: Realisation[]): Realisation[] {
  return [...liste].sort((a, b) => b.date.localeCompare(a.date) || b.modifieLe - a.modifieLe);
}

export const perso = new Perso();
