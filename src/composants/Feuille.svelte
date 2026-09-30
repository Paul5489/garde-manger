<script lang="ts">
  // Feuille qui monte du bas de l'écran (choix, confirmations). Pas de champ de saisie dedans :
  // sur iPhone, le clavier la recouvrirait.
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { portail } from '../lib/portail';

  let {
    ouvert = $bindable(false),
    titre,
    sousTitre,
    children,
    pied,
  }: { ouvert: boolean; titre: string; sousTitre?: string; children: Snippet; pied?: Snippet } = $props();
</script>

{#if ouvert}
  <div use:portail>
    <div class="voile" transition:fade={{ duration: 180 }} onclick={() => (ouvert = false)} aria-hidden="true"></div>
    <div class="feuille" role="dialog" aria-modal="true" aria-label={titre} transition:fly={{ y: 600, duration: 260 }}>
      <div class="poignee" aria-hidden="true"></div>
      <header>
        <div class="titres">
          <h2>{titre}</h2>
          {#if sousTitre}<p class="discret petit">{sousTitre}</p>{/if}
        </div>
        <button class="bouton-icone" onclick={() => (ouvert = false)} aria-label="Fermer"><X size={24} /></button>
      </header>
      <div class="defilement">{@render children()}</div>
      {#if pied}<footer>{@render pied()}</footer>{/if}
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px 6px 16px;
  }

  .titres {
    padding-top: 8px;
    min-width: 0;
  }

  h2 {
    font-family: var(--police-titre);
    font-size: 22px;
  }

  .titres p {
    margin: 2px 0 0;
  }

  .defilement {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 16px 16px;
  }

  footer {
    padding: 12px 16px calc(12px + var(--bas));
    border-top: 0.5px solid var(--trait);
  }

  .defilement:last-child {
    padding-bottom: calc(16px + var(--bas));
  }
</style>
