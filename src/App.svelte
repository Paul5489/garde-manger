<script lang="ts">
  import BandeauMiseAJour from './composants/BandeauMiseAJour.svelte';
  import BarreMinuteurs from './composants/BarreMinuteurs.svelte';
  import BarreOnglets from './composants/BarreOnglets.svelte';
  import Accueil from './ecrans/Accueil.svelte';
  import Bienvenue from './ecrans/Bienvenue.svelte';
  import Bientot from './ecrans/Bientot.svelte';
  import Fiche from './ecrans/Fiche.svelte';
  import ModeCuisine from './ecrans/ModeCuisine.svelte';
  import Recherche from './ecrans/Recherche.svelte';
  import Reglages from './ecrans/Reglages.svelte';
  import { etat } from './lib/etat.svelte';
  import { ONGLETS, routeur, type Onglet } from './lib/routeur.svelte';

  etat.demarrer();

  // Les onglets déjà ouverts restent en mémoire : on retrouve sa place en revenant.
  let visites = $state(new Set<Onglet>());
  $effect(() => {
    const o = routeur.onglet;
    if (!visites.has(o)) visites = new Set([...visites, o]);
  });

  const pageEmpilee = $derived(['fiche', 'reglages', 'cuisine'].includes(routeur.route.nom));
  const enCuisine = $derived(routeur.route.nom === 'cuisine');

  // Liens internes (#/…) : navigation avec historique pour le bouton Retour.
  function surClic(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const a = (e.target as Element).closest?.('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    routeur.aller(a.getAttribute('href')!);
  }
</script>

<svelte:document onclick={surClic} />

<div class="fond-statut" aria-hidden="true"></div>

{#if etat.statut === 'chargement'}
  <div class="attente" aria-busy="true"></div>
{:else if etat.statut === 'erreur'}
  <div class="vide">
    <p>Impossible d'ouvrir les données du téléphone.</p>
    <p class="petit">{etat.erreur}</p>
  </div>
{:else if etat.statut === 'vide'}
  <Bienvenue />
{:else}
  {#each ONGLETS as o (o)}
    {#if visites.has(o)}
      <main class="ecran" class:cache={routeur.onglet !== o || pageEmpilee} inert={routeur.onglet !== o || pageEmpilee}>
        {#if o === 'accueil'}<Accueil />
        {:else if o === 'recherche'}<Recherche />
        {:else if o === 'frigo'}
          <Bientot titre="Avec ce que j'ai" etape={4} texte="Indique les ingrédients que tu as : l'appli te proposera les recettes réalisables et ce qu'il te manque." />
        {:else if o === 'courses'}
          <Bientot titre="Courses" etape={3} texte="Ta liste de courses, remplie depuis les recettes, avec partage en un toucher." />
        {:else}
          <Bientot titre="Mes bocaux" etape={5} texte="Le suivi de tes fermentations : jours écoulés, dégustations, rappels dans le Calendrier." />
        {/if}
      </main>
    {/if}
  {/each}

  {#if routeur.route.nom === 'fiche'}
    <Fiche id={routeur.route.id} page={routeur.route.page} />
  {:else if routeur.route.nom === 'reglages'}
    <Reglages />
  {:else if routeur.route.nom === 'cuisine'}
    <ModeCuisine id={routeur.route.id} />
  {/if}

  {#if !enCuisine}<BarreOnglets />{/if}
  <BarreMinuteurs {enCuisine} />
{/if}

<BandeauMiseAJour />

<style>
  .fond-statut {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--haut);
    background: var(--fond);
    z-index: 30;
  }

  .attente {
    height: 100%;
  }
</style>
