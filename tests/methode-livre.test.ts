// Fiches AFPA complétées par La Cuisine de référence (méthode du livre, quantités AFPA).
import { describe, expect, it } from 'vitest';
import { empreinte, estExclue } from '../src/lib/exclusions';
import { construireFiche, ficheVersBrouillon } from '../src/lib/mes-recettes';
import {
  associer,
  completerAvecLeLivre,
  detaillerEtapes,
  NOMBRE_PAIRES,
  paireDuLivre,
  ressemblance,
} from '../src/lib/methode-livre';
import type { Etape, Fiche } from '../src/lib/types';
import { archiveBrute, archiveDisponible } from './archive-reelle';

const etapes = (...textes: string[]): Etape[] => textes.map((texte, i) => ({ numero: i + 1, texte }));

describe('rapprochement des étapes', () => {
  it('reconnaît la même étape écrite autrement', () => {
    expect(ressemblance('Réaliser la pâte à tarte', 'Confectionner la pâte à tarte')).toBe(1);
    expect(ressemblance('Cuire les crevettes', 'Marquer les crevettes en cuisson')).toBeGreaterThan(0.45);
    expect(ressemblance('Éplucher les navets (10 min)', 'Eplucher les navets')).toBe(1);
  });

  it('ne confond pas deux préparations qui partagent un mot courant', () => {
    expect(ressemblance("Réaliser l'appareil à gaufres", "Réaliser l'appareil à flan")).toBeLessThan(0.45);
    expect(ressemblance('Dresser le canard et la sauce au miel', 'Confectionner la sauce au miel')).toBeLessThan(0.45);
  });

  it("respecte l'ordre des deux méthodes", () => {
    const plan = etapes('Préparer le poste', 'Tailler les navets', 'Cuire les navets', 'Servir les navets');
    const livre = etapes('Préparer le poste', 'Éplucher et tailler les navets', 'Marquer les navets en cuisson');
    expect(associer(plan, livre)).toEqual([0, 1, 2, -1]);
  });
});

describe('compléter une fiche AFPA', () => {
  const afpa: Fiche = {
    id: 'afpa-essai',
    type: 'recette',
    titre: 'Navets glacés',
    source: { id: 'afpa', nom: 'AFPA' },
    portions: { nombre: 4 },
    ingredients: [{ items: [{ nom: 'Navets', quantite: 400, unite: 'g' }] }],
    etapes: etapes('Tailler les navets', 'Glacer les navets au sucre', 'Servir chaud'),
  };
  const livre: Fiche = {
    id: 'cr-essai',
    type: 'recette',
    titre: 'Navets glacés du livre',
    source: { id: 'cuisine-de-reference', nom: 'Livre' },
    portions: { nombre: 8, unite: 'couverts' },
    etapes: [
      { numero: 1, texte: 'Éplucher les navets' },
      { numero: 2, texte: 'Tailler les navets', details: ['En bâtonnets réguliers.'], renvois_pages: ['42'] },
      { numero: 3, texte: 'Glacer les navets', details: ['Beurre, sucre, eau à hauteur.'], duree: { texte: '20 min', minutes: 20 } },
    ],
  };

  it('plat proche : garde les étapes AFPA et ajoute les explications du livre', () => {
    const f = completerAvecLeLivre(afpa, livre, 'proche');
    expect(f.etapes!.map((e) => e.texte)).toEqual(afpa.etapes!.map((e) => e.texte));
    expect(f.etapes![0].details).toEqual(['En bâtonnets réguliers.']);
    expect(f.etapes![0].renvois_pages).toEqual(['42']);
    expect(f.etapes![1].duree?.minutes).toBe(20);
    expect(f.etapes![2].details).toBeUndefined();
    expect(f.methode_livre).toEqual({ id: 'cr-essai', titre: 'Navets glacés du livre', lien: 'proche', portions: '8 couverts', plan: afpa.etapes });
  });

  it('même plat : la méthode du livre remplace le plan, quantités et ingrédients AFPA gardés', () => {
    const f = completerAvecLeLivre(afpa, livre, 'meme');
    expect(f.etapes!.map((e) => e.texte)).toEqual(livre.etapes!.map((e) => e.texte));
    expect(f.ingredients).toBe(afpa.ingredients);
    expect(f.portions).toBe(afpa.portions);
    expect(f.methode_livre?.plan).toBe(afpa.etapes);
  });

  it('préparation de base : simple lien vers la fiche technique, étapes inchangées', () => {
    const f = completerAvecLeLivre(afpa, { ...livre, type: 'technique', etapes: undefined }, 'technique');
    expect(f.etapes).toBe(afpa.etapes);
    expect(f.methode_livre).toEqual({ id: 'cr-essai', titre: 'Navets glacés du livre', lien: 'technique' });
  });

  it("n'invente rien quand aucune étape ne correspond", () => {
    expect(detaillerEtapes(etapes('Laver la salade'), etapes('Monter la mayonnaise'))).toEqual(etapes('Laver la salade'));
  });
});

describe.skipIf(!archiveDisponible)('paires AFPA ↔ livre sur la vraie archive', () => {
  const fiches = archiveDisponible ? (archiveBrute().fiches as Fiche[]) : [];
  const parEmpreinte = new Map<string, Fiche[]>();
  for (const f of fiches) parEmpreinte.set(empreinte(f.id), [...(parEmpreinte.get(empreinte(f.id)) ?? []), f]);
  const completees = fiches.flatMap((f) => {
    const p = f.source.id === 'afpa' ? paireDuLivre(f.id) : undefined;
    if (!p) return [];
    const livre = parEmpreinte.get(p.livre) ?? [];
    return [{ afpa: f, livre, lien: p.lien }];
  });

  it('chaque paire relie une recette AFPA à une seule fiche du livre', () => {
    expect(completees.length).toBe(NOMBRE_PAIRES);
    for (const { afpa, livre, lien } of completees) {
      expect(afpa.type, afpa.id).toBe('recette');
      expect(livre.length, afpa.id).toBe(1);
      expect(livre[0].source.id).toBe('cuisine-de-reference');
      expect(estExclue(livre[0].id)).toBe(false);
      expect(livre[0].type, afpa.id).toBe(lien === 'technique' ? 'technique' : 'recette');
    }
  });

  it('les étapes sont détaillées, les ingrédients et les quantités AFPA intacts', () => {
    for (const { afpa, livre, lien } of completees) {
      const f = completerAvecLeLivre(afpa, livre[0], lien);
      expect(f.ingredients, afpa.id).toEqual(afpa.ingredients);
      expect(f.portions, afpa.id).toEqual(afpa.portions);
      expect(f.methode_livre?.lien, afpa.id).toBe(lien);
      if (lien === 'technique') continue;
      const detaillees = f.etapes!.filter((e) => e.details?.length).length;
      expect(detaillees, afpa.id).toBeGreaterThanOrEqual(3);
      expect(f.methode_livre?.portions, afpa.id).toMatch(/^\d+ /);
      if (lien === 'proche') expect(f.etapes!.map((e) => e.texte)).toEqual(afpa.etapes!.map((e) => e.texte));
    }
  });

  it('une fiche complétée se modifie et se réenregistre sans rien perdre', () => {
    for (const { afpa, livre, lien } of completees) {
      const f = completerAvecLeLivre(afpa, livre[0], lien);
      const g = construireFiche(ficheVersBrouillon(f), f);
      delete g.modifieLe;
      expect(g, afpa.id).toEqual(f);
    }
  });
});
