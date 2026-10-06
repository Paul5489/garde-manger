// Vérifie qu'aucune recette ne s'est glissée dans le build (dist/) avant toute mise en ligne.
// Lancé automatiquement après « npm run build ». Échoue (code 1) au moindre doute.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { recettesDuMac } from './recettes-du-mac.mjs';

const racine = resolve(import.meta.dirname, '..');
const dist = join(racine, 'dist');

const problemes = [];

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

if (!existsSync(dist)) {
  console.error('✗ Dossier dist/ introuvable : lance d’abord « npm run build ».');
  process.exit(1);
}

const tous = fichiers(dist);
const textes = tous.filter((f) => /\.(js|css|html|webmanifest|svg|txt|map)$/.test(f));
let tailleTotale = 0;

for (const f of tous) {
  const rel = relative(dist, f);
  const taille = statSync(f).size;
  tailleTotale += taille;
  if (f.endsWith('.json')) problemes.push(`fichier JSON dans le build : ${rel}`);
  if (taille > 1_000_000) problemes.push(`fichier anormalement gros (${(taille / 1e6).toFixed(1)} Mo) : ${rel}`);
}

// Traces du mode développement (chargement depuis le Mac).
const interdits = ['__archive-dev', 'archive-recettes/'];
const contenus = new Map(textes.map((f) => [f, readFileSync(f, 'utf8')]));
for (const [f, contenu] of contenus)
  for (const mot of interdits)
    if (contenu.includes(mot)) problemes.push(`« ${mot} » trouvé dans ${relative(dist, f)}`);

// Comparaison avec les recettes du Mac (archive + fichiers de mes-recettes) : aucun identifiant, titre ou texte
// d'étape ne doit apparaître.
let nbEmpreintes = 0;
const { fiches, sources } = recettesDuMac(racine);
if (sources.includes('archive')) {
  const empreintes = new Set();
  for (const f of fiches) {
    if (f.id.length >= 10) empreintes.add(f.id);
    if (f.titre.length >= 15) empreintes.add(f.titre);
    for (const e of f.etapes ?? []) if (e.texte?.length >= 40) empreintes.add(e.texte.slice(0, 60));
    for (const g of f.ingredients ?? [])
      for (const i of g.items ?? []) if (i.texte_original?.length >= 30) empreintes.add(i.texte_original);
    if (f.description?.length >= 40) empreintes.add(f.description.slice(0, 60));
    for (const n of f.notes ?? []) if (n.length >= 40) empreintes.add(n.slice(0, 60));
    for (const s of f.sections ?? []) if (s.texte?.length >= 40) empreintes.add(s.texte.slice(0, 60));
  }
  nbEmpreintes = empreintes.size;
  for (const [f, contenu] of contenus)
    for (const e of empreintes)
      if (contenu.includes(e)) {
        problemes.push(`contenu de recette trouvé dans ${relative(dist, f)} : « ${e.slice(0, 50)}… »`);
        break;
      }
} else {
  console.warn('⚠ Archive introuvable : comparaison avec les recettes impossible (vérifications de base seulement).');
}

if (problemes.length) {
  console.error('\n✗ BUILD REFUSÉ — des données ne doivent pas être publiées :');
  for (const p of problemes) console.error('  - ' + p);
  process.exit(1);
}

console.log(
  `✓ Build vérifié : ${tous.length} fichiers, ${(tailleTotale / 1e6).toFixed(2)} Mo, aucune recette ` +
    `(${nbEmpreintes} empreintes de recettes comparées).`,
);
