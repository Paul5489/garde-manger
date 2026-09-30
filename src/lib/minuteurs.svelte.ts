// Minuteurs : plusieurs en même temps. On enregistre l'heure de fin, pas un compte à rebours,
// pour rester juste même si l'iPhone met l'application en pause (arrière-plan, écran verrouillé).

import { bip, deverrouillerSon, finSonnerie } from './son';
import { ecrireLocal, lireLocal } from './stockage-local';

export interface Minuteur {
  id: string;
  libelle: string;
  ficheId?: string;
  /** Durée totale demandée (ms). */
  duree: number;
  /** Heure de fin (ms depuis 1970) quand il tourne. */
  fin?: number;
  /** Temps restant (ms) quand il est en pause. */
  restant?: number;
  etat: 'actif' | 'pause' | 'fini';
  /** Heure à laquelle il a sonné. */
  finiA?: number;
  /** Fourchette « 45 à 60 min » : temps en plus à proposer à la fin (ms). */
  supplement?: number;
  /** Sonnerie arrêtée par l'utilisateur. */
  acquitte?: boolean;
}

const CLE = 'minuteurs';
/** Au-delà, un minuteur terminé pendant que l'appli dormait s'affiche sans sonner. */
const SONNERIE_MAX = 2 * 60_000;

class Minuteurs {
  liste = $state<Minuteur[]>(lireLocal<Minuteur[]>(CLE, []));
  maintenant = $state(Date.now());
  #intervalle: ReturnType<typeof setInterval> | null = null;
  #dernierBip = 0;

  /** Minuteurs terminés dont la sonnerie n'a pas été arrêtée. */
  sonnent = $derived(this.liste.filter((m) => m.etat === 'fini' && !m.acquitte));
  /** Minuteurs affichés (en cours, en pause, ou qui sonnent), le plus proche de la fin d'abord. */
  visibles = $derived(
    this.liste
      .filter((m) => m.etat !== 'fini' || !m.acquitte)
      .sort((a, b) => this.restant(a) - this.restant(b)),
  );

  constructor() {
    this.#verifier();
    this.#demarrerHorloge();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.#verifier();
    });
  }

  restant(m: Minuteur): number {
    if (m.etat === 'actif' && m.fin) return Math.max(0, m.fin - this.maintenant);
    if (m.etat === 'pause') return m.restant ?? 0;
    return 0;
  }

  lancer(libelle: string, secondes: number, options: { ficheId?: string; supplementSecondes?: number } = {}) {
    deverrouillerSon();
    const duree = Math.round(secondes * 1000);
    const m: Minuteur = {
      id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
      libelle,
      ficheId: options.ficheId,
      duree,
      fin: Date.now() + duree,
      etat: 'actif',
      supplement: options.supplementSecondes ? Math.round(options.supplementSecondes * 1000) : undefined,
    };
    this.liste = [...this.liste, m];
    this.#enregistrer();
    this.#demarrerHorloge();
    return m;
  }

  #modifier(id: string, f: (m: Minuteur) => Minuteur | null) {
    this.liste = this.liste.flatMap((m) => {
      if (m.id !== id) return [m];
      const r = f(m);
      return r ? [r] : [];
    });
    this.#enregistrer();
    if (!this.sonnent.length) finSonnerie();
  }

  pause(id: string) {
    this.#modifier(id, (m) =>
      m.etat === 'actif' ? { ...m, etat: 'pause', restant: Math.max(0, (m.fin ?? 0) - Date.now()), fin: undefined } : m,
    );
  }

  reprendre(id: string) {
    deverrouillerSon();
    this.#modifier(id, (m) =>
      m.etat === 'pause' ? { ...m, etat: 'actif', fin: Date.now() + (m.restant ?? 0), restant: undefined } : m,
    );
    this.#demarrerHorloge();
  }

  /** Ajoute du temps (relance un minuteur terminé). */
  ajouter(id: string, secondes: number) {
    deverrouillerSon();
    const ms = secondes * 1000;
    this.#modifier(id, (m) => {
      if (m.etat === 'actif') return { ...m, fin: (m.fin ?? Date.now()) + ms, duree: m.duree + ms };
      if (m.etat === 'pause') return { ...m, restant: (m.restant ?? 0) + ms, duree: m.duree + ms };
      return {
        ...m,
        etat: 'actif',
        fin: Date.now() + ms,
        duree: ms,
        finiA: undefined,
        acquitte: false,
        supplement: undefined,
      };
    });
    this.#demarrerHorloge();
  }

  arreter(id: string) {
    this.#modifier(id, (m) => (m.etat === 'fini' ? null : { ...m, acquitte: true }));
  }

  supprimer(id: string) {
    this.#modifier(id, () => null);
  }

  #enregistrer() {
    ecrireLocal(CLE, this.liste);
  }

  #demarrerHorloge() {
    if (this.#intervalle || !this.liste.length) return;
    this.#intervalle = setInterval(() => this.#verifier(), 250);
  }

  #verifier() {
    const maintenant = Date.now();
    this.maintenant = maintenant;
    let change = false;
    const liste = this.liste.map((m) => {
      if (m.etat === 'actif' && m.fin && m.fin <= maintenant) {
        change = true;
        // finiA = heure de fin prévue : terminé depuis longtemps (appli fermée) → affiché sans sonner.
        return { ...m, etat: 'fini' as const, finiA: m.fin, acquitte: false };
      }
      return m;
    });
    if (change) {
      this.liste = liste;
      this.#enregistrer();
    }
    // Sonnerie : répétée tant que non arrêtée, 2 minutes maximum.
    const aSonner = this.sonnent.filter((m) => maintenant - (m.finiA ?? maintenant) < SONNERIE_MAX);
    if (aSonner.length && document.visibilityState === 'visible' && maintenant - this.#dernierBip > 1400) {
      this.#dernierBip = maintenant;
      bip();
      navigator.vibrate?.([200, 100, 200]);
    }
    if (!this.liste.some((m) => m.etat === 'actif') && !aSonner.length && this.#intervalle) {
      clearInterval(this.#intervalle);
      this.#intervalle = null;
      finSonnerie();
    }
  }
}

export const minuteurs = new Minuteurs();

// Développement uniquement : accès depuis la console pour tester la sonnerie sans attendre.
if (import.meta.env.DEV) (globalThis as Record<string, unknown>).__minuteurs = minuteurs;
