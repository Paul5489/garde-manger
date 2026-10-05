// Données personnelles dans une base IndexedDB simulée (fake-indexeddb) : magasins, sauvegarde, réimport.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { etatEtape } from '../src/lib/bocaux';
import { bocaux } from '../src/lib/bocaux.svelte';
import { construireIndexIngredients } from '../src/lib/classement-frigo';
import { courses } from '../src/lib/courses.svelte';
import { BaseGardeManger, db, remplacerRecettes } from '../src/lib/db';
import { propositionsDeLaFiche } from '../src/lib/liste-courses';
import { frigo } from '../src/lib/frigo.svelte';
import { perso } from '../src/lib/perso.svelte';
import { compter, ErreurSauvegarde, exporter, lireSauvegarde, nomFichierSauvegarde, restaurer } from '../src/lib/sauvegarde';
import type { Fiche } from '../src/lib/types';

const esp = (s: string) => s.replace(/[  ]/g, ' ');

function ficheExemple(id: string, items: { nom: string; quantite?: number; unite?: string }[]): Fiche {
  return { id, type: 'recette', titre: id, source: { id: 'afpa', nom: 'AFPA' }, ingredients: [{ items }] };
}

async function toutVider(base: BaseGardeManger) {
  await Promise.all(base.tables.map((t) => t.clear()));
}

describe('réimport des recettes', () => {
  it('ne touche jamais aux données personnelles', async () => {
    const base = new BaseGardeManger('test-reimport');
    await base.favoris.put({ ficheId: 'afpa-a', modifieLe: 1 });
    await base.notes.put({ ficheId: 'afpa-a', texte: 'Moins de sel', modifieLe: 1 });
    await base.courses.put({ id: 'c1', nom: 'Beurre', cle: 'beurre', rayon: 'cremerie', apports: [], coche: false, ajouteLe: 1, modifieLe: 1 });
    for (let i = 0; i < 2; i++)
      await remplacerRecettes(base, [ficheExemple('afpa-a', [])], [{ cle: 'archive', valeur: { nbFiches: 1 } }]);
    expect(await base.fiches.count()).toBe(1);
    expect(await base.favoris.count()).toBe(1);
    expect((await base.notes.get('afpa-a'))?.texte).toBe('Moins de sel');
    expect(await base.courses.count()).toBe(1);
    base.close();
  });
});

describe('favoris, notes et carnet', () => {
  beforeEach(async () => {
    await toutVider(db);
    await perso.charger();
  });

  it('favori ajouté puis retiré, gardé dans le téléphone', async () => {
    await perso.basculerFavori('afpa-a');
    await perso.basculerFavori('afpa-b');
    expect(perso.idsFavoris).toEqual(['afpa-b', 'afpa-a']);
    await perso.basculerFavori('afpa-b');
    await perso.charger();
    expect(perso.estFavori('afpa-a')).toBe(true);
    expect(perso.estFavori('afpa-b')).toBe(false);
  });

  it('note : enregistrée, puis effacée quand on la vide', async () => {
    await perso.definirNote('afpa-a', 'Doubler l’ail  ');
    await perso.charger();
    expect(perso.note('afpa-a')).toBe('Doubler l’ail');
    await perso.definirNote('afpa-a', '   ');
    expect(await db.notes.count()).toBe(0);
  });

  it('« cuisiné le… » : le plus récent d’abord', async () => {
    await perso.ajouterRealisation({ ficheId: 'afpa-a', date: '2026-09-12', note: 4 });
    await perso.ajouterRealisation({ ficheId: 'afpa-b', date: '2026-09-30', note: 5, commentaire: '  ' });
    await perso.ajouterRealisation({ ficheId: 'afpa-a', date: '2026-08-01', note: 3 });
    await perso.charger();
    expect(perso.realisations.map((r) => r.date)).toEqual(['2026-09-30', '2026-09-12', '2026-08-01']);
    expect(perso.realisations[0].commentaire).toBeUndefined();
    expect(perso.idsCuisines).toEqual(['afpa-b', 'afpa-a']);
    expect(perso.realisationsDe('afpa-a')).toHaveLength(2);
    await perso.supprimerRealisation(perso.realisations[0].id);
    expect(await db.realisations.count()).toBe(2);
  });
});

