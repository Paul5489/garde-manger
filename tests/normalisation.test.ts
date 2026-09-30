import { describe, expect, it } from 'vitest';
import { classer, construireIndexIngredients, construireVocabulaire, preparer, suggestions } from '../src/lib/classement-frigo';
import {
  alternativesDuNom,
  correspond,
  Dictionnaire,
  ecrireSynonymes,
  lireSynonymes,
  PLACARD_DEFAUT,
  SYNONYMES_DEFAUT,
} from '../src/lib/normalisation';
import type { Fiche } from '../src/lib/types';
import { archiveBrute, archiveDisponible } from './archive-reelle';

const dico = new Dictionnaire();
const j = (nom: string) => [...(dico.alternatives(nom)[0] ?? [])].sort();
const va = (a: string, b: string) => dico.alternatives(a).some((x) => dico.alternatives(b).some((y) => correspond(x, y)));

describe('normalisation des noms', () => {
  it('singulier, sans accents, sans préparation ni précisions', () => {
    expect(j('ail râpées, avec le jus')).toEqual(['ail']);
    expect(j('Oignons émincés')).toEqual(['oignon']);
    expect(j('Échalotes')).toEqual(j('échalote'));
    expect(j('gingembre pelé et râpé')).toEqual(['gingembre']);
    expect(j('2 gousses d’ail hachées')).toEqual(['ail']);
    expect(j('tomates (grosses)')).toEqual(['tomate']);
    expect(j('Œufs')).toEqual(['oeuf']);
  });

  it('les noms composés restent entiers', () => {
    expect(j('pommes de terre à chair ferme')).toEqual(['pomme_terre']);
    expect(j('Noix de coco râpée')).toEqual(['noix_coco']);
    expect(j('huile d’olive')).toEqual(['huile', 'huile_olive']);
    expect(j('fond brun de veau lié')).toEqual(['fond_brun', 'fond_brun_veau', 'lie'].sort());
  });

  it('les synonymes sont ramenés au nom principal', () => {
    expect(j('jeunes pousses d’oignons')).toEqual(j('oignon nouveau'));
    expect(j('Cébettes')).toEqual(j('Oignon nouveau'));
    expect(j('crème fleurette')).toEqual(j('crème liquide'));
    expect(j('Maïzena')).toEqual(j('fécule de maïs'));
    expect(j('sauce soja light')).toEqual(j('sauce soja claire'));
    expect(j('patates')).toEqual(j('pommes de terre'));
    expect(j('patates douces')).not.toEqual(j('pommes de terre'));
  });

  it('alternatives dans le nom', () => {
    expect(alternativesDuNom('ciboule ou ciboulette')).toEqual(['ciboule', 'ciboulette']);
    expect(alternativesDuNom('olives vertes ou noires')).toEqual(['olives vertes', 'olives noires']);
    expect(alternativesDuNom('crème fleurette ou double (facultatif)')).toEqual(['crème fleurette', 'crème double']);
    expect(alternativesDuNom('piment selon le goût')).toEqual(['piment']);
    expect(alternativesDuNom('beurre pour le moule')).toEqual(['beurre']);
  });
});

describe('correspondances', () => {
  it('le plus général correspond au plus précis, dans les deux sens', () => {
    expect(va('poireau', 'blancs de poireaux')).toBe(true);
    expect(va('crème', 'crème liquide')).toBe(true);
    expect(va('crème fleurette', 'crème')).toBe(true);
    expect(va('oeufs', 'jaunes d’œufs')).toBe(true);
    expect(va('citron', 'jus de citron vert')).toBe(true);
    expect(va('huile', 'huile d’olive')).toBe(true);
    expect(va('vinaigre', 'vinaigre de riz')).toBe(true);
    expect(va('ciboulette', 'ciboule ou ciboulette')).toBe(true);
  });

  it('pas de confusion entre produits différents', () => {
    expect(va('pomme', 'pommes de terre')).toBe(false);
    expect(va('lait', 'lait de coco')).toBe(false);
    expect(va('riz', 'vinaigre de riz')).toBe(false);
    expect(va('vin', 'vinaigre de vin')).toBe(false);
    expect(va('vin blanc', 'vin rouge')).toBe(false);
    expect(va('tomate', 'concentré de tomate')).toBe(false);
    expect(va('crème liquide', 'crème fraîche')).toBe(false);
    expect(va('pois chiches', 'petits pois')).toBe(false);
    expect(va('huile', 'huile de sésame')).toBe(false);
    expect(va('eau', 'eau de vie')).toBe(false);
    expect(va('huile', 'bain de friture')).toBe(true); // synonyme : huile de friture
    expect(va('veau', 'fond brun de veau')).toBe(false);
    expect(va('poisson', 'sauce poisson')).toBe(false);
    expect(va('coco', 'noix de coco')).toBe(false);
  });

  it('les synonymes édités par Paul sont pris en compte', () => {
    const perso = new Dictionnaire([...SYNONYMES_DEFAUT, ['Coriandre', 'Cilantro', 'Persil chinois']]);
    const a = perso.alternatives('persil chinois')[0];
    expect(correspond(a, perso.alternatives('coriandre fraîche')[0])).toBe(true);
    expect(correspond(dico.alternatives('persil chinois')[0], dico.alternatives('coriandre')[0])).toBe(false);
  });

  it('synonymes en texte : une ligne par groupe', () => {
    const g = lireSynonymes('Échalote, échalion\n\nCrème liquide = crème fleurette ; crème UHT\nSeul');
    expect(g).toEqual([['Échalote', 'échalion'], ['Crème liquide', 'crème fleurette', 'crème UHT']]);
    expect(lireSynonymes(ecrireSynonymes(SYNONYMES_DEFAUT))).toEqual(SYNONYMES_DEFAUT);
  });
});

