<script lang="ts">
  // Mise en service de la chambre, à faire avant le premier koji : ITC en °C d'abord, calibrage des sondes,
  // étalonnage du pH-mètre, tests de redémarrage, tapis, câbles et joint, essai à vide.
  import { CircleAlert } from '@lucide/svelte';
  import { routeur } from '../../lib/routeur.svelte';
  import { t } from '../affichage';
  import { chambre, estFacultative } from '../chambre.svelte';
  import { CONTENU } from '../donnees';

  const etapes = CONTENU.modes.mise_en_service;
  const requises = etapes.filter((e) => !estFacultative(e.titre));
  const faites = $derived(requises.filter((e) => chambre.miseEnService.includes(e.titre)).length);
</script>

<div class="contenu">
  <h1 class="titre-serif">Mise en service</h1>
  <p class="discret">À faire une fois, avant le premier koji. Coche chaque étape quand elle est faite.</p>
  <p class="compte" class:fini={chambre.miseEnServiceFaite}>
    {chambre.miseEnServiceFaite ? '✓ Mise en service terminée' : `${faites} sur ${requises.length} étapes faites`}
  </p>

  <ol class="etapes">
    {#each etapes as e, i (e.titre)}
      {@const faite = chambre.miseEnService.includes(e.titre)}
      <li class="carte" class:faite>
        <label>
          <input type="checkbox" checked={faite} onchange={(ev) => chambre.cocherEtape(e.titre, ev.currentTarget.checked)} />
          <span class="titre"><span class="num">{i + 1}.</span> {e.titre}</span>
        </label>
        <p>{t(e.texte)}</p>
        {#if e.si_echec}
          <p class="echec"><CircleAlert size={16} /> <span><strong>Si ça ne marche pas :</strong> {t(e.si_echec)}</span></p>
        {/if}
      </li>
    {/each}
  </ol>

  {#if chambre.miseEnServiceFaite}
    <button class="bouton plein" onclick={() => routeur.retour()}>Terminé</button>
  {/if}
</div>

<style>
  h1 {
    font-size: 30px;
    margin: 4px 0 6px;
  }

  .compte {
    font-weight: 600;
    color: var(--ambre);
  }

  .compte.fini {
    color: var(--vert);
  }

  .etapes {
    list-style: none;
    margin: 12px 0 20px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .etapes li {
    padding: 12px 14px 14px;
    border-left: 5px solid var(--surface-3);
  }

  .etapes li.faite {
    border-left-color: var(--vert);
  }

  label {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }

  input {
    flex: none;
    width: 26px;
    height: 26px;
    margin: 0;
    accent-color: var(--vert);
  }

  .titre {
    font-weight: 700;
    font-size: 18px;
  }

  .num {
    color: var(--texte-3);
  }

  .etapes p {
    margin: 6px 0 0;
  }

  .echec {
    display: flex;
    gap: 6px;
    font-size: 15px;
    color: var(--texte-2);
  }

  .echec :global(svg) {
    flex: none;
    margin-top: 3px;
    color: var(--ambre);
  }

  .faite p {
    color: var(--texte-2);
  }
</style>
