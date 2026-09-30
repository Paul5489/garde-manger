import { describe, expect, it } from 'vitest';
import {
  debutDegustation,
  etatEtape,
  evenementsCalendrier,
  fichierIcs,
  joursEntre,
  libelleAvancement,
  libelleDuree,
  nouveauBocal,
  reglagesDepuisFiche,
  rubrique,
  selEnGrammes,
  type Bocal,
} from '../src/lib/bocaux';
import { archiveBrute, archiveDisponible } from './archive-reelle';

/** Date locale : j(1, 10) = 1er octobre 2026 à 10 h. */
const j = (jour: number, h = 10, mois = 10) => new Date(2026, mois - 1, jour, h, 0);

function bocal(etapes: Bocal['etapes'], debut = j(1), autres: Partial<Bocal> = {}): Bocal {
  return { ...nouveauBocal({ nom: 'Kimchi', etapes }, debut, 'b1'), ...autres };
}

describe('calcul des jours', () => {
  it('jours de calendrier, quelle que soit l’heure', () => {
    expect(joursEntre(j(1, 23), j(2, 1))).toBe(1);
    expect(joursEntre(j(1, 1), j(1, 23))).toBe(0);
    expect(joursEntre(j(30, 12, 9), j(4, 12))).toBe(4);
  });

  it('passage à l’heure d’hiver (25 octobre) et fin d’année', () => {
    expect(joursEntre(j(24, 23), j(26, 0))).toBe(2);
    expect(joursEntre(new Date(2026, 11, 30), new Date(2027, 0, 2))).toBe(3);
    expect(joursEntre(new Date(2027, 2, 27, 12), new Date(2027, 2, 29, 12))).toBe(2); // heure d'été
  });

  it('« 5 à 7 jours » : en cours, à goûter, prêt, dépassé', () => {
    const b = bocal([{ nom: 'Lacto-fermentation', min: 5, max: 7, unite: 'jours' }]);
    const suite = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
      const e = etatEtape(b, j(d, 20));
      return [libelleAvancement(e), e.phase];
    });
    expect(suite).toEqual([
      ["Mis en bocal aujourd'hui", 'attente'],
      ['Jour 1 sur 5 à 7', 'attente'],
      ['Jour 2 sur 5 à 7', 'attente'],
      ['Jour 3 sur 5 à 7', 'attente'],
      ['Jour 4 sur 5 à 7', 'a-gouter'],
      ['Jour 5 sur 5 à 7', 'pret'],
      ['Jour 6 sur 5 à 7', 'pret'],
      ['Jour 7 sur 5 à 7', 'pret'],
      ['Jour 8 sur 5 à 7', 'depasse'],
    ]);
    expect(etatEtape(b, j(4)).progression).toBeCloseTo(3 / 7);
    expect(etatEtape(b, j(1)).finMin).toEqual(j(6));
    expect(etatEtape(b, j(1)).finMax).toEqual(j(8));
  });

  it('début de dégustation selon la durée', () => {
    expect(debutDegustation({ nom: '', min: 5, max: 7, unite: 'jours' })).toBe(4);
    expect(debutDegustation({ nom: '', min: 14, max: 14, unite: 'jours' })).toBe(11);
    expect(debutDegustation({ nom: '', min: 1, max: 2, unite: 'jours' })).toBe(1);
    expect(debutDegustation({ nom: '', min: 8, max: 8, unite: 'heures' })).toBe(8);
    expect(debutDegustation({ nom: '', unite: 'jours' })).toBeUndefined();
  });

  it('étapes en heures (koji)', () => {
    const b = bocal([{ nom: 'Culture du koji', min: 48, max: 48, unite: 'heures' }], j(1, 8));
    expect(libelleAvancement(etatEtape(b, j(2, 11)))).toBe('27 h sur 48 h');
    expect(etatEtape(b, j(2, 11)).phase).toBe('attente');
    expect(etatEtape(b, j(3, 8)).phase).toBe('pret');
    expect(etatEtape(b, j(3, 10)).phase).toBe('depasse');
  });

  it('étapes successives : la suivante commence quand on y passe', () => {
    const etapes: Bocal['etapes'] = [
      { nom: 'Fermentation alcoolique', min: 7, max: 10, unite: 'jours', temperatureC: 18 },
      { nom: 'Acétification', min: 10, max: 14, unite: 'jours', temperatureC: 21 },
    ];
    const b = bocal(etapes);
    expect(etatEtape(b, j(9)).phase).toBe('pret');
    // Passage à l'étape 2 le 10 octobre
    const b2 = { ...b, etapeCourante: 1, etapes: [etapes[0], { ...etapes[1], debut: j(10, 9).toISOString() }] };
    const e = etatEtape(b2, j(13));
    expect([e.index, libelleAvancement(e), e.phase, e.derniere]).toEqual([1, 'Jour 3 sur 10 à 14', 'attente', true]);
  });

  it('durée libre et sel à peser', () => {
    const b = bocal([{ nom: 'Fermentation', unite: 'jours' }], j(1), { poidsG: 1250, selPct: 2 });
    expect(libelleAvancement(etatEtape(b, j(4)))).toBe('Jour 3');
    expect(etatEtape(b, j(4)).phase).toBe('sans-duree');
    expect(selEnGrammes(b)).toBe(25);
    expect(libelleDuree({ min: 5, max: 7, unite: 'jours' })).toBe('5 à 7 jours');
  });

  it('rubriques : à goûter aujourd’hui (sauf si déjà goûté), prêts, en cours, finis', () => {
    const b = bocal([{ nom: 'Lacto', min: 5, max: 7, unite: 'jours' }]);
    expect(rubrique(b, j(3))).toBe('en-cours');
    expect(rubrique(b, j(5, 18))).toBe('a-gouter'); // jour 4
    expect(rubrique({ ...b, derniereNoteLe: j(5, 9).toISOString() }, j(5, 18))).toBe('en-cours');
    expect(rubrique({ ...b, derniereNoteLe: j(4, 21).toISOString() }, j(5, 18))).toBe('a-gouter');
    expect(rubrique(b, j(6))).toBe('prets');
    expect(rubrique(b, j(12))).toBe('prets');
    expect(rubrique({ ...b, statut: 'termine' }, j(6))).toBe('finis');
  });
});

