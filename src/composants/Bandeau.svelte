<script lang="ts">
  // Bandeau de fiches qui défile horizontalement (favoris, cuisiné récemment).
  import { NOMS_SOURCES } from '../lib/archive';
  import { duree, dureeJours } from '../lib/format';
  import { lienFiche } from '../lib/routeur.svelte';
  import type { Resume } from '../lib/types';

  let { fiches }: { fiches: Resume[] } = $props();

  function infos(r: Resume): string {
    if (r.fermentationJours) return dureeJours(...r.fermentationJours);
    if (r.minutes) return duree(r.minutes);
    return NOMS_SOURCES[r.source] ?? '';
  }
</script>

<ul class="bandeau">
  {#each fiches as r (r.id)}
    <li>
      <a class="vignette" href={lienFiche(r.id)} style:--couleur="var(--u-{r.univers[0] ?? 'techniques'})">
        <span class="titre">{r.titre}</span>
        <span class="infos">{infos(r)}</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .bandeau {
    list-style: none;
    margin-top: 0;
    margin-bottom: 0;
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    margin: 0 calc(-16px - var(--droite)) 0 calc(-16px - var(--gauche));
    padding: 2px calc(16px + var(--droite)) 6px calc(16px + var(--gauche));
    scroll-padding-left: calc(16px + var(--gauche));
  }

  .bandeau::-webkit-scrollbar {
    display: none;
  }

  .bandeau li {
    flex: none;
    display: flex;
    scroll-snap-align: start;
  }

  .vignette {
    flex: none;
    width: 148px;
    min-height: 96px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    padding: 12px;
    border-radius: var(--rayon);
    border-top: 4px solid var(--couleur);
    background: var(--surface);
    box-shadow: var(--ombre);
    color: inherit;
    text-decoration: none;
  }

  .vignette:active {
    background: var(--surface-2);
  }

  .titre {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .infos {
    font-size: 13px;
    color: var(--texte-2);
  }
</style>
