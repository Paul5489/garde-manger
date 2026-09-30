<script lang="ts">
  import { X } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { pluriel } from '../lib/format';
  import { portail } from '../lib/portail';
  import { NOMS_FILTRES, recherche, type CleFiltre } from '../lib/recherche.svelte';

  let { ouvert = $bindable(false) }: { ouvert: boolean } = $props();

  const sections: CleFiltre[] = ['univers', 'types', 'sources', 'temps', 'categories', 'cuisines', 'typesDePlat'];
</script>

{#if ouvert}
<div use:portail>
  <div class="voile" transition:fade={{ duration: 180 }} onclick={() => (ouvert = false)} aria-hidden="true"></div>
  <div class="feuille" role="dialog" aria-modal="true" aria-label="Filtres" transition:fly={{ y: 600, duration: 260 }}>
    <div class="poignee" aria-hidden="true"></div>
    <header>
      <button class="bouton-icone" onclick={() => recherche.effacerFiltres()} disabled={!recherche.nbFiltres}>
        Effacer
      </button>
      <h2>Filtres</h2>
      <button class="bouton-icone" onclick={() => (ouvert = false)} aria-label="Fermer"><X size={24} /></button>
    </header>
    <div class="defilement">
      {#each sections as cle (cle)}
        {@const options = recherche.options(cle).filter((o) => o.nombre > 0 || (recherche.filtres[cle] as string[]).includes(o.valeur))}
        {#if options.length > 1 || (recherche.filtres[cle] as string[]).length}
          <section>
            <h3>{NOMS_FILTRES[cle]}</h3>
            <div class="puces">
              {#each options as o (o.valeur)}
                <button
                  class="puce"
                  class:active={(recherche.filtres[cle] as string[]).includes(o.valeur)}
                  onclick={() => recherche.basculer(cle, o.valeur)}
                >
                  {o.libelle}<span class="nombre">{o.nombre}</span>
                </button>
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    </div>
    <footer>
      <button class="bouton plein" onclick={() => (ouvert = false)}>
        Voir {pluriel(recherche.resultats.length, 'fiche')}
      </button>
    </footer>
  </div>
</div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.35);
  }

  .feuille {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    max-height: calc(100% - var(--haut) - 24px);
    display: flex;
    flex-direction: column;
    background: var(--fond);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -8px 30px rgb(0 0 0 / 0.2);
  }

  .poignee {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-3);
    margin: 8px auto 0;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px;
  }

  header h2 {
    font-size: 17px;
    font-weight: 600;
  }

  header .bouton-icone:disabled {
    color: var(--texte-3);
  }

  .defilement {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 16px 8px;
  }

  h3 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin: 18px 0 8px;
  }

  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .nombre {
    font-size: 12.5px;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }

  footer {
    padding: 12px 16px calc(12px + var(--bas));
    border-top: 0.5px solid var(--trait);
  }
</style>
