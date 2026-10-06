<script lang="ts">
  import { CircleX, Search, SlidersHorizontal, X } from '@lucide/svelte';
  import FeuilleFiltres from '../composants/FeuilleFiltres.svelte';
  import ListeFiches from '../composants/ListeFiches.svelte';
  import { etat } from '../lib/etat.svelte';
  import { pluriel } from '../lib/format';
  import { libelleValeur, recherche, type CleFiltre } from '../lib/recherche.svelte';
  import { routeur } from '../lib/routeur.svelte';
  import { collator } from '../lib/texte';
  import type { Resume } from '../lib/types';

  let feuilleOuverte = $state(false);
  let champ = $state<HTMLInputElement>();

  // La feuille des filtres se ferme si on quitte l'écran.
  $effect(() => {
    if (routeur.route.nom !== 'recherche') feuilleOuverte = false;
  });

  // Prépare l'index de recherche dès que l'écran est affiché.
  $effect(() => {
    etat.chargerIndex();
  });

  const actifs = $derived(
    (Object.entries(recherche.filtres) as [CleFiltre, string[]][]).flatMap(([cle, vals]) =>
      vals.map((v) => ({ cle, valeur: v, libelle: libelleValeur(cle, v) })),
    ),
  );

  // Sans texte saisi mais avec un filtre : liste rangée par catégorie.
  const parCategorie = $derived(!recherche.requete.trim() && recherche.nbFiltres > 0);
  const fiches = $derived.by((): Resume[] => {
    if (!parCategorie) return recherche.resultats;
    return [...recherche.resultats].sort(
      (a, b) =>
        collator.compare(a.categorie ?? '~', b.categorie ?? '~') || collator.compare(a.titre, b.titre),
    );
  });
  const unSeulSource = $derived(new Set(recherche.resultats.map((r) => r.source)).size === 1);

  function fermerClavier() {
    if (document.activeElement === champ) champ?.blur();
  }
</script>

<div class="grand-titre"><h1>Recherche</h1></div>

<div class="barre-recherche">
  <form class="champ-recherche" role="search" onsubmit={(e) => { e.preventDefault(); champ?.blur(); }}>
    <Search size={19} />
    <input
      bind:this={champ}
      bind:value={recherche.requete}
      id="champ-recherche"
      type="search"
      placeholder="Titre, ingrédient, technique…"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      aria-label="Rechercher"
    />
    {#if recherche.requete}
      <button type="button" class="effacer" onclick={() => { recherche.requete = ''; champ?.focus(); }} aria-label="Effacer">
        <CircleX size={19} />
      </button>
    {/if}
  </form>
  <div class="puces-actives">
    <button class="puce" class:active={recherche.nbFiltres > 0} onclick={() => (feuilleOuverte = true)}>
      <SlidersHorizontal size={16} />
      Filtres{#if recherche.nbFiltres}&nbsp;({recherche.nbFiltres}){/if}
    </button>
    {#each actifs as a (a.cle + a.valeur)}
      <button class="puce" onclick={() => recherche.basculer(a.cle, a.valeur)} aria-label="Retirer le filtre {a.libelle}">
        {a.libelle}
        <X size={15} />
      </button>
    {/each}
  </div>
</div>

<div class="contenu" role="presentation" ontouchstart={fermerClavier}>
  <p class="compte discret petit" role="status">
    {#if recherche.enAttenteIndex}
      Préparation de la recherche…
    {:else}
      {pluriel(recherche.resultats.length, 'fiche')}
    {/if}
  </p>

  {#if !recherche.enAttenteIndex && !recherche.resultats.length}
    <div class="vide">
      {#if recherche.cacheesParLesFiltres}
        <p>
          <strong>{pluriel(recherche.cacheesParLesFiltres, 'fiche trouvée', 'fiches trouvées')}</strong>, mais
          cachée{recherche.cacheesParLesFiltres > 1 ? 's' : ''} par les filtres choisis.
        </p>
        <button class="bouton" onclick={() => recherche.effacerFiltres()}>Retirer les filtres et voir</button>
      {:else}
        <p>Aucune fiche ne correspond.</p>
        {#if recherche.nbFiltres}
          <button class="bouton secondaire" onclick={() => recherche.effacerFiltres()}>Retirer les filtres</button>
        {/if}
      {/if}
    </div>
  {:else}
    <ListeFiches
      {fiches}
      masquerSource={unSeulSource}
      grouperPar={parCategorie ? (r) => r.categorie ?? 'Autres' : undefined}
    />
  {/if}
</div>

<FeuilleFiltres bind:ouvert={feuilleOuverte} />

<style>
  .barre-recherche {
    position: sticky;
    top: var(--haut);
    z-index: 5;
    padding: 0 calc(16px + var(--droite)) 8px calc(16px + var(--gauche));
    background: color-mix(in srgb, var(--fond) 88%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(18px);
    backdrop-filter: saturate(180%) blur(18px);
    max-width: 720px;
    margin: 0 auto;
  }

  .champ-recherche {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 10px 0 12px;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--texte-3);
  }

  .champ-recherche input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    outline: none;
    color: var(--texte);
    padding: 10px 0;
    -webkit-appearance: none;
    appearance: none;
  }

  .champ-recherche input::-webkit-search-cancel-button {
    display: none;
  }

  .effacer {
    display: flex;
    border: none;
    background: none;
    color: var(--texte-3);
    padding: 8px;
    margin-right: -6px;
  }

  .puces-actives {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    /* 5 px en haut et en bas : la zone tactile agrandie des puces n'est pas rognée. */
    padding-top: 5px;
    padding-bottom: 5px;
    margin: 5px calc(-16px - var(--droite)) -5px calc(-16px - var(--gauche));
    padding-left: calc(16px + var(--gauche));
    padding-right: calc(16px + var(--droite));
    scrollbar-width: none;
  }

  .puces-actives::-webkit-scrollbar {
    display: none;
  }

  .compte {
    margin: 8px 4px;
  }
</style>
