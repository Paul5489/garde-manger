<script lang="ts">
  // Compatibilité d'une recette : ce qui est déjà dans la chambre ou prévu au même moment, ce qui peut partager la
  // chambre (quel que soit le mois), ce qui se fait en parallèle hors de la chambre le mois choisi, l'incompatible.
  import { Check, ChevronLeft, ChevronRight, CircleAlert, Star, X } from '@lucide/svelte';
  import { nombre } from '../../lib/format';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { compatibilite } from '../compatibilite';
  import { CONTENU, MODES_PAR_ID, NOMS_LIEUX, recette } from '../donnees';
  import { lots } from '../lots.svelte';
  import { prevoir } from '../prevoir';
  import { NomMois } from '../recettes';
  import type { RecetteChambre } from '../types';

  let { id, mois: moisRoute }: { id: string; mois?: string } = $props();

  const cycle = CONTENU.calendrier.cycle;
  const moisCourant = $derived(new Date(chambre.maintenant).getMonth() + 1);
  const m = $derived(moisRoute && cycle.includes(Number(moisRoute)) ? Number(moisRoute) : moisCourant);
  const x = $derived(recette(id));
  const c = $derived(x ? compatibilite(x, m, lots.enCours, chambre.maintenant, chambre.etoiles) : undefined);
  const nomMode = (md: string) => MODES_PAR_ID.get(md as never)?.nom ?? md;

  function voisin(sens: 1 | -1) {
    const i = cycle.indexOf(m);
    routeur.remplacerPage(lienChambre('compatibilite', id, String(cycle[(i + sens + 12) % 12])));
  }

  const lieu = (r: RecetteChambre) => {
    const md = r.phases?.find((p) => p.mode)?.mode ?? r.mode;
    return r.lieu === 'chambre' && md ? `mode ${nomMode(md)}` : NOMS_LIEUX[r.lieu];
  };
</script>

{#snippet ligne(r: RecetteChambre, raisons?: string[])}
  {@const prevue = chambre.estPrevue(r.id, m)}
  <li>
    <a href={lienChambre('recette', r.id)}>
      <strong>{r.nom}</strong>
      <span class="petit discret">{lieu(r)}{r.place && r.lieu === 'chambre' ? ` · ${nombre(r.place * 100)} % de la chambre` : ''}</span>
      {#if raisons?.length}<span class="raisons petit">{raisons.join(' · ')}</span>{/if}
    </a>
    <button class="etoile" class:active={prevue} aria-pressed={prevue} onclick={() => prevoir(r.id, m)} aria-label="{r.nom} prévue en {NomMois(m).toLowerCase()}">
      <Star size={20} fill={prevue ? 'currentColor' : 'none'} />
    </button>
  </li>
{/snippet}

{#snippet verdict(ok: boolean)}
  {#if ok}<span class="ok" aria-label="compatible"><Check size={18} /></span>{:else}<span class="non" aria-label="incompatible"><X size={18} /></span>{/if}
{/snippet}

{#if !x || !c}
  <p class="vide">Cette recette n'existe pas.</p>
{:else}
  <div class="contenu">
    <p class="surtitre">Ce qui va avec</p>
    <h1 class="titre-serif">{x.nom}</h1>

    <div class="carte bloc">
      <p>
        {#if c.modes.length}
          Dans la chambre, en {c.modes.map(nomMode).join(' puis ')}, {nombre(x.place * 100)}&nbsp;% de la place.
        {:else}
          Se fait hors de la chambre ({NOMS_LIEUX[x.lieu].toLowerCase()}) : elle ne la partage avec rien.
        {/if}
      </p>
      {#each c.ensemble as e (e)}<p class="petit discret">{t(e)}</p>{/each}
      {#each c.avertissements as a (a)}
        <p class="avertissement"><CircleAlert size={16} /> {a}</p>
      {/each}
    </div>

    {#if c.presents.length}
      <h2 class="section-titre">Déjà dans la chambre</h2>
      <ul class="liste">
        {#each c.presents as p (p.lot.id)}
          <li>
            <a href={lienChambre('lot', p.lot.id)}>
              <strong>{p.lot.nom}</strong>
              <span class="petit discret">Lot en cours · mode {nomMode(p.mode)} · {nombre(p.lot.recette.place * 100)} %</span>
              {#if p.raisons.length}<span class="raisons petit">{p.raisons.join(' · ')}</span>{/if}
            </a>
            {#if c.modes.length}{@render verdict(!p.raisons.length)}{/if}
          </li>
        {/each}
      </ul>
      {#if c.modes.length}
        <p class="petit discret occupation">Place prise par les lots présents dans ce mode : {nombre(c.occupation * 100)}&nbsp;%, plus {nombre(x.place * 100)}&nbsp;% pour {x.nom.toLowerCase()}.</p>
      {/if}
    {/if}

    <div class="navigation-mois">
      <button class="bouton-icone" onclick={() => voisin(-1)} aria-label="Mois précédent"><ChevronLeft size={24} /></button>
      <strong>{NomMois(m)}</strong>
      <button class="bouton-icone" onclick={() => voisin(1)} aria-label="Mois suivant"><ChevronRight size={24} /></button>
    </div>

    {#if c.prevus.length}
      <h2 class="section-titre">Prévu au même moment</h2>
      <ul class="liste">
        {#each c.prevus as p (p.recette.id)}
          <li>
            <a href={lienChambre('recette', p.recette.id)}>
              <strong>{p.recette.nom}</strong>
              <span class="petit discret">{p.source === 'calendrier' ? 'Au calendrier' : 'Dans ton programme ★'} · {lieu(p.recette)}</span>
              {#if p.raisons.length}<span class="raisons petit">{p.raisons.join(' · ')}</span>{/if}
            </a>
            {#if c.modes.length}{@render verdict(!p.raisons.length)}{/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="section-titre vert">{c.modes.length ? 'Peut partager la chambre' : `Dans la chambre en ${NomMois(m).toLowerCase()}`} ({c.partage.length})</h2>
    {#if c.modes.length}<p class="petit discret aide">Quel que soit le mois de lancement, dès que le mode est le même.</p>{/if}
    {#if c.partage.length}
      <ul class="liste">
        {#each c.partage as r (r.id)}{@render ligne(r)}{/each}
      </ul>
    {:else}
      <p class="petit discret">Rien : elle est seule dans la chambre.</p>
    {/if}
    {#if c.precautions.length}
      <div class="carte precautions">
        <strong>Précautions</strong>
        <ul>
          {#each c.precautions as p (p)}<li>{t(p)}</li>{/each}
        </ul>
      </div>
    {/if}

    <h2 class="section-titre">En parallèle, hors de la chambre, en {NomMois(m).toLowerCase()} ({c.parallele.length})</h2>
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
      <p class="petit discret">Rien d'incompatible.</p>
    {/if}
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
    margin-bottom: 10px;
  }

  .navigation-mois {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin: 18px 0 0;
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

  .aide {
    margin: -4px 4px 8px;
  }

  .occupation {
    margin: 8px 4px 0;
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

  .ok,
  .non {
    flex: none;
    width: 52px;
    display: flex;
    justify-content: center;
  }

  .ok {
    color: var(--vert);
  }

  .non {
    color: var(--rouge);
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

  .precautions {
    margin-top: 10px;
    padding: 12px 14px;
    border-left: 4px solid var(--ambre);
  }

  .precautions ul {
    margin: 6px 0 0;
    padding-left: 1.1em;
  }

  .precautions li {
    display: list-item;
  }
</style>
