/// <reference lib="webworker" />
// Construit l'index des ingrédients à partir des fiches déjà dans le téléphone
// (recettes importées avant l'étape « Avec ce que j'ai », ou index d'une version précédente).

import { construireIndexIngredients, type IndexIngredients } from './classement-frigo';
import { db } from './db';

export type ReponseIndex = { ok: true; index: IndexIngredients } | { ok: false; message: string };

self.onmessage = async () => {
  const envoyer = (r: ReponseIndex) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(r);
  try {
    const recettes = await db.fiches.filter((f) => f.type === 'recette').toArray();
    const index = construireIndexIngredients(recettes);
    await db.meta.put({ cle: 'ingredients', valeur: index });
    envoyer({ ok: true, index });
  } catch (e) {
    envoyer({ ok: false, message: e instanceof Error ? e.message : String(e) });
  }
};
