<script lang="ts">
  import BarreHaut from '../composants/BarreHaut.svelte';
  import Importeur from '../composants/Importeur.svelte';
  import { NOMS_SOURCES } from '../lib/archive';
  import { etat } from '../lib/etat.svelte';
  import { date, heure, nombre } from '../lib/format';
  import type { SourceId } from '../lib/types';

  let conteneur = $state<HTMLElement>();
  let defile = $state(false);

  const parSource = $derived.by(() => {
    const c = new Map<SourceId, number>();
    for (const r of etat.catalogue) c.set(r.source, (c.get(r.source) ?? 0) + 1);
    return [...c.entries()];
  });

  let persistant = $state<boolean | null>(null);
  $effect(() => {
    navigator.storage?.persisted?.().then((p) => (persistant = p)).catch(() => {});
  });
</script>

<div class="ecran calque" bind:this={conteneur} onscroll={() => (defile = (conteneur?.scrollTop ?? 0) > 40)}>
  <BarreHaut titre="Réglages" avecTrait={defile} />
  <div class="contenu">
    <h1 class="titre-serif">Réglages</h1>

    <h2 class="section-titre">Mes recettes</h2>
    <div class="carte bloc">
      {#if etat.archive}
        <dl>
          <dt>Fiches</dt>
          <dd>{nombre(etat.archive.nbFiches, 0)}</dd>
          {#if etat.archive.genereLe}
            <dt>Date de l'archive</dt>
            <dd>{date(etat.archive.genereLe)}</dd>
          {/if}
          <dt>Importée le</dt>
          <dd>{date(etat.archive.importeLe)} à {heure(etat.archive.importeLe)}</dd>
        </dl>
        <ul class="sources">
          {#each parSource as [s, n] (s)}
            <li><span>{NOMS_SOURCES[s]}</span><span class="discret">{nombre(n, 0)}</span></li>
          {/each}
        </ul>
      {/if}
      <p class="discret petit">
        Pour mettre à jour, choisis la nouvelle version de <strong>archive_complete.json</strong>. Tes favoris,
        notes, courses et bocaux sont conservés.
      </p>
      <Importeur libelle="Mettre à jour les recettes" />
    </div>

    <h2 class="section-titre">Stockage</h2>
    <div class="carte bloc">
      <p class="petit">
        {#if persistant}
          ✓ Les données de l'application sont protégées : l'iPhone ne les effacera pas pour faire de la place.
        {:else}
          Les données sont enregistrées dans ce téléphone uniquement. Pense à faire des sauvegardes (bientôt
          disponible).
        {/if}
      </p>
    </div>

    <p class="discret petit version">Garde-manger — version {__VERSION__}</p>
  </div>
</div>

<style>
  .calque {
    z-index: 10;
  }

  h1 {
    font-size: 30px;
    margin-top: 4px;
  }

  .bloc {
    padding: 14px 16px 16px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 16px;
    margin: 0 0 10px;
  }

  dt {
    color: var(--texte-2);
  }

  dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
  }

  .sources {
    list-style: none;
    padding: 10px 0 0;
    margin: 0 0 6px;
    border-top: 0.5px solid var(--trait);
    font-size: 15px;
  }

  .sources li {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
  }

  .bloc p {
    margin: 0;
  }

  .bloc p + :global(*) {
    margin-top: 12px;
  }

  .version {
    text-align: center;
    margin-top: 32px;
  }
</style>
