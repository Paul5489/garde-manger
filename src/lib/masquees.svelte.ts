// Recettes supprimées par Paul. Les fiches de l'archive ne sont pas effacées (un réimport les ramènerait) :
// elles sont masquées partout, et récupérables dans Réglages › Recettes supprimées.
// La liste est un réglage personnel : sauvegardée, et gardée lors d'un réimport.

import { db } from './db';

const CLE = 'fichesSupprimees';

class Masquees {
  ids = $state.raw<Set<string>>(new Set());

  async charger() {
    const r = await db.reglages.get(CLE);
    const liste = Array.isArray(r?.valeur) ? r.valeur.filter((x): x is string => typeof x === 'string') : [];
    this.ids = new Set(liste);
  }

  est(id: string): boolean {
    return this.ids.has(id);
  }

  async masquer(id: string) {
    this.ids = new Set([...this.ids, id]);
    await this.#enregistrer();
  }

  async remettre(id: string) {
    const s = new Set(this.ids);
    s.delete(id);
    this.ids = s;
    await this.#enregistrer();
  }

  async #enregistrer() {
    await db.reglages.put({ cle: CLE, valeur: [...this.ids], modifieLe: Date.now() });
  }
}

export const masquees = new Masquees();
