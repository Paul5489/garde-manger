// Recette en attente de vérification : préparée dans l'onglet Ajouter (par Claude ou rangée sans Claude),
// puis ouverte dans le formulaire (#/recette/nouvelle).

import type { Brouillon } from './mes-recettes';
import type { Fiche } from './types';

export interface AjoutEnAttente {
  brouillon: Brouillon;
  /** Fiche complète lue par Claude (garde les champs que le formulaire ne montre pas : fermentation, matériel…). */
  base?: Fiche;
  /** Message affiché en haut du formulaire. */
  info?: string;
  modifications?: string[];
}

class Ajout {
  enAttente = $state.raw<AjoutEnAttente | null>(null);

  prendre(): AjoutEnAttente | null {
    const a = this.enAttente;
    this.enAttente = null;
    return a;
  }
}

export const ajout = new Ajout();
