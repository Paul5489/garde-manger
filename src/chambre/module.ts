// Module « Chambre », chargé à la première ouverture de l'onglet (ses recettes et réglages ne pèsent pas
// sur le démarrage de l'appli). Le service worker le garde en cache comme le reste : il marche hors ligne.

import { chambre } from './chambre.svelte';
import { lots } from './lots.svelte';

export { default as Chambre } from './ecrans/Chambre.svelte';
export { default as PageChambre } from './ecrans/PageChambre.svelte';
export { chambre, lots };

if (!chambre.charge) chambre.charger().catch((e) => console.error(e));
if (!lots.charge) lots.charger().catch((e) => console.error(e));
