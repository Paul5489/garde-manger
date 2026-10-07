<script lang="ts">
  // Un contrôle d'un lot : quand, quoi observer, ce qui est normal ou non, quoi faire ; « OK » ou « Problème »
  // (avec une note). Les pesées et les mesures de pH se notent directement.
  import { Check, ChevronDown, CircleAlert, RotateCcw } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { nombre } from '../../lib/format';
  import { quandLisible, t } from '../affichage';
  import { MESSAGE_PH_BLOQUE, momentPropose, PH_SAUCISSON, type Occurrence } from '../lots';
  import { lots } from '../lots.svelte';
  import type { Lot, MesurePh } from '../types';

  let { lot, occ, maintenant, ouvert: ouvertInitial = false }: { lot: Lot; occ: Occurrence; maintenant: number; ouvert?: boolean } = $props();

  // Ouvert au départ si demandé (contrôles à faire), puis libre.
  let ouvert = $state(untrack(() => ouvertInitial));
  let probleme = $state(false);
  let note = $state('');
  let valeur = $state('');
  const MOMENTS: [MesurePh['moment'], string][] = [
    ['depart', 'Au départ'],
    ['48h', 'À 48 h'],
    ['72h', 'À 72 h'],
    ['libre', 'Autre'],
  ];
  const saucisson = $derived(lot.recette.technique === 'saucisson');
  // Moment de la mesure : d'après le contrôle (j = 0, 2, 3) sinon d'après le temps écoulé.
  let moment = $state<MesurePh['moment']>('libre');
  $effect(() => {
    moment = !saucisson ? 'libre' : occ.controle.j === 0 ? 'depart' : occ.controle.j === 2 ? '48h' : occ.controle.j === 3 ? '72h' : momentPropose(lot, maintenant);
  });

  const nombreSaisi = $derived(Number(valeur.replace(',', '.').replace(/\s/g, '')));
  const valide = $derived(valeur.trim() !== '' && Number.isFinite(nombreSaisi) && nombreSaisi > 0);
  const enRetard = $derived(!occ.coche && occ.quand.getTime() < maintenant - 6 * 3_600_000);

  async function ok() {
    await lots.cocher(lot.id, occ.cle, { etat: 'ok' });
  }

  async function signaler() {
    await lots.cocher(lot.id, occ.cle, { etat: 'probleme', note: note.trim() || undefined });
    probleme = false;
  }

  async function noter() {
    if (!valide) return;
    if (occ.type === 'ph') await lots.mesurerPh(lot.id, nombreSaisi, moment, new Date(), occ.cle);
    else await lots.peser(lot.id, nombreSaisi, new Date(), occ.cle);
    valeur = '';
  }
</script>

