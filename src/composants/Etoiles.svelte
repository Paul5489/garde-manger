<script lang="ts">
  import { Star } from '@lucide/svelte';

  let {
    valeur = $bindable(0),
    taille = 30,
    modifiable = true,
  }: { valeur?: number; taille?: number; modifiable?: boolean } = $props();

  const NOTES = [1, 2, 3, 4, 5];
  const LIBELLES = ['', 'Bof', 'Moyen', 'Bien', 'Très bien', 'Excellent'];
</script>

{#if modifiable}
  <div class="etoiles" role="radiogroup" aria-label="Appréciation">
    {#each NOTES as n (n)}
      <button
        type="button"
        role="radio"
        aria-checked={valeur === n}
        aria-label="{n} sur 5 : {LIBELLES[n]}"
        class:pleine={n <= valeur}
        onclick={() => (valeur = valeur === n ? 0 : n)}
      >
        <Star size={taille} fill={n <= valeur ? 'currentColor' : 'none'} strokeWidth={1.8} />
      </button>
    {/each}
    <span class="libelle" aria-hidden="true">{LIBELLES[valeur]}</span>
  </div>
{:else if valeur > 0}
  <span class="etoiles lecture" role="img" aria-label="{valeur} sur 5">
    {#each NOTES as n (n)}
      <Star size={taille} fill={n <= valeur ? 'currentColor' : 'none'} strokeWidth={n <= valeur ? 1.8 : 1.4} class={n <= valeur ? 'pleine' : 'vide-etoile'} />
    {/each}
  </span>
{/if}

<style>
  .etoiles {
    display: inline-flex;
    align-items: center;
    color: var(--ambre);
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    color: var(--texte-3);
    padding: 0;
  }

  button.pleine {
    color: var(--ambre);
  }

  .libelle {
    margin-left: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--texte-2);
  }

  .lecture {
    gap: 1px;
    vertical-align: -2px;
  }

  .lecture :global(.vide-etoile) {
    color: var(--texte-3);
    opacity: 0.6;
  }
</style>
