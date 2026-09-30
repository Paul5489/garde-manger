<script lang="ts">
  // Réglages › Avec ce que j'ai : placard (toujours à la maison) et synonymes d'ingrédients.
  import { Plus, RotateCcw, X } from '@lucide/svelte';
  import { pluriel } from '../lib/format';
  import { frigo } from '../lib/frigo.svelte';
  import { ecrireSynonymes, lireSynonymes } from '../lib/normalisation';

  let nouveau = $state('');

  async function ajouter(e: SubmitEvent) {
    e.preventDefault();
    const n = nouveau.trim();
    if (!n) return;
    nouveau = '';
    await frigo.ajouterAuPlacard(n);
  }

  // Synonymes : édités comme un petit fichier texte, une ligne par groupe.
  let texte = $state(ecrireSynonymes(frigo.synonymes));
  let message = $state<string | null>(null);
  const modifie = $derived(texte.trim() !== ecrireSynonymes(frigo.synonymes).trim());

  async function enregistrer() {
    const groupes = lireSynonymes(texte);
    await frigo.definirSynonymes(groupes);
    texte = ecrireSynonymes(frigo.synonymes);
    message = `✓ ${pluriel(groupes.length, 'groupe enregistré', 'groupes enregistrés')}.`;
  }

  async function retablir() {
    if (!confirm('Revenir à la liste de synonymes d’origine ? Tes modifications seront perdues.')) return;
    await frigo.definirSynonymes(null);
    texte = ecrireSynonymes(frigo.synonymes);
    message = '✓ Liste d’origine rétablie.';
  }
</script>

<div class="carte bloc">
  <h3>Toujours à la maison</h3>
  <p class="discret petit">
    Le « placard » : jamais compté comme manquant dans « Avec ce que j'ai », et décoché quand tu ajoutes une recette
    aux courses.
  </p>
  <div class="puces">
    {#each frigo.placard as p (p)}
      <button class="puce" onclick={() => frigo.retirerDuPlacard(p)} aria-label="Retirer {p} du placard">{p} <X size={15} /></button>
    {/each}
  </div>
  <form class="ajout" onsubmit={ajouter}>
    <input class="champ" bind:value={nouveau} placeholder="Ajouter (ex. farine, beurre…)" autocomplete="off" enterkeyhint="done" aria-label="Ajouter au placard" />
    <button class="bouton" type="submit" disabled={!nouveau.trim()} aria-label="Ajouter au placard"><Plus size={22} /></button>
  </form>
  {#if frigo.placardModifie}
    <button class="bouton-icone retablir" onclick={() => frigo.definirPlacard(null)}><RotateCcw size={15} /> Placard d'origine</button>
  {/if}
</div>

<div class="carte bloc">
  <h3>Synonymes</h3>
  <p class="discret petit">
    Une ligne par groupe de noms qui désignent le même ingrédient, séparés par des virgules. Le premier est le nom
    principal. Exemple : <em>Échalote, échalion</em>. Le pluriel, les accents et les mots comme « émincé » sont déjà
    gérés tout seuls.
  </p>
  <textarea class="champ synonymes" rows="10" bind:value={texte} oninput={() => (message = null)} spellcheck="false" aria-label="Synonymes"></textarea>
  <div class="boutons">
    <button class="bouton" onclick={enregistrer} disabled={!modifie}>Enregistrer</button>
    {#if frigo.synonymesModifies}
      <button class="bouton secondaire" onclick={retablir}><RotateCcw size={17} /> Liste d'origine</button>
    {/if}
  </div>
  {#if message}<p class="message" role="status">{message}</p>{/if}
</div>

<style>
  .bloc {
    padding: 14px 16px 16px;
  }

  .bloc + .bloc {
    margin-top: 12px;
  }

  h3 {
    font-size: 16px;
    margin: 0 0 4px;
  }

  p {
    margin: 0;
  }

  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .ajout {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .ajout .champ {
    flex: 1;
    min-width: 0;
  }

  .ajout .bouton {
    flex: none;
    width: 48px;
    padding: 0;
  }

  .retablir {
    margin-top: 6px;
    font-size: 15px;
    gap: 6px;
  }

  .synonymes {
    display: block;
    margin-top: 12px;
    font-size: 15.5px;
    line-height: 1.5;
    resize: vertical;
    white-space: pre-wrap;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .message {
    margin-top: 8px;
    color: var(--vert);
    font-weight: 600;
    font-size: 15px;
  }
</style>