describe('rappels du Calendrier', () => {
  it('goûter, prêt et dernier délai à 18 h, seulement à venir', () => {
    const b = bocal([{ nom: 'Lacto', min: 5, max: 7, unite: 'jours' }]);
    const ev = evenementsCalendrier(b, j(1, 12));
    expect(ev.map((e) => [e.titre, e.date])).toEqual([
      ['🫙 Goûter : Kimchi', j(5, 18)],
      ['🫙 Prêt : Kimchi', j(6, 18)],
      ['🫙 Dernier délai : Kimchi', j(8, 18)],
    ]);
    expect(evenementsCalendrier(b, j(7, 12)).map((e) => e.titre)).toEqual(['🫙 Dernier délai : Kimchi']);
  });

  it('étapes successives : fin de chaque étape, dates prévues en chaîne', () => {
    const b = bocal([
      { nom: 'Fermentation alcoolique', min: 7, max: 10, unite: 'jours' },
      { nom: 'Acétification', min: 10, max: 14, unite: 'jours' },
    ]);
    const ev = evenementsCalendrier(b, j(1, 12));
    expect(ev.map((e) => [e.titre, e.date.getDate(), e.date.getMonth() + 1])).toEqual([
      ['🫙 Goûter : Kimchi', 7, 10],
      ["🫙 Kimchi : fin de l'étape 1", 8, 10],
      ['🫙 Prêt : Kimchi', 18, 10],
      ['🫙 Dernier délai : Kimchi', 22, 10],
    ]);
  });

  it('fichier .ics valide : alarmes, heure locale, texte échappé, lignes pliées', () => {
    const b = bocal([{ nom: 'Lacto', min: 5, max: 5, unite: 'jours' }], j(1), { nom: 'Chou, sel; et piment\\rouge' });
    const ics = fichierIcs(evenementsCalendrier(b, j(1, 12)), new Date(Date.UTC(2026, 9, 1, 8)));
    const lignes = ics.split('\r\n');
    expect(lignes[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lignes).toContain('DTSTART:20261006T180000');
    expect(lignes).toContain('DTSTAMP:20261001T080000Z');
    expect(lignes).toContain('TRIGGER:PT0S');
    expect(ics).toContain('SUMMARY:🫙 Prêt : Chou\\, sel\\; et piment\\\\rouge');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    for (const l of lignes) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    // Une ligne pliée se reconstitue à l'identique
    expect(ics.replace(/\r\n /g, '')).toContain("durée minimale atteinte (5 jours). Goûter et décider.");
  });
});

describe('création depuis une fiche Noma', () => {
  it('fermentation simple', () => {
    const r = reglagesDepuisFiche({
      id: 'noma-x',
      titre: 'Prunes lacto',
      fermentation: { type: 'lacto-fermentation', sel_pct: 2, temperature_c: 28, duree_min_jours: 5, duree_max_jours: 7 },
    });
    expect(r).toEqual({
      nom: 'Prunes lacto',
      ficheId: 'noma-x',
      type: 'lacto-fermentation',
      selPct: 2,
      temperatureC: 28,
      etapes: [{ nom: 'Lacto-fermentation', min: 5, max: 7, unite: 'jours', temperatureC: 28 }],
    });
  });

  it('étapes en heures puis en jours', () => {
    const r = reglagesDepuisFiche({
      id: 'noma-y',
      titre: 'Amazake',
      fermentation: {
        etapes: [
          { nom: 'saccharification', temperature_c: 60, duree_min_heures: 8, duree_max_heures: 8 },
          { nom: 'fermentation alcoolique', temperature_c: 15, duree_min_jours: 4, duree_max_jours: 5 },
        ],
      },
    });
    expect(r.etapes).toEqual([
      { nom: 'Saccharification', min: 8, max: 8, unite: 'heures', temperatureC: 60 },
      { nom: 'Fermentation alcoolique', min: 4, max: 5, unite: 'jours', temperatureC: 15 },
    ]);
  });

  it.skipIf(!archiveDisponible)('les 50 fiches de fermentation de l’archive donnent un bocal valide', () => {
    const fiches = archiveBrute().fiches.filter((f) => f.fermentation);
    expect(fiches.length).toBe(50);
    let avecDuree = 0;
    for (const f of fiches) {
      const b = nouveauBocal(reglagesDepuisFiche(f), j(1), 'x');
      expect(b.etapes.length, f.id).toBeGreaterThan(0);
      for (const e of b.etapes) {
        expect(e.nom.trim(), f.id).not.toBe('');
        if (e.min !== undefined) expect(e.max!, f.id).toBeGreaterThanOrEqual(e.min);
      }
      if (b.etapes.every((e) => e.min !== undefined)) avecDuree++;
      const e = etatEtape(b, j(3));
      expect(libelleAvancement(e), f.id).toMatch(/^(Jour \d|Mis en bocal|\d+ h)/);
      expect(() => fichierIcs(evenementsCalendrier(b, j(1)))).not.toThrow();
    }
    expect(avecDuree).toBeGreaterThanOrEqual(49);
  });
});
