<script lang="ts">
  // Valeurs complètes d'une étape de réglage, tirées de modes.json : ITC, IHC (la bonne phase), prises, thermostat
  // du frigo, ventilateur, réservoir, bac de sel, sonde.
  import { NOMS_PRISES, t, texteBranchement, VITESSES } from '../affichage';
  import { MODES_PAR_ID } from '../donnees';
  import { CODES_IHC, CODES_ITC, PRISES, type IdMode } from '../types';
  import CodesControleur from './CodesControleur.svelte';

  let { mode: modeId, phase }: { mode: IdMode; phase: number | null } = $props();

  const m = $derived(MODES_PAR_ID.get(modeId));
  const ph = $derived(m && phase !== null ? m.ihc_phases[phase] : undefined);
</script>

{#if m}
  <div class="valeurs">
    {#if m.itc}
      <p class="appareil">ITC · température</p>
      <CodesControleur appareil="itc" mode={m} valeurs={m.itc} codes={CODES_ITC} />
    {/if}
    {#if ph}
      <p class="appareil">IHC · humidité{m.ihc_phases.length > 1 ? ` · ${ph.nom}` : ''}</p>
      <CodesControleur appareil="ihc" mode={m} valeurs={ph} codes={CODES_IHC} />
    {/if}
    <ul class="lignes">
      {#each PRISES as p (p)}
        <li><span class="discret">{NOMS_PRISES[p]}</span><span>{t(texteBranchement(m.branchements[p]))}</span></li>
      {/each}
      <li><span class="discret">Thermostat du frigo</span><span>{t(m.thermostat_frigo)}</span></li>
      <li>
        <span class="discret">Ventilateur</span>
        <span>{VITESSES[m.ventilateur.vitesse]}{m.ventilateur.orientation ? ` · ${t(m.ventilateur.orientation)}` : ''}</span>
      </li>
      <li><span class="discret">Réservoir</span><span>{t(m.reservoir.texte)}</span></li>
      {#if m.bac_de_sel}<li><span class="discret">Bac de sel</span><span>{t(m.bac_de_sel)}</span></li>{/if}
      {#if m.sonde_itc}<li><span class="discret">Sonde de l'ITC</span><span>{t(m.sonde_itc)}</span></li>{/if}
    </ul>
  </div>
{/if}

<style>
  .appareil {
    margin: 10px 0 6px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
  }

  .lignes {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    font-size: 14px;
  }

  .lignes li {
    display: grid;
    grid-template-columns: minmax(100px, 38%) 1fr;
    gap: 10px;
    padding: 5px 0;
    border-top: 0.5px solid var(--trait);
  }
</style>
