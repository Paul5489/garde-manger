// Fiches de fermentation Noma + Koji Alchemy (résumé en français), ajoutées par fichier dans « mesRecettes ».
// Le fichier est préparé sur le Mac, hors du projet : ces tests sont ignorés s'il est absent.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estMaRecette, ficheValide, resumer, universDe } from '../src/lib/archive';
import { reglagesDepuisFiche } from '../src/lib/bocaux';
import { estRetiree } from '../src/lib/exclusions';
import { markdownVersHtml } from '../src/lib/markdown';
import { construireFiche, ficheVersBrouillon } from '../src/lib/mes-recettes';
import { ligneIngredient } from '../src/lib/quantites';
import { rubriqueDe } from '../src/lib/rubriques';
import { lireSauvegarde } from '../src/lib/sauvegarde';
import type { Fiche } from '../src/lib/types';
import { archiveBrute, archiveDisponible, CHEMIN_FERMENTATION, fermentationDisponible } from './archive-reelle';

describe('liens dans les textes', () => {
  it('garde les liens internes de l’appli, retire les liens sortants', () => {
    expect(markdownVersHtml('[Essai](#/fiche/ferm-essai)')).toContain('<a href="#/fiche/ferm-essai">Essai</a>');
    expect(markdownVersHtml('[Site](https://exemple.fr)')).not.toContain('<a');
    expect(markdownVersHtml('[Piège](javascript:alert(1))')).not.toContain('<a');
  });
});

describe.skipIf(!fermentationDisponible)('fichier de fermentation (Noma + Koji Alchemy)', () => {
  const sauvegarde = fermentationDisponible ? lireSauvegarde(JSON.parse(readFileSync(CHEMIN_FERMENTATION, 'utf8'))) : null;
  const fiches = (sauvegarde?.donnees.mesRecettes ?? []) as unknown as Fiche[];
  const recettes = fiches.filter((f) => f.type === 'recette');
  const ids = new Set(fiches.map((f) => f.id));

  it('22 recettes et une page de présentation, toutes lisibles', () => {
    expect(recettes).toHaveLength(22);
    expect(fiches.filter((f) => f.type === 'chapitre')).toHaveLength(1);
    expect(ids.size).toBe(fiches.length);
    for (const f of fiches) {
      expect(ficheValide(f), f.id).toBe(true);
      expect(f.id.startsWith('ferm-'), f.id).toBe(true);
      expect(estMaRecette(f), f.id).toBe(false);
      expect(estRetiree(f.id), f.id).toBe(false);
      expect(f.modifieLe, f.id).toBeTypeOf('number');
    }
  });

  it('rangées en Fermentation, avec des sources Noma / Koji Alchemy', () => {
    for (const f of fiches) {
      expect(universDe(f), f.id).toEqual(['fermentation']);
      expect(rubriqueDe(resumer(f)), f.id).toBe('fermentation');
    }
    const sources = new Set(fiches.map((f) => f.source.id));
    expect([...sources].sort()).toEqual(['koji-alchemy', 'noma', 'noma-koji']);
  });

  it('chaque recette est complète et ses lignes d’ingrédients s’affichent', () => {
    for (const f of recettes) {
      expect(f.etapes!.length, f.id).toBeGreaterThanOrEqual(4);
      const items = f.ingredients!.flatMap((g) => g.items ?? []);
      expect(items.length, f.id).toBeGreaterThanOrEqual(1);
      for (const i of items) {
        const l = ligneIngredient(i, f.source.id, 2);
        expect(`${l.quantite ?? ''} ${l.texte}`, f.id).not.toMatch(/undefined|NaN|\*\*/);
        expect(i.nom.length, f.id).toBeGreaterThan(1);
      }
      for (const e of f.etapes!) expect(e.texte, f.id).not.toMatch(/\*\*/);
    }
  });

  it('chaque recette peut démarrer un bocal', () => {
    for (const f of recettes) {
      expect(f.fermentation, f.id).toBeDefined();
      const r = reglagesDepuisFiche(f);
      expect(r.etapes.length, f.id).toBeGreaterThanOrEqual(1);
      for (const e of r.etapes) {
        expect(e.nom, f.id).toBeTruthy();
        if (e.min !== undefined) expect(e.max!, f.id).toBeGreaterThanOrEqual(e.min);
      }
    }
  });

  it('le sommaire de la page de présentation mène à chaque recette', () => {
    const guide = fiches.find((f) => f.type === 'chapitre')!;
    const liens = [...guide.sections!.map((s) => s.texte).join('\n').matchAll(/\(#\/fiche\/([\w-]+)\)/g)].map((m) => m[1]);
    expect(new Set(liens)).toEqual(new Set(recettes.map((f) => f.id)));
  });

  it('se modifie et se réenregistre sans rien perdre', () => {
    for (const f of recettes) {
      const g = construireFiche(ficheVersBrouillon(f), f);
      delete g.modifieLe;
      const { modifieLe: _m, ...attendu } = f;
      expect(g, f.id).toEqual(attendu);
    }
  });

  it.skipIf(!archiveDisponible)('aucun identifiant ne recouvre une fiche de l’archive', () => {
    const archive = new Set((archiveBrute().fiches as Fiche[]).map((f) => f.id));
    for (const id of ids) expect(archive.has(id), id).toBe(false);
  });
});
