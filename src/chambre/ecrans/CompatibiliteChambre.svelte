<script lang="ts">
  // Compatibilité d'une recette pour un mois : partager la chambre, en parallèle hors de la chambre, incompatible.
  import { ChevronLeft, ChevronRight, CircleAlert, Star } from '@lucide/svelte';
  import { nombre } from '../../lib/format';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { chambre } from '../chambre.svelte';
  import { compatibilite } from '../compatibilite';
  import { CONTENU, MODES_PAR_ID, NOMS_LIEUX, recette } from '../donnees';
  import { lots } from '../lots.svelte';
  import { NomMois } from '../recettes';
  import type { IdMode, RecetteChambre } from '../types';

  let { id, mois: moisRoute }: { id: string; mois?: string } = $props();

  const cycle = CONTENU.calendrier.cycle;
  const moisCourant = $derived(new Date(chambre.maintenant).getMonth() + 1);
  const m = $derived(moisRoute && cycle.includes(Number(moisRoute)) ? Number(moisRoute) : moisCourant);
  const x = $derived(recette(id));
  // Les lots déjà dans la chambre ne comptent que pour le mois en cours.
  const c = $derived(x ? compatibilite(x, m, m === moisCourant ? lots.enCours : [], chambre.maintenant) : undefined);

  function voisin(sens: 1 | -1) {
    const i = cycle.indexOf(m);
    routeur.remplacerPage(lienChambre('compatibilite', id, String(cycle[(i + sens + 12) % 12])));
  }

  const lieu = (r: RecetteChambre) => {
    const md = r.phases?.find((p) => p.mode)?.mode ?? r.mode;
    return r.lieu === 'chambre' && md ? `mode ${MODES_PAR_ID.get(md)?.nom}` : NOMS_LIEUX[r.lieu];
  };
</script>

{#snippet ligne(r: RecetteChambre, raisons?: string[])}
  {@const prevue = chambre.estPrevue(r.id, m)}
  <li>
    <a href={lienChambre('recette', r.id)}>
      <strong>{r.nom}</strong>
      <span class="petit discret">{lieu(r)}{r.place && r.lieu === 'chambre' ? ` · ${nombre(r.place * 100)} % de la chambre` : ''}</span>
      {#if raisons}<span class="raisons petit">{raisons.join(' · ')}</span>{/if}
    </a>
    <button class="etoile" class:active={prevue} aria-pressed={prevue} onclick={() => chambre.basculerEtoile(r.id, m)} aria-label="{r.nom} prévue en {NomMois(m).toLowerCase()}">
      <Star size={20} fill={prevue ? 'currentColor' : 'none'} />
    </button>
  </li>
{/snippet}

{#if !x || !c}
  <p class="vide">Cette recette n'existe pas.</p>
{:else}
  <div class="contenu">
    <p class="surtitre">Compatibilité</p>
    <h1 class="titre-serif">{x.nom}</h1>
    <div class="navigation-mois">
      <button class="bouton-icone" onclick={() => voisin(-1)} aria-label="Mois précédent"><ChevronLeft size={24} /></button>
      <strong>{NomMois(m)}</strong>
      <button class="bouton-icone" onclick={() => voisin(1)} aria-label="Mois suivant"><ChevronRight size={24} /></button>
    </div>

    <div class="carte bloc">
      <p>
        {#if c.modes.length}
          Dans la chambre, en {c.modes.map((md) => MODES_PAR_ID.get(md)?.nom).join(' puis ')}, {nombre(x.place * 100)}&nbsp;% de la place.
        {:else}
          Se fait hors de la chambre ({NOMS_LIEUX[x.lieu].toLowerCase()}) : la chambre reste libre pour ce qui y est prévu.
        {/if}
      </p>
      <p class="petit discret">
        Chambre en {NomMois(m).toLowerCase()} : {c.modesDuMois.map((md) => MODES_PAR_ID.get(md)?.nom).join(', ') || 'pas de mode prévu'}.
        {#each Object.entries(c.occupation) as [md, part] (md)}
          Déjà {nombre((part ?? 0) * 100)}&nbsp;% occupés en {MODES_PAR_ID.get(md as IdMode)?.nom}.
        {/each}
        {#if c.thermoPris}Thermoplongeur pris par « {c.thermoPris.nom} ».{/if}
      </p>
      {#each c.avertissements as a (a)}
        <p class="avertissement"><CircleAlert size={16} /> {a}</p>
      {/each}
    </div>

    <h2 class="section-titre vert">{c.modes.length ? 'Peut partager la chambre' : 'Dans la chambre en même temps'} ({c.partage.length})</h2>
    {#if c.partage.length}
      <ul class="liste">
        {#each c.partage as r (r.id)}{@render ligne(r)}{/each}
      </ul>
    {:else}
      <p class="petit discret">Rien ce mois-ci.</p>
    {/if}

    <h2 class="section-titre">En parallèle, hors de la chambre ({c.parallele.length})</h2>
    {#if c.parallele.length}
      <ul class="liste">
        {#each c.parallele as r (r.id)}{@render ligne(r)}{/each}
      </ul>
    {:else}
      <p class="petit discret">Rien ce mois-ci.</p>
    {/if}

    <h2 class="section-titre rouge">Incompatible ({c.incompatibles.length})</h2>
    {#if c.incompatibles.length}
      <ul class="liste">
        {#each c.incompatibles as i (i.recette.id)}{@render ligne(i.recette, i.raisons)}{/each}
      </ul>
    {:else}
      <p class="petit discret">Rien d'incompatible ce mois-ci.</p>
    {/if}
    <p class="petit discret note">Recettes de saison en {NomMois(m).toLowerCase()} ; ★ pour les prévoir.</p>
  </div>
{/if}

<style>
  .surtitre {
    margin: 4px 0 2px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 28px;
  }

  .navigation-mois {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin: 6px 0 10px;
    font-size: 18px;
  }

  .bloc {
    padding: 12px 14px;
  }

  .bloc p {
    margin: 0 0 6px;
  }

  .avertissement {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--rouge);
    font-weight: 600;
  }

  .vert {
    color: var(--vert);
  }

  .rouge {
    color: var(--rouge);
  }

  li {
    display: flex;
    align-items: center;
  }

  li a {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 9px 4px 9px 14px;
    min-height: 52px;
    justify-content: center;
    color: inherit;
    text-decoration: none;
  }

  .raisons {
    color: var(--rouge);
    font-weight: 600;
  }

  .etoile {
    flex: none;
    width: 52px;
    min-height: 52px;
    border: none;
    background: none;
    color: var(--texte-3);
  }

  .etoile.active {
    color: var(--ambre);
  }

  .note {
    margin-top: 16px;
  }
</style>
