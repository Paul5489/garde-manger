// Publie l'application (le CODE seulement) sur GitHub Pages : https://paul5489.github.io/garde-manger/
// 1. build avec la bonne adresse de base + vérification anti-recettes (s'arrête au moindre doute) ;
// 2. vérification du dépôt Git ;
// 3. envoi du dossier dist/ sur la branche gh-pages.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const DEPOT = 'https://github.com/Paul5489/garde-manger.git';
const BASE = '/garde-manger/';

const lancer = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: racine, ...options });
const lire = (cmd, args) => execFileSync(cmd, args, { cwd: racine, encoding: 'utf8' }).trim();

if (lire('git', ['status', '--porcelain'])) {
  console.error('✗ Des modifications ne sont pas enregistrées (git commit) : publication annulée.');
  process.exit(1);
}

console.log('1/3 Construction et vérification anti-recettes…');
lancer('npm', ['run', 'build'], { env: { ...process.env, BASE_URL: BASE } });

console.log('2/3 Vérification du dépôt…');
lancer('node', ['scripts/verifier-depot.mjs']);

console.log('3/3 Envoi sur GitHub Pages…');
const temp = mkdtempSync(join(tmpdir(), 'garde-manger-'));
try {
  cpSync(join(racine, 'dist'), temp, { recursive: true });
  writeFileSync(join(temp, '.nojekyll'), '');
  const version = lire('git', ['rev-parse', '--short', 'HEAD']);
  const auteur = ['-c', `user.name=${lire('git', ['config', 'user.name'])}`, '-c', `user.email=${lire('git', ['config', 'user.email'])}`];
  lancer('git', ['init', '-q', '-b', 'gh-pages'], { cwd: temp });
  lancer('git', ['add', '-A'], { cwd: temp });
  lancer('git', [...auteur, 'commit', '-q', '-m', `Publication de la version ${version}`], { cwd: temp });
  lancer('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '-q', '-f', DEPOT, 'gh-pages'], {
    cwd: temp,
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(`✓ Publié. L'adresse https://paul5489.github.io${BASE} sera à jour d'ici une à deux minutes.`);
