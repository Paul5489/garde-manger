// Ajustement des portions (ou d'un coefficient quand la fiche ne donne qu'un rendement).

import { SvelteMap } from 'svelte/reactivity';
import type { Fiche } from './types';

/** Nombre de portions de référence de la fiche (undefined : seulement un rendement ou rien). */
export function portionsDeBase(f: Pick<Fiche, 'portions'>): number | undefined {
  const n = f.portions?.nombre;
  return n && n > 0 ? n : undefined;
}

/** Coefficients proposés quand il n'y a pas de nombre de portions. */
export const COEFFICIENTS = [0.5, 1, 1.5, 2, 3, 4];

class Portions {
  /** Coefficient choisi pour chaque fiche pendant la session (1 par défaut). */
  #coefs = new SvelteMap<string, number>();

  coef(id: string): number {
    return this.#coefs.get(id) ?? 1;
  }

  definirCoef(id: string, coef: number) {
    if (!(coef > 0)) return;
    if (Math.abs(coef - 1) < 1e-9) this.#coefs.delete(id);
    else this.#coefs.set(id, coef);
  }

  /** Portions choisies = base × coefficient (arrondi à 2 décimales). */
  portions(id: string, base: number): number {
    return Math.round(base * this.coef(id) * 100) / 100;
  }

  definirPortions(id: string, base: number, choisies: number) {
    if (choisies > 0) this.definirCoef(id, choisies / base);
  }
}

export const portions = new Portions();

/** Pas du réglage : 1 portion (ou 0,5 pour les très petites quantités de base). */
export function pasPortions(base: number): number {
  return base < 2 ? 0.5 : 1;
}
