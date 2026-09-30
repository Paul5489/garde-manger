<script lang="ts">
  import Markdown from './Markdown.svelte';
  import TableauDenrees from './TableauDenrees.svelte';
  import { REPERE_TABLEAU, retirerTitreRepete } from '../lib/markdown';
  import type { SourceId, TableauDenrees as Tableau } from '../lib/types';

  let {
    texte,
    titre = '',
    tableaux = [],
    source,
    coef = 1,
    renvoiIngredients = false,
  }: {
    texte: string;
    titre?: string;
    tableaux?: Tableau[];
    source: SourceId;
    coef?: number;
    renvoiIngredients?: boolean;
  } = $props();

  const morceaux = $derived(retirerTitreRepete(texte, titre).split(REPERE_TABLEAU));
  // Les tableaux sont insérés à leur place quand leur nombre correspond aux repères du texte.
  const enLigne = $derived(tableaux.length === morceaux.length - 1);
</script>

{#each morceaux as m, i (i)}
  <Markdown texte={m} />
  {#if i < morceaux.length - 1}
    {#if enLigne}
      <TableauDenrees tableau={tableaux[i]} {source} {coef} />
    {:else if renvoiIngredients}
      <p class="renvoi-tableau">Tableau des denrées : voir « Ingrédients » plus haut.</p>
    {:else if tableaux.length}
      <p class="renvoi-tableau">Tableau des denrées : voir plus bas.</p>
    {/if}
  {/if}
{/each}
{#if !enLigne && tableaux.length}
  <h2 class="section-titre">Tableaux des denrées</h2>
  {#each tableaux as t, i (i)}
    <TableauDenrees tableau={t} {source} {coef} />
  {/each}
{/if}

<style>
  .renvoi-tableau {
    font-size: 14px;
    color: var(--texte-2);
    font-style: italic;
  }
</style>
