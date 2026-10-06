// Façon gratuite : demande pour l'app Claude et lecture de la réponse recollée. Exemples inventés.
import { describe, expect, it } from 'vitest';
import { demandePourAppClaude, ErreurLecture, lireReponseClaude, ressembleReponseClaude, versFiche } from '../src/lib/lecture-recette';

const reponse = `Voici la fiche :
\`\`\`json
{
  "recette_trouvee": true,
  "probleme": null,
  "titre": "Soupe de potiron",
  "description": null,
  "type_de_plat": "Soupes et bouillons",
  "categorie": null,
  "cuisine": ["Française"],
  "portions": { "nombre": "4", "unite": "personnes" },
  "rendement": null,
  "temps": { "preparation_min": 15, "cuisson_min": 30, "repos_min": null, "repos_texte": null },
  "groupes": [ { "groupe": null, "ingredients": [
    { "texte": "800 g de potiron", "nom": "potiron", "quantite": 800, "quantite_max": null, "unite": "g", "optionnel": false, "alternative_du_precedent": false },
    { "texte": "20 cl de crème", "nom": "crème", "quantite": 20, "unite": "cl" },
    { "texte": "Sel, poivre", "nom": "sel" }
  ] } ],
  "etapes": [ { "titre": null, "texte": "Cuire le potiron 30 minutes." }, "Mixer avec la crème." ],
  "notes": [],
  "materiel": ["Mixeur"],
  "fermentation": null,
  "modifications_appliquees": ["Lait remplacé par de la crème"]
}
\`\`\`
Bon appétit !`;

describe('demande à coller dans l’app Claude', () => {
  it('contient les consignes, le modèle de réponse, les modifications et la recette', () => {
    const d = demandePourAppClaude({ texte: 'Ma recette…', consignes: 'sans lactose' });
    expect(d).toContain('Tout en français');
    expect(d).toContain('"groupes"');
    expect(d).toContain('Consignes de modification de Paul : sans lactose');
    expect(d).toContain('Ma recette…');
  });
  it('en mode photo, annonce la photo jointe', () => {
    expect(demandePourAppClaude({ photo: true })).toContain('photos jointes');
  });
});

describe('lecture de la réponse recollée', () => {
  it('trouve le bloc JSON au milieu du texte et tolère les champs manquants', () => {
    expect(ressembleReponseClaude(reponse)).toBe(true);
    expect(ressembleReponseClaude('200 g de farine\nMélanger')).toBe(false);
    const r = lireReponseClaude(reponse);
    expect(r.titre).toBe('Soupe de potiron');
    expect(r.portions).toEqual({ nombre: 4, unite: 'personnes' });
    expect(r.groupes[0].ingredients).toHaveLength(3);
    expect(r.groupes[0].ingredients[1]).toMatchObject({ quantite: 20, unite: 'cl', quantite_max: null, optionnel: false });
    expect(r.etapes).toEqual([
      { titre: null, texte: 'Cuire le potiron 30 minutes.' },
      { titre: null, texte: 'Mixer avec la crème.' },
    ]);
    const f = versFiche(r, undefined, true);
    expect(f.source.id).toBe('perso');
    expect(f.portions?.nombre).toBe(4);
    expect(f.temps?.cuisson?.minutes).toBe(30);
    expect(f.texte_source).toBe('(lue sur photo)');
  });

  it('messages clairs quand ce n’est pas la bonne réponse', () => {
    expect(() => lireReponseClaude('Bonjour !')).toThrow(ErreurLecture);
    expect(() => lireReponseClaude('{ "titre": "Soupe", "groupes": [')).toThrow(/incomplète/);
    expect(() => lireReponseClaude('{ "recette_trouvee": false, "probleme": "Photo floue" }')).toThrow('Photo floue');
    expect(() => lireReponseClaude('{ "groupes": [] }')).toThrow(/titre/);
  });
});

describe('fiche construite depuis la réponse de Claude', async () => {
  const { construireFiche, ficheVersBrouillon } = await import('../src/lib/mes-recettes');
  const { ligneIngredient } = await import('../src/lib/quantites');
  const r = lireReponseClaude(`{
    "titre": "Thé glacé à la pêche", "type_de_plat": "Boisson fraîche", "materiel": ["Une grande carafe"],
    "groupes": [{ "groupe": "Sirop", "ingredients": [
      { "texte": "2 c. à s. de miel", "nom": "miel", "quantite": 2, "unite": "c. à s." },
      { "texte": "4 à 5 sachets de thé noir", "nom": "thé noir", "quantite": 4, "quantite_max": 5, "unite": "sachets" },
      { "texte": "200 grammes de pêches", "nom": "pêches", "quantite": 200, "unite": "grammes" },
      { "texte": "1 tsp de cannelle", "nom": "cannelle", "quantite": 1, "unite": "tsp", "optionnel": true }
    ] }],
    "etapes": [{ "titre": "Infuser", "texte": "Infuser le thé 5 minutes." }]
  }`);
  const fiche = versFiche(r);

  it('unités écrites librement ramenées à celles des fiches, fourchettes gardées', () => {
    expect(fiche.ingredients?.[0].groupe).toBe('Sirop');
    expect(fiche.ingredients?.[0].items?.map((i) => i.unite)).toEqual(['cuillère à soupe', 'sachet', 'g', 'cuillère à café']);
    expect(fiche.ingredients?.[0].items?.[1]).toMatchObject({ quantite_min: 4, quantite_max: 5 });
    expect(fiche.ingredients?.[0].items?.[3].optionnel).toBe(true);
    expect(fiche.classement?.type_de_plat).toEqual(['Boisson fraîche']);
    expect(fiche.etapes?.[0]).toMatchObject({ numero: 1, phase: 'Infuser' });
    expect(ligneIngredient(fiche.ingredients![0].items![1], 'perso', 2).quantite).toBe('8 à 10');
  });

  it('le formulaire non retouché garde exactement ce que Claude a rendu', () => {
    const f2 = construireFiche(ficheVersBrouillon(fiche), fiche);
    expect(f2.id).toBe(fiche.id);
    expect(f2.ingredients).toEqual(fiche.ingredients);
    expect(f2.etapes).toEqual(fiche.etapes);
    expect(f2.materiel).toEqual(['Une grande carafe']);
    const b = ficheVersBrouillon(fiche);
    const f3 = construireFiche({ ...b, ingredients: b.ingredients + '\n2 cuillères à soupe de sucre' }, fiche);
    expect(f3.ingredients?.flatMap((g) => g.items ?? [])).toHaveLength(5);
  });
});
