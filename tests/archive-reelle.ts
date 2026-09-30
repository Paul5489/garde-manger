// Accès à la vraie archive du Mac pour les tests (jamais copiée dans le projet).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Fiche } from '../src/lib/types';

export const CHEMIN_ARCHIVE = resolve(__dirname, '../../archive-recettes/donnees/archive_complete.json');
export const CHEMIN_INDEX = resolve(__dirname, '../../archive-recettes/index.json');
export const archiveDisponible = existsSync(CHEMIN_ARCHIVE);

let cache: { genere_le: string; nb_fiches: number; fiches: Fiche[] } | null = null;

export function archiveBrute() {
  cache ??= JSON.parse(readFileSync(CHEMIN_ARCHIVE, 'utf8'));
  return cache!;
}
