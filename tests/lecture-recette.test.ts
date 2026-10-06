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
