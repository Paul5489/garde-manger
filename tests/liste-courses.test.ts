import { describe, expect, it } from 'vitest';
import type { ArticleCourses } from '../src/lib/db';
import {
  cleCourses,
  estToujoursLa,
  nomPourCourses,
  parRayon,
  propositionsDeLaFiche,
  quantiteTotale,
  rayonDe,
  texteListe,
  versUniteDeBase,
} from '../src/lib/liste-courses';
import { mesureIngredient } from '../src/lib/quantites';
import type { Fiche } from '../src/lib/types';
import { archiveBrute, archiveDisponible } from './archive-reelle';

const esp = (s: string) => s.replace(/[  ]/g, ' ');

describe('noms pour la liste de courses', () => {
  it('retire préparations, précisions et « pour … »', () => {
    expect(nomPourCourses('gingembre pelé et râpé')).toBe('Gingembre');
    expect(nomPourCourses('Oignons émincés')).toBe('Oignons');
    expect(nomPourCourses('carottes coupées en fines rondelles')).toBe('Carottes');
    expect(nomPourCourses('beurre pour le moule')).toBe('Beurre');
    expect(nomPourCourses('piment selon le goût')).toBe('Piment');
    expect(nomPourCourses('citron (1/2 pièce)')).toBe('Citron');
    expect(nomPourCourses('échalote ciselée, bien égouttée')).toBe('Échalote');
    expect(nomPourCourses('eau froide')).toBe('Eau');
  });

  it('garde ce qui identifie le produit', () => {
    expect(nomPourCourses('ail en poudre')).toBe('Ail en poudre');
    expect(nomPourCourses('crème fraîche épaisse')).toBe('Crème fraîche épaisse');
    expect(nomPourCourses('huile d’olive')).toBe('Huile d’olive');
    expect(nomPourCourses('SAUCE TOMATE')).toBe('Sauce tomate');
    expect(nomPourCourses('pommes de terre à chair ferme')).toBe('Pommes de terre à chair ferme');
  });

  it('même clé pour les doublons, clés différentes pour des produits différents', () => {
    expect(cleCourses('Oignons')).toBe(cleCourses('oignon'));
    expect(cleCourses('Huile d’olive')).toBe(cleCourses("huile d'olive"));
    expect(cleCourses('Échalotes')).toBe(cleCourses('echalote'));
    expect(cleCourses('Crème')).not.toBe(cleCourses('Crème fraîche'));
    expect(cleCourses('Vin blanc')).not.toBe(cleCourses('Vin rouge'));
  });

  it('eau, sel et poivre sont toujours à la maison (pas l’eau de vie)', () => {
    for (const n of ['Eau', 'eau froide', 'Sel fin', 'Gros sel', 'Poivre du moulin', 'Sel et poivre'])
      expect(estToujoursLa(cleCourses(nomPourCourses(n))), n).toBe(true);
    for (const n of ['Eau de vie', 'Eau de fleur d’oranger', 'Sucre', 'Poivron'])
      expect(estToujoursLa(cleCourses(nomPourCourses(n))), n).toBe(false);
  });
});

describe('rayons', () => {
  const cas: [string, string][] = [
    ['Oignons', 'fruits-legumes'],
    ['Poivron jaune', 'fruits-legumes'],
    ['Citron confit', 'fruits-legumes'],
    ['Persil plat', 'fruits-legumes'],
    ['Gingembre en poudre', 'epices'],
    ['Noix de muscade', 'epices'],
    ['Poivre du moulin', 'epices'],
    ['Sauce soja', 'asiatique'],
    ['Vinaigre de riz', 'asiatique'],
    ['Lait de coco', 'asiatique'],
    ['Vinaigre de vin', 'epicerie-salee'],
    ['Fond blanc de volaille', 'epicerie-salee'],
    ['Pâtes', 'epicerie-salee'],
    ['Vin blanc', 'boissons'],
    ['Jaune d’œuf', 'cremerie'],
    ['Pâte feuilletée', 'cremerie'],
    ['Beurre', 'cremerie'],
    ['Noix de veau', 'boucherie'],
    ['Poitrine de porc', 'boucherie'],
    ['Noix de Saint-Jacques', 'poissonnerie'],
    ['Filets de cabillaud', 'poissonnerie'],
    ['Sucre semoule', 'epicerie-sucree'],
    ['Pain de mie', 'boulangerie'],
    ['Épinards surgelés', 'surgeles'],
    ['Papier cuisson', 'autres'],
  ];
  it.each(cas)('%s → %s', (nom, rayon) => expect(rayonDe(nom)).toBe(rayon));

  it('liste rangée dans l’ordre du magasin, puis par nom', () => {
    const a = (nom: string, rayon: string) => ({ id: nom, nom, cle: nom, rayon, apports: [], coche: false, ajouteLe: 0, modifieLe: 0 });
    const g = parRayon([a('Sucre', 'epicerie-sucree'), a('Poireaux', 'fruits-legumes'), a('Carottes', 'fruits-legumes'), a('X', 'inconnu')]);
    expect(g.map((x) => x.rayon.id)).toEqual(['fruits-legumes', 'epicerie-sucree', 'autres']);
    expect(g[0].articles.map((x) => x.nom)).toEqual(['Carottes', 'Poireaux']);
  });
});

