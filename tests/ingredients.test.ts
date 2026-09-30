import { describe, expect, it } from 'vitest';
import { ingredientsDeLEtape, motsCles, nomSimplifie } from '../src/lib/ingredients';
import { archiveBrute, archiveDisponible } from './archive-reelle';

describe('noms d’ingrédients', () => {
  it('retire les précisions', () => {
    expect(nomSimplifie('ail râpées, avec le jus')).toBe('ail rapees');
    expect(nomSimplifie('pommes de terre (Bintje)')).toBe('pommes de terre');
    expect(nomSimplifie('piment rouge ou 2 piments doux')).toBe('piment rouge');
  });

  it('garde les mots qui identifient l’ingrédient', () => {
    expect(motsCles('blancs de poireaux')).toEqual(['poireau']);
    expect(motsCles('Crème fraîche épaisse')).toEqual(['creme', 'epaisse']);
    expect(motsCles('Huile d’olive')).toEqual(['huile', 'olive']);
    expect(motsCles('2 gousses d’ail hachées')).toEqual(['ail']);
    expect(motsCles('Pain de mie au choix')).toEqual(['pain', 'mie']);
  });
});

describe('ingrédients cités dans une étape', () => {
  const fiche = {
    ingredients: [
      {
        items: [
          { nom: 'blancs de poireaux', quantite: 0.4, unite: 'kg' },
          { nom: 'pommes de terre (Bintje)', quantite: 0.8, unite: 'kg' },
          { nom: 'beurre', quantite: 0.04, unite: 'kg' },
          { nom: 'crème double', quantite: 0.2, unite: 'l' },
        ],
      },
    ],
  };

  it('retrouve les ingrédients du texte et des détails', () => {
    const r = ingredientsDeLEtape(fiche, {
      texte: 'Marquer en cuisson',
      details: ['Suer au beurre les poireaux émincés.', 'Ajouter les pommes de terre.'],
    });
    expect(r.map((x) => x.item.nom)).toEqual(['blancs de poireaux', 'pommes de terre (Bintje)', 'beurre']);
  });

  it('ne trouve rien quand l’étape ne cite aucun ingrédient', () => {
    expect(ingredientsDeLEtape(fiche, { texte: 'Mettre en place le poste de travail' })).toEqual([]);
  });
});

describe.skipIf(!archiveDisponible)('sur la vraie archive', () => {
  it('la plupart des recettes ont au moins une étape qui cite un ingrédient', () => {
    const recettes = archiveBrute().fiches.filter((f) => f.type === 'recette' && f.etapes?.length && f.ingredients?.length);
    const avec = recettes.filter((f) => f.etapes!.some((e) => ingredientsDeLEtape(f, e).length > 0));
    expect(avec.length / recettes.length).toBeGreaterThan(0.75);
  });
});
