<script lang="ts">
  // Page d'un lot : avancement, sécurité, pH, perte de poids, phases, contrôles, notes, fin du lot.
  import { CalendarPlus, ChevronRight, RotateCcw, ShieldAlert, Trash2 } from '@lucide/svelte';
  import { annonce } from '../../lib/annonce.svelte';
  import { date, dateCourte, heure, nombre } from '../../lib/format';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { couleurMode, quandLisible, t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import CourbePerte from '../composants/CourbePerte.svelte';
  import FeuilleRappels from '../composants/FeuilleRappels.svelte';
  import { evenementsLot, sequenceDuLot } from '../ics';
  import ValeursReglage from '../composants/ValeursReglage.svelte';
  import { phaseIhcCave, VAGUE_CAVE_J } from '../taches';
  import { apres } from '../temps';
  import LigneControle from '../composants/LigneControle.svelte';
  import { MODES_PAR_ID, NOMS_LIEUX } from '../donnees';
  import {
    aFaire,
    aVenir,
    debutsDesPhases,
    etatPh,
    finPrevue,
    MESSAGE_PH_BLOQUE,
    occurrences,
    passageSuivant,
    perteDePoids,
    PH_SAUCISSON,
    poidsDemande,
    reglagesAFaire,
    reglagesDuLot,
    type ReglageDuLot,
  } from '../lots';
  import { lots } from '../lots.svelte';
  import { dureeLisible } from '../recettes';
  import { depuisChampDateHeure, joursCalendaires, versChampDateHeure } from '../temps';
  import type { MesurePh } from '../types';

  let { id }: { id: string } = $props();

  const lot = $derived(lots.lot(id));
  const maintenant = $derived(chambre.maintenant);
  const r = $derived(lot?.recette);
  const enCours = $derived(lot?.statut === 'en-cours');
  const phases = $derived(r?.phases ?? []);
  const debuts = $derived(lot ? debutsDesPhases(lot) : null);
  const fin = $derived(lot ? finPrevue(lot) : null);
  const tous = $derived(lot ? occurrences(lot, chambre.heureRappels) : []);
  const dus = $derived(lot ? aFaire(lot, maintenant, chambre.heureRappels) : []);
  const prochains = $derived(lot ? aVenir(lot, maintenant, 4, chambre.heureRappels) : []);
  const faits = $derived(tous.filter((o) => o.coche).reverse());
  const perte = $derived(lot && r?.fin.type === 'perte_poids' ? perteDePoids(lot) : undefined);
  const ph = $derived(lot ? etatPh(lot) : undefined);
  const passage = $derived(lot ? passageSuivant(lot) : { possible: false });
  const securite = $derived([...(lot?.technique?.securite ?? []), ...(r?.securite ?? [])]);
  const saucisson = $derived(r?.technique === 'saucisson');
  const courte = $derived((r?.duree.max_j ?? 9) <= 3);
  const modeActuel = $derived(phases.length ? phases[lot?.phaseCourante ?? 0]?.mode : r?.lieu === 'chambre' ? r.mode : null);
  const jour = $derived(lot ? joursCalendaires(lot.entree, maintenant) : 0);

  let faitsOuverts = $state(false);
  // Réglages de la chambre, étape par étape (dates prises dans le lot).
  const reglages = $derived(lot ? reglagesDuLot(lot, chambre.heureRappels) : []);
  const reglagesDus = $derived(lot ? new Set(reglagesAFaire(lot, maintenant, chambre.heureRappels).map((g) => g.cle)) : new Set<string>());

  /** Cave, passage à 76 % : une autre pièce entrée depuis moins de 3 semaines fait garder 80 %. */
  function garder80(g: ReglageDuLot): Date | undefined {
    if (g.etape.mode !== 'cave' || g.etape.ihc_phase !== 1) return undefined;
    return phaseIhcCave(maintenant, chambre.debutVague) === 0 ? apres(chambre.debutVague, VAGUE_CAVE_J) : undefined;
  }
  let feuilleRappels = $state(false);
  const rappels = $derived(lot && feuilleRappels ? evenementsLot(lot, maintenant, chambre.heureRappels) : []);
  const nomFichier = $derived(
    `rappels-${(lot?.nom ?? 'lot').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.ics`,
  );

  // Phase suivante
  let quandPhase = $state(versChampDateHeure(new Date()));
  let poidsPhase = $state('');
  const suivante = $derived(lot ? phases[lot.phaseCourante + 1] : undefined);
  const demandePoids = $derived(!!lot && !!r && poidsDemande(r, lot.phaseCourante + 1));
  const poidsPhaseValide = $derived(!demandePoids || Number(poidsPhase.replace(',', '.')) > 0);

  async function passer() {
    if (!lot) return;
    const le = depuisChampDateHeure(quandPhase) ?? new Date();
    await lots.passerPhase(lot.id, le, demandePoids ? Number(poidsPhase.replace(',', '.')) : undefined);
    poidsPhase = '';
    annonce.afficher(`Phase « ${suivante?.nom} » commencée.`);
  }

  // Pesée et pH libres
  let poids = $state('');
  let valeurPh = $state('');
  let momentPh = $state<MesurePh['moment']>('libre');
  const nombreDe = (v: string) => Number(v.replace(',', '.').replace(/\s/g, ''));

  async function peser(e: Event) {
    e.preventDefault();
    if (!lot || !(nombreDe(poids) > 0)) return;
    await lots.peser(lot.id, nombreDe(poids), new Date());
    poids = '';
  }

  async function mesurer(e: Event) {
    e.preventDefault();
    const v = nombreDe(valeurPh);
    if (!lot || !(v > 0 && v < 14)) return;
    await lots.mesurerPh(lot.id, v, saucisson ? momentPh : 'libre', new Date());
    valeurPh = '';
  }

  // Notes
  let notes = $state('');
  $effect(() => {
    notes = lot?.notes ?? '';
  });

  // Fin du lot
  let finOuverte = $state(false);
  let conservation = $state(0);
  let quantite = $state('');
  let quandFin = $state(versChampDateHeure(new Date()));

  async function terminer(rate = false) {
    if (!lot || !r) return;
    const le = depuisChampDateHeure(quandFin) ?? new Date();
    await lots.terminer(lot.id, { le, rate, conservation: rate ? undefined : r.conservation[conservation], quantite });
    finOuverte = false;
    annonce.afficher(rate ? 'Lot noté comme raté.' : 'Lot terminé, ajouté au stock.');
  }

  async function supprimer() {
    if (!lot || !confirm(`Supprimer le lot « ${lot.nom} » ? (Ses contrôles, pesées et mesures seront effacés.)`)) return;
    await lots.supprimer(lot.id);
    routeur.retour();
  }

  const MOMENTS: [MesurePh['moment'], string][] = [
    ['depart', 'Au départ'],
    ['48h', 'À 48 h'],
    ['72h', 'À 72 h'],
    ['libre', 'Autre'],
  ];
</script>

{#if !lots.charge}
  <p class="vide">Chargement…</p>
{:else if !lot || !r || !debuts || !fin}
  <p class="vide">Ce lot n'existe plus.</p>
{:else}
  {@const mode = modeActuel ? MODES_PAR_ID.get(modeActuel) : undefined}
  <article class="contenu" style:--couleur={couleurMode(mode)}>
    <p class="surtitre">Lot démarré le {date(lot.entree)} à {heure(lot.entree)}</p>
    <h1 class="titre-serif">{lot.nom}</h1>

    <div class="carte etat">
      {#if enCours}
        <p class="jour">
          {courte ? `${Math.max(0, Math.round((maintenant - new Date(lot.entree).getTime()) / 3_600_000))} h` : `Jour ${Math.max(0, jour)}`}
          {#if phases.length} · {phases[lot.phaseCourante].nom}{/if}
        </p>
        <p class="ou">
          {#if mode}Chambre · <a href={lienChambre('mode', mode.id)}>mode {mode.nom}</a>{:else}{NOMS_LIEUX[phases[lot.phaseCourante]?.lieu ?? r.lieu]}{/if}
        </p>
        <p class="fin">
          Fin prévue {courte
            ? `entre ${quandLisible(fin.min, true, maintenant)} et ${quandLisible(fin.max, true, maintenant)}`
            : fin.min.getTime() === fin.max.getTime()
              ? `le ${dateCourte(fin.min)}`
              : `entre le ${dateCourte(fin.min)} et le ${dateCourte(fin.max)}`}
          <span class="petit discret">· {t(r.fin.texte)}</span>
        </p>
        <button class="bouton secondaire rappels" onclick={() => (feuilleRappels = true)}><CalendarPlus size={18} /> Ajouter au Calendrier</button>
      {:else}
        <p class="jour">{lot.statut === 'rate' ? 'Raté' : 'Terminé'} le {date(lot.finLe ?? lot.entree)}</p>
        <button class="bouton secondaire" onclick={() => lots.reprendre(lot.id)}><RotateCcw size={16} /> Remettre en cours</button>
      {/if}
    </div>

    {#if ph?.bloque}
      <p class="alerte-rouge" role="alert">{MESSAGE_PH_BLOQUE}</p>
    {:else if ph?.jeter}
      <p class="alerte-rouge" role="alert">{ph.message}</p>
    {/if}

    {#if securite.length && (r.famille === 'charc' || saucisson)}
      <div class="carte securite">
        <ShieldAlert size={22} />
        <ul>
          {#each securite as s (s)}<li>{t(s)}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if phases.length}
      <h2 class="titre-section">Phases</h2>
      <ol class="phases">
        {#each phases as p, i (i)}
          {@const m = p.mode ? MODES_PAR_ID.get(p.mode) : undefined}
          <li class:courante={i === lot.phaseCourante && enCours} class:faite={i < lot.phaseCourante} style:--couleur={couleurMode(m)}>
            <strong>{p.nom}</strong>
            <span class="petit discret">
              {m ? `mode ${m.nom}` : NOMS_LIEUX[p.lieu ?? 'cuisine']} · {dureeLisible(p.min_j, p.max_j)} ·
              {debuts.reel[i] ? `depuis le ${dateCourte(debuts.min[i])}` : `prévue vers le ${dateCourte(debuts.min[i])}`}
              {#if lot.phases[i]?.poids} · entrée {nombre(lot.phases[i].poids!)}&nbsp;g{/if}
            </span>
          </li>
        {/each}
      </ol>
      {#if enCours && suivante}
        <div class="carte passage">
          <p><strong>Passer à : {suivante.nom}</strong>{suivante.mode ? ` (mode ${MODES_PAR_ID.get(suivante.mode)?.nom})` : ''}</p>
          {#if !passage.possible && passage.raison}
            <p class:alerte-rouge={ph?.bloque} class:raison={!ph?.bloque}>{passage.raison}</p>
          {:else}
            <label class="ligne-champ">
              <span>Début</span>
              <input class="champ" type="datetime-local" bind:value={quandPhase} />
            </label>
            {#if demandePoids}
              <label class="ligne-champ">
                <span>Poids à l'entrée (g)</span>
                <input class="champ" type="text" inputmode="decimal" bind:value={poidsPhase} placeholder="ex. 1 420" />
              </label>
              <p class="petit discret">La perte de poids se compte depuis ce poids.</p>
            {/if}
            <button class="bouton plein" disabled={!poidsPhaseValide} onclick={passer}>Commencer « {suivante.nom} »</button>
          {/if}
        </div>
        {#if lot.phaseCourante > 0}
          <button class="lien-bouton" onclick={() => lots.revenirPhase(lot.id)}>Revenir à la phase précédente</button>
        {/if}
      {/if}
    {/if}

    {#if reglages.length}
      <h2 class="titre-section">Réglages de la chambre</h2>
      <p class="petit discret resume">{t(r.reglages?.resume)}</p>
      <ol class="reglages">
        {#each reglages as g (g.cle)}
          {@const m = g.etape.mode ? MODES_PAR_ID.get(g.etape.mode) : undefined}
          {@const du = reglagesDus.has(g.cle)}
          {@const garde = garder80(g)}
          <li class="carte" class:du class:fait={!!g.coche} style:--couleur={couleurMode(m)}>
            <p class="quand">
              {g.quand ? quandLisible(g.quand, g.exacte, maintenant) : `Étape « ${g.etape.etape_recette} »`} · {t(g.etape.quand)}
              {#if g.coche}<span class="etiquette">fait</span>{/if}
            </p>
            <h3>{du ? 'Réglage à faire : ' : ''}{t(g.etape.titre)}</h3>
            {#if m}<p class="mode-reglage">Mode {m.nom}{m.ihc_phases.length > 1 && g.etape.ihc_phase !== null ? ` · IHC : ${m.ihc_phases[g.etape.ihc_phase].nom.toLowerCase()}` : ''}</p>{/if}
            {#if g.etape.actions.length}
              <ul>
                {#each g.etape.actions as a (a)}<li>{t(a)}</li>{/each}
              </ul>
            {/if}
            {#if du && m}
              {#if garde}
                <p class="raison">Une autre pièce est entrée en Cave depuis moins de 3 semaines : garde 80 % jusqu'au {dateCourte(garde)}.</p>
              {:else if chambre.actif.id !== m.id}
                <p class="raison">La chambre est en {chambre.actif.mode?.nom ?? 'nettoyage'} : il faut changer de mode.</p>
                <a class="bouton plein" href={lienChambre('changer', m.id)}>Passer en mode {m.nom}</a>
              {:else}
                <p class="petit discret">Même mode ({m.nom}) : rien à changer de mode, vérifie les valeurs.</p>
              {/if}
              <ValeursReglage mode={m.id} phase={g.etape.ihc_phase} />
              {#if !g.entree}
                <button class="bouton secondaire plein fait-bouton" onclick={() => lots.cocher(lot.id, g.cle, { etat: 'ok' })}>C'est réglé</button>
              {:else}
                <p class="petit discret">Se coche tout seul quand tu commences « {phases[g.phase]?.nom} » (plus haut).</p>
              {/if}
            {:else if m}
              <details>
                <summary>Toutes les valeurs</summary>
                <ValeursReglage mode={m.id} phase={g.etape.ihc_phase} />
              </details>
            {/if}
            {#if g.coche && !g.entree}
              <button class="lien-bouton" onclick={() => lots.cocher(lot.id, g.cle, null)}>Annuler</button>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    {#if saucisson || ph?.cible}
      <h2 class="titre-section">pH</h2>
      <div class="carte bloc">
        {#if ph?.cible}
          <p>{ph.cible.valeur === null ? '' : 'Seuil : '}<strong>{t(ph.cible.texte)}</strong></p>
          {#if ph.cible.pret}<p class="petit discret">Prêt : souvent {t(ph.cible.pret)}.</p>{/if}
          {#if ph.cible.note}<p class="petit discret">{t(ph.cible.note)}</p>{/if}
        {/if}
        {#if ph?.message && !ph.bloque && !ph.jeter}<p class:raison={!ph.atteinte} class:atteinte={ph.atteinte}>{ph.message}</p>{/if}
        {#if lot.ph.length}
          <ul class="mesures">
            {#each [...lot.ph].sort((a, b) => a.le.localeCompare(b.le)) as m (m.le)}
              <li>
                <span class:haut={saucisson && m.moment !== 'depart' && m.valeur > PH_SAUCISSON}><strong>pH {nombre(m.valeur, 2)}</strong></span>
                <span class="discret petit">{MOMENTS.find(([v]) => v === m.moment)?.[1] ?? ''} · {dateCourte(m.le)} à {heure(m.le)}</span>
                <button class="bouton-icone" onclick={() => lots.supprimerPh(lot.id, m.le)} aria-label="Supprimer cette mesure"><Trash2 size={16} /></button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if enCours}
          <form class="saisie" onsubmit={mesurer}>
            <input class="champ" type="text" inputmode="decimal" bind:value={valeurPh} placeholder="pH, ex. 5,2" aria-label="pH mesuré" />
            {#if saucisson}
              <select class="champ" bind:value={momentPh} aria-label="Moment de la mesure">
                {#each MOMENTS as [v, l] (v)}<option value={v}>{l}</option>{/each}
              </select>
            {/if}
            <button class="bouton" type="submit" disabled={!(nombreDe(valeurPh) > 0)}>Noter</button>
          </form>
          {#if saucisson && momentPh === '72h' && nombreDe(valeurPh) > PH_SAUCISSON}
            <p class="alerte-rouge">{MESSAGE_PH_BLOQUE}</p>
          {/if}
        {/if}
      </div>
    {/if}

    {#if r.fin.type === 'perte_poids'}
      <h2 class="titre-section">Perte de poids</h2>
      <div class="carte bloc">
        {#if perte}
          <p class="perte">
            <strong>{nombre(perte.pct, 1)}&nbsp;%</strong>
            {#if perte.cible !== undefined} sur {nombre(perte.cible)}&nbsp;% visés{/if}
          </p>
          {#if perte.atteinte}
            <p class="atteinte">✓ Cible atteinte : le lot peut sortir.</p>
          {:else if perte.finEstimee}
            <p>Fin estimée d'après les dernières pesées : <strong>{dateCourte(perte.finEstimee)}</strong></p>
          {:else}
            <p class="petit discret">La fin estimée apparaîtra après deux pesées.</p>
          {/if}
          <CourbePerte {perte} />
          <p class="petit discret">Poids de départ : {nombre(perte.reference.g)}&nbsp;g le {dateCourte(perte.reference.le)}.</p>
        {:else if phases.length}
          <p class="petit discret">Le poids de départ se note en entrant en Cave (phase « {phases.find((p) => p.mode === 'cave')?.nom} »).</p>
        {:else}
          <p class="petit discret">Pas de poids d'entrée noté : la perte ne peut pas se calculer.</p>
        {/if}
        {#if enCours && (perte || !phases.length)}
          <form class="saisie" onsubmit={peser}>
            <input class="champ" type="text" inputmode="decimal" bind:value={poids} placeholder="Poids en g" aria-label="Poids en grammes" />
            <button class="bouton" type="submit" disabled={!(nombreDe(poids) > 0)}>Noter la pesée</button>
          </form>
        {/if}
        {#if lot.pesees.length}
          <ul class="mesures">
            {#each [...lot.pesees].sort((a, b) => b.le.localeCompare(a.le)) as p (p.le)}
              <li>
                <strong>{nombre(p.g)}&nbsp;g</strong>
                <span class="discret petit">{dateCourte(p.le)} à {heure(p.le)}</span>
                <button class="bouton-icone" onclick={() => lots.supprimerPesee(lot.id, p.le)} aria-label="Supprimer cette pesée"><Trash2 size={16} /></button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <h2 class="titre-section">Contrôles</h2>
    {#if dus.length}
      <h3 class="sous-titre a-faire">À faire</h3>
      <ul class="liste">
        {#each dus as o (o.cle)}<LigneControle {lot} occ={o} {maintenant} ouvert />{/each}
      </ul>
    {/if}
    {#if prochains.length}
      <h3 class="sous-titre">À venir</h3>
      <ul class="liste">
        {#each prochains as o (o.cle)}<LigneControle {lot} occ={o} {maintenant} />{/each}
      </ul>
    {:else if !dus.length}
      <p class="petit discret">Plus aucun contrôle prévu.</p>
    {/if}
    {#if faits.length}
      <button class="sous-titre bascule" onclick={() => (faitsOuverts = !faitsOuverts)} aria-expanded={faitsOuverts}>
        Faits ({faits.length}) {faitsOuverts ? '▾' : '▸'}
      </button>
      {#if faitsOuverts}
        <ul class="liste">
          {#each faits as o (o.cle)}<LigneControle {lot} occ={o} {maintenant} />{/each}
        </ul>
      {/if}
    {/if}

    <h2 class="titre-section">Notes</h2>
    <textarea class="champ" rows="3" bind:value={notes} onblur={() => lots.modifierNotes(lot.id, notes)} placeholder="Provenance, poids des pièces, ce que tu changes…"></textarea>

    <a class="lien-recette" href={lienChambre('recette', lot.recetteId)}>
      Recette : {r.nom} · {nombre(lot.quantiteBase)}&nbsp;{r.base.unite} de {r.base.ingredient.toLowerCase()} <ChevronRight size={16} />
    </a>

    {#if enCours}
      {#if !finOuverte}
        <button class="bouton plein terminer" onclick={() => (finOuverte = true)}>Terminer le lot</button>
      {:else}
        <div class="carte bloc fin-lot">
          <h3>Terminer le lot</h3>
          <label class="ligne-champ">
            <span>Fini le</span>
            <input class="champ" type="datetime-local" bind:value={quandFin} />
          </label>
          <p class="petit discret">Conservation :</p>
          <ul class="choix">
            {#each r.conservation as c, i (i)}
              <li>
                <label>
                  <input type="radio" name="conservation" value={i} bind:group={conservation} />
                  <span><strong>{c.mode}</strong> {t(c.comment)} · {t(c.duree)}</span>
                </label>
              </li>
            {/each}
          </ul>
          {#if r.congelation && r.congelation.possible !== 'oui'}
            <p class="petit discret">Congélateur : {r.congelation.possible === 'non' ? 'non' : 'inutile'} — {t(r.congelation.texte)}</p>
          {/if}
          <label class="ligne-champ">
            <span>Quantité</span>
            <input class="champ" type="text" bind:value={quantite} placeholder="ex. 1,2 kg, 6 pièces" />
          </label>
          <button class="bouton plein" onclick={() => terminer(false)}>Mettre en stock</button>
          <button class="bouton secondaire plein" onclick={() => terminer(true)}>Raté, ou jeté</button>
          <button class="lien-bouton" onclick={() => (finOuverte = false)}>Annuler</button>
        </div>
      {/if}
    {/if}
    <button class="bouton secondaire plein supprimer" onclick={supprimer}><Trash2 size={18} /> Supprimer le lot</button>
  </article>
  <FeuilleRappels
    bind:ouvert={feuilleRappels}
    titre="Rappels dans le Calendrier"
    sousTitre={lot.nom}
    evenements={rappels}
    {nomFichier}
    sequence={sequenceDuLot(lot)}
    {maintenant}
  />
{/if}

<style>
  .surtitre {
    margin: 4px 0 2px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 30px;
    line-height: 1.12;
    margin-bottom: 12px;
  }

  .etat {
    padding: 12px 14px;
    border-left: 5px solid var(--couleur);
  }

  .etat p {
    margin: 0;
  }

  .jour {
    font-size: 20px;
    font-weight: 700;
  }

  .ou a {
    color: var(--couleur);
    font-weight: 600;
  }

  .fin {
    margin-top: 4px !important;
  }

  .etat .bouton {
    margin-top: 10px;
  }

  .rappels {
    min-height: 40px;
    padding: 0 14px;
    font-size: 15px;
  }

  .securite {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    margin-top: 12px;
    border-left: 5px solid var(--rouge);
    font-size: 15px;
  }

  .securite :global(svg) {
    flex: none;
    color: var(--rouge);
  }

  .securite ul {
    margin: 0;
    padding-left: 1.1em;
  }

  .alerte-rouge {
    margin: 12px 0 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--rouge);
    color: var(--surface);
    font-weight: 700;
    font-size: 17px;
  }

  .raison {
    color: var(--ambre);
    font-weight: 600;
  }

  .atteinte {
    color: var(--vert);
    font-weight: 600;
  }

  .resume {
    margin: -4px 4px 10px;
  }

  .reglages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .reglages > li {
    padding: 12px 14px;
    border-left: 5px solid var(--couleur, var(--surface-3));
  }

  .reglages > li.du {
    box-shadow: 0 0 0 2px var(--accent), var(--ombre);
  }

  .reglages > li.fait {
    opacity: 0.75;
  }

  .reglages .quand {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  .reglages h3 {
    font-size: 17px;
    margin: 2px 0 4px;
  }

  .reglages ul {
    margin: 4px 0 8px;
    padding-left: 1.1em;
  }

  .mode-reglage {
    margin: 0;
    font-size: 15px;
    color: var(--couleur);
    font-weight: 600;
  }

  .reglages details summary {
    min-height: 36px;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }

  .fait-bouton {
    margin-top: 10px;
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 21px;
    margin: 26px 0 10px;
  }

  .phases {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .phases li {
    display: flex;
    flex-direction: column;
    padding: 6px 0 6px 12px;
    border-left: 4px solid var(--surface-3);
  }

  .phases li.courante {
    border-left-color: var(--couleur);
  }

  .phases li.faite strong {
    color: var(--texte-3);
  }

  .passage {
    margin-top: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .passage p {
    margin: 0;
  }

  .ligne-champ {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .ligne-champ input {
    width: auto;
    max-width: 62%;
  }

  .lien-bouton {
    border: none;
    background: none;
    color: var(--accent);
    padding: 8px 4px;
    font-size: 15px;
  }

  .bloc {
    padding: 12px 14px;
  }

  .bloc p {
    margin: 0 0 8px;
  }

  .mesures {
    list-style: none;
    margin: 8px 0;
    padding: 0;
  }

  .mesures li {
    display: flex;
    align-items: center;
    gap: 10px;
    border-top: 0.5px solid var(--trait);
    padding: 2px 0;
  }

  .mesures li > :nth-child(2) {
    flex: 1;
  }

  .mesures :global(.bouton-icone) {
    color: var(--texte-3);
  }

  .haut {
    color: var(--rouge);
  }

  .saisie {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .saisie input {
    flex: 1;
    min-width: 0;
  }

  .saisie select {
    width: auto;
  }

  .saisie .bouton {
    padding: 0 14px;
  }

  .perte {
    font-size: 17px;
  }

  .perte strong {
    font-size: 26px;
  }

  .atteinte {
    color: var(--vert);
    font-weight: 700;
  }

  .sous-titre {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin: 14px 4px 8px;
  }

  .sous-titre.a-faire {
    color: var(--accent);
  }

  .bascule {
    display: block;
    border: none;
    background: none;
    padding: 8px 0;
    min-height: 44px;
  }

  textarea {
    resize: vertical;
  }

  .lien-recette {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin: 16px 0;
    font-weight: 600;
    text-decoration: none;
  }

  .terminer {
    margin-bottom: 10px;
  }

  .fin-lot {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
  }

  .fin-lot h3 {
    font-size: 18px;
  }

  .choix {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .choix label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
  }

  .choix input {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 2px 0 0;
    accent-color: var(--accent);
  }

  .supprimer {
    color: var(--rouge);
  }
</style>