describe('liste de courses', () => {
  const soupe = ficheExemple('afpa-soupe', [
    { nom: 'Oignons émincés', quantite: 0.2, unite: 'kg' },
    { nom: 'Beurre', quantite: 0.03, unite: 'kg' },
  ]);
  const tarte = ficheExemple('afpa-tarte', [
    { nom: 'Oignons', quantite: 0.5, unite: 'kg' },
    { nom: 'Oignons', quantite: 2, unite: 'pièce' },
    { nom: 'Farine', quantite: 0.25, unite: 'kg' },
  ]);
  const ajouter = (f: Fiche, coef = 1) =>
    courses.ajouterRecette({ ficheId: f.id, titre: f.titre, coef }, propositionsDeLaFiche(f, coef).flatMap((s) => s.items));
  const article = (nom: string) => courses.articles.find((a) => a.nom === nom);
  const total = async (nom: string) => esp((await import('../src/lib/liste-courses')).quantiteTotale(article(nom)?.apports ?? []));

  beforeEach(async () => {
    await toutVider(db);
    await courses.charger();
  });

  it('fusionne les doublons de plusieurs recettes', async () => {
    await ajouter(soupe);
    await ajouter(tarte);
    expect(courses.articles.map((a) => a.nom).sort()).toEqual(['Beurre', 'Farine', 'Oignons']);
    expect(await total('Oignons')).toBe('700 g + 2 pièces');
    expect(courses.recettes.map((r) => r.ficheId)).toEqual(['afpa-tarte', 'afpa-soupe']);
  });

  it('rajouter une recette remplace ses quantités (autres portions)', async () => {
    await ajouter(soupe);
    await ajouter(soupe, 2);
    expect(await total('Oignons')).toBe('400 g');
    expect(courses.recettes).toHaveLength(1);
    expect(courses.recettes[0].coef).toBe(2);
  });

  it('retirer une recette garde ce qui vient d’ailleurs', async () => {
    await ajouter(soupe);
    await ajouter(tarte);
    await courses.ajouterLibre('beurre');
    await courses.retirerRecette('afpa-soupe');
    expect(await total('Oignons')).toBe('500 g + 2 pièces');
    expect(article('Beurre')?.apports).toEqual([{}]);
    expect(courses.recettes.map((r) => r.ficheId)).toEqual(['afpa-tarte']);
    await courses.charger();
    expect(courses.articles).toHaveLength(3);
  });

  it('articles libres, cases à cocher, rayons choisis à la main', async () => {
    await courses.ajouterLibre('  papier   cuisson ');
    await courses.ajouterLibre('Papier cuisson');
    expect(courses.articles).toHaveLength(1);
    const a = courses.articles[0];
    expect(a.nom).toBe('Papier cuisson');
    expect(a.rayon).toBe('autres');
    await courses.basculer(a.id);
    expect(courses.coches).toHaveLength(1);
    // Rajouté alors qu'il était coché : il redevient à acheter
    await courses.ajouterLibre('papier cuisson');
    expect(courses.restants).toHaveLength(1);
    await courses.changerRayon(a.id, 'epicerie-salee');
    await courses.supprimer(a.id);
    await courses.ajouterLibre('Papier cuisson');
    expect(courses.articles[0].rayon).toBe('epicerie-salee');
    await courses.basculer(courses.articles[0].id);
    await courses.retirerCoches();
    expect(await db.courses.count()).toBe(0);
  });
});

