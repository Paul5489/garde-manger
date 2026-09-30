// Rendu Markdown des textes intégraux (techniques, chapitres, notes).
// Le HTML brut est ignoré ; les repères « <!-- page 272 --> » deviennent des ancres (#p-272).

import { Marked, type Tokens } from 'marked';
import { casseLisible, normaliser } from './texte';

const echapper = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const REPERE_PAGE = /<!--\s*page\s+(\d+)\s*-->/g;

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      let sortie = '';
      for (const m of text.matchAll(REPERE_PAGE)) sortie += `<span class="page" id="p-${m[1]}">${m[1]}</span>`;
      return sortie;
    },
    link(token: Tokens.Link): string {
      return this.parser.parseInline(token.tokens); // pas de liens sortants depuis les textes de livres
    },
    image(): string {
      return '';
    },
    // Titres du livre en capitales (« LES HARICOTS VERTS ») → « Les haricots verts ».
    heading({ text, depth }: Tokens.Heading): string | false {
      if (text !== text.toUpperCase() || !/\p{L}/u.test(text)) return false;
      return `<h${depth}>${echapper(casseLisible(text.replace(/\*\*/g, '')))}</h${depth}>\n`;
    },
  },
});

export function markdownVersHtml(texte: string): string {
  return marked.parse(texte, { async: false }) as string;
}

/** Repère du tableau des denrées dans les textes intégraux de La Cuisine de référence. */
export const REPERE_TABLEAU = '[TABLEAU DES DENRÉES — voir le champ « ingredients »]';

/** Retire le premier titre du texte s'il répète le titre de la fiche. */
export function retirerTitreRepete(texte: string, titre: string): string {
  const m = texte.match(/^((?:\s*<!--[^>]*-->)*\s*)#{1,3}\s+(.+)\n/);
  if (!m) return texte;
  const propre = (t: string) => normaliser(t).replace(/[^a-z0-9]+/g, ' ').trim();
  return propre(m[2]) === propre(titre) ? m[1] + texte.slice(m[0].length) : texte;
}
