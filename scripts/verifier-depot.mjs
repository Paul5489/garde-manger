// Vérifie qu'aucun texte de recette n'est dans les fichiers suivis par Git.
// Lancé automatiquement avant chaque enregistrement (git commit) via .githooks/pre-commit.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { recettesDuMac } from './recettes-du-mac.mjs';

const racine = resolve(import.meta.dirname, '..');

const fichiers = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: racine, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const problemes = [];
for (const f of fichiers) {
  if (/(^|\/)(archive-recettes|donnees)\//.test(f) || /archive_complete|sauvegarde-garde-manger|garde-manger-sauvegarde/.test(f))
    problemes.push(`fichier de données suivi par Git : ${f}`);
}

const { fiches, sources } = recettesDuMac(racine);
if (sources.length) {
  // Empreintes de texte rédigé (les identifiants et titres courts peuvent figurer dans les tests).
  const empreintes = new Set();
  for (const fi of fiches) {
    for (const e of fi.etapes ?? []) if (e.texte?.length >= 40) empreintes.add(e.texte.slice(0, 60));
    for (const g of fi.ingredients ?? [])
      for (const i of g.items ?? []) if (i.texte_original?.length >= 30) empreintes.add(i.texte_original);
    if (fi.description?.length >= 40) empreintes.add(fi.description.slice(0, 60));
    for (const n of fi.notes ?? []) if (n.length >= 40) empreintes.add(n.slice(0, 60));
    for (const s of fi.sections ?? []) if (s.texte?.length >= 40) empreintes.add(s.texte.slice(0, 60));
  }
  for (const f of fichiers) {
    if (!/\.(ts|js|mjs|svelte|json|md|html|css|txt)$/.test(f) || f === 'package-lock.json') continue;
    const chemin = resolve(racine, f);
    if (!existsSync(chemin)) continue;
    const contenu = readFileSync(chemin, 'utf8');
    for (const e of empreintes)
      if (contenu.includes(e)) {
        problemes.push(`texte de recette dans ${f} : « ${e.slice(0, 50)}… »`);
        break;
      }
  }
}

if (problemes.length) {
  console.error('\n✗ ENREGISTREMENT REFUSÉ — des recettes ne doivent pas aller dans Git :');
  for (const p of problemes) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ Dépôt vérifié : ${fichiers.length} fichiers, aucune recette.`);