describe('avec ce que j’ai', () => {
  beforeEach(async () => {
    await toutVider(db);
    await frigo.charger();
  });

  it('ingrédients choisis : sans doublon, gardés dans le téléphone', async () => {
    await frigo.ajouter('poireaux');
    await frigo.ajouter('  Poireaux ');
    await frigo.ajouter('crème');
    await frigo.charger();
    expect(frigo.possedes).toEqual(['Poireaux', 'Crème']);
    await frigo.retirer('Poireaux');
    await frigo.vider();
    await frigo.charger();
    expect(frigo.possedes).toEqual([]);
  });

  it('placard et synonymes modifiables, puis retour à l’origine', async () => {
    expect(frigo.auPlacard('Beurre doux')).toBe(false);
    await frigo.ajouterAuPlacard('beurre');
    await frigo.retirerDuPlacard('Sucre');
    await frigo.charger();
    expect(frigo.placard).toEqual(['Beurre', 'Eau', 'Huile', 'Poivre', 'Sel']);
    expect(frigo.auPlacard('Beurre doux')).toBe(true);
    await frigo.definirPlacard(null);
    expect(frigo.placardModifie).toBe(false);

    await frigo.definirSynonymes([['Coriandre', 'Persil chinois']]);
    await frigo.charger();
    expect(frigo.synonymes).toEqual([['Coriandre', 'Persil chinois']]);
    expect([...frigo.dico.jetons('persil chinois')]).toEqual(['coriandre']);
    await frigo.definirSynonymes(null);
    expect(frigo.synonymesModifies).toBe(false);
  });

  it('classe les recettes de l’index enregistré à l’import', async () => {
    const index = construireIndexIngredients([
      ficheExemple('afpa-soupe', [{ nom: 'Poireaux' }, { nom: 'Pommes de terre' }, { nom: 'Sel' }]),
      ficheExemple('afpa-tarte', [{ nom: 'Pommes' }, { nom: 'Pâte brisée' }]),
    ]);
    await db.meta.put({ cle: 'ingredients', valeur: index });
    await frigo.chargerIndex('2026-09-30T10:00:00Z');
    expect(frigo.statutIndex).toBe('pret');
    await frigo.ajouter('Blancs de poireaux');
    expect(frigo.resultats.map((r) => [r.id, r.manquants])).toEqual([['afpa-soupe', ['Pommes de terre']]]);
  });
});

