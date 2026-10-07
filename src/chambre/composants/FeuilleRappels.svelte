<script lang="ts">
  // Ajouter des rappels au Calendrier de l'iPhone (.ics, une alarme par rappel), ou envoyer le fichier.
  import { CalendarPlus } from '@lucide/svelte';
  import Feuille from '../../composants/Feuille.svelte';
  import { pluriel } from '../../lib/format';
  import { enregistrerFichier, ouvrirCalendrier } from '../../lib/partage';
  import { quandLisible } from '../affichage';
  import { fichierIcsChambre, type EvenementIcs } from '../ics';

  let {
    ouvert = $bindable(false),
    titre,
    sousTitre,
    evenements,
    nomFichier,
    sequence = 0,
    maintenant,
  }: {
    ouvert: boolean;
    titre: string;
    sousTitre?: string;
    evenements: EvenementIcs[];
    nomFichier: string;
    sequence?: number;
    maintenant: number;
  } = $props();

  const ics = $derived(fichierIcsChambre(evenements, sequence));
  const repete = (e: EvenementIcs) => (e.rrule ? ' (se répète)' : '');

  function ajouter() {
    ouvrirCalendrier(ics);
  }

  async function envoyer() {
    await enregistrerFichier(new File([ics], nomFichier, { type: 'text/calendar' }));
  }
</script>

<Feuille bind:ouvert {titre} {sousTitre}>
  {#if evenements.length}
    <p class="petit discret">{pluriel(evenements.length, 'rappel')}, chacun avec une alarme :</p>
    <ul class="liste rappels">
      {#each evenements.slice(0, 12) as e (e.uid)}
        <li><strong>{e.titre}</strong><span class="discret petit">{quandLisible(e.debut, true, maintenant)}{repete(e)}</span></li>
      {/each}
      {#if evenements.length > 12}<li class="discret petit">… et {evenements.length - 12} autres</li>{/if}
    </ul>
    <p class="discret petit aide">
      Le Calendrier sonne à l'heure dite, même appli fermée. Si rien ne s'ouvre avec le premier bouton, utilise le
      second, choisis « Enregistrer dans Fichiers », puis touche le fichier dans l'app Fichiers › « Ajouter tout ».
      Après un changement (passage en Cave, contrôle coché…), refais-le : les anciens rappels sont remplacés.
    </p>
  {:else}
    <p class="vide">Aucun rappel à venir.</p>
  {/if}
  {#snippet pied()}
    <div class="pied">
      <button class="bouton plein" onclick={ajouter} disabled={!evenements.length}><CalendarPlus size={20} /> Ajouter au Calendrier</button>
      <button class="bouton secondaire plein" onclick={envoyer} disabled={!evenements.length}>Envoyer le fichier…</button>
    </div>
  {/snippet}
</Feuille>

<style>
  .rappels li {
    display: flex;
    flex-direction: column;
    padding: 9px 14px;
  }

  .aide {
    margin: 12px 4px 0;
  }

  .pied {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
