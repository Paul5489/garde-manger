// Lecture d'une recette par Claude : réponses de l'API simulées (aucun appel réel, aucun coût).
// Exemples inventés.
import { describe, expect, it } from 'vitest';
import { analyserRecette, testerCle } from '../src/lib/claude';
import { construireFiche, ficheVersBrouillon } from '../src/lib/mes-recettes';
import { ligneIngredient } from '../src/lib/quantites';

const lue = {
  recette_trouvee: true,
  probleme: null,
  titre: 'Thé glacé à la pêche',
  description: 'Un thé froid parfumé.',
  type_de_plat: 'Boisson',
  categorie: 'Boissons',
  cuisine: ['Française'],
  portions: null,
  rendement: 'Environ 1 litre',
  temps: { preparation_min: 10, cuisson_min: 5, repos_min: 120, repos_texte: '2 h au frais' },
  groupes: [
    {
      groupe: null,
      ingredients: [
        { texte: "1 litre d'eau", nom: 'eau', quantite: 1, quantite_max: null, unite: 'l', optionnel: false, alternative_du_precedent: false },
        { texte: '4 à 5 sachets de thé noir', nom: 'thé noir', quantite: 4, quantite_max: 5, unite: 'sachet', optionnel: false, alternative_du_precedent: false },
        { texte: '2 pêches bien mûres', nom: 'pêches', quantite: 2, quantite_max: null, unite: 'pièce', optionnel: false, alternative_du_precedent: false },
        { texte: '1 pincée de cannelle', nom: 'cannelle', quantite: 1, quantite_max: null, unite: 'pincée', optionnel: true, alternative_du_precedent: false },
      ],
    },
  ],
  etapes: [
    { titre: 'Infuser', texte: "Porter l'eau à frémissement et infuser le thé 5 minutes." },
    { titre: null, texte: 'Ajouter les pêches en morceaux et laisser refroidir 2 heures au frais.' },
  ],
  notes: ['Se garde 2 jours au réfrigérateur.'],
  materiel: ['Une grande carafe'],
  fermentation: null,
  modifications_appliquees: ['Sucre remplacé par du miel'],
};

function reponseApi(corps: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const message = (contenu: unknown, stop = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: JSON.stringify(contenu) }],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 3000, output_tokens: 2000 },
});

describe('lecture par Claude (réponses simulées)', () => {
  it('transforme la réponse en fiche au format de l’appli', async () => {
    const r = await analyserRecette({ cle: 'sk-ant-test', texte: 'recette…', consignes: 'miel', fetch: reponseApi(message(lue)) });
    const f = r.fiche;
    expect(f.id).toMatch(/^perso-the-glace-a-la-peche-/);
    expect(f.source.id).toBe('perso');
    expect(f.classement).toMatchObject({ type_de_plat: ['Boisson'], categorie: 'Boissons', cuisine: ['Française'] });
    expect(f.temps).toMatchObject({ preparation: { minutes: 10 }, cuisson: { minutes: 5 }, repos: { texte: '2 h au frais', minutes: 120 } });
    expect(f.ingredients?.[0].items?.[1]).toMatchObject({ nom: 'thé noir', quantite: 4, quantite_min: 4, quantite_max: 5, unite: 'sachet' });
    expect(f.ingredients?.[0].items?.[3]).toMatchObject({ optionnel: true });
    expect(f.etapes?.[0]).toMatchObject({ numero: 1, phase: 'Infuser' });
    expect(f.etapes?.[1].phase).toBeUndefined();
    expect(f.materiel).toEqual(['Une grande carafe']);
    expect(f.texte_source).toBe('recette…');
    expect(r.modifications).toEqual(['Sucre remplacé par du miel']);
    // 3000 × 4 $ + 2000 × 20 $ par million de jetons
    expect(r.coutDollars).toBeCloseTo(0.052, 5);
    // Affichage et mise à l'échelle comme les autres fiches
    const l = ligneIngredient(f.ingredients![0].items![1], 'perso', 2);
    expect(l.quantite).toBe('8 à 10');
  });

  it('le formulaire non retouché garde exactement ce que Claude a lu', async () => {
    const { fiche } = await analyserRecette({ cle: 'k', texte: 't', fetch: reponseApi(message(lue)) });
    const f2 = construireFiche(ficheVersBrouillon(fiche), fiche);
    expect(f2.id).toBe(fiche.id);
    expect(f2.ingredients).toEqual(fiche.ingredients);
    expect(f2.etapes).toEqual(fiche.etapes);
    expect(f2.materiel).toEqual(['Une grande carafe']);
    const b = ficheVersBrouillon(fiche);
    const f3 = construireFiche({ ...b, ingredients: b.ingredients + '\n2 cuillères à soupe de miel' }, fiche);
    expect(f3.ingredients?.[0].items).toHaveLength(5);
  });

  it('pas de recette lisible : message de Claude', async () => {
    const vide = { ...lue, recette_trouvee: false, probleme: 'La photo est floue.' };
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: reponseApi(message(vide)) })).rejects.toThrow('La photo est floue.');
  });

  it('erreurs traduites en français', async () => {
    const erreur = (type: string, status: number) =>
      reponseApi({ type: 'error', error: { type, message: 'detail' } }, status);
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: erreur('authentication_error', 401) })).rejects.toThrow(/Clé Claude refusée/);
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: erreur('billing_error', 402) })).rejects.toThrow(/plus de crédit/);
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: erreur('rate_limit_error', 429) })).rejects.toThrow(/réessaie dans une minute/);
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: erreur('overloaded_error', 529) })).rejects.toThrow(/surchargé/);
    const horsLigne = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: horsLigne })).rejects.toThrow(/besoin d'Internet/);
    await expect(testerCle('k', erreur('authentication_error', 401))).rejects.toThrow(/Clé Claude refusée/);
  });

  it('réponse coupée ou refusée', async () => {
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: reponseApi(message(lue, 'max_tokens')) })).rejects.toThrow(/trop longue/);
    await expect(analyserRecette({ cle: 'k', texte: 't', fetch: reponseApi(message(lue, 'refusal')) })).rejects.toThrow(/refusé/);
  });
});

describe('unités écrites librement par Claude', () => {
  it('ramenées aux unités des fiches', async () => {
    const autre = {
      ...lue,
      type_de_plat: 'Boisson fraîche',
      groupes: [
        {
          groupe: 'Sirop',
          ingredients: [
            { texte: '2 c. à s. de miel', nom: 'miel', quantite: 2, quantite_max: null, unite: 'c. à s.', optionnel: false, alternative_du_precedent: false },
            { texte: '3 gousses d’ail', nom: 'ail', quantite: 3, quantite_max: null, unite: 'gousses', optionnel: false, alternative_du_precedent: false },
            { texte: '200 grammes de sucre', nom: 'sucre', quantite: 200, quantite_max: null, unite: 'grammes', optionnel: false, alternative_du_precedent: false },
            { texte: '1 tsp de sel', nom: 'sel', quantite: 1, quantite_max: null, unite: 'tsp', optionnel: false, alternative_du_precedent: false },
          ],
        },
      ],
    };
    const { fiche } = await analyserRecette({ cle: 'k', texte: 't', fetch: reponseApi(message(autre)) });
    expect(fiche.ingredients?.[0].items?.map((i) => i.unite)).toEqual(['cuillère à soupe', 'gousse', 'g', 'cuillère à café']);
    expect(fiche.ingredients?.[0].groupe).toBe('Sirop');
    expect(fiche.classement?.type_de_plat).toEqual(['Boisson fraîche']);
  });
});