describe('mes bocaux', () => {
  beforeEach(async () => {
    await toutVider(db);
    await bocaux.charger();
  });

  const vinaigre = {
    nom: 'Vinaigre de poire',
    ficheId: 'noma-vinaigre',
    selPct: undefined,
    etapes: [
      { nom: 'Fermentation alcoolique', min: 7, max: 10, unite: 'jours' as const },
      { nom: 'Acétification', min: 10, max: 14, unite: 'jours' as const },
    ],
  };

  it('créer, passer à l’étape suivante, terminer : tout est gardé', async () => {
    const debut = new Date(Date.now() - 8 * 86_400_000);
    const b = await bocaux.creer({ ...vinaigre, notes: '  ', type: '' }, debut);
    expect(b.notes).toBeUndefined();
    expect(b.type).toBeUndefined();
    expect(bocaux.parRubrique.prets.map((x) => x.id)).toEqual([b.id]);
    await bocaux.etapeSuivante(b.id);
    await bocaux.charger();
    const b2 = bocaux.bocal(b.id)!;
    expect(b2.etapeCourante).toBe(1);
    expect(etatEtape(b2).ecoule).toBe(0);
    expect(bocaux.parRubrique['en-cours'].map((x) => x.id)).toEqual([b.id]);
    await bocaux.changerStatut(b.id, 'termine');
    expect(bocaux.bocal(b.id)?.finLe).toBeDefined();
    expect(bocaux.parRubrique.finis).toHaveLength(1);
  });

  it('modifier les réglages garde l’avancement', async () => {
    const b = await bocaux.creer(vinaigre, new Date());
    await bocaux.etapeSuivante(b.id);
    const debutEtape2 = bocaux.bocal(b.id)!.etapes[1].debut;
    await bocaux.modifier(b.id, { ...vinaigre, nom: 'Vinaigre de poire williams', poidsG: 1500 }, b.debut);
    const m = bocaux.bocal(b.id)!;
    expect([m.nom, m.poidsG, m.etapeCourante, m.etapes[1].debut]).toEqual(['Vinaigre de poire williams', 1500, 1, debutEtape2]);
  });

  it('journal : « goûté aujourd’hui », photos, suppression avec le bocal', async () => {
    const b = await bocaux.creer({ nom: 'Kimchi', etapes: [{ nom: 'Lacto', min: 5, max: 7, unite: 'jours' }] }, new Date(Date.now() - 4 * 86_400_000));
    expect(bocaux.parRubrique['a-gouter'].map((x) => x.nom)).toEqual(['Kimchi']);
    const n1 = await bocaux.ajouterAuJournal(b.id, '  Encore doux  ', 'data:image/jpeg;base64,AAAA');
    expect(n1.texte).toBe('Encore doux');
    expect(bocaux.parRubrique['a-gouter']).toEqual([]);
    expect(bocaux.aSignaler).toBe(0);
    expect((await bocaux.journalDe(b.id))[0].photo).toBe('data:image/jpeg;base64,AAAA');
    await bocaux.supprimerDuJournal(n1);
    expect(bocaux.bocal(b.id)?.derniereNoteLe).toBeUndefined();
    await bocaux.ajouterAuJournal(b.id, 'Acidulé');
    await bocaux.supprimer(b.id);
    expect(await db.journal.count()).toBe(0);
    expect(await db.bocaux.count()).toBe(0);
  });

  it('modèles réutilisables (sans dates)', async () => {
    const b = await bocaux.creer(vinaigre, new Date());
    await bocaux.etapeSuivante(b.id);
    const m = await bocaux.enregistrerModele(bocaux.bocal(b.id)!);
    expect(m.etapes.every((e) => e.debut === undefined)).toBe(true);
    await bocaux.charger();
    expect(bocaux.modeles.map((x) => x.nom)).toEqual(['Vinaigre de poire']);
    await bocaux.supprimerModele(m.id);
    expect(await db.modelesBocaux.count()).toBe(0);
  });

  it('bocaux et journal font partie de la sauvegarde', async () => {
    const b = await bocaux.creer({ nom: 'Kimchi', etapes: [{ nom: 'Lacto', unite: 'jours' }] }, new Date());
    await bocaux.ajouterAuJournal(b.id, 'Mis en bocal');
    const s = lireSauvegarde(JSON.parse(JSON.stringify(await exporter(db))));
    expect([compter(s).bocaux, compter(s).journal]).toEqual([1, 1]);
  });
});

