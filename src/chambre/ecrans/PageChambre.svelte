<script lang="ts">
  // Pages de la chambre, empilées au-dessus des onglets : #/chambre/<page>/<…>.
  import BarreHaut from '../../composants/BarreHaut.svelte';
  import Bocaux from '../../ecrans/Bocaux.svelte';
  import { MODES_PAR_ID } from '../donnees';
  import type { IdMode } from '../types';
  import AssistantMode from './AssistantMode.svelte';
  import InfosChambre from './InfosChambre.svelte';
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
    return 'Chambre';
  });

  let conteneur = $state<HTMLElement>();
  let defile = $state(false);
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
    {:else}<p class="vide">Page introuvable.</p>{/if}
  {/key}
</div>

<style>
  .calque {
    z-index: 10;
  }
</style>