<li class="controle" class:fait={occ.coche?.etat === 'ok'} class:souci={occ.coche?.etat === 'probleme'} class:retard={enRetard}>
  <button class="entete" onclick={() => (ouvert = !ouvert)} aria-expanded={ouvert}>
    <span class="texte">
      <span class="quand">{quandLisible(occ.quand, occ.exacte, maintenant)}{occ.exacte ? '' : ' (vers ' + occ.quand.getHours() + ' h)'}</span>
      <strong>{t(occ.controle.titre)}</strong>
      {#if occ.coche}
        <span class="etat petit">
          {#if occ.coche.etat === 'ok'}<Check size={14} /> Fait{:else}<CircleAlert size={14} /> Problème{occ.coche.note ? ` : ${occ.coche.note}` : ''}{/if}
        </span>
      {/if}
    </span>
    <ChevronDown size={18} class="chevron {ouvert ? 'tourne' : ''}" />
  </button>

  {#if ouvert}
    <div class="details">
      <dl>
        <dt>Observer</dt>
        <dd>{t(occ.controle.observer)}</dd>
        <dt>Normal</dt>
        <dd>{t(occ.controle.normal)}</dd>
        {#if occ.controle.probleme}
          <dt>Problème</dt>
          <dd>{t(occ.controle.probleme)}</dd>
        {/if}
        <dt>Que faire</dt>
        <dd>{t(occ.controle.action)}</dd>
      </dl>

      {#if occ.coche}
        <button class="bouton secondaire petit-bouton" onclick={() => lots.cocher(lot.id, occ.cle, null)}><RotateCcw size={16} /> Annuler</button>
      {:else if occ.type === 'ph' || (occ.type === 'pesee' && lot.recette.fin.type === 'perte_poids')}
        <form class="saisie" onsubmit={(e) => (e.preventDefault(), noter())}>
          <input
            class="champ"
            type="text"
            inputmode="decimal"
            bind:value={valeur}
            placeholder={occ.type === 'ph' ? 'pH, ex. 5,2' : 'Poids en g'}
            aria-label={occ.type === 'ph' ? 'pH mesuré' : 'Poids en grammes'}
          />
          {#if occ.type === 'ph' && saucisson}
            <select class="champ" bind:value={moment} aria-label="Moment de la mesure">
              {#each MOMENTS as [v, l] (v)}<option value={v}>{l}</option>{/each}
            </select>
          {/if}
          <button class="bouton" type="submit" disabled={!valide}>Noter</button>
        </form>
        {#if occ.type === 'ph' && saucisson && moment === '72h' && valide && nombreSaisi > PH_SAUCISSON}
          <p class="alerte-ph">{MESSAGE_PH_BLOQUE}</p>
        {/if}
        <button class="lien-bouton" onclick={ok}>Marquer comme fait sans noter de valeur</button>
      {:else if probleme}
        <textarea class="champ" rows="2" bind:value={note} placeholder="Ce que tu as vu, ce que tu as fait"></textarea>
        <div class="boutons">
          <button class="bouton secondaire" onclick={() => (probleme = false)}>Annuler</button>
          <button class="bouton" onclick={signaler}>Enregistrer le problème</button>
        </div>
      {:else}
        <div class="boutons">
          <button class="bouton ok" onclick={ok}><Check size={18} /> OK</button>
          <button class="bouton secondaire" onclick={() => (probleme = true)}><CircleAlert size={18} /> Problème</button>
        </div>
      {/if}
      {#if occ.type === 'pesee' && lot.pesees.length && occ.coche}
        <p class="petit discret">Dernière pesée : {nombre(lot.pesees.at(-1)!.g)}&nbsp;g.</p>
      {/if}
    </div>
  {/if}
</li>

<style>
  .controle {
    list-style: none;
  }

  .entete {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    min-height: 56px;
    border: none;
    background: none;
    text-align: left;
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .quand {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  .retard .quand {
    color: var(--rouge);
  }

  .fait .quand,
  .fait strong {
    color: var(--texte-3);
  }

  .etat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--vert);
  }

  .souci .etat {
    color: var(--rouge);
  }

  .entete :global(.chevron) {
    flex: none;
    color: var(--texte-3);
    transition: transform 0.15s;
  }

  .entete :global(.tourne) {
    transform: rotate(180deg);
  }

  .details {
    padding: 0 14px 14px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0 0 12px;
    font-size: 15px;
  }

  dt {
    color: var(--texte-2);
  }

  dd {
    margin: 0;
  }

  .boutons {
    display: flex;
    gap: 8px;
  }

  .boutons .bouton {
    flex: 1;
    padding: 0 12px;
  }

  .ok {
    background: var(--vert);
    color: var(--surface);
  }

  .saisie {
    display: flex;
    gap: 8px;
  }

  .saisie input {
    flex: 1;
    min-width: 0;
  }

  .saisie select {
    width: auto;
  }

  .alerte-ph {
    margin: 10px 0 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--rouge);
    color: var(--surface);
    font-weight: 700;
  }

  .lien-bouton {
    border: none;
    background: none;
    color: var(--accent);
    padding: 10px 0 0;
    font-size: 14px;
    text-align: left;
  }

  .petit-bouton {
    min-height: 40px;
    padding: 0 14px;
  }

  textarea {
    margin-bottom: 8px;
    resize: vertical;
  }
</style>
