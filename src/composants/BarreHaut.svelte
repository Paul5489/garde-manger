<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronLeft } from '@lucide/svelte';
  import { routeur } from '../lib/routeur.svelte';

  let {
    titre = '',
    avecTrait = false,
    actions,
  }: { titre?: string; avecTrait?: boolean; actions?: Snippet } = $props();
</script>

<header class="barre-haut" class:avec-trait={avecTrait}>
  <button class="bouton-icone" onclick={() => routeur.retour()} aria-label="Retour">
    <ChevronLeft size={28} strokeWidth={2.2} />
    <span class="retour">Retour</span>
  </button>
  <div class="titre-barre">{titre}</div>
  <div class="actions">
    {@render actions?.()}
  </div>
</header>

<style>
  .retour {
    margin-left: -4px;
  }

  .actions {
    display: flex;
    align-items: center;
    min-width: 88px;
    justify-content: flex-end;
  }
</style>
