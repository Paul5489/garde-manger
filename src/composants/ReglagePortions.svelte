<script lang="ts">
  import { Minus, Plus, RotateCcw } from '@lucide/svelte';
  import { nombre } from '../lib/format';
  import { COEFFICIENTS, pasPortions, portions } from '../lib/portions.svelte';

  let {
    id,
    base,
    unite = 'portions',
    rendement,
  }: { id: string; base?: number; unite?: string; rendement?: string } = $props();

  const coef = $derived(portions.coef(id));
  const choisies = $derived(base ? portions.portions(id, base) : undefined);

  function changer(sens: 1 | -1) {
    if (!base || choisies === undefined) return;
    const pas = pasPortions(base);
    const suivant = Math.round((choisies + sens * pas) / pas) * pas;
    if (suivant >= pas) portions.definirPortions(id, base, suivant);
  }
</script>

<div class="reglage carte">
  {#if base && choisies !== undefined}
    <span class="libelle">Pour</span>
    <div class="stepper">
      <button class="rond" onclick={() => changer(-1)} disabled={choisies <= pasPortions(base)} aria-label="Moins de portions">
        <Minus size={20} />
      </button>
      <span class="valeur" aria-live="polite"><strong>{nombre(choisies)}</strong> {unite}</span>
      <button class="rond" onclick={() => changer(1)} aria-label="Plus de portions"><Plus size={20} /></button>
    </div>
  {:else}
    <span class="libelle">Quantités{#if rendement}<span class="rendement"> · base : {rendement}</span>{/if}</span>
    <div class="coefs" role="group" aria-label="Coefficient">
      {#each COEFFICIENTS as c (c)}
        <button class="puce" class:active={Math.abs(coef - c) < 1e-9} onclick={() => portions.definirCoef(id, c)}>
          ×{nombre(c)}
        </button>
      {/each}
    </div>
  {/if}
  {#if Math.abs(coef - 1) > 1e-9}
    <p class="note">
      Quantités recalculées (×{nombre(coef)}). Les quantités écrites dans les étapes, elles, ne changent pas.
      <button class="retablir" onclick={() => portions.definirCoef(id, 1)}><RotateCcw size={14} /> Rétablir</button>
    </p>
  {/if}
</div>

<style>
  .reglage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 10px 12px 10px 16px;
    margin-bottom: 10px;
  }

  .libelle {
    font-weight: 600;
  }

  .rendement {
    font-weight: 400;
    color: var(--texte-2);
    font-size: 14px;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rond {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    border: none;
    background: var(--accent-doux);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rond:disabled {
    opacity: 0.4;
  }

  .valeur {
    min-width: 7.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .coefs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    max-width: 100%;
    padding: 3px 0;
    margin: -3px 0;
  }

  .coefs .puce {
    min-height: 40px;
    padding: 0 12px;
    font-variant-numeric: tabular-nums;
  }

  .note {
    flex: 1 1 100%;
    margin: 2px 0 0;
    font-size: 13.5px;
    color: var(--texte-2);
  }

  .retablir {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: none;
    color: var(--accent);
    font-size: 13.5px;
    font-weight: 600;
    padding: 6px 4px;
  }
</style>
