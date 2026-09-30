import { describe, expect, it } from 'vitest';
import { casseLisible, normaliser, radical, termeDeRecherche } from '../src/lib/texte';

describe('normalisation du texte', () => {
  it('accents et ligatures', () => {
    expect(normaliser('Œuf à la Crème')).toBe('oeuf a la creme');
    expect(normaliser('œufs brouillés')).toBe('oeufs brouilles');
    expect(normaliser('Ex æquo')).toBe('ex aequo');
    expect(normaliser('Aïl d’été')).toBe("ail d'ete");
  });

  it('pluriels simples', () => {
    expect(radical('tomates')).toBe('tomate');
    expect(radical('poireaux')).toBe('poireau');
    expect(radical('riz')).toBe('riz');
    expect(radical('noix')).toBe('noix');
    expect(radical('bass')).toBe('bass');
  });

  it('termes de recherche', () => {
    expect(termeDeRecherche('Crèmes')).toBe('creme');
    expect(termeDeRecherche('de')).toBeNull();
    expect(termeDeRecherche('à')).toBeNull();
    expect(termeDeRecherche('Œufs')).toBe('oeuf');
  });

  it('casse lisible', () => {
    expect(casseLisible('SAUCE')).toBe('Sauce');
    expect(casseLisible('Garniture aromatique')).toBe('Garniture aromatique');
  });
});

describe('espaces insécables', async () => {
  const { insecables } = await import('../src/lib/texte');
  it('ne coupe pas les unités ni la ponctuation double', () => {
    expect(insecables('puis 20 % de vinaigre')).toBe('puis 20 % de vinaigre');
    expect(insecables('vers 18 °C, 45 min')).toBe('vers 18 °C, 45 min');
    expect(insecables('Contrôle : goûter')).toBe('Contrôle : goûter');
    expect(insecables('2 gousses')).toBe('2 gousses');
  });
});

describe('textes Markdown du livre', async () => {
  const { markdownVersHtml, retirerTitreRepete } = await import('../src/lib/markdown');
  it('titres en capitales remis en casse normale', () => {
    expect(markdownVersHtml('## LES HARICOTS VERTS')).toBe('<h2>Les haricots verts</h2>\n');
    expect(markdownVersHtml('## Qu’est-ce que la fermentation ?')).toContain('<h2>Qu’est-ce que la fermentation ?</h2>');
  });
  it('repères de page transformés en ancres, HTML brut ignoré', () => {
    const html = markdownVersHtml('<!-- page 102 -->\nTexte <script>alert(1)</script>');
    expect(html).toContain('id="p-102"');
    expect(html).not.toContain('<script>');
  });
  it('retire le titre qui répète celui de la fiche', () => {
    expect(retirerTitreRepete('<!-- page 102 -->\n# LES HARICOTS\n\nTexte', 'Les haricots')).toBe('<!-- page 102 -->\n\nTexte');
    expect(retirerTitreRepete('# Autre chose\nTexte', 'Les haricots')).toBe('# Autre chose\nTexte');
  });
});
