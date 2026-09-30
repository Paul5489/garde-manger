<script lang="ts">
  import { Search, Settings } from '@lucide/svelte';
  import ListeFiches from '../composants/ListeFiches.svelte';
  import { UNIVERS } from '../lib/archive';
  import { etat } from '../lib/etat.svelte';
  import { nombre } from '../lib/format';
  import { recherche } from '../lib/recherche.svelte';
  import { routeur } from '../lib/routeur.svelte';
  import type { Univers } from '../lib/types';

  const compte = $derived.by(() => {
    const c: Record<Univers, number> = { asiatique: 0, francaise: 0, techniques: 0, fermentation: 0 };
    for (const r of etat.catalogue) for (const u of r.univers) c[u]++;
    return c;
  });

  // Idées du jour : 4 recettes tirées au sort, les mêmes toute la journée.
  const idees = $derived.by(() => {
    const recettes = etat.catalogue.filter((r) => r.type === 'recette');
    if (!recettes.length) return [];
    const jour = new Date();
    let graine = jour.getFullYear() * 10000 + (jour.getMonth() + 1) * 100 + jour.getDate();
    const alea = () => {
      graine = (graine * 1103515245 + 12345) % 2147483648;
      return graine / 2147483648;
    };
    const choix = new Set<number>();
    while (choix.size < Math.min(4, recettes.length)) choix.add(Math.floor(alea() * recettes.length));
    return [...choix].map((i) => recettes[i]);
  });

  function ouvrir(u: Univers) {
    recherche.ouvrirUnivers(u);
    routeur.ouvrirOnglet('recherche');
  }

  function chercher() {
    routeur.ouvrirOnglet('recherche');
    requestAnimationFrame(() => document.getElementById('champ-recherche')?.focus());
  }
</script>

<div class="grand-titre">
  <h1>Garde-manger</h1>
  <a class="bouton-icone" href="#/reglages" aria-label="Réglages"><Settings size={24} /></a>
</div>

<div class="contenu">
  <button class="faux-champ" onclick={chercher}>
    <Search size={19} />
    Rechercher une recette, un ingrédient…
  </button>

  <div class="univers">
    {#each UNIVERS as u (u.id)}
      <button class="tuile" style:--couleur="var(--u-{u.id})" onclick={() => ouvrir(u.id)}>
        <span class="emoji" aria-hidden="true">{u.emoji}</span>
        <span class="titre-tuile">{u.titre}</span>
        <span class="sous-titre">{u.sousTitre}</span>
        <span class="nombre">{nombre(compte[u.id], 0)} fiches</span>
      </button>
    {/each}
  </div>

  {#if idees.length}
    <h2 class="section-titre">Idées du jour</h2>
    <ListeFiches fiches={idees} />
  {/if}
</div>

<style>
  .faux-champ {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    margin-top: 6px;
    border: none;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--texte-3);
    font-size: 17px;
    text-align: left;
  }

  .univers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }

  .tuile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 132px;
    padding: 14px;
    border: none;
    border-radius: var(--rayon);
    background: var(--couleur);
    color: #fff;
    text-align: left;
    box-shadow: var(--ombre);
    overflow: hidden;
  }

  .tuile:active {
    filter: brightness(0.92);
  }

  @media (prefers-color-scheme: dark) {
    .tuile {
      background: color-mix(in srgb, var(--couleur) 30%, var(--surface));
      color: var(--texte);
    }
  }

  .emoji {
    font-size: 30px;
    line-height: 1;
    margin-bottom: 8px;
  }

  .titre-tuile {
    font-family: var(--police-titre);
    font-weight: 700;
    font-size: 18px;
    line-height: 1.15;
  }

  .sous-titre {
    font-size: 12.5px;
    opacity: 0.85;
    line-height: 1.25;
  }

  .nombre {
    margin-top: auto;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 600;
    opacity: 0.9;
  }
</style>
