<script lang="ts">
  // Calendrier de la chambre : un écran par mois (octobre → septembre), ouvert sur le mois en cours.
  // Bandeau à l'échelle des jours (modes, rendez-vous, sorties), recettes de saison avec étoile « prévu ».
  import { ChevronLeft, ChevronRight, Star } from '@lucide/svelte';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { couleurMode, t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, MODES_PAR_ID, NOMS_FAMILLES, NOMS_LIEUX, recette } from '../donnees';
  import { NomMois, repereDuMois } from '../recettes';
  import type { EntreeCalendrier, Famille, IdMode } from '../types';

  let { mois: moisRoute }: { mois?: string } = $props();

  const cycle = CONTENU.calendrier.cycle;
  const maintenant = $derived(new Date(chambre.maintenant));
  const moisCourant = $derived(maintenant.getMonth() + 1);
  const m = $derived(moisRoute && cycle.includes(Number(moisRoute)) ? Number(moisRoute) : moisCourant);
  // Année du cycle en cours (octobre → septembre).
  const debutCycle = $derived(moisCourant >= 10 ? maintenant.getFullYear() : maintenant.getFullYear() - 1);
  const annee = $derived(m >= 10 ? debutCycle : debutCycle + 1);
  const nbJours = $derived(new Date(annee, m, 0).getDate());
  const donnees = $derived(CONTENU.calendrier.mois[String(m)] ?? {});
  const aujourdhui = $derived(m === moisCourant ? maintenant.getDate() : null);

  function voisin(sens: 1 | -1) {
    const i = cycle.indexOf(m);
    routeur.remplacerPage(lienChambre('calendrier', String(cycle[(i + sens + 12) % 12])));
  }

  /** Jours d'un rendez-vous « 1 → 8 », « Le 9 », « Vers le 8 », « Mi-novembre », « Fin novembre »… (approximatif). */
  function jours(quand: string): [number, number] | null {
    const plage = quand.match(/(\d+)\s*(?:→|à|-)\s*(\d+)/);
    if (plage) return [Number(plage[1]), Number(plage[2])];
    const un = quand.match(/(?:le|vers le)\s+(\d+)/i);
    if (un) return /après/i.test(quand) ? [Number(un[1]), Math.min(nbJours, Number(un[1]) + 6)] : [Number(un[1]), Number(un[1])];
    if (/^début/i.test(quand)) return [1, 7];
    if (/^mi-/i.test(quand)) return [12, 18];
    if (/^fin/i.test(quand)) return [nbJours - 7, nbJours];
    return null;
  }

  const pct = (j: number) => `${((j - 1) / nbJours) * 100}%`;
  const largeur = (du: number, au: number) => `${((au - du + 1) / nbJours) * 100}%`;
  const reperes = $derived([
    ...(donnees.rendez_vous ?? []).map((e) => ({ e, type: 'rdv' as const, j: jours(e.quand) })),
    ...(donnees.sorties ?? []).map((e) => ({ e, type: 'sortie' as const, j: jours(e.quand) })),
  ]);

  // Recettes de saison, par famille.
  const ORDRE: Famille[] = ['koji', 'lacto', 'charc', 'champ', 'pain', 'vin', 'sech'];
  const deSaison = $derived(CONTENU.recettes.filter((r) => r.mois?.includes(m)));
  const groupes = $derived(ORDRE.map((f) => [f, deSaison.filter((r) => r.famille === f)] as const).filter(([, l]) => l.length));
  const prevues = $derived(deSaison.filter((r) => chambre.estPrevue(r.id, m)));
  const touteAnnee = CONTENU.recettes.filter((r) => r.toute_annee).length;
</script>

