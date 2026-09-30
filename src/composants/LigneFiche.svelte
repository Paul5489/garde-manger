<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  import { NOMS_SOURCES, NOMS_TYPES } from '../lib/archive';
  import { duree, dureeJours } from '../lib/format';
  import { lienFiche } from '../lib/routeur.svelte';
  import type { Resume } from '../lib/types';

  let {
    fiche,
    masquerSource = false,
    masquerCategorie = false,
  }: { fiche: Resume; masquerSource?: boolean; masquerCategorie?: boolean } = $props();

  const couleur = $derived(`var(--u-${fiche.univers[0] ?? 'techniques'})`);
  const temps = $derived(
    fiche.fermentationJours
      ? dureeJours(...fiche.fermentationJours)
      : fiche.minutes
        ? duree(fiche.minutes)
        : null,
  );
  const infos = $derived(
    [masquerSource ? null : NOMS_SOURCES[fiche.source], masquerCategorie ? null : fiche.categorie]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<a class="ligne" href={lienFiche(fiche.id)} style:--couleur={couleur}>
  <span class="pastille" aria-hidden="true"></span>
  <span class="corps">
    <span class="titre">{fiche.titre}</span>
    <span class="infos">
      {#if fiche.type !== 'recette'}<span class="etiquette">{NOMS_TYPES[fiche.type]}</span>{/if}
      <span class="texte-infos">{infos}</span>
    </span>
  </span>
  {#if temps}<span class="temps">{temps}</span>{/if}
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
    content-visibility: auto;
    contain-intrinsic-size: auto 64px;
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

  .infos {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 13.5px;
    color: var(--texte-2);
  }

  .texte-infos {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .temps {
    flex: none;
    font-size: 13.5px;
    color: var(--texte-2);
    font-variant-numeric: tabular-nums;
  }

  .ligne :global(.chevron) {
    flex: none;
    color: var(--texte-3);
  }
</style>
