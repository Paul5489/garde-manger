import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { documentDeRecherche, ErreurArchive, lireArchive, resumer, tempsTotal } from '../src/lib/archive';
import { chercher, chargerIndex, creerIndex } from '../src/lib/moteur';
import { fichesDeLaPage } from '../src/lib/renvois';
import { archiveBrute, archiveDisponible, CHEMIN_INDEX } from './archive-reelle';

describe('validation du fichier importé', () => {
  it('refuse un fichier qui n’est pas une archive', () => {
    expect(() => lireArchive({ bonjour: 1 })).toThrow(ErreurArchive);
    expect(() => lireArchive(null)).toThrow(ErreurArchive);
    expect(() => lireArchive([{ id: 'x' }])).toThrow(/index\.json/);
    expect(() => lireArchive({ fiches: [] })).toThrow(ErreurArchive);
  });

  it('ignore les fiches illisibles sans bloquer les autres', () => {
    const r = lireArchive({
      genere_le: '2026-09-30',
      fiches: [
        { id: 'mw-a', type: 'recette', titre: 'A', langue: 'fr', source: { id: 'marc-winer', nom: 'MW' } },
        { id: 'x', titre: 'sans type' },
      ],
    });
    expect(r.fiches).toHaveLength(1);
    expect(r.ignorees).toBe(1);
    expect(r.genereLe).toBe('2026-09-30');
  });
});

describe.skipIf(!archiveDisponible)('vraie archive (821 fiches)', () => {
  const brute = archiveDisponible ? archiveBrute() : { fiches: [], genere_le: '', nb_fiches: 0 };
  const lue = archiveDisponible ? lireArchive(structuredClone(brute)) : { fiches: [], ignorees: 0, ecartees: 0 };

  it('lit toutes les fiches sans erreur (moins les pages hors cuisine écartées)', () => {
    expect(lue.fiches.length + lue.ecartees).toBe(brute.nb_fiches);
    expect(lue.ecartees).toBe(13);
    expect(lue.ignorees).toBe(0);
  });

  it('refuse index.json avec un message clair', () => {
    expect(() => lireArchive(JSON.parse(readFileSync(CHEMIN_INDEX, 'utf8')))).toThrow(/archive_complete\.json/);
  });

  it('ne garde jamais le texte anglais (version_originale)', () => {
    expect(lue.fiches.some((f) => 'version_originale' in f)).toBe(false);
    expect(JSON.stringify(lue.fiches).length).toBeLessThan(JSON.stringify(brute.fiches).length);
  });

  it('résumés : univers et temps cohérents', () => {
    const resumes = lue.fiches.map(resumer);
    const compte = (u: string) => resumes.filter((r) => r.univers.includes(u as never)).length;
    expect(compte('asiatique')).toBe(188);
    expect(compte('fermentation')).toBe(70 - 6); // 6 chapitres Noma hors cuisine écartés
    expect(compte('francaise')).toBe(194 + 186);
    expect(compte('techniques')).toBeGreaterThan(180);
    expect(resumes.every((r) => r.univers.length > 0)).toBe(true);
    const sauceChien = lue.fiches.find((f) => f.id === 'mw-sauce-chien')!;
    expect(tempsTotal(sauceChien)).toBe(10);
    const prunes = resumes.find((r) => r.id === 'noma-prunes-lacto-fermentees')!;
    expect(prunes.fermentationJours).toEqual([5, 7]);
    expect(prunes.minutes).toBeUndefined();
  });

  it('tous les renvois de pages mènent à une fiche technique (sauf vers les pages écartées)', () => {
    const resumes = lue.fiches.map(resumer);
    // Pages des « Généralités » (hygiène, organisation), écartées : 1 seul renvoi (p. 12), sans lien.
    const pagesEcartees = new Set(Array.from({ length: 32 }, (_, i) => 7 + i));
    let n = 0;
    for (const f of lue.fiches)
      for (const e of f.etapes ?? [])
        for (const p of e.renvois_pages ?? []) {
          if (pagesEcartees.has(Number(p))) continue;
          n++;
          expect(fichesDeLaPage(resumes, Number(p)).length, `${f.id} → p. ${p}`).toBeGreaterThan(0);
        }
    expect(n).toBeGreaterThan(400);
  });

  describe('recherche plein texte', () => {
    const index = archiveDisponible ? chargerIndex(JSON.stringify(creerIndex(lue.fiches.map(documentDeRecherche)))) : null!;
    const titres = (q: string, n = 5) =>
      chercher(index, q)
        .slice(0, n)
        .map((id) => lue.fiches.find((f) => f.id === id)!.titre.toLowerCase());

    it('« creme anglaise » trouve la crème anglaise', () => {
      expect(titres('creme anglaise', 3).some((t) => t.includes('crème anglaise'))).toBe(true);
    });

    it('« oeuf » trouve les fiches avec « œuf »', () => {
      const ids = chercher(index, 'oeufs brouilles').slice(0, 5);
      expect(ids).toContain('afpa-oeufs-brouille-a-la-portugaise'); // titre écrit « Œufs brouille »
      expect(ids).toContain('cr-oeufs-brouilles-portugaise');
      expect(titres('oeuf', 30).filter((t) => t.includes('œuf')).length).toBeGreaterThan(5);
    });

    it('tolère une faute de frappe', () => {
      expect(titres('mouse chocolat', 5).some((t) => t.includes('mousse au chocolat'))).toBe(true);
      expect(titres('kinchi', 5).some((t) => t.includes('kimchi'))).toBe(true);
      expect(titres('bechamele', 5).some((t) => t.includes('béchamel'))).toBe(true);
    });

    it('trouve pendant la frappe (début de mot)', () => {
      expect(titres('kombu', 10).some((t) => t.includes('kombucha'))).toBe(true);
    });

    it('cherche aussi dans les ingrédients et les techniques', () => {
      const ids = chercher(index, 'gochugaru');
      expect(ids.length).toBeGreaterThan(0);
      expect(titres('fond brun de veau', 5).some((t) => t.includes('fond brun'))).toBe(true);
    });
  });
});

