<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  import type { ResultatFrigo } from '../lib/classement-frigo';
  import { lienFiche } from '../lib/routeur.svelte';
  import type { Resume } from '../lib/types';

  let { fiche, resultat }: { fiche: Resume; resultat: ResultatFrigo } = $props();

  const couleur = $derived(`var(--u-${fiche.univers[0] ?? 'techniques'})`);
  const complet = $derived(!resultat.manquants.length);
</script>

<a class="ligne" href={lienFiche(fiche.id)} style:--couleur={couleur}>
  <span class="pastille" aria-hidden="true"></span>
  <span class="corps">
    <span class="titre">{fiche.titre}</span>
    {#if complet}
      <span class="complet">✓ Tu as tout</span>
    {:else}
      <span class="manque">Il manque : {resultat.manquants.join(', ')}</span>
    {/if}
  </span>
  <span class="score" class:complet aria-label="{resultat.possedes} ingrédients sur {resultat.total}">
    {resultat.possedes}/{resultat.total}
  </span>
  <ChevronRight size={18} class="chevron" />
</a>

<style>
  .ligne {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 10px 12px 10px 14px;
    color: inherit;
    text-decoration: none;
  }

  .ligne:active {
    background: var(--surface-2);
  }

  .pastille {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--couleur);
  }

  .corps {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .titre {
    font-weight: 600;
    font-size: 16.5px;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .manque {
    font-size: 13.5px;
    color: var(--texte-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .complet {
    font-size: 13.5px;
    color: var(--vert);
    font-weight: 600;
  }

  .score {
    flex: none;
    min-width: 40px;
    padding: 3px 8px;
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--texte-2);
    font-size: 13.5px;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .score.complet {
    background: var(--vert-doux);
    color: var(--vert);
  }

  .ligne :global(.chevron) {
    flex: none;
    color: var(--texte-3);
  }
</style>
