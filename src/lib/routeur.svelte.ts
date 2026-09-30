// Navigation par l'adresse (#/…) : fonctionne hors ligne et sur GitHub Pages sans réglage serveur.

export type Onglet = 'accueil' | 'recherche' | 'frigo' | 'courses' | 'bocaux';
export const ONGLETS: Onglet[] = ['accueil', 'recherche', 'frigo', 'courses', 'bocaux'];

export type Route =
  | { nom: Onglet }
  | { nom: 'fiche'; id: string; page?: number }
  | { nom: 'cuisine'; id: string }
  | { nom: 'reglages'; section?: string }
  | { nom: 'bocal'; id: string }
  | { nom: 'bocal-edition'; id?: string; fiche?: string; modele?: string };

export function lireRoute(hash: string): Route {
  const chemin = hash.replace(/^#\/?/, '');
  const [nom, ...reste] = chemin.split('/');
  if (nom === 'fiche' && reste[0]) {
    const id = decodeURIComponent(reste[0]);
    const page = reste[1]?.match(/^p(\d+)$/)?.[1];
    return page ? { nom: 'fiche', id, page: Number(page) } : { nom: 'fiche', id };
  }
  if (nom === 'cuisine' && reste[0]) return { nom: 'cuisine', id: decodeURIComponent(reste[0]) };
  if (nom === 'bocal' && reste[0]) {
    const d = (i: number) => (reste[i] ? decodeURIComponent(reste[i]) : undefined);
    if (reste[0] === 'nouveau') {
      if (reste[1] === 'fiche' && reste[2]) return { nom: 'bocal-edition', fiche: d(2) };
      if (reste[1] === 'modele' && reste[2]) return { nom: 'bocal-edition', modele: d(2) };
      return { nom: 'bocal-edition' };
    }
    if (reste[1] === 'modifier') return { nom: 'bocal-edition', id: d(0) };
    return { nom: 'bocal', id: d(0)! };
  }
  if (nom === 'reglages') return reste[0] ? { nom: 'reglages', section: reste[0] } : { nom: 'reglages' };
  if ((ONGLETS as string[]).includes(nom)) return { nom: nom as Onglet };
  return { nom: 'accueil' };
}

export function lienCuisine(id: string): string {
  return `#/cuisine/${encodeURIComponent(id)}`;
}

export function lienBocal(id: string): string {
  return `#/bocal/${encodeURIComponent(id)}`;
}

/** Nouveau bocal : libre, depuis une fiche de fermentation, ou depuis un modèle. */
export function lienNouveauBocal(depuis: { fiche?: string; modele?: string } = {}): string {
  if (depuis.fiche) return `#/bocal/nouveau/fiche/${encodeURIComponent(depuis.fiche)}`;
  if (depuis.modele) return `#/bocal/nouveau/modele/${encodeURIComponent(depuis.modele)}`;
  return '#/bocal/nouveau';
}

export function lienModifierBocal(id: string): string {
  return `#/bocal/${encodeURIComponent(id)}/modifier`;
}

export function lienFiche(id: string, page?: number): string {
  return `#/fiche/${encodeURIComponent(id)}${page ? `/p${page}` : ''}`;
}

class Routeur {
  route = $state<Route>(lireRoute(location.hash));
  /** Dernier onglet affiché (reste visible sous les pages empilées). */
  onglet = $state<Onglet>('accueil');

  constructor() {
    this.#synchroniser();
    addEventListener('popstate', () => this.#synchroniser());
    addEventListener('hashchange', () => this.#synchroniser());
  }

  #synchroniser() {
    this.route = lireRoute(location.hash);
    if ((ONGLETS as string[]).includes(this.route.nom)) this.onglet = this.route.nom as Onglet;
  }

  get profondeur(): number {
    return (history.state as { n?: number } | null)?.n ?? 0;
  }

  /** Ouvre une page (le bouton Retour y reviendra). */
  aller(lien: string) {
    const cible = lien.startsWith('#') ? lien : `#${lien}`;
    if (cible === location.hash) return;
    history.pushState({ n: this.profondeur + 1 }, '', cible);
    this.#synchroniser();
  }

  /** Change de page sans empiler (onglets). */
  remplacer(lien: string) {
    const cible = lien.startsWith('#') ? lien : `#${lien}`;
    history.replaceState({ n: 0 }, '', cible);
    this.#synchroniser();
  }

  /** Remplace la page affichée par une autre, au même niveau (ex. formulaire → bocal créé). */
  remplacerPage(lien: string) {
    const cible = lien.startsWith('#') ? lien : `#${lien}`;
    history.replaceState({ n: this.profondeur }, '', cible);
    this.#synchroniser();
  }

  retour() {
    if (this.profondeur > 0) history.back();
    else this.remplacer(`#/${this.onglet}`);
  }

  ouvrirOnglet(o: Onglet) {
    this.remplacer(`#/${o}`);
  }
}

export const routeur = new Routeur();
