<script lang="ts">
  import { fly } from 'svelte/transition';
  import { annonce } from '../lib/annonce.svelte';

  let { enCuisine = false }: { enCuisine?: boolean } = $props();
</script>

<div class="zone-annonce" class:en-cuisine={enCuisine} aria-live="polite">
  {#if annonce.courante}
    {@const a = annonce.courante}
    {#key a.id}
      <div class="annonce" role="status" transition:fly={{ y: 30, duration: 200 }}>
        <span>{a.texte}</span>
        {#if a.action}
          <button
            onclick={() => {
              a.action?.faire();
              annonce.fermer();
            }}>{a.action.libelle}</button
          >
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .zone-annonce {
    position: fixed;
    left: calc(12px + var(--gauche));
    right: calc(12px + var(--droite));
    bottom: calc(var(--hauteur-onglets) + var(--bas) + 68px);
    z-index: 55;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .zone-annonce.en-cuisine {
    bottom: calc(var(--bas) + 140px);
  }

  .annonce {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    min-height: 48px;
    padding: 6px 8px 6px 16px;
    border-radius: 14px;
    background: var(--texte);
    color: var(--fond);
    font-size: 15px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
    pointer-events: auto;
  }

  button {
    flex: none;
    min-height: 36px;
    padding: 0 12px;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--fond) 18%, transparent);
    color: inherit;
    font-weight: 700;
  }
</style>
