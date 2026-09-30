import { describe, expect, it } from 'vitest';
import { formaterMesure, formaterPlage, ligneIngredient, lireNombre } from '../src/lib/quantites';
import { archiveBrute, archiveDisponible } from './archive-reelle';

const esp = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ');

describe('unités lisibles', () => {
  it('masses', () => {
    expect(esp(formaterMesure(0.04, 'kg'))).toBe('40 g');
    expect(esp(formaterMesure(0.002, 'kg'))).toBe('2 g');
    expect(esp(formaterMesure(0.0025, 'kg'))).toBe('2,5 g');
    expect(esp(formaterMesure(1.5, 'kg'))).toBe('1,5 kg');
    expect(esp(formaterMesure(0.8, 'kg'))).toBe('800 g');
    expect(esp(formaterMesure(1500, 'g'))).toBe('1,5 kg');
    expect(esp(formaterMesure(4, 'kilograms'))).toBe('4 kg');
  });

  it('volumes', () => {
    expect(esp(formaterMesure(0.25, 'l'))).toBe('25 cl');
    expect(esp(formaterMesure(0.04, 'l'))).toBe('4 cl');
    expect(esp(formaterMesure(0.015, 'l'))).toBe('1,5 cl');
    expect(esp(formaterMesure(0.005, 'l'))).toBe('5 ml');
    expect(esp(formaterMesure(1.8, 'l'))).toBe('1,8 l');
    expect(esp(formaterMesure(150, 'ml'))).toBe('150 ml');
    expect(esp(formaterMesure(1500, 'ml'))).toBe('1,5 l');
    expect(esp(formaterMesure(0.04, '1'))).toBe('4 cl'); // « l » lu « 1 » dans le livre
  });

  it('unités de cuisine et pluriels', () => {
    expect(esp(formaterMesure(3, 'cuillère à soupe'))).toBe('3 c. à soupe');
    expect(esp(formaterMesure(0.5, 'cuillère à café'))).toBe('0,5 c. à café');
    expect(esp(formaterMesure(2, 'gousse'))).toBe('2 gousses');
    expect(esp(formaterMesure(1, 'gousse'))).toBe('1 gousse');
    expect(esp(formaterMesure(2, 'morceau'))).toBe('2 morceaux');
    expect(esp(formaterMesure(2, 'pièce'))).toBe('2');
    expect(esp(formaterMesure(4, 'p'))).toBe('4');
    expect(esp(formaterMesure(2, 'boîte 4/4'))).toBe('2 boîtes 4/4');
    expect(esp(formaterMesure(0.25, 'botte'))).toBe('0,25 botte');
  });

  it('plages', () => {
    expect(esp(formaterPlage(0.5, 0.6, 'kg'))).toBe('500 à 600 g');
    expect(esp(formaterPlage(2.4, 2.8, 'kg'))).toBe('2,4 à 2,8 kg');
    expect(esp(formaterPlage(2, 3, 'pièce'))).toBe('2 à 3');
  });

  it('lecture des nombres', () => {
    expect(lireNombre('0,800')).toBe(0.8);
    expect(lireNombre('1/4')).toBe(0.25);
    expect(lireNombre('½')).toBe(0.5);
    expect(lireNombre('0.5')).toBe(0.5);
    expect(lireNombre('abc')).toBeUndefined();
  });
});

