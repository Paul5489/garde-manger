<script lang="ts">
  import { ligneIngredient, mentionneFacultatif } from '../lib/quantites';
  import { casseLisible, insecables } from '../lib/texte';
  import type { GroupeIngredients, SourceId } from '../lib/types';

  let {
    groupes,
    source,
    coef = 1,
  }: { groupes: GroupeIngredients[]; source: SourceId; coef?: number } = $props();

  // Toucher un ingrédient le raye (pratique pour la mise en place).
  let coches = $state(new Set<string>());
  function basculer(cle: string) {
    const s = new Set(coches);
    if (s.has(cle)) s.delete(cle);
    else s.add(cle);
    coches = s;
  }
</script>

{#each groupes as g, gi (gi)}
  {#if g.groupe?.trim()}<h3 class="groupe">{casseLisible(g.groupe)}</h3>{/if}
  <ul class="ingredients">
    {#each g.items ?? [] as item, ii (ii)}
      {@const l = ligneIngredient(item, source, coef)}
      {@const cle = `${gi}-${ii}`}
      <li class:alternative={l.alternative} class:coche={coches.has(cle)}>
        <button class="ingredient" class:colonnes={l.mode === 'colonnes'} onclick={() => basculer(cle)}>
          {#if l.mode === 'colonnes'}
            <span class="qte" class:pm={l.pm}>{l.quantite ?? ''}</span>
            <span class="nom">
              {#if l.alternative}<em class="ou">ou&nbsp;</em>{/if}{insecables(l.texte)}{#if l.optionnel && !mentionneFacultatif(l.texte)}<span class="facultatif"> (facultatif)</span>{/if}
            </span>
          {:else}
            <span class="phrase">
              {#if l.alternative}<em class="ou">ou&nbsp;</em>{/if}{#if l.quantite}<strong>{l.quantite}</strong>&nbsp;{/if}{insecables(l.texte)}{#if l.optionnel && !mentionneFacultatif(l.texte)}<span class="facultatif"> (facultatif)</span>{/if}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
{/each}

<style>
  .groupe {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
    margin: 18px 0 6px;
  }

  .ingredients {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ingredients li + li {
    border-top: 0.5px solid var(--trait);
  }

  .ingredient {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 9px 2px;
    min-height: 44px;
    font-size: 16.5px;
    line-height: 1.35;
  }

  .ingredient.colonnes {
    display: grid;
    grid-template-columns: 5.6em 1fr;
    gap: 12px;
    align-items: baseline;
  }

  .qte {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .qte.pm {
    font-weight: 500;
    font-size: 13px;
    color: var(--texte-3);
    letter-spacing: 0.04em;
  }

  .alternative .ingredient {
    padding-top: 2px;
  }

  .alternative {
    border-top: none !important;
  }

  .ou {
    color: var(--texte-2);
    font-size: 14px;
  }

  .facultatif {
    color: var(--texte-2);
    font-size: 14px;
  }

  .coche .qte,
  .coche .nom,
  .coche .phrase {
    text-decoration: line-through;
    color: var(--texte-3);
  }
</style>
