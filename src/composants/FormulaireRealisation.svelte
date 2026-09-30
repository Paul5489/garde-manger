<script lang="ts">
  // « J'ai cuisiné cette recette » : date, appréciation, un mot pour la prochaine fois.
  import Etoiles from './Etoiles.svelte';
  import { aujourdhui } from '../lib/format';
  import { perso } from '../lib/perso.svelte';

  let {
    ficheId,
    quantites,
    question = 'Comment c’était ?',
    onenregistre,
    onannule,
  }: {
    ficheId: string;
    quantites?: string;
    question?: string;
    onenregistre?: () => void;
    onannule?: () => void;
  } = $props();

  const max = aujourdhui();
  let jour = $state(max);
  let note = $state(0);
  let commentaire = $state('');
  let enCours = $state(false);

  async function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    if (enCours) return;
    enCours = true;
    try {
      await perso.ajouterRealisation({ ficheId, date: jour || max, note, commentaire: commentaire.trim(), quantites });
      onenregistre?.();
    } finally {
      enCours = false;
    }
  }
</script>

<form class="formulaire" onsubmit={enregistrer}>
  <p class="question">{question}</p>
  <Etoiles bind:valeur={note} />
  <label class="ligne-date">
    <span>Cuisiné le</span>
    <input class="champ date" type="date" bind:value={jour} {max} required />
  </label>
  <textarea
    class="champ"
    rows="2"
    placeholder="Un mot pour la prochaine fois (facultatif)"
    bind:value={commentaire}
    aria-label="Commentaire"
  ></textarea>
  <div class="boutons">
    {#if onannule}<button type="button" class="bouton secondaire" onclick={onannule}>Annuler</button>{/if}
    <button type="submit" class="bouton" disabled={enCours}>Noter dans mon carnet</button>
  </div>
</form>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
  }

  .question {
    margin: 0;
    font-weight: 700;
    font-size: 17px;
  }

  .formulaire :global(.etoiles) {
    margin-left: -8px;
  }

  .ligne-date {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .date {
    width: auto;
    min-width: 0;
    flex: 0 1 auto;
    padding: 8px 12px;
  }

  textarea {
    resize: vertical;
  }

  .boutons {
    display: flex;
    gap: 10px;
  }

  .boutons .bouton {
    flex: 1;
  }
</style>
