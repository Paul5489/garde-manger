<script lang="ts">
  import { Timer } from '@lucide/svelte';
  import TexteRenvois from './TexteRenvois.svelte';
  import { decouperDurees, libelleDuree, type DureeTrouvee } from '../lib/durees';
  import { minuteurs } from '../lib/minuteurs.svelte';
  import { insecables } from '../lib/texte';

  let {
    texte,
    livre = false,
    libelle,
    ficheId,
  }: {
    texte: string;
    /** Cuisine de référence : les « voir p. 57 » deviennent des liens. */
    livre?: boolean;
    /** Nom du minuteur lancé depuis ce texte. */
    libelle: string;
    ficheId?: string;
  } = $props();

  const morceaux = $derived(decouperDurees(insecables(texte)));
  let lance = $state<string | null>(null);

  function lancer(d: DureeTrouvee) {
    minuteurs.lancer(libelle, d.min, { ficheId, supplementSecondes: d.max - d.min });
    lance = d.texte;
    setTimeout(() => (lance = null), 1800);
  }
</script>

{#each morceaux as m, i (i)}{#if m.duree}{@const d = m.duree}<button
      class="duree"
      class:lance={lance === d.texte}
      onclick={() => lancer(d)}
      aria-label="Lancer un minuteur de {libelleDuree(d.min)}"
      ><Timer size={15} strokeWidth={2.4} />{m.texte}</button
    >{:else if livre}<TexteRenvois texte={m.texte} />{:else}{m.texte}{/if}{/each}

<style>
  .duree {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px 1px 5px;
    margin: 0 1px;
    border: none;
    border-radius: 8px;
    background: var(--ambre-doux);
    color: var(--ambre);
    font: inherit;
    font-weight: 600;
    line-height: 1.35;
    vertical-align: baseline;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .duree :global(svg) {
    align-self: center;
  }

  .duree:active,
  .duree.lance {
    background: var(--ambre);
    color: var(--surface);
  }
</style>
