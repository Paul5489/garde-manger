<script lang="ts">
  import { CalendarPlus, Camera, Check, ChevronRight, Copy, Pencil, RotateCcw, Trash2, X } from '@lucide/svelte';
  import BarreHaut from '../composants/BarreHaut.svelte';
  import CarteBocal from '../composants/CarteBocal.svelte';
  import Feuille from '../composants/Feuille.svelte';
  import {
    debutsDesEtapes,
    etatEtape,
    evenementsCalendrier,
    fichierIcs,
    joursEntre,
    libelleDuree,
    quandRappel,
    selEnGrammes,
    type EntreeJournal,
  } from '../lib/bocaux';
  import { bocaux } from '../lib/bocaux.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import { etat } from '../lib/etat.svelte';
  import { date, dateCourte, heure, nombre } from '../lib/format';
  import { enregistrerFichier, ouvrirCalendrier } from '../lib/partage';
  import { compresserPhoto } from '../lib/photo';
  import { lienFiche, lienModifierBocal, routeur } from '../lib/routeur.svelte';
  import { insecables, majuscule } from '../lib/texte';
  import type { Fermentation } from '../lib/types';

  let { id }: { id: string } = $props();

  const b = $derived(bocaux.bocal(id));
  const e = $derived(b ? etatEtape(b, bocaux.maintenant) : null);
  const debuts = $derived(b ? debutsDesEtapes(b) : []);
  const titreFiche = $derived(b?.ficheId ? etat.parId.get(b.ficheId)?.titre : undefined);

  let conteneur = $state<HTMLElement>();
  let defile = $state(false);

  // Repères de la recette d'origine (contrôle, conservation).
  let reperes = $state.raw<Fermentation | null>(null);
  $effect(() => {
    const f = b?.ficheId;
    reperes = null;
    if (f) void etat.fiche(f).then((x) => (reperes = x?.fermentation ?? null));
  });

  // Journal (chargé à part : il contient les photos).
  let journal = $state.raw<EntreeJournal[]>([]);
  let versionJournal = $state(0);
  $effect(() => {
    void versionJournal;
    void bocaux.journalDe(id).then((j) => (journal = j));
  });

  let texte = $state('');
  let photo = $state<string | null>(null);
  let champPhoto = $state<HTMLInputElement>();
  let champTexte = $state<HTMLTextAreaElement>();
  let erreurPhoto = $state<string | null>(null);
  let enCours = $state(false);

  async function photoChoisie(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    erreurPhoto = null;
    try {
      photo = await compresserPhoto(f);
    } catch (err) {
      erreurPhoto = err instanceof Error ? err.message : String(err);
    }
  }

  async function noter(ev: SubmitEvent) {
    ev.preventDefault();
    if (enCours || (!texte.trim() && !photo)) return;
    enCours = true;
    try {
      await bocaux.ajouterAuJournal(id, texte, photo ?? undefined);
      texte = '';
      photo = null;
      versionJournal++;
      champTexte?.blur();
    } finally {
      enCours = false;
    }
  }

  function supprimerNote(n: EntreeJournal) {
    if (!confirm('Supprimer cette note du journal ?')) return;
    void bocaux.supprimerDuJournal(n).then(() => versionJournal++);
  }

  function allerAuJournal() {
    conteneur?.querySelector('#journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => champTexte?.focus(), 350);
  }

  async function terminer(statut: 'termine' | 'rate') {
    const q = statut === 'termine' ? 'Marquer ce bocal comme terminé ?' : 'Marquer ce bocal comme raté ?';
    if (confirm(q)) await bocaux.changerStatut(id, statut);
  }

  async function etapeSuivante() {
    if (!b || !e) return;
    const suivante = b.etapes[e.index + 1];
    if (suivante && confirm(`Passer à l'étape « ${suivante.nom} » ? Elle commence maintenant.`)) await bocaux.etapeSuivante(id);
  }

  async function modele() {
    if (!b) return;
    const m = await bocaux.enregistrerModele({ ...b, nom: b.nom });
    annonce.afficher(`Modèle « ${m.nom} » enregistré`);
  }

  async function supprimer() {
    if (!b || !confirm(`Supprimer « ${b.nom} » et son journal ? C'est définitif.`)) return;
    await bocaux.supprimer(id);
    routeur.retour();
  }

  // Rappels du Calendrier
  let feuilleCalendrier = $state(false);
  const evenements = $derived(b && feuilleCalendrier ? evenementsCalendrier(b, bocaux.maintenant) : []);

  function calendrier() {
    ouvrirCalendrier(fichierIcs(evenements));
  }

  async function envoyerIcs() {
    if (!b) return;
    const nomFichier = `rappels-${b.nom.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'bocal'}.ics`;
    await enregistrerFichier(new File([fichierIcs(evenements)], nomFichier, { type: 'text/calendar' }));
  }
</script>

<div class="ecran calque" bind:this={conteneur} onscroll={() => (defile = (conteneur?.scrollTop ?? 0) > 50)}>
  <BarreHaut titre={b?.nom ?? ''} avecTrait={defile}>
    {#snippet actions()}
      {#if b}<a class="bouton-icone" href={lienModifierBocal(id)} aria-label="Modifier le bocal"><Pencil size={22} /></a>{/if}
    {/snippet}
  </BarreHaut>

  {#if !bocaux.charge}
    <p class="vide">Chargement…</p>
  {:else if !b || !e}
    <p class="vide">Ce bocal n'existe plus.</p>
  {:else}
    <article class="contenu">
      <p class="surtitre">
        {[b.type ? majuscule(b.type) : '', `mis en bocal le ${date(b.debut)}`].filter(Boolean).join(' · ')}
      </p>
      <h1 class="titre-serif">{b.nom}</h1>
      {#if b.ficheId}
        <a class="lien-fiche" href={lienFiche(b.ficheId)}>Recette : {titreFiche ?? 'voir la fiche'} <ChevronRight size={16} /></a>
      {/if}

      <div class="etat"><CarteBocal bocal={b} maintenant={bocaux.maintenant} lien={false} /></div>

      {#if b.statut === 'en-cours'}
        {#if e.finMin}
          <p class="dates">
            {#if e.derniere}Prêt à partir du{:else}Fin de l'étape à partir du{/if}
            <strong>{e.etape.unite === 'heures' ? `${dateCourte(e.finMin)} à ${heure(e.finMin)}` : dateCourte(e.finMin)}</strong>{#if e.finMax && e.finMax.getTime() !== e.finMin.getTime()},
              au plus tard le <strong>{e.etape.unite === 'heures' ? `${dateCourte(e.finMax)} à ${heure(e.finMax)}` : dateCourte(e.finMax)}</strong>{/if}
          </p>
        {/if}
        <div class="actions">
          <button class="bouton" onclick={allerAuJournal}>Noter une dégustation</button>
          {#if !e.derniere}
            <button class="bouton secondaire" onclick={etapeSuivante}>Étape suivante <ChevronRight size={18} /></button>
          {:else}
            <button class="bouton secondaire" onclick={() => terminer('termine')}><Check size={18} /> Terminé</button>
          {/if}
          {#if e.etape.min !== undefined}
            <button class="bouton secondaire" onclick={() => (feuilleCalendrier = true)}><CalendarPlus size={18} /> Rappels</button>
          {/if}
          <button class="bouton secondaire rate" onclick={() => terminer('rate')}>Raté</button>
        </div>
      {:else}
        <div class="actions">
          <button class="bouton secondaire" onclick={() => bocaux.changerStatut(id, 'en-cours')}><RotateCcw size={18} /> Remettre en cours</button>
        </div>
      {/if}

      <h2 class="titre-section">Réglages</h2>
      <div class="carte bloc">
        <dl>
          <dt>Mis en bocal</dt>
          <dd>{date(b.debut)} à {heure(b.debut)}</dd>
          {#if b.poidsG}<dt>Poids</dt><dd>{nombre(b.poidsG)}&nbsp;g</dd>{/if}
          {#if b.selPct !== undefined}
            <dt>Sel</dt>
            <dd>{nombre(b.selPct)}&nbsp;%{#if selEnGrammes(b) !== undefined}{` · ${nombre(selEnGrammes(b)!, 1)}\u00a0g`}{/if}</dd>
          {/if}
          {#if b.temperatureC !== undefined}<dt>Température</dt><dd>{nombre(b.temperatureC)}&nbsp;°C</dd>{/if}
          {#if b.etapes.length === 1}<dt>Durée prévue</dt><dd>{libelleDuree(b.etapes[0])}</dd>{/if}
        </dl>
        {#if b.etapes.length > 1}
          <ol class="etapes">
            {#each b.etapes as et, i (i)}
              <li class:courante={i === e.index && b.statut === 'en-cours'} class:faite={i < e.index}>
                <span class="nom-etape">{i + 1}. {et.nom}</span>
                <span class="discret petit">
                  {[libelleDuree(et), et.temperatureC !== undefined ? `${nombre(et.temperatureC)}\u00a0°C` : '', `${i <= e.index ? 'depuis le' : 'prévue vers le'} ${dateCourte(debuts[i])}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            {/each}
          </ol>
          {#if e.index > 0 && b.statut === 'en-cours'}
            <button class="bouton-icone petit-lien" onclick={() => bocaux.etapePrecedente(id)}><RotateCcw size={14} /> Revenir à l'étape précédente</button>
          {/if}
        {/if}
      </div>

      {#if b.notes}
        <h2 class="titre-section">Notes</h2>
        <div class="carte bloc texte-libre">{b.notes}</div>
      {/if}

      {#if reperes?.controle || reperes?.conservation || reperes?.ensemencement}
        <h2 class="titre-section">Repères de la recette</h2>
        <div class="carte bloc">
          <dl class="reperes">
            {#if reperes.ensemencement}<dt>Ensemencement</dt><dd>{insecables(majuscule(reperes.ensemencement))}</dd>{/if}
            {#if reperes.controle}<dt>Surveillance</dt><dd>{insecables(majuscule(reperes.controle))}</dd>{/if}
            {#if reperes.conservation}<dt>Conservation</dt><dd>{insecables(majuscule(reperes.conservation))}</dd>{/if}
          </dl>
        </div>
      {/if}

      <h2 class="titre-section" id="journal">Journal</h2>
      <form class="carte bloc nouvelle-note" onsubmit={noter}>
        <textarea
          bind:this={champTexte}
          bind:value={texte}
          class="champ"
          rows="2"
          placeholder="Goût, acidité, odeur, bulles… (jour {Math.max(0, joursEntre(b.debut, bocaux.maintenant))})"
          aria-label="Note de dégustation"
        ></textarea>
        {#if photo}
          <div class="apercu">
            <img src={photo} alt="Aperçu avant enregistrement" />
            <button type="button" class="bouton-icone" onclick={() => (photo = null)} aria-label="Retirer la photo"><X size={20} /></button>
          </div>
        {/if}
        {#if erreurPhoto}<p class="erreur petit">{erreurPhoto}</p>{/if}
        <div class="boutons-note">
          <button type="button" class="bouton secondaire" onclick={() => champPhoto?.click()}><Camera size={18} /> Photo</button>
          <button class="bouton" type="submit" disabled={enCours || (!texte.trim() && !photo)}>Noter</button>
        </div>
        <input bind:this={champPhoto} type="file" accept="image/*" onchange={photoChoisie} hidden />
      </form>

      {#if journal.length}
        <ul class="journal">
          {#each journal as n (n.id)}
            <li class="carte">
              <div class="entete-note">
                <span><strong>Jour {Math.max(0, joursEntre(b.debut, n.date))}</strong> · <span class="discret">{date(n.date)} à {heure(n.date)}</span></span>
                <button class="bouton-icone" onclick={() => supprimerNote(n)} aria-label="Supprimer cette note"><Trash2 size={17} /></button>
              </div>
              {#if n.texte}<p class="texte-libre">{n.texte}</p>{/if}
              {#if n.photo}<img class="photo" src={n.photo} alt="Le bocal le {date(n.date)}" loading="lazy" />{/if}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="bas">
        <a class="bouton secondaire plein" href={lienModifierBocal(id)}><Pencil size={18} /> Modifier les réglages</a>
        <button class="bouton secondaire plein" onclick={modele}><Copy size={18} /> Enregistrer comme modèle</button>
        <button class="bouton secondaire plein supprimer" onclick={supprimer}><Trash2 size={18} /> Supprimer le bocal</button>
      </div>
    </article>
  {/if}
</div>

{#if b}
  <Feuille bind:ouvert={feuilleCalendrier} titre="Rappels dans le Calendrier" sousTitre={b.nom}>
    {#if evenements.length}
      <ul class="liste rappels">
        {#each evenements as ev (ev.uid)}
          <li><strong>{ev.titre.replace(/^🫙\s*/, '')}</strong><span class="discret petit">{quandRappel(ev.date)}</span></li>
        {/each}
      </ul>
      <p class="discret petit aide">
        Chaque rappel sonne à l'heure indiquée, même appli fermée. Si rien ne s'ouvre avec le premier bouton, utilise le
        second puis choisis « Enregistrer dans Fichiers » et touche le fichier.
      </p>
    {:else}
      <p class="vide">Plus aucun rappel à venir pour ce bocal.</p>
    {/if}
    {#snippet pied()}
      <div class="pied-rappels">
        <button class="bouton plein" onclick={calendrier} disabled={!evenements.length}><CalendarPlus size={20} /> Ajouter au Calendrier</button>
        <button class="bouton secondaire plein" onclick={envoyerIcs} disabled={!evenements.length}>Envoyer le fichier…</button>
      </div>
    {/snippet}
  </Feuille>
{/if}

<style>
  .calque {
    z-index: 10;
  }

  .surtitre {
    margin: 4px 0 6px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 30px;
    line-height: 1.12;
  }

  .lien-fiche {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 40px;
    font-weight: 600;
    text-decoration: none;
  }

  .etat {
    margin-top: 12px;
  }

  .dates {
    margin: 10px 4px 0;
    font-size: 15px;
    color: var(--texte-2);
  }

  .dates strong {
    color: var(--texte);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .actions .bouton {
    flex: 1 1 auto;
    padding: 0 14px;
  }

  .rate {
    color: var(--rouge);
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 22px;
    margin: 28px 0 10px;
    scroll-margin-top: calc(var(--haut) + 56px);
  }

  .bloc {
    padding: 12px 14px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 16px;
    margin: 0;
  }

  dt {
    color: var(--texte-2);
  }

  dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
  }

  .reperes {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .reperes dd {
    text-align: left;
    font-weight: 400;
    margin-bottom: 8px;
  }

  .reperes dt {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .etapes {
    list-style: none;
    margin: 12px 0 0;
    padding: 10px 0 0;
    border-top: 0.5px solid var(--trait);
  }

  .etapes li {
    display: flex;
    flex-direction: column;
    padding: 6px 0 6px 10px;
    border-left: 3px solid var(--surface-3);
  }

  .etapes li.courante {
    border-left-color: var(--accent);
  }

  .etapes li.faite .nom-etape {
    color: var(--texte-2);
  }

  .nom-etape {
    font-weight: 600;
  }

  .petit-lien {
    margin-top: 6px;
    font-size: 14px;
    gap: 6px;
  }

  .texte-libre {
    white-space: pre-line;
    margin: 0;
  }

  .nouvelle-note {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nouvelle-note textarea {
    resize: vertical;
  }

  .apercu {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .apercu img {
    max-width: 50%;
    border-radius: 10px;
  }

  .boutons-note {
    display: flex;
    gap: 8px;
  }

  .boutons-note .bouton {
    flex: 1;
  }

  .erreur {
    color: var(--rouge);
    margin: 0;
  }

  .journal {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .journal li {
    padding: 8px 8px 12px 14px;
  }

  .entete-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 15px;
  }

  .entete-note .bouton-icone {
    color: var(--texte-3);
  }

  .photo {
    display: block;
    width: calc(100% - 6px);
    margin-top: 8px;
    border-radius: 10px;
  }

  .bas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 32px;
  }

  .supprimer {
    color: var(--rouge);
  }

  .rappels li {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
  }

  .aide {
    margin: 12px 4px 0;
  }

  .pied-rappels {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
