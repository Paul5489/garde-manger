<script lang="ts">
  import Ingredients from './Ingredients.svelte';
  import type { SourceId, TableauDenrees } from '../lib/types';

  let { tableau, source, coef = 1 }: { tableau: TableauDenrees; source: SourceId; coef?: number } = $props();

  const titre = $derived(
    (tableau.titre ?? 'Denrées').replace(/^DENRÉES\b/, 'Denrées').replace(/\s+/g, ' ').trim(),
  );
</script>

<div class="tableau carte">
  <h3>{titre}</h3>
  <Ingredients groupes={tableau.ingredients ?? []} {source} {coef} />
</div>

<style>
  .tableau {
    padding: 12px 14px 6px;
    margin: 14px 0;
  }

  h3 {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--texte-2);
  }
</style>
