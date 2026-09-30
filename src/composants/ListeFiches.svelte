<script lang="ts">
  import LigneFiche from './LigneFiche.svelte';
  import type { Resume } from '../lib/types';

  let {
    fiches,
    grouperPar,
    masquerSource = false,
  }: {
    fiches: Resume[];
    /** Regroupe par catégorie (dans l'ordre d'apparition). */
    grouperPar?: (r: Resume) => string;
    masquerSource?: boolean;
  } = $props();

  // Affichage progressif : on ajoute des lignes en approchant du bas de la liste.
  const PAS = 60;
  let limite = $state(PAS);
  let sentinelle = $state<HTMLElement>();

  $effect(() => {
    fiches; // réinitialise quand la liste change
    limite = PAS;
  });

  $effect(() => {
    if (!sentinelle) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) limite += PAS;
      },
      { rootMargin: '800px' },
    );
    obs.observe(sentinelle);
    return () => obs.disconnect();
  });

  const visibles = $derived(fiches.slice(0, limite));
  const groupes = $derived.by(() => {
    if (!grouperPar) return [{ titre: '', fiches: visibles }];
    const m = new Map<string, Resume[]>();
    for (const r of visibles) {
      const g = grouperPar(r);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return [...m.entries()].map(([titre, fiches]) => ({ titre, fiches }));
  });
</script>

{#each groupes as g (g.titre)}
  {#if g.titre}<h2 class="section-titre">{g.titre}</h2>{/if}
  <ul class="liste">
    {#each g.fiches as f (f.id)}
      <li><LigneFiche fiche={f} {masquerSource} masquerCategorie={!!grouperPar} /></li>
    {/each}
  </ul>
{/each}
{#if limite < fiches.length}
  <div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
{/if}

<style>
  .sentinelle {
    height: 1px;
  }

  .liste + .section-titre {
    margin-top: 28px;
  }
</style>