describe('liens vers les pages du livre', async () => {
  const { decouperRenvois } = await import('../src/lib/renvois');
  const cat = [
    { id: 'cr-legumes', pages: [57, 58], titre: 'Les légumes' },
    { id: 'cr-cuissons', pages: [373], titre: 'Les cuissons' },
  ] as never[];
  const lien = (id: string, p: number) => `#/fiche/${id}/p${p}`;

  it('rend chaque numéro de page cliquable quand la page est connue', () => {
    const m = decouperRenvois('Tailler en brunoise (voir p. 57, 103, 109).', cat, lien);
    expect(m.map((x) => x.texte).join('')).toBe('Tailler en brunoise (voir p. 57, 103, 109).');
    expect(m.filter((x) => x.lien).map((x) => x.lien)).toEqual(['#/fiche/cr-legumes/p57']);
  });

  it('laisse le texte intact sans renvoi', () => {
    expect(decouperRenvois('Cuire 5 min.', cat, lien)).toEqual([{ texte: 'Cuire 5 min.' }]);
  });
});

describe.skipIf(!archiveDisponible)('pages « hors cuisine » écartées (demande du 06/10/2026)', async () => {
  const { estExclue, NOMBRE_EXCLUES } = await import('../src/lib/exclusions');
  const { lireArchive: lire } = await import('../src/lib/archive');
  const brute = archiveDisponible ? archiveBrute() : { fiches: [] as { id: string; type: string; titre: string }[] };

  it('chaque empreinte correspond à une page de l’archive, jamais à une recette', () => {
    const exclues = brute.fiches.filter((f) => estExclue(f.id));
    expect(exclues).toHaveLength(NOMBRE_EXCLUES);
    expect(exclues.every((f) => f.type !== 'recette')).toBe(true);
    const titres = exclues.map((f) => f.titre.toLowerCase()).join(' | ');
    for (const mot of ['auteur', 'remerciements', 'hygiène', 'bep et cap', 'bibliographie', 'fournisseurs'])
      expect(titres).toContain(mot);
  });

  it('les techniques, explications de produits et chapitres de fermentation restent', () => {
    const gardees = brute.fiches.filter((f) => !estExclue(f.id)).map((f) => f.titre.toLowerCase());
    for (const t of ['les haricots', 'vocabulaire professionnel', 'équipement', 'les bases', 'koji', 'sauce béchamel'])
      expect(gardees).toContain(t);
  });

  it('l’import les écarte et le dit', () => {
    const r = lire(structuredClone(brute));
    expect(r.ecartees).toBe(NOMBRE_EXCLUES);
    expect(r.fiches.length).toBe(brute.fiches.length - NOMBRE_EXCLUES);
  });
});
