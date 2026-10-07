<script lang="ts">
  // Les lots : en cours (avec ce qu'il y a à faire), puis terminés.
  import { ChevronRight } from '@lucide/svelte';
  import { date, dateCourte, nombre, pluriel } from '../../lib/format';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { couleurMode } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { MODES_PAR_ID, NOMS_LIEUX } from '../donnees';
  import { aFaire, aVenir, etatPh, finPrevue, modeDuLot, perteDePoids } from '../lots';
  import { lots } from '../lots.svelte';
  import { joursCalendaires } from '../temps';
  import type { Lot } from '../types';

  let finisOuverts = $state(false);

  function resume(l: Lot) {
    const m = modeDuLot(l);
    const mode = m ? MODES_PAR_ID.get(m) : undefined;
    const dus = aFaire(l, chambre.maintenant, chambre.heureRappels).length;
    const prochain = aVenir(l, chambre.maintenant, 1, chambre.heureRappels)[0];
    const perte = l.recette.fin.type === 'perte_poids' ? perteDePoids(l) : undefined;
    const fin = finPrevue(l);
    const phase = l.recette.phases?.[l.phaseCourante]?.nom;
    return { mode, dus, prochain, perte, fin, phase, bloque: etatPh(l).bloque };
  }
</script>

<div class="contenu">
  <h1 class="titre-serif">Mes lots</h1>
  {#if !lots.enCours.length}
    <p class="carte vide-carte">
      Aucun lot en cours. Démarre-en un depuis une fiche (bouton « Démarrer un lot ») : l'appli calcule les dates des
      contrôles, des pesées et de la fin.
    </p>
    <a class="bouton plein" href={lienChambre('recettes')}>Voir les recettes</a>
  {:else}
    <ul class="liste lots">
      {#each lots.enCours as l (l.id)}
        {@const x = resume(l)}
        <li>
          <a href={lienChambre('lot', l.id)} style:--couleur={couleurMode(x.mode)}>
            <span class="texte">
              <strong>{l.nom}</strong>
              <span class="petit discret">
                Jour {Math.max(0, joursCalendaires(l.entree, chambre.maintenant))}{x.phase ? ` · ${x.phase}` : ''} ·
                {x.mode ? `mode ${x.mode.nom}` : NOMS_LIEUX[l.recette.lieu]}
              </span>
              <span class="petit">
                {#if x.bloque}<span class="rouge">Ne pas sécher</span>
                {:else if x.dus}<span class="a-faire">{pluriel(x.dus, 'contrôle')} à faire</span>
                {:else if x.prochain}Prochain contrôle le {dateCourte(x.prochain.quand)}{/if}
                {#if x.perte} · perte {nombre(x.perte.pct, 1)}&nbsp;%{x.perte.cible !== undefined ? ` / ${x.perte.cible} %` : ''}{/if}
                · fin vers le {dateCourte(x.fin.min)}
              </span>
            </span>
            <ChevronRight size={18} />
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  {#if lots.finis.length}
    <button class="section-titre bascule" onclick={() => (finisOuverts = !finisOuverts)} aria-expanded={finisOuverts}>
      Terminés ({lots.finis.length}) {finisOuverts ? '▾' : '▸'}
    </button>
    {#if finisOuverts}
      <ul class="liste lots">
        {#each lots.finis as l (l.id)}
          <li>
            <a href={lienChambre('lot', l.id)}>
              <span class="texte">
                <strong>{l.nom}</strong>
                <span class="petit discret">{l.statut === 'rate' ? 'Raté' : 'Terminé'} le {date(l.finLe ?? l.entree)}</span>
              </span>
              <ChevronRight size={18} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  h1 {
    font-size: 28px;
    margin: 4px 0 14px;
  }

  .vide-carte {
    padding: 14px;
    margin: 0 0 12px;
    color: var(--texte-2);
  }

  .lots a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    color: inherit;
    text-decoration: none;
    border-left: 4px solid var(--couleur, var(--surface-3));
  }

  .lots a:active {
    background: var(--surface-2);
  }

  .lots :global(svg) {
    flex: none;
    color: var(--texte-3);
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .a-faire {
    color: var(--accent);
    font-weight: 600;
  }

  .rouge {
    color: var(--rouge);
    font-weight: 700;
  }

  .bascule {
    display: block;
    border: none;
    background: none;
    padding: 8px 0;
    min-height: 44px;
    text-align: left;
    width: 100%;
  }
</style>