describe('classement « avec ce que j’ai »', () => {
  const fiche = (id: string, noms: (string | [string, 'facultatif' | 'ou'])[]): Fiche => ({
    id,
    type: 'recette',
    titre: id,
    source: { id: 'afpa', nom: 'AFPA' },
    ingredients: [
      {
        items: noms.map((n) =>
          typeof n === 'string'
            ? { nom: n }
            : n[1] === 'facultatif'
              ? { nom: n[0], optionnel: true }
              : { nom: n[0], alternative_du_precedent: true },
        ),
      },
    ],
  });
  const index = construireIndexIngredients([
    fiche('potage', ['Blancs de poireaux', 'Pommes de terre', 'Beurre', 'Crème fleurette', 'Sel fin', 'Poivre', ['Cerfeuil', 'facultatif']]),
    fiche('omelette', ['Œufs', 'Beurre', ['Huile', 'ou'], 'Sel']),
    fiche('tarte', ['Pâte brisée', 'Pommes', 'Sucre', 'Beurre', 'Crème fraîche']),
    fiche('sans-rapport', ['Lotte', 'Safran']),
  ]);
  const prep = preparer(index, dico);
  const alts = (noms: string[]) => noms.map((n) => dico.alternatives(n));
  const placard = alts(PLACARD_DEFAUT);

  it('classe par ingrédients manquants, puis par part possédée ; placard et facultatifs ne comptent pas', () => {
    const r = classer(prep, alts(['poireaux', 'pommes de terre', 'beurre', 'crème', 'oeufs']), placard);
    expect(r.map((x) => [x.id, x.possedes, x.total, x.manquants])).toEqual([
      ['potage', 4, 4, []],
      ['omelette', 1, 1, []], // « beurre ou huile » : l'huile est au placard
      ['tarte', 2, 4, ['Pâte brisée', 'Pommes']], // « crème » couvre « crème fraîche »
    ]);
  });

  it('rien à proposer sans ingrédient', () => {
    expect(classer(prep, [], placard)).toEqual([]);
  });

  it('suggestions pendant la frappe', () => {
    const vocab = construireVocabulaire(prep, dico, SYNONYMES_DEFAUT);
    const noms = (s: string) => suggestions(vocab, s, placard).map((m) => m.nom);
    expect(noms('poir')).toEqual(['Blancs de poireaux']);
    expect(noms('pom')).toEqual(['Pommes', 'Pommes de terre']);
    expect(noms('creme')).toContain('Crème fleurette');
    expect(noms('seL')).toEqual([]); // au placard
    expect(noms('oignon nou')).toEqual(['Oignon nouveau']); // nom principal d'un synonyme
  });
});

describe.skipIf(!archiveDisponible)('sur la vraie archive', () => {
  const fiches = archiveDisponible ? archiveBrute().fiches : [];
  const index = construireIndexIngredients(fiches);
  const prep = preparer(index, dico);
  const placard = PLACARD_DEFAUT.map((n) => dico.alternatives(n));

  it('toutes les recettes avec ingrédients sont indexées, et presque tous les noms sont compris', () => {
    const recettes = fiches.filter((f) => f.type === 'recette' && f.ingredients?.length);
    expect(index.fiches.length).toBe(recettes.length);
    const places = index.fiches.flatMap((f) => f.places);
    const comprises = places.filter((p) => p.noms.some((n) => dico.alternatives(n).length));
    expect(comprises.length / places.length).toBeGreaterThan(0.99);
    expect(JSON.stringify(index).length).toBeLessThan(600_000);
  });

  it('poireaux + pommes de terre + beurre + crème : des potages en tête, sans rien qui manque', () => {
    const r = classer(prep, ['poireaux', 'pommes de terre', 'beurre', 'crème', 'oignon'].map((n) => dico.alternatives(n)), placard);
    const titres = new Map(fiches.map((f) => [f.id, f.titre]));
    const tete = r.slice(0, 15);
    expect(tete[0].manquants).toEqual([]);
    expect(tete.some((x) => /potage|velout|soupe|vichyssoise|parmentier|poireau/i.test(titres.get(x.id) ?? ''))).toBe(true);
    // Toujours trié : manquants croissants
    for (let i = 1; i < r.length; i++) expect(r[i].manquants.length).toBeGreaterThanOrEqual(r[i - 1].manquants.length);
  });

  it('le classement de toute l’archive reste rapide', () => {
    const debut = performance.now();
    const d = new Dictionnaire();
    const p = preparer(index, d);
    const vocab = construireVocabulaire(p, d, SYNONYMES_DEFAUT);
    for (let k = 0; k < 20; k++) classer(p, ['oeufs', 'lait', 'farine', 'tomate', 'poulet', 'riz'].map((n) => d.alternatives(n)), placard);
    suggestions(vocab, 'cho', []);
    expect(performance.now() - debut).toBeLessThan(1500);
  });
});