describe('lignes d’ingrédients', () => {
  it('fiche pro : quantité chiffrée et PM', () => {
    const l = ligneIngredient({ nom: 'beurre', quantite: 0.04, unite: 'kg' }, 'cuisine-de-reference');
    expect(esp(l.quantite)).toBe('40 g');
    expect(l.texte).toBe('Beurre');
    expect(l.mode).toBe('colonnes');
    const pm = ligneIngredient({ nom: 'sel fin', pour_memoire: true, texte_original: 'sel fin — PM' }, 'cuisine-de-reference', 2);
    expect(pm.quantite).toBe('PM');
    expect(pm.pm).toBe(true);
  });

  it('fiche pro : quantité relue dans la ligne d’origine', () => {
    const eau = { nom: 'eau', unite: 'l', texte_original: 'eau — l — 1,8 à 2' };
    expect(esp(ligneIngredient(eau, 'cuisine-de-reference').quantite)).toBe('1,8 à 2 l');
    expect(esp(ligneIngredient(eau, 'cuisine-de-reference', 0.5).quantite)).toBe('0,9 à 1 l');
    const poissons = { nom: 'petits crabes', unite: 'kg', texte_original: 'petits crabes — kg — 0,800' };
    expect(esp(ligneIngredient(poissons, 'cuisine-de-reference').quantite)).toBe('800 g');
    const pain = { nom: 'Pain de mie', texte_original: 'Pain de mie 4 Pm' };
    expect(ligneIngredient(pain, 'afpa').quantite).toBe('4');
    expect(ligneIngredient(pain, 'afpa', 0.5).quantite).toBe('2');
    expect(ligneIngredient({ nom: 'beurre :', texte_original: 'beurre :' }, 'cuisine-de-reference').texte).toBe('Beurre');
  });

  it('mise à l’échelle des fiches pro', () => {
    const l = ligneIngredient({ nom: 'beurre', quantite: 0.04, unite: 'kg' }, 'afpa', 2.5);
    expect(esp(l.quantite)).toBe('100 g');
    const l2 = ligneIngredient({ nom: 'crème', quantite: 0.2, unite: 'l' }, 'cuisine-de-reference', 8);
    expect(esp(l2.quantite)).toBe('1,6 l');
  });

  it('fiche rédigée (Marc Winer) : la ligne d’origine fait foi', () => {
    const l = ligneIngredient(
      { nom: 'piment rouge ou 2 piments doux', quantite: 0.5, texte_original: '0.5 piment rouge ou 2 piments doux' },
      'marc-winer',
    );
    expect(l.mode).toBe('ligne');
    expect(l.quantite).toBe('0,5');
    expect(l.texte).toBe('piment rouge ou 2 piments doux');
    const eau = ligneIngredient(
      { nom: 'eau chaude', quantite: 150, unite: 'ml', texte_original: "150 ml d'eau chaude" },
      'marc-winer',
      2,
    );
    expect(eau.quantite).toBe('300');
    expect(eau.texte).toBe("ml d'eau chaude");
    const sel = ligneIngredient({ nom: 'Pincée de sel', texte_original: 'Pincée de sel' }, 'marc-winer', 2);
    expect(sel.quantite).toBeNull();
    expect(sel.texte).toBe('Pincée de sel');
  });

  it('fiche Noma : masses intégrées mises à l’échelle, pas les pourcentages', () => {
    const levure = ligneIngredient(
      { nom: 'levure de bière', quantite: 40, unite: 'ml', texte_original: '1 sachet (40 ml) de levure de bière' },
      'noma',
      2,
    );
    expect(levure.quantite).toBe('2');
    expect(levure.texte).toBe('sachet (80 ml) de levure de bière');
    const sel = ligneIngredient(
      { nom: 'sel fin', texte_original: 'Sel fin : 3 % du poids des légumes' },
      'noma',
      2,
    );
    expect(sel.quantite).toBeNull();
    expect(sel.texte).toBe('Sel fin : 3 % du poids des légumes');
    const eau = ligneIngredient(
      { nom: 'eau', quantite_min: 300, quantite_max: 600, unite: 'g', texte_original: "300 à 600 g d'eau" },
      'noma',
    );
    expect(eau.quantite).toBe('300 à 600');
    expect(eau.texte).toBe("g d'eau");
  });
});

describe.skipIf(!archiveDisponible)('toutes les lignes de la vraie archive', () => {
  it('chaque ingrédient s’affiche sans erreur, avec un texte, à ×1 et ×2', () => {
    const { fiches } = archiveBrute();
    let n = 0;
    for (const f of fiches) {
      const tables = [
        f.ingredients ?? [],
        ...(f.preparations_de_base ?? []).map((t) => t.ingredients ?? []),
        ...(f.ingredients_supplementaires ?? []).map((t) => t.ingredients ?? []),
      ];
      for (const groupes of tables)
        for (const g of groupes)
          for (const item of g.items ?? []) {
            for (const coef of [1, 2]) {
              const l = ligneIngredient(item, f.source.id, coef);
              expect(l.texte.length + (l.quantite?.length ?? 0), `${f.id} : ${item.texte_original}`).toBeGreaterThan(0);
              expect(l.quantite ?? '', `${f.id} : ${item.texte_original}`).not.toMatch(/NaN|undefined|Infinity/);
            }
            n++;
          }
    }
    expect(n).toBeGreaterThan(8000);
  });

  it('les quantités chiffrées des fiches pro sont presque toutes affichées', () => {
    const { fiches } = archiveBrute();
    let total = 0;
    let sansQuantite = 0;
    for (const f of fiches) {
      if (f.source.id !== 'afpa' && f.source.id !== 'cuisine-de-reference') continue;
      for (const g of f.ingredients ?? [])
        for (const item of g.items ?? []) {
          total++;
          if (!ligneIngredient(item, f.source.id).quantite) sansQuantite++;
        }
    }
    // Restent sans quantité les lignes qui n'en ont réellement pas (« Colorant », « gruyère râpé : »…).
    expect(sansQuantite / total).toBeLessThan(0.03);
  });
});
