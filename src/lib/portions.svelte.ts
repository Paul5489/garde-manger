// Ajustement des portions (ou d'un coefficient quand la fiche ne donne qu'un rendement).
// Le choix de chaque fiche est gardé dans le téléphone : on le retrouve à la prochaine ouverture.

import { SvelteMap } from 'svelte/reactivity';
import { nombre } from './format';
import { ecrireLocal, lireLocal } from './stockage-local';
import type { Fiche } from './types';

/** Nombre de portions de référence de la fiche (undefined : seulement un rendement ou rien). */
export function portionsDeBase(f: Pick<Fiche, 'portions'>): number | undefined {
  const n = f.portions?.nombre;
  return n && n > 0 ? n : undefined;
}

/** Coefficients proposés quand il n'y a pas de nombre de portions. */
export const COEFFICIENTS = [0.5, 1, 1.5, 2, 3, 4];

const CLE = 'portions';

class Portions {
  /** Coefficient choisi pour chaque fiche (1 par défaut, non enregistré). */
  #coefs = new SvelteMap<string, number>(
    Object.entries(lireLocal<Record<string, number>>(CLE, {})).filter(([, c]) => typeof c === 'number' && c > 0),
  );

  coef(id: string): number {
    return this.#coefs.get(id) ?? 1;
  }

  definirCoef(id: string, coef: number) {
    if (!(coef > 0)) return;
    if (Math.abs(coef - 1) < 1e-9) this.#coefs.delete(id);
    else this.#coefs.set(id, coef);
    ecrireLocal(CLE, Object.fromEntries(this.#coefs));
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

/** Texte lisible des quantités choisies : « 6 couverts », « ×2 », ou undefined (quantités de la fiche). */
export function texteQuantites(f: Pick<Fiche, 'id' | 'portions'>, coef = portions.coef(f.id)): string | undefined {
  const base = portionsDeBase(f);
  if (base) return `${nombre(base * coef)} ${f.portions?.unite ?? 'portions'}`;
  return Math.abs(coef - 1) > 1e-9 ? `×${nombre(coef)}` : undefined;
}
