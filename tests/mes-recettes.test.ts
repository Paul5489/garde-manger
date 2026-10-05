// Mes recettes : ajoutées hors archive (par un fichier de sauvegarde), jamais effacées par un réimport.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { construireIndexIngredients } from '../src/lib/classement-frigo';
import { db, remplacerRecettes } from '../src/lib/db';
import { etat } from '../src/lib/etat.svelte';
import { frigo } from '../src/lib/frigo.svelte';
import { creerIndex } from '../src/lib/moteur';
import { documentDeRecherche, resumer } from '../src/lib/archive';
import { compter, exporter, lireSauvegarde, restaurer } from '../src/lib/sauvegarde';
import type { Fiche } from '../src/lib/types';

// Exemples inventés (aucune recette réelle dans le dépôt).
const tisane: Fiche = {
  id: 'perso-tisane-test',
  type: 'recette',
  titre: 'Tisane de verveine glacée',
  source: { id: 'notes-perso', nom: 'Mes recettes' },
  portions: { nombre: 4, unite: 'verres' },
  ingredients: [{ items: [{ nom: 'Verveine séchée', quantite: 10, unite: 'g' }, { nom: 'Eau', quantite: 1, unite: 'l' }] }],
  etapes: [{ numero: 1, texte: 'Infuser, filtrer, refroidir.' }],
};

const soupe: Fiche = {
  id: 'afpa-soupe',
  type: 'recette',
  titre: 'Soupe exemple',
  source: { id: 'afpa', nom: 'AFPA' },
  ingredients: [{ items: [{ nom: 'Poireaux' }] }],
};

async function importer(fiches: Fiche[]) {
  await remplacerRecettes(db, fiches, [
    { cle: 'catalogue', valeur: fiches.map(resumer) },
    { cle: 'index', valeur: JSON.stringify(creerIndex(fiches.map(documentDeRecherche))) },
    { cle: 'ingredients', valeur: construireIndexIngredients(fiches) },
    { cle: 'archive', valeur: { nbFiches: fiches.length, importeLe: '2026-10-01T10:00:00Z', ignorees: 0 } },
  ]);
}

function fichierAvec(mesRecettes: unknown[]) {
  return { format: 'garde-manger-sauvegarde', version: 1, exporteLe: '2026-10-05T10:00:00Z', donnees: { mesRecettes } };
}

describe('mes recettes', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await importer([soupe]);
    await etat.demarrer();
  });

  it('s’ajoutent par un fichier de sauvegarde, sans rien effacer', async () => {
    const s = lireSauvegarde(fichierAvec([{ ...tisane, modifieLe: 1 }]));
    expect(compter(s).mesRecettes).toBe(1);
    expect((await restaurer(s)).ajoutes).toBe(1);
    await etat.demarrer();
    expect(etat.catalogue.map((r) => r.id)).toEqual(['afpa-soupe', 'perso-tisane-test']);
    expect((await etat.fiche('perso-tisane-test'))?.titre).toBe('Tisane de verveine glacée');
    expect((await etat.fiche('afpa-soupe'))?.titre).toBe('Soupe exemple');
  });

  it('écarte une fiche incomplète ou de source inconnue', () => {
    const s = lireSauvegarde(
      fichierAvec([
        { ...tisane, id: 'a', type: 'plat', modifieLe: 1 },
        { ...tisane, id: 'b', source: { id: 'inconnue', nom: '?' }, modifieLe: 1 },
        { id: 'c', modifieLe: 1 },
        { ...tisane, modifieLe: 1 },
      ]),
    );
    expect(s.donnees.mesRecettes.map((r) => r.id)).toEqual(['perso-tisane-test']);
  });

  it('se retrouvent dans la recherche, le Frigo et la sauvegarde', async () => {
    await restaurer(lireSauvegarde(fichierAvec([{ ...tisane, modifieLe: 1 }])));
    await etat.demarrer();
    const index = await etat.chargerIndex();
    expect(index?.search('verveine').map((r) => r.id)).toEqual(['perso-tisane-test']);
    expect(index?.search('poireaux').map((r) => r.id)).toEqual(['afpa-soupe']);

    await frigo.chargerIndex(etat.versionRecettes, etat.mesRecettes);
    await frigo.vider();
    await frigo.ajouter('Verveine');
    expect(frigo.resultats[0]).toMatchObject({ id: 'perso-tisane-test', manquants: [] });

    expect((await exporter(db)).donnees.mesRecettes.map((r) => r.id)).toEqual(['perso-tisane-test']);
  });

  it('restent après un réimport de l’archive', async () => {
    await restaurer(lireSauvegarde(fichierAvec([{ ...tisane, modifieLe: 1 }])));
    await importer([soupe]);
    await etat.demarrer();
    expect(etat.parId.has('perso-tisane-test')).toBe(true);
  });
});
