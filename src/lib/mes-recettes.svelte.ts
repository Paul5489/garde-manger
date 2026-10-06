// Mes recettes en mémoire (peu nombreuses) et dans le téléphone (table Dexie « mesRecettes »).
// Elles s'ajoutent au catalogue, à la recherche et au Frigo ; un réimport de l'archive n'y touche jamais.

import { documentDeRecherche, resumer } from './archive';
import { db } from './db';
import { creerIndex } from './moteur';
import type { Fiche } from './types';

class MesRecettes {
  liste = $state.raw<Fiche[]>([]);
  resumes = $derived(this.liste.map(resumer));
  /** Petit index de recherche dédié, reconstruit à chaque changement (quelques fiches : instantané). */
  index = $derived(creerIndex(this.liste.map(documentDeRecherche)));

  async charger() {
    this.liste = trier(await db.mesRecettes.toArray());
  }

  trouver(id: string): Fiche | undefined {
    return this.liste.find((f) => f.id === id);
  }

  async enregistrer(f: Fiche) {
    // Copie simple : ne jamais écrire un objet réactif dans IndexedDB.
    const propre = JSON.parse(JSON.stringify(f)) as Fiche;
    await db.mesRecettes.put(propre);
    this.liste = trier([...this.liste.filter((x) => x.id !== propre.id), propre]);
  }

  async supprimer(id: string) {
    await db.mesRecettes.delete(id);
    this.liste = this.liste.filter((x) => x.id !== id);
  }
}

function trier(liste: Fiche[]): Fiche[] {
  return [...liste].sort((a, b) => (b.creeLe ?? 0) - (a.creeLe ?? 0));
}

export const mesRecettes = new MesRecettes();
