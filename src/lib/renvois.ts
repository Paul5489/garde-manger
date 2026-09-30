// Renvois « voir p. 272 » de La Cuisine de référence → fiches techniques (via source.pages).

import type { Resume } from './types';

let cache: { catalogue: Resume[]; parPage: Map<number, Resume[]> } | null = null;

export function fichesDeLaPage(catalogue: Resume[], page: number): Resume[] {
  if (cache?.catalogue !== catalogue) {
    const parPage = new Map<number, Resume[]>();
    for (const r of catalogue) {
      for (const p of r.pages ?? []) {
        if (!parPage.has(p)) parPage.set(p, []);
        parPage.get(p)!.push(r);
      }
    }
    cache = { catalogue, parPage };
  }
  return cache.parPage.get(page) ?? [];
}

export type Morceau = { texte: string; lien?: string; titre?: string };

const PAGES = /\bp\.\s*(\d{1,4}(?:\s*(?:,|et|-)\s*\d{1,4})*)/g;

/** Découpe « … (voir p. 57, 103) » en morceaux dont les numéros de page sont des liens. */
export function decouperRenvois(
  texte: string,
  catalogue: Resume[],
  lien: (id: string, page: number) => string,
): Morceau[] {
  const morceaux: Morceau[] = [];
  let dernier = 0;
  for (const m of texte.matchAll(PAGES)) {
    const debutNombres = m.index! + m[0].indexOf(m[1]);
    morceaux.push({ texte: texte.slice(dernier, debutNombres) });
    let pos = debutNombres;
    for (const n of m[1].matchAll(/\d{1,4}/g)) {
      const absolu = debutNombres + n.index!;
      morceaux.push({ texte: texte.slice(pos, absolu) });
      const page = Number(n[0]);
      const cible = fichesDeLaPage(catalogue, page)[0];
      morceaux.push(cible ? { texte: n[0], lien: lien(cible.id, page), titre: cible.titre } : { texte: n[0] });
      pos = absolu + n[0].length;
    }
    dernier = pos;
  }
  morceaux.push({ texte: texte.slice(dernier) });
  return morceaux.filter((m) => m.texte);
}
