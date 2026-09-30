import { describe, expect, it } from 'vitest';
import { pasPortions, portions, portionsDeBase } from '../src/lib/portions.svelte';
import { ligneIngredient } from '../src/lib/quantites';

const esp = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ');

describe('calcul des portions', () => {
  it('portions de référence', () => {
    expect(portionsDeBase({ portions: { nombre: 8, unite: 'couverts' } })).toBe(8);
    expect(portionsDeBase({ portions: { nombre: 0 } })).toBeUndefined();
    expect(portionsDeBase({})).toBeUndefined();
  });

  it('8 couverts → 6 : coefficient 0,75 et quantités recalculées', () => {
    portions.definirPortions('test-a', 8, 6);
    const coef = portions.coef('test-a');
    expect(coef).toBe(0.75);
    expect(portions.portions('test-a', 8)).toBe(6);
    expect(esp(ligneIngredient({ nom: 'beurre', quantite: 0.04, unite: 'kg' }, 'cuisine-de-reference', coef).quantite)).toBe('30 g');
    expect(esp(ligneIngredient({ nom: 'crème', quantite: 0.2, unite: 'l' }, 'cuisine-de-reference', coef).quantite)).toBe('15 cl');
    // Les PM restent des PM
    expect(ligneIngredient({ nom: 'sel', pour_memoire: true }, 'cuisine-de-reference', coef).quantite).toBe('PM');
  });

  it('4 portions → 10 (AFPA)', () => {
    portions.definirPortions('test-b', 4, 10);
    const coef = portions.coef('test-b');
    expect(coef).toBe(2.5);
    expect(esp(ligneIngredient({ nom: 'Oignon jaune', quantite: 0.5, unite: 'kg' }, 'afpa', coef).quantite)).toBe('1,25 kg');
    expect(esp(ligneIngredient({ nom: 'Aïl', quantite: 2, unite: 'gousse' }, 'afpa', coef).quantite)).toBe('5 gousses');
  });

  it('coefficient seul (rendement) et retour à ×1', () => {
    portions.definirCoef('test-c', 0.5);
    expect(portions.coef('test-c')).toBe(0.5);
    portions.definirCoef('test-c', 1);
    expect(portions.coef('test-c')).toBe(1);
    portions.definirCoef('test-c', -2); // ignoré
    expect(portions.coef('test-c')).toBe(1);
  });

  it('pas du réglage', () => {
    expect(pasPortions(8)).toBe(1);
    expect(pasPortions(1)).toBe(0.5);
  });
});
