// Exemples inventés (aucun texte de recette réelle dans le dépôt).
import { describe, expect, it } from 'vitest';
import { analyserTexte, construireFiche, ficheVersBrouillon, lireLigneIngredient } from '../src/lib/mes-recettes';
import { ligneIngredient } from '../src/lib/quantites';

const TEXTE = `Citronnade maison à la verveine
Pour 4 personnes
Préparation : 15 min

Ingrédients
- 3 citrons jaunes
- 1,5 litre d'eau froide
- 80 g de sucre en poudre (ou miel)
- 2 cuillères à soupe de sirop d'agave
- 4 à 5 feuilles de verveine
- Le zeste d'une orange
- Une pincée de sel (facultatif)

Préparation
1. Presser les citrons : récupérez tout le jus dans un grand pichet et retirez les pépins.
2. Ajouter l'eau, le sucre et le sirop, puis mélanger jusqu'à dissolution complète.
3. Laisser infuser la verveine 30 minutes au frais avant de servir.

Astuce
On peut remplacer la verveine par de la menthe.`;

describe('lecture d’une ligne d’ingrédient', () => {
  it('quantité, unité et nom', () => {
    expect(lireLigneIngredient("80 g de sucre en poudre (ou miel)")).toMatchObject({ quantite: 80, unite: 'g', nom: 'sucre en poudre' });
    expect(lireLigneIngredient("1,5 litre d'eau froide")).toMatchObject({ quantite: 1.5, unite: 'l', nom: 'eau froide' });
    expect(lireLigneIngredient('2 cuillères à soupe de sirop')).toMatchObject({ quantite: 2, unite: 'cuillère à soupe', nom: 'sirop' });
    expect(lireLigneIngredient('1 c. à c. de cumin')).toMatchObject({ quantite: 1, unite: 'cuillère à café', nom: 'cumin' });
    expect(lireLigneIngredient('2 dl de lait')).toMatchObject({ quantite: 20, unite: 'cl', nom: 'lait' });
    expect(lireLigneIngredient('3 citrons jaunes')).toMatchObject({ quantite: 3, nom: 'citrons jaunes' });
    expect(lireLigneIngredient('3 citrons jaunes').unite).toBeUndefined();
    expect(lireLigneIngredient('2 grosses tomates').unite).toBeUndefined();
    expect(lireLigneIngredient('1 bâton de cannelle')).toMatchObject({ quantite: 1, unite: 'bâton', nom: 'cannelle' });
  });

  it('fourchettes, mots-nombres, facultatif, sans quantité', () => {
    expect(lireLigneIngredient('4 à 5 feuilles de verveine')).toMatchObject({ quantite: 4, quantite_min: 4, quantite_max: 5, unite: 'feuille', nom: 'verveine' });
    expect(lireLigneIngredient('Une pincée de sel (facultatif)')).toMatchObject({ quantite: 1, unite: 'pincée', nom: 'sel', optionnel: true });
    expect(lireLigneIngredient("Le zeste d'une orange")).toMatchObject({ nom: "Le zeste d'une orange" });
    expect(lireLigneIngredient("Le zeste d'une orange").quantite).toBeUndefined();
    expect(lireLigneIngredient('½ citron')).toMatchObject({ quantite: 0.5, nom: 'citron' });
  });

  it('s’affiche et se met à l’échelle comme les autres fiches', () => {
    const l = ligneIngredient(lireLigneIngredient("1,5 litre d'eau froide"), 'perso', 2);
    expect(l.quantite).toBe('3');
    expect(l.texte).toBe("litre d'eau froide");
    const f = ligneIngredient(lireLigneIngredient('4 à 5 feuilles de verveine'), 'perso');
    expect(f.quantite).toBe('4 à 5');
  });
});

