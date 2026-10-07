<script lang="ts">
  // Résumé du mode actif : valeurs des contrôleurs, branchements, ventilateur, thermostat du frigo.
  import { ChevronRight } from '@lucide/svelte';
  import { dateCourte } from '../../lib/format';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { couleurMode, NOMS_PRISES, t, texteBranchement, valeurCode, VITESSES } from '../affichage';
  import { mode as modeParId } from '../donnees';
  import { phaseIhcCave, type ModeActif } from '../taches';
  import { PRISES } from '../types';

  let { actif, debutVague, maintenant }: { actif: ModeActif; debutVague?: Date | string; maintenant: number } = $props();

  const m = $derived(actif.mode);
  const apres = $derived(actif.apres ? modeParId(actif.apres) : undefined);
  const prevu = $derived(actif.prevu !== 'nettoyage' && actif.prevu !== actif.id ? modeParId(actif.prevu) : undefined);
  // En Cave, la phase de l'IHC dépend de la dernière entrée (3 semaines à 80 %, puis 76 %).
  const phase = $derived(m?.id === 'cave' ? m.ihc_phases[phaseIhcCave(maintenant, debutVague ?? actif.depuis)] : m?.ihc_phases[0]);
</script>

<section class="carte mode" style:--couleur={couleurMode(m ?? apres)}>
  {#if m}
    <a class="entete" href={lienChambre('mode', m.id)}>
      <span class="surtitre">
        Mode actuel · {actif.manuel ? `choisi à la main le ${dateCourte(actif.depuis)}` : `selon le calendrier, depuis le ${dateCourte(actif.depuis)}`}
      </span>
      <span class="nom">{m.nom}</span>
      <span class="cible">{t(m.cible)}</span>
      <ChevronRight size={20} class="chevron" />
    </a>
    {#if m.itc}
      <dl class="valeurs">
        <dt>ITC</dt>
        <dd>
          TS {valeurCode('itc', 'TS', m.itc.TS)} · HD {valeurCode('itc', 'HD', m.itc.HD)} · CD {valeurCode('itc', 'CD', m.itc.CD)}
        </dd>
        {#if phase}
          <dt>IHC</dt>
          <dd>
            HS {valeurCode('ihc', 'HS', phase.HS)} · DD {valeurCode('ihc', 'DD', phase.DD)}
            {#if m.ihc_phases.length > 1}<span class="discret"> ({phase.nom.toLowerCase()})</span>{/if}
          </dd>
        {/if}
      </dl>
      <p class="seuils">{t(m.seuils)}</p>
    {/if}
    <ul class="branchements">
      {#each PRISES as p (p)}
        <li><span class="discret">{NOMS_PRISES[p]}</span><span>{t(texteBranchement(m.branchements[p]))}</span></li>
      {/each}
      <li><span class="discret">Ventilateur</span><span>{VITESSES[m.ventilateur.vitesse]}</span></li>
      <li><span class="discret">Thermostat du frigo</span><span>{t(m.thermostat_frigo)}</span></li>
    </ul>
  {:else}
    <div class="entete">
      <span class="surtitre">Aujourd'hui</span>
      <span class="nom">Jour de nettoyage</span>
      {#if apres}<span class="cible">Puis mode {apres.nom}</span>{/if}
    </div>
  {/if}
  {#if prevu}
    <p class="prevu petit">Le calendrier prévoit le mode <strong>{prevu.nom}</strong>.</p>
  {/if}
</section>

<style>
  .mode {
    overflow: hidden;
    border-left: 6px solid var(--couleur);
    padding-bottom: 6px;
  }

  .entete {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 12px 40px 8px 14px;
    color: inherit;
    text-decoration: none;
  }

  .entete :global(.chevron) {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--texte-3);
  }

  .surtitre {
    font-size: 13px;
    color: var(--texte-2);
  }

  .nom {
    font-family: var(--police-titre);
    font-size: 24px;
    font-weight: 700;
    color: var(--couleur);
    line-height: 1.2;
  }

  .cible {
    font-size: 15px;
    color: var(--texte-2);
  }

  .valeurs {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
    padding: 6px 14px 0;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .valeurs dt {
    font-weight: 700;
  }

  .valeurs dd {
    margin: 0;
  }

  .seuils {
    margin: 6px 14px 0;
    font-size: 14px;
    color: var(--texte-2);
  }

  .branchements {
    list-style: none;
    margin: 10px 0 0;
    padding: 0 14px;
    font-size: 14px;
  }

  .branchements li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border-top: 0.5px solid var(--trait);
  }

  .branchements li span:last-child {
    text-align: right;
    font-weight: 600;
  }

  .prevu {
    margin: 8px 14px 4px;
    color: var(--ambre);
  }
</style>
