// Mes recettes dans une base IndexedDB simulée : réimport, sauvegarde, recherche, Frigo. Exemples inventés.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { resumer } from '../src/lib/archive';
import { construireIndexIngredients } from '../src/lib/classement-frigo';
import { BaseGardeManger, remplacerRecettes } from '../src/lib/db';
import { analyserTexte, construireFiche } from '../src/lib/mes-recettes';
import { chercher, creerIndex } from '../src/lib/moteur';
import { documentDeRecherche } from '../src/lib/archive';
import { exporter, lireSauvegarde, restaurer, TABLES_VIDES } from '../src/lib/sauvegarde';

const fiche = construireFiche({
  ...analyserTexte(`Sirop de gingembre\nPour 1 bouteille\n100 g de gingembre frais\n200 g de sucre\nÉplucher et râper le gingembre, puis le cuire 15 minutes avec le sucre et 25 cl d'eau.`),
  typeDePlat: 'Boisson',
});

describe('Mes recettes', () => {
  it('au format des fiches : univers « Mes recettes », source perso', () => {
    const r = resumer(fiche);
    expect(r.univers).toEqual(['perso']);
    expect(r.source).toBe('perso');
    expect(r.nbIngredients).toBe(2);
    expect(r.typesDePlat).toEqual(['Boisson']);
  });

  it('un réimport de l’archive ne les efface pas', async () => {
    const base = new BaseGardeManger('test-mes-recettes-reimport');
    await base.mesRecettes.put(fiche);
    await remplacerRecettes(base, [{ id: 'afpa-x', type: 'recette', titre: 'X', source: { id: 'afpa', nom: 'AFPA' } }], []);
    expect(await base.mesRecettes.count()).toBe(1);
    base.close();
  });

  it('font partie de la sauvegarde et se restaurent (fusion)', async () => {
    const a = new BaseGardeManger('test-mes-recettes-a');
    await a.mesRecettes.put(fiche);
    const s = lireSauvegarde(JSON.parse(JSON.stringify(await exporter(a))));
    expect(s.donnees.mesRecettes).toHaveLength(1);
    const b = new BaseGardeManger('test-mes-recettes-b');
    const bilan = await restaurer({ ...s, donnees: { ...TABLES_VIDES(), mesRecettes: s.donnees.mesRecettes } }, b);
    expect(bilan.ajoutes).toBe(1);
    expect((await b.mesRecettes.get(fiche.id))?.titre).toBe('Sirop de gingembre');
    expect(await b.favoris.count()).toBe(0);
    a.close();
    b.close();
  });

  it('se retrouvent avec la recherche et dans le Frigo', () => {
    const index = creerIndex([documentDeRecherche(fiche)]);
    expect(chercher([index], 'gingembre')).toEqual([fiche.id]);
    expect(chercher([index], 'sirop gingembre')).toEqual([fiche.id]);
    const ing = construireIndexIngredients([fiche]);
    expect(ing.fiches[0].places.map((p) => p.noms[0])).toEqual(['gingembre frais', 'sucre']);
  });
});

describe('recherche : mes recettes passent devant l’archive', () => {
  it('même avec une archive bien plus grande (scores non comparables)', () => {
    const archive = creerIndex(
      Array.from({ length: 50 }, (_, i) => ({
        id: `afpa-${i}`,
        titre: i === 0 ? 'Gingembre confit au sirop' : `Plat ${i}`,
        ingredients: 'gingembre sucre',
        classement: '',
        texte: '',
      })),
    );
    const perso = creerIndex([documentDeRecherche(fiche)]);
    expect(chercher([perso, archive], 'gingembre')[0]).toBe(fiche.id);
    expect(chercher([perso, archive], 'gingembre').length).toBe(51);
    expect(chercher([perso, archive], 'sirop gingenbre')[0]).toBe(fiche.id); // faute de frappe
  });
});
