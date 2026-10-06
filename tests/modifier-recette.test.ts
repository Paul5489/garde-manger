// Modifier n'importe quelle recette (archive comprise) sans rien perdre. Vérifié sur la vraie archive.
import { describe, expect, it } from 'vitest';
import { construireFiche, ficheVersBrouillon } from '../src/lib/mes-recettes';
import { ligneIngredient } from '../src/lib/quantites';
import type { Fiche } from '../src/lib/types';
import { archiveBrute, archiveDisponible } from './archive-reelle';

describe.skipIf(!archiveDisponible)('modifier une recette de l’archive', () => {
  const recettes = archiveDisponible ? (archiveBrute().fiches.filter((f) => f.type === 'recette') as Fiche[]) : [];

  it('ouvrir puis enregistrer sans rien changer ne modifie aucune recette', () => {
    for (const f of recettes) {
      const g = construireFiche(ficheVersBrouillon(f), f);
      expect(g.modifieLe).toBeTypeOf('number');
      delete g.modifieLe;
      expect(g, f.id).toEqual(f);
    }
  });

  it('après une retouche des ingrédients, les autres gardent leurs quantités (fiches pro et blogs)', () => {
    let total = 0;
    let identiques = 0;
    for (const f of recettes) {
      const b = ficheVersBrouillon(f);
      const g = construireFiche({ ...b, ingredients: `${b.ingredients}\n1 pincée de sel` }, f);
      const avant = (f.ingredients ?? []).flatMap((x) => x.items ?? []);
      const apres = (g.ingredients ?? []).flatMap((x) => x.items ?? []);
      expect(apres.length, f.id).toBe(avant.length + 1);
      avant.forEach((item, i) => {
        total++;
        const q1 = ligneIngredient(item, f.source.id).quantite ?? '';
        const q2 = ligneIngredient(apres[i], f.source.id).quantite ?? '';
        if (q1 === q2) identiques++;
      });
      expect(g.source).toEqual(f.source);
      expect(g.id).toBe(f.id);
    }
    expect(identiques / total).toBeGreaterThan(0.97);
  });

  it('après une retouche des étapes, détails, durées et renvois des autres étapes sont gardés', () => {
    const f = recettes.find((x) => x.source.id === 'cuisine-de-reference' && (x.etapes ?? []).some((e) => e.renvois_pages && e.details?.length))!;
    const b = ficheVersBrouillon(f);
    const lignes = b.etapes.split('\n');
    const g = construireFiche({ ...b, etapes: [...lignes, 'Servir bien chaud.'].join('\n') }, f);
    expect(g.etapes).toHaveLength(f.etapes!.length + 1);
    f.etapes!.forEach((e, i) => {
      expect(g.etapes![i].texte).toBe(e.texte);
      expect(g.etapes![i].details ?? []).toEqual(e.details ?? []);
      expect(g.etapes![i].duree).toEqual(e.duree);
      expect(g.etapes![i].renvois_pages).toEqual(e.renvois_pages);
    });
    expect(g.etapes!.at(-1)!.texte).toBe('Servir bien chaud.');
  });

  it('changer le titre ou les portions garde le reste (source, classement, texte du livre)', () => {
    const f = recettes.find((x) => x.source.id === 'cuisine-de-reference' && x.texte_complet)!;
    const g = construireFiche({ ...ficheVersBrouillon(f), titre: 'Mon potage', portions: '4' }, f);
    expect(g.titre).toBe('Mon potage');
    expect(g.portions?.nombre).toBe(4);
    expect(g.texte_complet).toBe(f.texte_complet);
    expect(g.classement).toEqual(f.classement);
    expect(g.ingredients).toEqual(f.ingredients);
  });
});

describe('lignes « PM » et unités abrégées', async () => {
  const { lireLigneIngredient } = await import('../src/lib/mes-recettes');
  it('reconnues à la relecture', () => {
    expect(lireLigneIngredient('Sel fin (PM)')).toMatchObject({ nom: 'Sel fin', pour_memoire: true });
    expect(lireLigneIngredient('3 c. à soupe huile')).toMatchObject({ quantite: 3, unite: 'cuillère à soupe', nom: 'huile' });
    expect(lireLigneIngredient('1 c. à café sel')).toMatchObject({ quantite: 1, unite: 'cuillère à café', nom: 'sel' });
  });
});
