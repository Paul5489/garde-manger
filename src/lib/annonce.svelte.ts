// Petit message temporaire en bas de l'écran (« 12 articles ajoutés à ta liste »).

export interface Annonce {
  id: number;
  texte: string;
  action?: { libelle: string; faire: () => void };
}

class Annonces {
  courante = $state<Annonce | null>(null);
  #minuteur: ReturnType<typeof setTimeout> | undefined;
  #compteur = 0;

  afficher(texte: string, action?: Annonce['action'], duree = 4000) {
    clearTimeout(this.#minuteur);
    this.courante = { id: ++this.#compteur, texte, action };
    this.#minuteur = setTimeout(() => this.fermer(), duree);
  }

  fermer() {
    clearTimeout(this.#minuteur);
    this.courante = null;
  }
}

export const annonce = new Annonces();