describe('analyse d’un texte collé', () => {
  const b = analyserTexte(TEXTE);

  it('titre, portions, temps', () => {
    expect(b.titre).toBe('Citronnade maison à la verveine');
    expect(b.portions).toBe('4');
    expect(b.unitePortions).toBe('personnes');
    expect(b.preparation).toBe('15 min');
  });

  it('ingrédients, étapes et astuces séparés', () => {
    expect(b.ingredients.split('\n')).toHaveLength(7);
    expect(b.ingredients.split('\n')[0]).toBe('3 citrons jaunes');
    const etapes = b.etapes.split('\n');
    expect(etapes).toHaveLength(3);
    expect(etapes[0].startsWith('Presser les citrons')).toBe(true);
    expect(b.notes).toBe('On peut remplacer la verveine par de la menthe.');
  });

  it('texte sans titres de section : ingrédients puis étapes', () => {
    const r = analyserTexte(
      `Compote express\n2 pommes\n1 cuillère à soupe de sucre\nÉplucher les pommes, les couper en dés et les cuire 10 minutes avec le sucre.\nMixer et servir tiède.`,
    );
    expect(r.titre).toBe('Compote express');
    expect(r.ingredients.split('\n')).toEqual(['2 pommes', '1 cuillère à soupe de sucre']);
    expect(r.etapes.split('\n')).toHaveLength(2);
  });

  it('« Recette du … : préparation » donne le titre quand il manque', () => {
    const r = analyserTexte(`200 g de farine\n2 œufs\nRecette des crêpes légères : préparation\nMélanger la farine et les œufs, puis laisser reposer une heure.`);
    expect(r.titre).toBe('Crêpes légères');
    expect(r.ingredients.split('\n')).toHaveLength(2);
    expect(r.etapes.split('\n')).toHaveLength(1);
  });
});

describe('fiche construite', () => {
  const f = construireFiche({ ...analyserTexte(TEXTE), typeDePlat: 'Boisson', cuisine: 'Française' });

  it('au format des fiches de l’archive', () => {
    expect(f.id).toMatch(/^perso-citronnade-maison-a-la-verveine-[a-z0-9]+$/);
    expect(f.type).toBe('recette');
    expect(f.source).toEqual({ id: 'perso', nom: 'Mes recettes' });
    expect(f.portions).toMatchObject({ nombre: 4, unite: 'personnes' });
    expect(f.temps?.preparation).toEqual({ texte: '15 min', minutes: 15 });
    expect(f.classement).toMatchObject({ type_de_plat: ['Boisson'], cuisine: ['Française'] });
    expect(f.ingredients?.[0].items).toHaveLength(7);
    expect(f.notes).toEqual(['On peut remplacer la verveine par de la menthe.']);
    expect(f.texte_source).toContain('Citronnade');
  });

  it('« Titre : texte » devient le titre de l’étape', () => {
    expect(f.etapes?.[0]).toMatchObject({ numero: 1, phase: 'Presser les citrons', texte: 'Récupérez tout le jus dans un grand pichet et retirez les pépins.' });
    expect(f.etapes?.[2].phase).toBeUndefined();
  });

  it('groupes et alternatives', () => {
    const g = construireFiche({
      ...analyserTexte(''),
      titre: 'Test',
      ingredients: 'Pour la pâte :\n200 g de farine\nPour la garniture :\n2 pommes\nou 2 poires',
    });
    expect(g.ingredients?.map((x) => x.groupe)).toEqual(['Pâte', 'Garniture']);
    expect(g.ingredients?.[1].items?.[1]).toMatchObject({ nom: 'poires', alternative_du_precedent: true });
  });

  it('aller-retour avec le formulaire (modification)', () => {
    const b = ficheVersBrouillon(f);
    const f2 = construireFiche(b, f);
    expect(f2.id).toBe(f.id);
    expect(f2.creeLe).toBe(f.creeLe);
    expect(f2.ingredients).toEqual(f.ingredients);
    expect(f2.etapes).toEqual(f.etapes);
    expect(f2.portions).toEqual(f.portions);
  });
});
