<script lang="ts">
  // Un mode de la chambre : valeurs à entrer dans les Inkbird, ce qui va se passer, pourquoi,
  // branchements, réservoir, alarmes, énergie.
  import { ChevronRight } from '@lucide/svelte';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { couleurMode, NOMS_ALARMES, NOMS_PRISES, t, texteBranchement, valeurCode, VITESSES } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import CodesControleur from '../composants/CodesControleur.svelte';
  import { CONTENU, MODES_PAR_ID } from '../donnees';
  import { CODES_IHC, CODES_ITC, PRISES, type IdMode } from '../types';

  let { id }: { id: string } = $props();

  const m = $derived(MODES_PAR_ID.get(id as IdMode));
  const actuel = $derived(chambre.actif.id === id);
  const ALARMES_ITC: Record<string, 'AH' | 'AL'> = { temperature_haute: 'AH', temperature_basse: 'AL' };
</script>

{#if !m}
  <p class="vide">Ce mode n'existe pas.</p>
{:else}
  <article class="contenu" style:--couleur={couleurMode(m)}>
    <p class="surtitre">Mode de la chambre{#if actuel} · <strong>mode actuel</strong>{/if}</p>
    <h1 class="titre-serif">{m.nom}</h1>
    <p class="cible">{t(m.cible)}</p>

    {#if m.itc}
      <div class="carte encadre seuils">
        <h2 class="petit-titre">Ce qui va se passer</h2>
        <p>{t(m.seuils)}</p>
      </div>

      <h2 class="titre-section">Inkbird ITC-308 · température</h2>
      <CodesControleur appareil="itc" mode={m} valeurs={m.itc} codes={CODES_ITC} />
      <p class="aide petit discret">Touche un code pour savoir ce qu'il fait et pourquoi cette valeur.</p>
    {:else}
      <div class="carte encadre"><p>{t(m.seuils)}</p></div>
    {/if}

    {#if m.ihc_phases.length}
      <h2 class="titre-section">Inkbird IHC-200 · humidité</h2>
      {#each m.ihc_phases as ph, i (i)}
        {#if m.ihc_phases.length > 1}<h3 class="phase">{ph.nom}</h3>{/if}
        <CodesControleur appareil="ihc" mode={m} valeurs={ph} codes={CODES_IHC} />
        {#if ph.note}<p class="note-phase petit">{t(ph.note)}</p>{/if}
      {/each}
      {#if m.ihc_phases.length > 1}
        <p class="aide petit discret">{t(CONTENU.modes.guide_ihc.reglage_rapide)}</p>
      {/if}
    {/if}

    {#if m.itc}
      <a class="bouton plein action" href={lienChambre('changer', m.id)}>
        {actuel ? 'Revoir le réglage pas à pas' : `Passer en mode ${m.nom}`}
      </a>
    {/if}

    <h2 class="titre-section">Pourquoi ces valeurs</h2>
    <ul class="carte puces">
      {#each m.pourquoi as p (p)}<li>{t(p)}</li>{/each}
    </ul>

    <h2 class="titre-section">Branchements</h2>
    <ul class="liste lignes">
      {#each PRISES as p (p)}
        <li><span class="discret">{NOMS_PRISES[p]}</span><span class="valeur">{t(texteBranchement(m.branchements[p]))}</span></li>
      {/each}
      <li><span class="discret">Thermostat du frigo</span><span class="valeur">{t(m.thermostat_frigo)}</span></li>
      <li>
        <span class="discret">Ventilateur</span>
        <span class="valeur">{VITESSES[m.ventilateur.vitesse]}{#if m.ventilateur.orientation}<span class="sous">{t(m.ventilateur.orientation)}</span>{/if}</span>
      </li>
      {#if m.deshumidificateur}<li><span class="discret">Déshumidificateur</span><span class="valeur">{t(m.deshumidificateur)}</span></li>{/if}
      {#if m.bac_de_sel}<li><span class="discret">Bac de sel</span><span class="valeur">{t(m.bac_de_sel)}</span></li>{/if}
      {#if m.sonde_itc}<li><span class="discret">Sonde de l'ITC</span><span class="valeur">{t(m.sonde_itc)}</span></li>{/if}
    </ul>

    <h2 class="titre-section">Réservoir du déshumidificateur</h2>
    <p class="carte encadre">{t(m.reservoir.texte)}</p>

    {#if Object.keys(m.alarmes).length}
      <h2 class="titre-section">Alarmes</h2>
      <ul class="liste lignes alarmes">
        {#each Object.entries(m.alarmes) as [cle, texte] (cle)}
          <li>
            <span class="discret">
              {NOMS_ALARMES[cle] ?? cle}
              {#if m.itc && ALARMES_ITC[cle]}<br />{valeurCode('itc', ALARMES_ITC[cle], m.itc[ALARMES_ITC[cle]])}{/if}
              {#if m.ihc_phases[0] && (cle === 'humidite_haute' || cle === 'humidite_basse')}
                <br />{m.ihc_phases.map((p) => valeurCode('ihc', cle === 'humidite_haute' ? 'AH' : 'AL', p[cle === 'humidite_haute' ? 'AH' : 'AL'])).join(' / ')}
              {/if}
            </span>
            <span class="valeur">{t(texte)}</span>
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="titre-section">Énergie</h2>
    <div class="carte encadre">
      <p><strong>{t(m.energie.estimation_kwh_jour)} kWh par jour</strong> (estimation)</p>
      <p class="discret">{t(m.energie.ce_qui_consomme)}</p>
      {#if m.energie.leviers.length}
        <ul class="puces-simples">
          {#each m.energie.leviers as l (l)}<li>{t(l)}</li>{/each}
        </ul>
      {/if}
      <a class="lien" href={lienChambre('infos', 'energie')}>Économiser l'énergie <ChevronRight size={16} /></a>
    </div>

    {#if m.passagers.length}
      <h2 class="titre-section">Peut aussi accueillir</h2>
      <ul class="carte puces">
        {#each m.passagers as p (p)}<li>{t(p)}</li>{/each}
      </ul>
    {/if}

    {#if m.notes.length}
      <h2 class="titre-section">À savoir</h2>
      <ul class="carte puces">
        {#each m.notes as n (n)}<li>{t(n)}</li>{/each}
      </ul>
    {/if}

    {#if !m.itc}
      <a class="bouton plein action" href={lienChambre('changer', m.id)}>{actuel ? 'Revoir les étapes' : `Passer en mode ${m.nom}`}</a>
    {/if}
  </article>
{/if}

<style>
  .surtitre {
    margin: 4px 0 2px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 30px;
    color: var(--couleur);
  }

  .cible {
    margin: 4px 0 14px;
    color: var(--texte-2);
  }

  .encadre {
    padding: 12px 14px;
    margin: 0;
  }

  .encadre p {
    margin: 0;
  }

  .encadre p + p {
    margin-top: 6px;
  }

  .seuils {
    border-left: 5px solid var(--couleur);
  }

  .petit-titre {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin-bottom: 4px;
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 21px;
    margin: 26px 0 10px;
  }

  .phase {
    font-size: 15px;
    margin: 14px 0 8px;
  }

  .note-phase {
    margin: 8px 2px 0;
    color: var(--texte-2);
  }

  .aide {
    margin: 8px 2px 0;
  }

  .action {
    margin-top: 18px;
  }

  .puces {
    margin: 0;
    padding: 12px 14px 12px 32px;
  }

  .puces li + li {
    margin-top: 6px;
  }

  .puces-simples {
    margin: 8px 0 0;
    padding-left: 1.2em;
  }

  .lignes li {
    display: grid;
    grid-template-columns: minmax(110px, 38%) 1fr;
    gap: 12px;
    padding: 10px 14px;
    font-size: 15px;
  }

  .valeur {
    font-weight: 600;
  }

  .sous {
    display: block;
    font-weight: 400;
    color: var(--texte-2);
  }

  .alarmes .valeur {
    font-weight: 400;
  }

  .lien {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 10px;
    min-height: 36px;
    font-weight: 600;
    text-decoration: none;
  }
</style>
