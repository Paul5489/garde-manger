<script lang="ts">
  // Pages de la chambre, empilées au-dessus des onglets : #/chambre/<page>/<…>.
  import BarreHaut from '../../composants/BarreHaut.svelte';
  import Bocaux from '../../ecrans/Bocaux.svelte';
  import { MODES_PAR_ID, recette } from '../donnees';
  import { lots } from '../lots.svelte';
  import type { IdMode } from '../types';
  import AssistantMode from './AssistantMode.svelte';
  import CalendrierChambre from './CalendrierChambre.svelte';
  import CompatibiliteChambre from './CompatibiliteChambre.svelte';
  import FicheChambre from './FicheChambre.svelte';
  import MaterielChambre from './MaterielChambre.svelte';
  import RecettesChambre from './RecettesChambre.svelte';
  import InfosChambre from './InfosChambre.svelte';
  import LotsChambre from './LotsChambre.svelte';
  import NouveauLot from './NouveauLot.svelte';
  import PageLot from './PageLot.svelte';
  import StockChambre from './StockChambre.svelte';
  import MiseEnService from './MiseEnService.svelte';
  import PageMode from './PageMode.svelte';
  import ReglagesChambre from './ReglagesChambre.svelte';

  let { chemin }: { chemin: string[] } = $props();

  const [page, arg] = $derived(chemin);
  const titre = $derived.by(() => {
    if (page === 'mode') return MODES_PAR_ID.get(arg as IdMode)?.nom ?? 'Mode';
    if (page === 'changer') return 'Changer de mode';
    if (page === 'mise-en-service') return 'Mise en service';
    if (page === 'reglages') return 'Réglages de la chambre';
    if (page === 'bocaux') return 'Mes bocaux';
    if (page === 'recette') return recette(arg)?.nom ?? 'Recette';
    if (page === 'recettes') return 'Recettes de la chambre';
    if (page === 'calendrier') return 'Calendrier';
    if (page === 'materiel') return 'Matériel';
    if (page === 'lot') return arg === 'nouveau' ? 'Nouveau lot' : (lots.lot(arg)?.nom ?? 'Lot');
    if (page === 'lots') return 'Mes lots';
    if (page === 'compatibilite') return 'Compatibilité';
    if (page === 'stock') return 'Stock';
    return 'Chambre';
  });

  let conteneur = $state<HTMLElement>();
  let defile = $state(false);
  // D'une page de la chambre à une autre (recette liée, mois suivant) : on repart du haut.
  $effect(() => {
    void chemin.join('/');
    if (conteneur) conteneur.scrollTop = 0;
  });
</script>

<div class="ecran calque" bind:this={conteneur} onscroll={() => (defile = (conteneur?.scrollTop ?? 0) > 40)}>
  <BarreHaut {titre} avecTrait={defile} />
  {#key chemin.join('/')}
    {#if page === 'mode' && arg}<PageMode id={arg} />
    {:else if page === 'changer'}<AssistantMode vers={arg} />
    {:else if page === 'mise-en-service'}<MiseEnService />
    {:else if page === 'reglages'}<ReglagesChambre />
    {:else if page === 'infos' && arg}<InfosChambre section={arg} />
    {:else if page === 'bocaux'}<Bocaux enPage />
    {:else if page === 'recette' && arg}<FicheChambre id={arg} />
    {:else if page === 'recettes'}<RecettesChambre />
    {:else if page === 'calendrier'}<CalendrierChambre mois={arg} />
    {:else if page === 'materiel'}<MaterielChambre />
    {:else if page === 'lot' && arg === 'nouveau' && chemin[2]}<NouveauLot recetteId={chemin[2]} />
    {:else if page === 'lot' && arg}<PageLot id={arg} />
    {:else if page === 'lots'}<LotsChambre />
    {:else if page === 'compatibilite' && arg}<CompatibiliteChambre id={arg} mois={chemin[2]} />
    {:else if page === 'stock'}<StockChambre />
    {:else}<p class="vide">Page introuvable.</p>{/if}
  {/key}
</div>

<style>
  .calque {
    z-index: 10;
  }
</style>
