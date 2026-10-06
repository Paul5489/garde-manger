// Clé API Anthropic de Paul, pour que Claude lise les recettes collées ou photographiées.
// Gardée uniquement dans ce téléphone (jamais dans la sauvegarde, jamais dans le code publié).

import { ecrireLocal, lireLocal } from './stockage-local';

class CleClaude {
  valeur = $state(lireLocal<string>('cle-claude', ''));
  presente = $derived(this.valeur.trim().length > 0);

  definir(cle: string) {
    this.valeur = cle.trim();
    ecrireLocal('cle-claude', this.valeur);
  }

  effacer() {
    this.definir('');
  }
}

export const cleClaude = new CleClaude();
