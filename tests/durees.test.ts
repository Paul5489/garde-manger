import { describe, expect, it } from 'vitest';
import { chrono, decouperDurees, libelleDuree, trouverDurees } from '../src/lib/durees';
import { archiveBrute, archiveDisponible } from './archive-reelle';

const une = (texte: string) => {
  const d = trouverDurees(texte);
  expect(d, texte).toHaveLength(1);
  return { texte: d[0].texte, min: d[0].min / 60, max: d[0].max / 60 };
};

describe('détection des durées', () => {
  it('minutes', () => {
    expect(une('Cuire 20 minutes à feu doux')).toEqual({ texte: '20 minutes', min: 20, max: 20 });
    expect(une('laisser tiédir 5min avant')).toEqual({ texte: '5min', min: 5, max: 5 });
    expect(une('Ranger le plan de travail (5 mn)')).toEqual({ texte: '5 mn', min: 5, max: 5 });
    expect(une('fouetter pendant 2 min puis')).toEqual({ texte: '2 min', min: 2, max: 2 });
  });

  it('heures et heures-minutes', () => {
    expect(une('Cuire 1 h 30 au four')).toEqual({ texte: '1 h 30', min: 90, max: 90 });
    expect(une('Cuire 1h30')).toEqual({ texte: '1h30', min: 90, max: 90 });
    expect(une('mariner 2 heures')).toEqual({ texte: '2 heures', min: 120, max: 120 });
    expect(une('pendant 1 heure 15 minutes')).toEqual({ texte: '1 heure 15 minutes', min: 75, max: 75 });
    expect(une('Cuire une heure')).toEqual({ texte: 'une heure', min: 60, max: 60 });
  });

  it('fourchettes', () => {
    expect(une('Cuire 45 à 60 min')).toEqual({ texte: '45 à 60 min', min: 45, max: 60 });
    expect(une('mijoter 45 min à 1 h.')).toEqual({ texte: '45 min à 1 h', min: 45, max: 60 });
    expect(une('Bouillon 3 h 30 à 4 h')).toEqual({ texte: '3 h 30 à 4 h', min: 210, max: 240 });
    expect(une('frire 5-7 minutes')).toEqual({ texte: '5-7 minutes', min: 5, max: 7 });
    expect(une('cuire de 10 à 15 minutes')).toEqual({ texte: '10 à 15 minutes', min: 10, max: 15 });
    expect(une('entre 8 et 10 min')).toEqual({ texte: '8 et 10 min', min: 8, max: 10 });
  });

  it('secondes', () => {
    expect(une('Blanchir 30 secondes')).toEqual({ texte: '30 secondes', min: 0.5, max: 0.5 });
    expect(une('mixer 20 à 30 s')).toEqual({ texte: '20 à 30 s', min: 20 / 60, max: 0.5 });
  });

  it('plusieurs durées dans une même étape', () => {
    const d = trouverDurees('Saisir 2 min de chaque côté puis cuire 12 minutes au four.');
    expect(d.map((x) => x.texte)).toEqual(['2 min', '12 minutes']);
  });

  it('ne confond pas avec autre chose', () => {
    expect(trouverDurees('Tailler en bâtonnets de 5 mm')).toEqual([]);
    expect(trouverDurees('Chauffer à 180 °C')).toEqual([]);
    expect(trouverDurees('Fermenter 5 à 7 jours')).toEqual([]);
    expect(trouverDurees('2 cuillères à soupe de sauce soja')).toEqual([]);
    expect(trouverDurees('les 4 moitiés')).toEqual([]);
    expect(trouverDurees('Ajouter 3 œufs')).toEqual([]);
    expect(trouverDurees('Verser (1,5 à 2 l)')).toEqual([]);
    expect(trouverDurees('faire une seconde cuisson des beignets')).toEqual([]);
    expect(trouverDurees('Dresser huits choux')).toEqual([]);
    expect(trouverDurees('Cuire à 170°C pendant 1 h pour les grands moules')).toHaveLength(1);
  });

  it('découpe le texte autour des durées sans rien perdre', () => {
    const texte = 'Cuire 20 minutes, puis laisser reposer 1 h.';
    const m = decouperDurees(texte);
    expect(m.map((x) => x.texte).join('')).toBe(texte);
    expect(m.filter((x) => x.duree).map((x) => x.texte)).toEqual(['20 minutes', '1 h']);
  });
});

describe('affichage des durées', () => {
  it('chronomètre', () => {
    expect(chrono(1500)).toBe('25:00');
    expect(chrono(59.2)).toBe('1:00');
    expect(chrono(3725)).toBe('1:02:05');
    expect(chrono(-3)).toBe('0:00');
  });

  it('libellés', () => {
    expect(libelleDuree(45)).toBe('45 s');
    expect(libelleDuree(1500)).toBe('25 min');
    expect(libelleDuree(5400)).toBe('1 h 30');
    expect(libelleDuree(3600)).toBe('1 h');
  });
});

describe.skipIf(!archiveDisponible)('durées dans la vraie archive', () => {
  it('trouve des durées dans beaucoup d’étapes, toutes plausibles', () => {
    const { fiches } = archiveBrute();
    let etapesAvecDuree = 0;
    let total = 0;
    for (const f of fiches)
      for (const e of f.etapes ?? [])
        for (const t of [e.texte, ...(e.details ?? [])]) {
          const d = trouverDurees(t);
          if (d.length) etapesAvecDuree++;
          for (const x of d) {
            total++;
            expect(x.min, `${f.id} : ${t}`).toBeGreaterThan(0);
            expect(x.max, `${f.id} : ${t}`).toBeLessThanOrEqual(3 * 24 * 3600);
            expect(t.slice(x.debut, x.fin), `${f.id}`).toBe(x.texte);
          }
        }
    expect(etapesAvecDuree).toBeGreaterThan(800);
    expect(total).toBeGreaterThan(900);
  });
});