describe('quantités de la liste', () => {
  it('unités de base', () => {
    expect(versUniteDeBase(0.25, 'l')).toEqual({ valeur: 250, unite: 'ml' });
    expect(versUniteDeBase(0.04, 'kg')).toEqual({ valeur: 40, unite: 'g' });
    expect(versUniteDeBase(3, 'cl')).toEqual({ valeur: 30, unite: 'ml' });
    expect(versUniteDeBase(3)).toEqual({ valeur: 3, unite: 'pièce' });
    expect(versUniteDeBase(2, 'P')).toEqual({ valeur: 2, unite: 'pièce' });
    expect(versUniteDeBase(2, 'cuillère à soupe')).toEqual({ valeur: 2, unite: 'cuillère à soupe' });
  });

  it('additionne les doublons de même unité', () => {
    expect(esp(quantiteTotale([{ valeur: 40, unite: 'g' }, { valeur: 460, unite: 'g' }]))).toBe('500 g');
    expect(esp(quantiteTotale([{ valeur: 800, unite: 'g' }, { valeur: 400, unite: 'g' }]))).toBe('1,2 kg');
    expect(esp(quantiteTotale([{ valeur: 250, unite: 'ml' }, { valeur: 250, unite: 'ml' }]))).toBe('50 cl');
    expect(esp(quantiteTotale([{ valeur: 2, unite: 'cuillère à soupe' }, { valeur: 1, unite: 'cuillère à soupe' }]))).toBe('3 c. à soupe');
  });

  it('pièces arrondies au-dessus, unités différentes côte à côte, PM ignorés', () => {
    expect(quantiteTotale([{ valeur: 0.5, unite: 'pièce' }, { valeur: 1, unite: 'pièce' }])).toBe('2');
    expect(esp(quantiteTotale([{ valeur: 2, unite: 'pièce' }, { valeur: 500, unite: 'g' }]))).toBe('500 g + 2 pièces');
    expect(quantiteTotale([{ ficheId: 'x' }, {}])).toBe('');
    expect(esp(quantiteTotale([{ valeur: 0.25, unite: 'botte' }]))).toBe('1 botte');
    expect(esp(quantiteTotale([{ valeur: 0.5, unite: 'cuillère à café' }]))).toBe('0,5 c. à café');
  });

  it('quantité chiffrée d’un ingrédient (fiches pro et rédigées)', () => {
    expect(mesureIngredient({ nom: 'beurre', quantite: 0.04, unite: 'kg' }, 'afpa')).toEqual({ valeur: 0.04, unite: 'kg' });
    expect(mesureIngredient({ nom: 'farine', quantite_min: 0.2, quantite_max: 0.25, unite: 'kg' }, 'afpa')).toEqual({ valeur: 0.25, unite: 'kg' });
    expect(mesureIngredient({ nom: 'sel', pour_memoire: true }, 'afpa')).toEqual({ pm: true });
    // Quantité oubliée à l'extraction, relue dans la ligne d'origine
    expect(mesureIngredient({ nom: 'navet', unite: 'kg', texte_original: 'navet — kg — 0,260' }, 'cuisine-de-reference')).toEqual({ valeur: 0.26, unite: 'kg' });
    expect(mesureIngredient({ nom: 'Pomme', unite: 'kg', texte_original: 'Pomme 4 Pm' }, 'afpa')).toEqual({ valeur: 4, unite: 'pièce' });
    expect(mesureIngredient({ nom: 'radis', texte_original: '3 radis roses' }, 'marc-winer')).toEqual({ valeur: 3 });
    expect(mesureIngredient({ nom: 'coriandre', texte_original: 'coriandre pour servir' }, 'marc-winer')).toEqual({});
  });
});

