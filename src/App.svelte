<script lang="ts">
  import Annonce from './composants/Annonce.svelte';
  import BandeauMiseAJour from './composants/BandeauMiseAJour.svelte';
  import BarreMinuteurs from './composants/BarreMinuteurs.svelte';
  import BarreOnglets from './composants/BarreOnglets.svelte';
  import Accueil from './ecrans/Accueil.svelte';
  import Ajouter from './ecrans/Ajouter.svelte';
  import Bienvenue from './ecrans/Bienvenue.svelte';
  import Bocal from './ecrans/Bocal.svelte';
  import Courses from './ecrans/Courses.svelte';
  import EditionBocal from './ecrans/EditionBocal.svelte';
  import EditionRecette from './ecrans/EditionRecette.svelte';
  import Fiche from './ecrans/Fiche.svelte';
  import Frigo from './ecrans/Frigo.svelte';
  import ModeCuisine from './ecrans/ModeCuisine.svelte';
  import Recherche from './ecrans/Recherche.svelte';
  import Reglages from './ecrans/Reglages.svelte';
  import { bocaux } from './lib/bocaux.svelte';
  import { courses } from './lib/courses.svelte';
  import { etat } from './lib/etat.svelte';
  import { frigo } from './lib/frigo.svelte';
  import { masquees } from './lib/masquees.svelte';
  import { mesRecettes } from './lib/mes-recettes.svelte';
  import { afficherSurIcone, pastilles } from './lib/pastilles.svelte';
  import { perso } from './lib/perso.svelte';
  import { ONGLETS, routeur, type Onglet } from './lib/routeur.svelte';

  etat.demarrer();
  // Données personnelles (favoris, notes, courses) : indépendantes des recettes importées.
  Promise.all([perso.charger(), courses.charger(), frigo.charger(), bocaux.charger(), mesRecettes.charger(), masquees.charger()]).catch((e) =>
    console.error(e),
  );

  // Les onglets déjà ouverts restent en mémoire : on retrouve sa place en revenant.
  let visites = $state(new Set<Onglet>());
  $effect(() => {
    const o = routeur.onglet;
    if (!visites.has(o)) visites = new Set([...visites, o]);
  });

  const pageEmpilee = $derived(
    ['fiche', 'reglages', 'cuisine', 'bocal', 'bocal-edition', 'recette-edition', 'chambre-page'].includes(routeur.route.nom),
  );
  const cheminChambre = $derived(routeur.route.nom === 'chambre-page' ? routeur.route.chemin : []);
  // Module Chambre : chargé à la première ouverture de l'onglet ou d'une de ses pages, et peu après le démarrage
  // pour la pastille (choses à faire aujourd'hui).
  const moduleChambre = () => import('./chambre/module');
  setTimeout(() => void moduleChambre().catch(() => {}), 1500);
  // Pastille de l'icône : choses à faire dans la chambre + bocaux à goûter ou prêts.
  $effect(() => afficherSurIcone(pastilles.chambre + bocaux.aSignaler));
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
        {:else if o === 'ajouter'}<Ajouter />
        {:else if o === 'frigo'}<Frigo />
        {:else if o === 'courses'}<Courses />
        {:else}{#await moduleChambre()}<p class="vide">Chargement…</p>{:then m}<m.Chambre />{/await}{/if}
      </main>
    {/if}
  {/each}

  {#if routeur.route.nom === 'fiche'}
    <Fiche id={routeur.route.id} page={routeur.route.page} />
  {:else if routeur.route.nom === 'reglages'}
    <Reglages section={routeur.route.section} />
  {:else if routeur.route.nom === 'bocal'}
    <Bocal id={routeur.route.id} />
  {:else if routeur.route.nom === 'bocal-edition'}
    {#key `${routeur.route.id}|${routeur.route.fiche}|${routeur.route.modele}`}
      <EditionBocal id={routeur.route.id} fiche={routeur.route.fiche} modele={routeur.route.modele} />
    {/key}
  {:else if routeur.route.nom === 'recette-edition'}
    {#key routeur.route.id ?? 'nouvelle'}
      <EditionRecette id={routeur.route.id} />
    {/key}
  {:else if routeur.route.nom === 'chambre-page'}
    {#await moduleChambre()}
      <div class="ecran attente-chambre"><p class="vide">Chargement…</p></div>
    {:then m}
      <m.PageChambre chemin={cheminChambre} />
    {/await}
  {:else if routeur.route.nom === 'cuisine'}
    <ModeCuisine id={routeur.route.id} />
  {/if}

  {#if !enCuisine}<BarreOnglets />{/if}
  <BarreMinuteurs {enCuisine} />
  <Annonce {enCuisine} />
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

  .attente-chambre {
    z-index: 10;
    padding-top: var(--haut);
  }
</style>
