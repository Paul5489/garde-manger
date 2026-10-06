<script lang="ts">
  // Recettes de l'archive (ou fiches ajoutées par fichier) supprimées par Paul : on peut les remettre.
  import { Undo2 } from '@lucide/svelte';
  import { etat } from '../lib/etat.svelte';
  import { masquees } from '../lib/masquees.svelte';
  import { mesRecettes } from '../lib/mes-recettes.svelte';
  import { collator } from '../lib/texte';

  const liste = $derived.by(() => {
    const parId = new Map([...etat.catalogueArchive, ...mesRecettes.resumes].map((r) => [r.id, r]));
    return [...parId.values()].filter((r) => masquees.est(r.id)).sort((a, b) => collator.compare(a.titre, b.titre));
  });
</script>

{#if liste.length}
  <ul class="supprimees">
    {#each liste as r (r.id)}
      <li>
        <span class="titre">{r.titre}</span>
        <button class="bouton secondaire" onclick={() => masquees.remettre(r.id)}><Undo2 size={16} /> Remettre</button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="discret petit">Aucune recette supprimée. (Bouton « Supprimer » en bas de chaque fiche.)</p>
{/if}

<style>
  .supprimees {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  li + li {
    border-top: 0.5px solid var(--trait);
  }

  .titre {
    flex: 1;
    min-width: 0;
    font-size: 15px;
  }

  .bouton {
    min-height: 40px;
    font-size: 14px;
    padding: 0 12px;
  }

  p {
    margin: 0;
  }
</style>
