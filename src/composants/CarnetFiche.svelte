<script lang="ts">
  // « Mon carnet » en bas d'une fiche : note personnelle et historique « cuisiné le… ».
  import { onDestroy, untrack } from 'svelte';
  import { ChefHat, X } from '@lucide/svelte';
  import Etoiles from './Etoiles.svelte';
  import FormulaireRealisation from './FormulaireRealisation.svelte';
  import { date, jourEnDate } from '../lib/format';
  import { perso } from '../lib/perso.svelte';
  import { texteQuantites } from '../lib/portions.svelte';
  import type { Fiche } from '../lib/types';

  let { fiche }: { fiche: Fiche } = $props();

  const cuisinable = $derived(fiche.type === 'recette' || fiche.type === 'technique');
  const realisations = $derived(perso.realisationsDe(fiche.id));

  // Note : enregistrée pendant la frappe (après une courte pause) et en quittant le champ.
  let texte = $state('');
  let idNote = '';
  let champ = $state<HTMLTextAreaElement>();
  let attente: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const id = fiche.id;
    untrack(() => {
      if (id === idNote) return;
      enregistrerMaintenant();
      idNote = id;
      texte = perso.note(id);
      requestAnimationFrame(ajusterHauteur);
    });
  });

  function ajusterHauteur() {
    if (!champ) return;
    champ.style.height = 'auto';
    champ.style.height = `${champ.scrollHeight + 2}px`;
  }

  function surSaisie() {
    ajusterHauteur();
    clearTimeout(attente);
    attente = setTimeout(enregistrerMaintenant, 600);
  }

  function enregistrerMaintenant() {
    clearTimeout(attente);
    if (idNote) void perso.definirNote(idNote, texte);
  }

  onDestroy(enregistrerMaintenant);

  let formulaire = $state(false);

  function supprimer(id: string, jour: string) {
    if (confirm(`Retirer « cuisiné le ${date(jourEnDate(jour))} » de ton carnet ?`)) void perso.supprimerRealisation(id);
  }
</script>

<section class="carnet" id="carnet">
  <h2 class="titre-section">Mon carnet</h2>
  <div class="carte bloc">
    <label class="etiquette-note" for="note-perso">Ma note</label>
    <textarea
      id="note-perso"
      class="note"
      rows="2"
      placeholder="Tes astuces, ce que tu changerais la prochaine fois…"
      bind:this={champ}
      bind:value={texte}
      oninput={surSaisie}
      onblur={enregistrerMaintenant}
    ></textarea>
  </div>

  {#if realisations.length}
    <ul class="liste historique">
      {#each realisations as r (r.id)}
        <li>
          <div class="realisation">
            <p class="ligne-haut">
              <strong>{date(jourEnDate(r.date))}</strong>
              <Etoiles valeur={r.note} taille={15} modifiable={false} />
              {#if r.quantites}<span class="discret petit">· {r.quantites}</span>{/if}
            </p>
            {#if r.commentaire}<p class="commentaire">{r.commentaire}</p>{/if}
          </div>
          <button class="bouton-icone retirer" onclick={() => supprimer(r.id, r.date)} aria-label="Retirer cette date">
            <X size={18} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if cuisinable}
    {#if formulaire}
      <div class="carte bloc formulaire">
        <FormulaireRealisation
          ficheId={fiche.id}
          quantites={texteQuantites(fiche)}
          question="J'ai cuisiné cette recette"
          onenregistre={() => (formulaire = false)}
          onannule={() => (formulaire = false)}
        />
      </div>
    {:else}
      <button class="bouton secondaire plein cuisine" onclick={() => (formulaire = true)}>
        <ChefHat size={20} /> J'ai cuisiné cette recette
      </button>
    {/if}
  {/if}
</section>

<style>
  .carnet {
    scroll-margin-top: calc(var(--haut) + 52px);
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 22px;
    margin: 30px 0 10px;
  }

  .bloc {
    padding: 10px 14px 12px;
  }

  .etiquette-note {
    display: block;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin-bottom: 4px;
  }

  .note {
    display: block;
    width: 100%;
    min-height: 3.2em;
    border: none;
    background: none;
    padding: 0;
    outline: none;
    resize: none;
    line-height: 1.45;
    overflow: hidden;
  }

  .historique {
    margin-top: 12px;
  }

  .historique li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 4px 10px 14px;
  }

  .realisation {
    flex: 1;
    min-width: 0;
  }

  .ligne-haut {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 0;
    min-height: 24px;
  }

  .commentaire {
    margin: 4px 0 0;
    color: var(--texte-2);
    font-size: 15.5px;
  }

  .retirer {
    color: var(--texte-3);
    margin: -8px 0;
  }

  .formulaire {
    margin-top: 12px;
    padding: 14px;
  }

  .cuisine {
    margin-top: 12px;
  }
</style>