describe('sauvegarde des données personnelles', () => {
  it('nom du fichier', () => {
    expect(nomFichierSauvegarde(new Date(2026, 8, 30))).toBe('garde-manger-sauvegarde-2026-09-30.json');
  });

  it('exporter puis restaurer sur un autre téléphone : tout revient', async () => {
    const a = new BaseGardeManger('test-telephone-a');
    const b = new BaseGardeManger('test-telephone-b');
    await a.favoris.bulkPut([{ ficheId: 'afpa-a', modifieLe: 1 }, { ficheId: 'mw-b', modifieLe: 2 }]);
    await a.notes.put({ ficheId: 'afpa-a', texte: 'Note', modifieLe: 1 });
    await a.realisations.put({ id: 'r1', ficheId: 'afpa-a', date: '2026-09-30', note: 5, modifieLe: 1 });
    await a.courses.put({ id: 'c1', nom: 'Beurre', cle: 'beurre', rayon: 'cremerie', apports: [{ ficheId: 'afpa-a', valeur: 30, unite: 'g' }], coche: false, ajouteLe: 1, modifieLe: 1 });
    await a.recettesCourses.put({ ficheId: 'afpa-a', titre: 'A', coef: 1, modifieLe: 1 });
    await a.reglages.put({ cle: 'rayons', valeur: { beurre: 'cremerie' }, modifieLe: 1 });
    await a.fiches.put(ficheExemple('afpa-a', []));

    const fichier = JSON.stringify(await exporter(a, 'test'));
    expect(fichier).not.toContain('"fiches"'); // jamais les recettes
    const s = lireSauvegarde(JSON.parse(fichier));
    expect(compter(s)).toEqual({
      favoris: 2,
      notes: 1,
      realisations: 1,
      courses: 1,
      recettesCourses: 1,
      reglages: 1,
      bocaux: 0,
      journal: 0,
      modelesBocaux: 0,
      mesRecettes: 0,
    });
    expect(await restaurer(s, b)).toEqual({ ajoutes: 7, misAJour: 0, inchanges: 0 });
    expect(await b.courses.get('c1')).toEqual(await a.courses.get('c1'));
    // Restaurer deux fois ne duplique rien
    expect(await restaurer(s, b)).toEqual({ ajoutes: 0, misAJour: 0, inchanges: 7 });
    a.close();
    b.close();
  });

  it('fusion : rien n’est effacé, la version la plus récente l’emporte', async () => {
    const base = new BaseGardeManger('test-fusion');
    await base.notes.bulkPut([
      { ficheId: 'ancienne', texte: 'du téléphone', modifieLe: 10 },
      { ficheId: 'recente', texte: 'du téléphone', modifieLe: 30 },
      { ficheId: 'locale', texte: 'seulement ici', modifieLe: 5 },
    ]);
    const s = lireSauvegarde({
      format: 'garde-manger-sauvegarde',
      version: 1,
      exporteLe: '2026-09-30T10:00:00Z',
      donnees: {
        notes: [
          { ficheId: 'ancienne', texte: 'de la sauvegarde', modifieLe: 20 },
          { ficheId: 'recente', texte: 'de la sauvegarde', modifieLe: 20 },
          { ficheId: 'nouvelle', texte: 'de la sauvegarde', modifieLe: 20 },
        ],
      },
    });
    expect(await restaurer(s, base)).toEqual({ ajoutes: 1, misAJour: 1, inchanges: 1 });
    const notes = Object.fromEntries((await base.notes.toArray()).map((n) => [n.ficheId, n.texte]));
    expect(notes).toEqual({
      ancienne: 'de la sauvegarde',
      recente: 'du téléphone',
      locale: 'seulement ici',
      nouvelle: 'de la sauvegarde',
    });
    base.close();
  });

  it('refuse les mauvais fichiers avec un message clair, écarte les éléments incomplets', () => {
    expect(() => lireSauvegarde({ genere_le: 'x', fiches: [] })).toThrow(/archive des recettes/);
    expect(() => lireSauvegarde({ bonjour: 1 })).toThrow(ErreurSauvegarde);
    expect(() => lireSauvegarde(null)).toThrow(/pas une sauvegarde/);
    expect(() => lireSauvegarde({ format: 'garde-manger-sauvegarde', version: 99, donnees: {} })).toThrow(/plus récente/);
    const s = lireSauvegarde({
      format: 'garde-manger-sauvegarde',
      version: 1,
      donnees: {
        favoris: [{ ficheId: 'a' }, { ficheId: '' }, null, 'x'],
        realisations: [{ id: 'r', ficheId: 'a' }],
      },
    });
    expect(s.donnees.favoris).toEqual([{ ficheId: 'a', modifieLe: 0 }]);
    expect(s.donnees.realisations).toEqual([]);
    expect(s.donnees.courses).toEqual([]);
  });
});
