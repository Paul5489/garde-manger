/// <reference lib="webworker" />
// Import de l'archive dans un fil d'exécution séparé : l'écran reste fluide pendant l'import.

import { documentDeRecherche, ErreurArchive, lireArchive, resumer } from './archive';
import { construireIndexIngredients } from './classement-frigo';
import { db, remplacerRecettes } from './db';
import { creerIndex } from './moteur';
import type { InfosArchive } from './types';

export type MessageImport = { fichier: File } | { url: string };
export type ReponseImport =
  | { etat: 'progression'; etape: string; pourcentage: number }
  | { etat: 'termine'; infos: InfosArchive }
  | { etat: 'erreur'; message: string };

const envoyer = (r: ReponseImport) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(r);

self.onmessage = async (e: MessageEvent<MessageImport>) => {
  try {
    envoyer({ etat: 'progression', etape: 'Lecture du fichier…', pourcentage: 5 });
    let texte: string;
    let nomFichier: string | undefined;
    if ('fichier' in e.data) {
      texte = await e.data.fichier.text();
      nomFichier = e.data.fichier.name;
    } else {
      const rep = await fetch(e.data.url, { cache: 'no-store' });
      if (!rep.ok) throw new ErreurArchive(`Archive introuvable sur le Mac (erreur ${rep.status}).`);
      texte = await rep.text();
      nomFichier = 'archive_complete.json (Mac)';
    }

    envoyer({ etat: 'progression', etape: 'Vérification des fiches…', pourcentage: 20 });
    let json: unknown;
    try {
      json = JSON.parse(texte);
    } catch {
      throw new ErreurArchive("Le fichier est illisible (ce n'est pas un JSON valide). Choisis « archive_complete.json ».");
    }
    const archive = lireArchive(json);
    texte = '';

    envoyer({ etat: 'progression', etape: 'Préparation de la recherche…', pourcentage: 40 });
    const catalogue = archive.fiches.map(resumer);
    const index = creerIndex(archive.fiches.map(documentDeRecherche));
    const indexJson = JSON.stringify(index);

    envoyer({ etat: 'progression', etape: 'Enregistrement dans le téléphone…', pourcentage: 70 });
    const infos: InfosArchive = {
      genereLe: archive.genereLe,
      nbFiches: archive.fiches.length,
      importeLe: new Date().toISOString(),
      nomFichier,
      ignorees: archive.ignorees,
      ecartees: archive.ecartees,
      ancienneFermentation: archive.ancienneFermentation,
    };
    await remplacerRecettes(db, archive.fiches, [
      { cle: 'catalogue', valeur: catalogue },
      { cle: 'index', valeur: indexJson },
      { cle: 'ingredients', valeur: construireIndexIngredients(archive.fiches) },
      { cle: 'archive', valeur: infos },
    ]);

    envoyer({ etat: 'termine', infos });
  } catch (err) {
    const message =
      err instanceof ErreurArchive
        ? err.message
        : `L'import a échoué : ${err instanceof Error ? err.message : String(err)}`;
    envoyer({ etat: 'erreur', message });
  }
};
