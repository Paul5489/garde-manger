<script lang="ts">
  import { etat } from '../lib/etat.svelte';
  import { decouperRenvois } from '../lib/renvois';
  import { lienFiche } from '../lib/routeur.svelte';

  let { texte }: { texte: string } = $props();
  const morceaux = $derived(decouperRenvois(texte, etat.catalogue, lienFiche));
</script>

{#each morceaux as m, i (i)}{#if m.lien}<a href={m.lien} class="lien-page" title={m.titre}>{m.texte}</a>{:else}{m.texte}{/if}{/each}

<style>
  .lien-page {
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    padding: 2px 1px;
  }
</style>