describe('ajout d’une recette aux courses', () => {
  const fiche: Pick<Fiche, 'id' | 'source' | 'ingredients' | 'ingredients_supplementaires'> = {
    id: 'afpa-exemple',
    source: { id: 'afpa', nom: 'AFPA' },
    ingredients: [
      {
        items: [
          { nom: 'Oignons émincés', quantite: 0.2, unite: 'kg' },
          { nom: 'Sel fin', pour_memoire: true },
          { nom: 'Beurre', quantite: 0.05, unite: 'kg' },
          { nom: 'Huile', quantite: 0.02, unite: 'l', alternative_du_precedent: true },
          { nom: 'Persil', quantite: 1, unite: 'botte', optionnel: true },
        ],
      },
    ],
    ingredients_supplementaires: [{ titre: 'DENRÉES POUR LA GARNITURE', ingredients: [{ items: [{ nom: 'Carottes', quantite: 0.3, unite: 'kg' }] }] }],
  };

  it('quantités multipliées par le coefficient, choix cochés par défaut', () => {
    const [s1, s2] = propositionsDeLaFiche(fiche, 2);
    expect(s1.items.map((p) => [p.nom, esp(p.quantite), p.coche])).toEqual([
      ['Oignons', '400 g', true],
      ['Sel fin', 'PM', false],
      ['Beurre', '100 g', true],
      ['Huile', '4 cl', false],
      ['Persil', '2 bottes', false],
    ]);
    expect(s1.items[0].apport).toEqual({ ficheId: 'afpa-exemple', valeur: 400, unite: 'g' });
    expect(s1.items[1].apport).toEqual({ ficheId: 'afpa-exemple' });
    expect(s2.titre).toBe('Denrées pour la garniture');
    expect(s2.items[0].rayon).toBe('fruits-legumes');
  });

  it('fiche rédigée : la quantité en tête de ligne compte', () => {
    const [s] = propositionsDeLaFiche(
      {
        id: 'mw-exemple',
        source: { id: 'marc-winer', nom: 'MW' },
        ingredients: [
          {
            items: [
              { texte_original: '2 c. à soupe de sauce soja', nom: 'sauce soja', quantite: 2, unite: 'cuillère à soupe' },
              { texte_original: '3 oignons nouveaux', nom: 'oignons nouveaux' },
            ],
          },
        ],
      },
      1.5,
    );
    expect(s.items.map((p) => [p.nom, esp(p.quantite), p.rayon])).toEqual([
      ['Sauce soja', '3 c. à soupe', 'asiatique'],
      ['Oignons nouveaux', '5', 'fruits-legumes'],
    ]);
  });
});

describe('texte à partager', () => {
  it('seulement ce qui reste à acheter, par rayon', () => {
    const art = (nom: string, rayon: string, coche = false, apports: ArticleCourses['apports'] = []): ArticleCourses => ({
      id: nom, nom, cle: cleCourses(nom), rayon, apports, coche, ajouteLe: 0, modifieLe: 0,
    });
    const t = texteListe(
      [
        art('Beurre', 'cremerie', false, [{ valeur: 250, unite: 'g' }]),
        art('Carottes', 'fruits-legumes', false, [{ valeur: 1, unite: 'pièce' }, { valeur: 2, unite: 'pièce' }]),
        art('Papier cuisson', 'autres'),
        art('Lait', 'cremerie', true),
      ],
      new Date(2026, 8, 30),
    );
    expect(t).toBe(
      ['Courses — 30 sept. 2026', '', '🥬 Fruits et légumes', '- Carottes : 3', '', '🧀 Crèmerie, œufs', '- Beurre : 250 g', '', '🛒 Autres', '- Papier cuisson'].join('\n'),
    );
  });
});

describe.skipIf(!archiveDisponible)('sur la vraie archive', () => {
  const fiches = archiveDisponible ? archiveBrute().fiches.filter((f) => f.ingredients?.length) : [];

  it('toutes les fiches donnent une liste, et les quantités chiffrées sont reprises', () => {
    let items = 0;
    let chiffres = 0;
    let repris = 0;
    for (const f of fiches) {
      const sections = propositionsDeLaFiche(f, 1);
      const props = sections.flatMap((s) => s.items);
      const brut = (f.ingredients ?? []).flatMap((g) => g.items ?? []);
      items += brut.length;
      chiffres += brut.filter((i) => i.quantite !== undefined).length;
      repris += props.filter((p) => p.apport.valeur !== undefined).length;
      for (const p of props) expect(p.nom.trim(), f.id).not.toBe('');
    }
    expect(items).toBeGreaterThan(7000);
    expect(repris).toBeGreaterThanOrEqual(chiffres);
  });

  it('presque tous les ingrédients trouvent leur rayon (hors eau)', () => {
    let total = 0;
    let autres = 0;
    for (const f of fiches)
      for (const p of propositionsDeLaFiche(f).flatMap((s) => s.items)) {
        if (estToujoursLa(p.cle)) continue;
        total++;
        if (p.rayon === 'autres') autres++;
      }
    expect(autres / total).toBeLessThan(0.06);
  });
});
