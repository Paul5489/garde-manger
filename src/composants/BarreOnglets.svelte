<script lang="ts">
  import { CirclePlus, House, Search, Refrigerator, ShoppingBasket } from '@lucide/svelte';
  import IconeBocal from './IconeBocal.svelte';
  import { bocaux } from '../lib/bocaux.svelte';
  import { courses } from '../lib/courses.svelte';
  import { routeur, type Onglet } from '../lib/routeur.svelte';

  const onglets: { id: Onglet; libelle: string }[] = [
    { id: 'accueil', libelle: 'Accueil' },
    { id: 'recherche', libelle: 'Recherche' },
    { id: 'ajouter', libelle: 'Ajouter' },
    { id: 'frigo', libelle: 'Frigo' },
    { id: 'courses', libelle: 'Courses' },
    { id: 'chambre', libelle: 'Chambre' },
  ];
</script>

<nav class="onglets" aria-label="Navigation principale">
  {#each onglets as o (o.id)}
    {@const actif = routeur.onglet === o.id}
    <button
      class="onglet"
      class:actif
      aria-current={actif ? 'page' : undefined}
      onclick={() => routeur.ouvrirOnglet(o.id)}
    >
      {#if o.id === 'accueil'}<House size={25} strokeWidth={actif ? 2.3 : 1.8} />
      {:else if o.id === 'recherche'}<Search size={25} strokeWidth={actif ? 2.3 : 1.8} />
      {:else if o.id === 'ajouter'}<CirclePlus size={25} strokeWidth={actif ? 2.3 : 1.8} />
      {:else if o.id === 'frigo'}<Refrigerator size={25} strokeWidth={actif ? 2.3 : 1.8} />
      {:else if o.id === 'courses'}
        <span class="icone-badge">
          <ShoppingBasket size={25} strokeWidth={actif ? 2.3 : 1.8} />
          {#if courses.restants.length}
            <span class="badge" aria-label="{courses.restants.length} à acheter">{courses.restants.length > 99 ? '99+' : courses.restants.length}</span>
          {/if}
        </span>
      {:else}
        <span class="icone-badge">
          <IconeBocal size={25} strokeWidth={actif ? 2.3 : 1.8} />
          {#if bocaux.aSignaler}
            <span class="badge vert" aria-label="{bocaux.aSignaler} à goûter ou prêts">{bocaux.aSignaler}</span>
          {/if}
        </span>
      {/if}
      <span>{o.libelle}</span>
    </button>
  {/each}
</nav>

<style>
  .onglets {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    height: calc(var(--hauteur-onglets) + var(--bas));
    padding: 0 var(--droite) var(--bas) var(--gauche);
    background: color-mix(in srgb, var(--fond) 85%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border-top: 0.5px solid var(--trait);
  }

  .onglet {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: none;
    color: var(--texte-3);
    font-size: 10.5px;
    font-weight: 500;
    padding: 4px 0 0;
  }

  .onglet.actif {
    color: var(--accent);
  }

  .icone-badge {
    position: relative;
    display: flex;
  }

  .badge.vert {
    background: var(--vert);
    color: var(--surface);
  }

  .badge {
    position: absolute;
    top: -4px;
    left: 17px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--sur-accent);
    font-size: 11.5px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
