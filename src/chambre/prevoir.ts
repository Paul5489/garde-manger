// Étoile « prévu » : quand une recette est cochée pour un mois, proposer de voir ce qui va avec (compatibilité).

import { annonce } from '../lib/annonce.svelte';
import { lienChambre, routeur } from '../lib/routeur.svelte';
import { chambre } from './chambre.svelte';
import { recette } from './donnees';
import { nomMois } from './recettes';

export async function prevoir(id: string, mois: number): Promise<void> {
  const ajout = await chambre.basculerEtoile(id, mois);
  if (!ajout) return;
  annonce.afficher(
    `${recette(id)?.nom ?? 'Recette'} prévue en ${nomMois(mois)}.`,
    { libelle: 'Ce qui va avec', faire: () => routeur.aller(lienChambre('compatibilite', id, String(mois))) },
    6000,
  );
}
