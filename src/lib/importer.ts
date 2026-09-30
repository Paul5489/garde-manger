import type { MessageImport, ReponseImport } from './import.worker';
import type { InfosArchive } from './types';

/** Lance l'import (fichier choisi dans l'app Fichiers, ou archive du Mac en développement). */
export function importerArchive(
  source: MessageImport,
  surProgression: (etape: string, pourcentage: number) => void,
): Promise<InfosArchive> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ReponseImport>) => {
      const r = e.data;
      if (r.etat === 'progression') surProgression(r.etape, r.pourcentage);
      else {
        worker.terminate();
        if (r.etat === 'termine') resolve(r.infos);
        else reject(new Error(r.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(`L'import a échoué : ${e.message || 'erreur inconnue'}`));
    };
    worker.postMessage(source);
  });
}
