// « Que veux-tu cuisiner ? » : classement de chaque fiche par type de plat, vérifié sur la vraie archive.
import { describe, expect, it } from 'vitest';
import { lireArchive, resumer } from '../src/lib/archive';
import { rubriqueDe, RUBRIQUES, type Rubrique } from '../src/lib/rubriques';
import { archiveBrute, archiveDisponible } from './archive-reelle';

describe.skipIf(!archiveDisponible)('types de plat sur la vraie archive', () => {
  const resumes = archiveDisponible ? lireArchive(structuredClone(archiveBrute())).fiches.map(resumer) : [];
  const de = (id: string) => rubriqueDe(resumes.find((r) => r.id === id)!);

  it('chaque type de plat a des fiches', () => {
    const compte = new Map<Rubrique, number>();
    for (const r of resumes) compte.set(rubriqueDe(r), (compte.get(rubriqueDe(r)) ?? 0) + 1);
    for (const { id } of RUBRIQUES) {
      if (id === 'boissons') continue; // aucune boisson dans l'archive (seulement dans mes recettes)
      expect(compte.get(id) ?? 0, id).toBeGreaterThan(5);
    }
    expect(compte.get('plats')! / resumes.length).toBeLessThan(0.45); // « Plats » n'est pas un fourre-tout
  });

  it('exemples', () => {
    expect(de('mw-sauce-chien')).toBe('sauces');
    expect(de('cr-potage-julienne-darblay')).toBe('soupes');
    expect(de('cr-consomme-de-boeuf-brunoise')).toBe('soupes');
    expect(de('afpa-creme-anglaise')).toBe('desserts');
    expect(de('afpa-pomme-darphin')).toBe('accompagnements');
    expect(de('afpa-oeufs-brouille-a-la-portugaise')).toBe('entrees');
    expect(de('afpa-steak-au-poivre')).toBe('plats');
    expect(de('noma-vinaigre-de-poire')).toBe('fermentation');
    expect(de('noma-chapitre-koji')).toBe('fermentation');
    expect(de('cr-les-legumes-les-haricots')).toBe('techniques');
    expect(de('afpa-sauce-bechamel-et-derives')).toBe('sauces');
  });
});

describe('mes recettes', () => {
  it('rangées d’après leur type de plat', () => {
    const r = { type: 'recette' as const, source: 'perso' as const, categorie: 'Boissons', typesDePlat: ['Boisson'], titre: 'Bissap', univers: ['perso' as const] };
    expect(rubriqueDe(r)).toBe('boissons');
    expect(rubriqueDe({ ...r, typesDePlat: ['Dessert'], categorie: undefined })).toBe('desserts');
    expect(rubriqueDe({ ...r, typesDePlat: [], categorie: undefined })).toBe('plats');
  });
});
