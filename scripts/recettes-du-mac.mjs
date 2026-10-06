// Recettes présentes sur le Mac, hors du projet : l'archive, et les fichiers de recettes préparés pour
// l'iPhone (../mes-recettes/*.json : fermentation Noma + Koji Alchemy, bissap…). Sert aux deux vérifications
// anti-recettes (build et dépôt) : aucun de ces textes ne doit se retrouver dans Git ni en ligne.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function recettesDuMac(racine) {
  const fiches = [];
  const sources = [];
  const archive = resolve(racine, '../archive-recettes/donnees/archive_complete.json');
  if (existsSync(archive)) {
    fiches.push(...JSON.parse(readFileSync(archive, 'utf8')).fiches);
    sources.push('archive');
  }
  const dossier = resolve(racine, '../mes-recettes');
  if (existsSync(dossier))
    for (const nom of readdirSync(dossier).filter((n) => n.endsWith('.json'))) {
      try {
        const lu = JSON.parse(readFileSync(join(dossier, nom), 'utf8'));
        const liste = lu?.donnees?.mesRecettes;
        if (Array.isArray(liste)) {
          fiches.push(...liste);
          sources.push(nom);
        }
      } catch {
        // fichier illisible : ignoré
      }
    }
  return { fiches, sources };
}
