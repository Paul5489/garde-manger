<script lang="ts">
  // Valeurs d'un contrôleur, comme sur son écran : le code en gros, la valeur dessous.
  // Toucher un code explique ce qu'il fait et pourquoi cette valeur.
  import Feuille from '../../composants/Feuille.svelte';
  import { glossaire, pourquoiDuCode, t, valeurCode, type Appareil } from '../affichage';
  import type { CodeIhc, CodeItc, Mode } from '../types';

  let {
    appareil,
    mode,
    valeurs,
    codes,
  }: {
    appareil: Appareil;
    mode: Mode;
    valeurs: Record<string, number | string>;
    codes: readonly (CodeItc | CodeIhc)[];
  } = $props();

  let ouvert = $state<string | null>(null);
  let feuille = $state(false);
  function montrer(code: string) {
    ouvert = code;
    feuille = true;
  }
  const g = $derived(ouvert ? glossaire(appareil, ouvert) : undefined);
  const raisons = $derived(
    ouvert ? pourquoiDuCode(mode, appareil, ouvert, typeof valeurs[ouvert] === 'number' ? (valeurs[ouvert] as number) : undefined) : [],
  );
  const nomAppareil = $derived(appareil === 'itc' ? 'ITC · température' : 'IHC · humidité');
</script>

<div class="codes">
  {#each codes as code (code)}
    <button class="code" onclick={() => montrer(code)} aria-label="{code} : {glossaire(appareil, code)?.nom}, {valeurCode(appareil, code, valeurs[code])}">
      <span class="lettres">{code}</span>
      <span class="valeur">{valeurCode(appareil, code, valeurs[code])}</span>
    </button>
  {/each}
</div>

<Feuille bind:ouvert={feuille} titre={ouvert ? `${ouvert} · ${g?.nom ?? ''}` : ''} sousTitre={nomAppareil}>
  {#if ouvert}
    <p class="valeur-grande">{valeurCode(appareil, ouvert as CodeItc, valeurs[ouvert])}</p>
    {#if g}<p>{t(g.explication)}</p>{/if}
    {#if raisons.length}
      <h3 class="section-titre">Pourquoi cette valeur</h3>
      <ul class="raisons">
        {#each raisons as r (r)}<li>{t(r)}</li>{/each}
      </ul>
    {/if}
    <button class="bouton secondaire plein fermer" onclick={() => (feuille = false)}>Fermer</button>
  {/if}
</Feuille>

<style>
  .codes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .code {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 68px;
    padding: 8px 4px;
    border: none;
    border-radius: 12px;
    background: #1d2420;
    color: #e9f5e4;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
  }

  .code:active {
    filter: brightness(1.25);
  }

  .lettres {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #9be38c;
  }

  .valeur {
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .valeur-grande {
    font-size: 34px;
    font-weight: 700;
    margin: 0 0 6px;
    font-variant-numeric: tabular-nums;
  }

  .raisons {
    padding-left: 1.2em;
    margin: 0;
  }

  .raisons li + li {
    margin-top: 6px;
  }

  .fermer {
    margin-top: 18px;
  }
</style>
