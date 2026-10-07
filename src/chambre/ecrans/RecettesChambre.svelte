<script lang="ts">
  // Les 83 recettes de la chambre, par famille, avec recherche et filtre « de saison ».
  import { ChevronRight, Star } from '@lucide/svelte';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { normaliser } from '../../lib/texte';
  import { couleurMode } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, MODES_PAR_ID, NOMS_FAMILLES, NOMS_LIEUX } from '../donnees';
  import { deSaison, dureeLisible, nomMois, saison } from '../recettes';
  import type { Famille } from '../types';

  let texte = $state('');
  let famille = $state<Famille | null>(null);
  let duMois = $state(false);
  const mois = $derived(new Date(chambre.maintenant).getMonth() + 1);

  const ORDRE: Famille[] = ['koji', 'lacto', 'charc', 'champ', 'pain', 'vin', 'sech'];
  const filtrees = $derived.by(() => {
    const q = normaliser(texte.trim());
    return CONTENU.recettes.filter(
      (r) =>
        (!famille || r.famille === famille) &&
        (!duMois || deSaison(r, mois) || r.toute_annee) &&
        (!q || normaliser(`${r.nom} ${r.ingredients.map((i) => i.nom).join(' ')}`).includes(q)),
    );
  });
  const groupes = $derived(ORDRE.map((f) => [f, filtrees.filter((r) => r.famille === f)] as const).filter(([, l]) => l.length));
  const prevue = (id: string) => chambre.etoiles.some((e) => e.startsWith(`${id}@`));
</script>

<div class="contenu">
  <h1 class="titre-serif">Recettes de la chambre</h1>
  <input class="champ" type="search" placeholder="Chercher (nom, ingrédient)" bind:value={texte} aria-label="Chercher une recette" />
  <div class="filtres">
    <button class="puce" class:active={duMois} aria-pressed={duMois} onclick={() => (duMois = !duMois)}>De saison en {nomMois(mois)}</button>
    {#each ORDRE as f (f)}
      <button class="puce" class:active={famille === f} aria-pressed={famille === f} onclick={() => (famille = famille === f ? null : f)}>
        {NOMS_FAMILLES[f]}
      </button>
    {/each}
  </div>

  {#each groupes as [f, liste] (f)}
    <h2 class="section-titre">{NOMS_FAMILLES[f]} ({liste.length})</h2>
    <ul class="liste">
      {#each liste as r (r.id)}
        {@const m = r.mode ? MODES_PAR_ID.get(r.mode) : undefined}
        <li>
          <a href={lienChambre('recette', r.id)} style:--couleur={couleurMode(m)}>
            <span class="texte">
              <strong>{r.nom}{#if prevue(r.id)}<Star size={14} fill="currentColor" class="etoile" />{/if}</strong>
              <span class="petit discret">
                {m ? `Chambre · ${m.nom}` : NOMS_LIEUX[r.lieu]} · {dureeLisible(r.duree.min_j, r.duree.max_j)} · {saison(r)}
              </span>
            </span>
            <ChevronRight size={18} />
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vide">Aucune recette ne correspond.</p>
  {/each}
</div>

<style>
  h1 {
    font-size: 28px;
    margin: 4px 0 12px;
  }

  .filtres {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    margin: 10px -16px 0;
    padding: 2px 16px 6px;
    scrollbar-width: none;
  }

  .liste a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 9px 14px;
    color: inherit;
    text-decoration: none;
    border-left: 4px solid var(--couleur);
  }

  .liste a:active {
    background: var(--surface-2);
  }

  .liste :global(svg) {
    flex: none;
    color: var(--texte-3);
  }

  .liste :global(.etoile) {
    color: var(--ambre);
    margin-left: 6px;
    vertical-align: -1px;
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
</style>