{#snippet entrees(liste: EntreeCalendrier[], type: 'rdv' | 'sortie')}
  <ul class="liste entrees">
    {#each liste as e, i (i)}
      <li class={type}>
        <span class="quand">{t(e.quand)}</span>
        <span class="quoi">{t(e.quoi)}</span>
        {#if e.recettes.length}
          <span class="liens">
            {#each e.recettes as id (id)}
              {@const r = recette(id)}
              {#if r}<a class="puce petite" href={lienChambre('recette', id)}>{r.nom}</a>{/if}
            {/each}
          </span>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="contenu">
  <div class="navigation-mois">
    <button class="bouton-icone" onclick={() => voisin(-1)} aria-label="Mois précédent"><ChevronLeft size={26} /></button>
    <h1 class="titre-serif">{NomMois(m)} {annee}</h1>
    <button class="bouton-icone" onclick={() => voisin(1)} aria-label="Mois suivant"><ChevronRight size={26} /></button>
  </div>
  {#if m !== moisCourant}
    <p class="retour-mois"><button class="lien-bouton" onclick={() => routeur.remplacerPage(lienChambre('calendrier'))}>Revenir à {NomMois(moisCourant).toLowerCase()}</button></p>
  {/if}

  <!-- Bandeau à l'échelle des jours -->
  <div class="bandeau" aria-label="Modes de la chambre en {NomMois(m).toLowerCase()}">
    <div class="segments">
      {#each donnees.chambre ?? [] as s (s.du)}
        {@const mode = s.mode !== 'nettoyage' ? MODES_PAR_ID.get(s.mode as IdMode) : undefined}
        <a
          class="segment"
          class:nettoyage={s.mode === 'nettoyage'}
          style:left={pct(s.du)}
          style:width={largeur(s.du, s.au)}
          style:--couleur={couleurMode(mode)}
          href={mode ? lienChambre('mode', mode.id) : lienChambre('infos', 'nettoyage')}
          aria-label="{s.du} au {s.au} : {s.nom}"
        ></a>
      {/each}
      {#if aujourdhui}<span class="aujourdhui" style:left={`${((aujourdhui - 0.5) / nbJours) * 100}%`} aria-hidden="true"></span>{/if}
    </div>
    <div class="marques" aria-hidden="true">
      {#each reperes.filter((x) => x.j) as x, i (i)}
        <span class="marque {x.type}" style:left={pct(x.j![0])} style:width={largeur(x.j![0], x.j![1])}></span>
      {/each}
    </div>
    <div class="graduation" aria-hidden="true">
      {#each [1, 8, 15, 22, 29].filter((j) => j <= nbJours) as j (j)}<span style:left={pct(j)}>{j}</span>{/each}
    </div>
  </div>
  <ul class="legende">
    {#each donnees.chambre ?? [] as s (s.du)}
      {@const mode = s.mode !== 'nettoyage' ? MODES_PAR_ID.get(s.mode as IdMode) : undefined}
      <li style:--couleur={couleurMode(mode)}>
        <span class="pastille" class:nettoyage={!mode}></span>
        <span><strong>{s.du === s.au ? `Le ${s.du}` : `${s.du} → ${s.au}`}</strong> · {s.nom}{s.detail ? ` · ${t(s.detail)}` : ''}</span>
      </li>
    {/each}
  </ul>

  {#if donnees.rendez_vous?.length}
    <h2 class="section-titre"><span class="carre rdv"></span>Rendez-vous</h2>
    {@render entrees(donnees.rendez_vous, 'rdv')}
  {/if}
  {#if donnees.sorties?.length}
    <h2 class="section-titre"><span class="carre sortie"></span>Sorties</h2>
    {@render entrees(donnees.sorties, 'sortie')}
  {/if}

  {#if prevues.length}
    <h2 class="section-titre">Mon programme ({prevues.length})</h2>
    <ul class="liste">
      {#each prevues as r (r.id)}
        <li class="ligne">
          <a href={lienChambre('recette', r.id)}><strong>{r.nom}</strong></a>
          <button class="etoile active" onclick={() => chambre.basculerEtoile(r.id, m)} aria-label="Retirer {r.nom} du programme"><Star size={20} fill="currentColor" /></button>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="section-titre">Recettes de saison ({deSaison.length})</h2>
  <p class="petit discret aide">★ : prévue ce mois-ci, pour composer ton programme.</p>
  {#each groupes as [f, liste] (f)}
    <h3 class="famille">{NOMS_FAMILLES[f]}</h3>
    <ul class="liste">
      {#each liste as r (r.id)}
        {@const rep = repereDuMois(r, m)}
        {@const prevue = chambre.estPrevue(r.id, m)}
        {@const mode = r.mode ? MODES_PAR_ID.get(r.mode) : undefined}
        <li class="ligne">
          <a href={lienChambre('recette', r.id)}>
            <strong>{r.nom}</strong>
            <span class="petit discret">
              {mode ? `Chambre · ${mode.nom}` : NOMS_LIEUX[r.lieu]}
              {#if rep}<span class="repere" class:dernier={rep === 'dernier-mois'}>{rep === 'ce-mois' ? 'À faire ce mois-ci' : 'Dernier mois'}</span>{/if}
            </span>
          </a>
          <button class="etoile" class:active={prevue} aria-pressed={prevue} onclick={() => chambre.basculerEtoile(r.id, m)} aria-label="{r.nom} prévue en {NomMois(m).toLowerCase()}">
            <Star size={20} fill={prevue ? 'currentColor' : 'none'} />
          </button>
        </li>
      {/each}
    </ul>
  {/each}
  <p class="petit discret toute-annee">
    Et {touteAnnee} recettes possibles toute l’année : <a href={lienChambre('recettes')}>toutes les recettes</a>.
  </p>
</div>

<style>
  .navigation-mois {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
  }

  h1 {
    font-size: 26px;
    text-align: center;
  }

  .retour-mois {
    text-align: center;
    margin: 0;
  }

  .lien-bouton {
    border: none;
    background: none;
    color: var(--accent);
    min-height: 36px;
    text-decoration: underline;
  }

  .bandeau {
    margin-top: 14px;
  }

  .segments,
  .marques,
  .graduation {
    position: relative;
  }

  .segments {
    height: 40px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface-3);
  }

  .segment {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--couleur);
    border-right: 2px solid var(--fond);
  }

  .segment.nettoyage {
    background: repeating-linear-gradient(45deg, var(--surface-3) 0 4px, var(--texte-3) 4px 6px);
  }

  .aujourdhui {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 3px;
    margin-left: -1.5px;
    background: var(--texte);
    border-radius: 2px;
  }

  .marques {
    height: 10px;
    margin-top: 4px;
  }

  .marque {
    position: absolute;
    height: 6px;
    min-width: 6px;
    border-radius: 3px;
    background: var(--accent);
    opacity: 0.85;
  }

  .marque.sortie {
    top: 4px;
    background: var(--vert);
  }

  .graduation {
    height: 16px;
    font-size: 12px;
    color: var(--texte-3);
  }

  .graduation span {
    position: absolute;
  }

  .legende {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    font-size: 15px;
  }

  .legende li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }

  .pastille {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--couleur);
  }

  .pastille.nettoyage {
    background: repeating-linear-gradient(45deg, var(--surface-3) 0 3px, var(--texte-3) 3px 5px);
  }

  .carre {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 6px;
    background: var(--accent);
  }

  .carre.sortie {
    background: var(--vert);
  }

  .entrees li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px;
  }

  .entrees .quand {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }

  .entrees .sortie .quand {
    color: var(--vert);
  }

  .entrees .liens {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .puce.petite {
    min-height: 30px;
    font-size: 14px;
    padding: 0 10px;
    text-decoration: none;
  }

  .aide {
    margin: -2px 4px 6px;
  }

  .famille {
    font-size: 15px;
    margin: 16px 4px 6px;
    color: var(--texte-2);
  }

  .ligne {
    display: flex;
    align-items: center;
  }

  .ligne a {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 9px 4px 9px 14px;
    color: inherit;
    text-decoration: none;
    min-height: 52px;
    justify-content: center;
  }

  .repere {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--accent-doux);
    color: var(--accent);
    font-weight: 600;
  }

  .repere.dernier {
    background: var(--ambre-doux);
    color: var(--ambre);
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

  .toute-annee {
    margin: 16px 4px 0;
  }
</style>
