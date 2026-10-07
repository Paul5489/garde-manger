<script lang="ts">
  // Fiche d'une recette de la chambre : en-tête, matériel à cocher, calculateur, étapes, contrôles
  // (technique puis recette), conservation, sécurité, notes, recettes liées.
  import { ChevronRight, ShieldAlert, Star } from '@lucide/svelte';
  import { nombre } from '../../lib/format';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { couleurMode, t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, MODES_PAR_ID, NOMS_FAMILLES, NOMS_LIEUX, recette } from '../donnees';
  import {
    calculer,
    cibleDuPh,
    controlesDeLaRecette,
    DIFFICULTES,
    dureeLisible,
    libelleJour,
    libelleRepetition,
    NomMois,
    saison,
  } from '../recettes';

  let { id }: { id: string } = $props();

  const r = $derived(recette(id));
  const technique = $derived(r?.technique ? CONTENU.techniques[r.technique] : undefined);
  const mode = $derived(r?.mode ? MODES_PAR_ID.get(r.mode) : undefined);
  const controles = $derived(r ? controlesDeLaRecette(r) : []);
  const ph = $derived(r ? cibleDuPh(r) : undefined);
  const securite = $derived([...(technique?.securite ?? []), ...(r?.securite ?? [])]);
  // Charcuterie sans nitrite : les règles de sécurité tout en haut de la fiche.
  const securiteEnHaut = $derived(r?.famille === 'charc');

  // Calculateur : poids réel de la base.
  let saisie = $state('');
  const quantite = $derived(Number(saisie.replace(',', '.').replace(/\s/g, '')) || r?.base.quantite || 0);
  const lignes = $derived(r ? calculer(r, quantite) : []);
  const ajuste = $derived(!!r && quantite !== r.base.quantite);

  const coches = $derived(chambre.materielFiches[id] ?? []);
  const FINS: Record<string, string> = {
    aspect: 'À l’aspect',
    gout: 'Au goût',
    odeur: 'À l’odeur',
    temps: 'Au temps',
    ph: 'Au pH',
    perte_poids: 'À la perte de poids',
    temperature_coeur: 'À la température à cœur',
  };
</script>

{#snippet blocSecurite()}
  <h2 class="titre-section">Sécurité</h2>
  <div class="carte securite">
    <ShieldAlert size={22} />
    <ul>
      {#each securite as s (s)}<li>{t(s)}</li>{/each}
    </ul>
  </div>
{/snippet}

{#if !r}
  <p class="vide">Cette recette n'existe pas.</p>
{:else}
  <article class="contenu" style:--couleur={couleurMode(mode)}>
    <p class="surtitre">{NOMS_FAMILLES[r.famille]}</p>
    <h1 class="titre-serif">{r.nom}</h1>

    <dl class="carte entete">
      <dt>Saison</dt>
      <dd>{saison(r)}</dd>
      <dt>Où</dt>
      <dd>
        {NOMS_LIEUX[r.lieu]}{#if mode}{' · '}<a href={lienChambre('mode', mode.id)} class="mode">mode {mode.nom}</a>{/if}
      </dd>
      <dt>Durée</dt>
      <dd>{dureeLisible(r.duree.min_j, r.duree.max_j)}</dd>
      <dt>Difficulté</dt>
      <dd>{DIFFICULTES[r.difficulte] ?? ''} <span class="discret" aria-hidden="true">{'★'.repeat(r.difficulte)}{'☆'.repeat(3 - r.difficulte)}</span></dd>
      <dt>Rendement</dt>
      <dd>{t(r.rendement)}</dd>
      <dt>Fin</dt>
      <dd>
        {t(r.fin.cible !== undefined && r.fin.type === 'perte_poids' ? `${FINS[r.fin.type]} : ${nombre(r.fin.cible)} %` : FINS[r.fin.type])}<span class="sous"
          >{t(r.fin.texte)}</span
        >
      </dd>
      {#if ph}
        <dt>pH</dt>
        <dd>{ph.texte}</dd>
      {/if}
    </dl>

    {#if r.phases?.length}
      <ol class="phases">
        {#each r.phases as p, i (i)}
          {@const m = p.mode ? MODES_PAR_ID.get(p.mode) : undefined}
          <li style:--couleur={couleurMode(m)}>
            <strong>{p.nom}</strong>
            <span class="discret petit">{m ? `mode ${m.nom}` : NOMS_LIEUX[p.lieu ?? 'cuisine']} · {dureeLisible(p.min_j, p.max_j)}</span>
          </li>
        {/each}
      </ol>
    {/if}

    {#if r.mois?.length}
      <div class="etoiles">
        <span class="petit discret">Prévue en :</span>
        {#each r.mois as m (m)}
          {@const prevue = chambre.estPrevue(r.id, m)}
          <button class="puce" class:active={prevue} aria-pressed={prevue} onclick={() => chambre.basculerEtoile(r.id, m)}>
            <Star size={15} fill={prevue ? 'currentColor' : 'none'} />
            {NomMois(m)}
          </button>
        {/each}
      </div>
    {/if}

    {#if securite.length && securiteEnHaut}
      {@render blocSecurite()}
    {/if}

    <h2 class="titre-section">Matériel</h2>
    <ul class="liste cases">
      {#each r.materiel as m (m)}
        <li>
          <label>
            <input type="checkbox" checked={coches.includes(m)} onchange={(e) => chambre.cocherMaterielFiche(r.id, m, e.currentTarget.checked)} />
            <span>{t(m)}</span>
          </label>
        </li>
      {/each}
    </ul>

    <h2 class="titre-section">Ingrédients</h2>
    <label class="carte calculateur">
      <span>
        <strong>{t(r.base.ingredient)}</strong>
        <span class="petit discret">Pèse-le, puis saisis son poids : tout se recalcule.</span>
      </span>
      <span class="saisie">
        <input
          class="champ"
          type="text"
          inputmode="decimal"
          placeholder={nombre(r.base.quantite)}
          bind:value={saisie}
          aria-label="Quantité de {r.base.ingredient} en {r.base.unite}"
        />
        <span>{r.base.unite}</span>
      </span>
    </label>
    {#if ajuste}
      <p class="petit discret ajuste">
        Pour {nombre(quantite)}&nbsp;{r.base.unite} au lieu de {nombre(r.base.quantite)} : ×{nombre(quantite / r.base.quantite, 2)}.
        <button class="lien-bouton" onclick={() => (saisie = '')}>Revenir à la recette</button>
      </p>
    {/if}
    <ul class="liste ingredients">
      {#each lignes as l, i (i)}
        <li>
          <span class="qte" class:environ={l.environ}>{l.quantite}</span>
          <span>{t(l.nom)}{#if l.note}<span class="sous">{t(l.note)}</span>{/if}</span>
        </li>
      {/each}
    </ul>

    <h2 class="titre-section">Étapes</h2>
    <ol class="etapes">
      {#each r.etapes as e, i (i)}
        <li>
          <span class="num" aria-hidden="true">{i + 1}</span>
          <div>
            <strong>{e.titre}</strong>{#if e.duree}<span class="etiquette">{t(e.duree)}</span>{/if}
            <p>{t(e.texte)}</p>
          </div>
        </li>
      {/each}
    </ol>

    {#if controles.length}
      <h2 class="titre-section">Contrôles</h2>
      {#each controles as c, i (i)}
        {#if c.ancre === 'cave' && (i === 0 || controles[i - 1].ancre !== 'cave')}
          <p class="depuis-cave">Depuis l'entrée en Cave :</p>
        {/if}
        <div class="carte controle">
          <p class="quand">
            {libelleJour(c.controle.j)}{#if c.controle.repeter_j}, puis {libelleRepetition(c.controle)}{/if}
            {#if c.source === 'technique'}<span class="etiquette">technique</span>{/if}
          </p>
          <h3>{t(c.controle.titre)}</h3>
          <dl>
            <dt>Observer</dt>
            <dd>{t(c.controle.observer)}</dd>
            <dt>Normal</dt>
            <dd>{t(c.controle.normal)}</dd>
            {#if c.controle.probleme}
              <dt>Problème</dt>
              <dd>{t(c.controle.probleme)}</dd>
            {/if}
            <dt>Que faire</dt>
            <dd>{t(c.controle.action)}</dd>
          </dl>
        </div>
      {/each}
    {/if}

    <h2 class="titre-section">Conservation</h2>
    <ul class="liste lignes">
      {#each r.conservation as c, i (i)}
        <li><span><strong>{c.mode}</strong> <span class="discret">{t(c.comment)}</span></span><span>{t(c.duree)}</span></li>
      {/each}
    </ul>

    {#if securite.length && !securiteEnHaut}
      {@render blocSecurite()}
    {/if}

    {#if technique}
      <details class="carte technique">
        <summary><strong>Technique : {technique.nom}</strong></summary>
        <p>{t(technique.principe)}</p>
        {#if technique.conseils.length}
          <ul>
            {#each technique.conseils as c (c)}<li>{t(c)}</li>{/each}
          </ul>
        {/if}
      </details>
    {/if}

    {#if r.notes}
      <h2 class="titre-section">Notes</h2>
      <p class="carte bloc">{t(r.notes)}</p>
    {/if}

    {#if r.liens?.length}
      <h2 class="titre-section">Recettes liées</h2>
      <ul class="liste liens">
        {#each r.liens as l (l)}
          {@const x = recette(l)}
          {#if x}
            <li><a href={lienChambre('recette', x.id)}><span>{x.nom}</span><ChevronRight size={18} /></a></li>
          {/if}
        {/each}
      </ul>
    {/if}
  </article>
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

  .entete {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 14px;
    margin: 0;
    padding: 12px 14px;
    border-left: 5px solid var(--couleur);
    font-size: 15px;
  }

  .entete dt {
    color: var(--texte-2);
  }

  .entete dd {
    margin: 0;
    font-weight: 600;
  }

  .mode {
    color: var(--couleur);
  }

  .sous {
    display: block;
    font-weight: 400;
    color: var(--texte-2);
    font-size: 14px;
  }

  .phases {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: flex;
    gap: 6px;
  }

  .phases li {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface);
    border-top: 4px solid var(--couleur);
    box-shadow: var(--ombre);
    font-size: 15px;
  }

  .etoiles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
  }

  .etoiles .active {
    background: var(--ambre-doux);
    border-color: var(--ambre);
    color: var(--ambre);
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 21px;
    margin: 26px 0 10px;
  }

  .cases label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 11px 14px;
  }

  .cases input {
    flex: none;
    width: 22px;
    height: 22px;
    margin: 0;
    accent-color: var(--vert);
  }

  .calculateur {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }

  .calculateur > span:first-child {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .saisie {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .saisie input {
    width: 96px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ajuste {
    margin: 8px 4px 0;
  }

  .lien-bouton {
    border: none;
    background: none;
    color: var(--accent);
    padding: 0;
    font-size: inherit;
    text-decoration: underline;
  }

  .ingredients {
    margin-top: 10px;
  }

  .ingredients li {
    display: grid;
    grid-template-columns: minmax(84px, auto) 1fr;
    gap: 12px;
    padding: 10px 14px;
  }

  .qte {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: right;
  }

  .qte.environ {
    white-space: normal;
  }

  .etapes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .etapes li {
    display: flex;
    gap: 12px;
  }

  .num {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--accent-doux);
    color: var(--accent);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .etapes p {
    margin: 2px 0 0;
  }

  .etapes .etiquette {
    margin-left: 8px;
  }

  .depuis-cave {
    margin: 16px 4px 8px;
    font-weight: 600;
    color: var(--m-cave);
  }

  .controle {
    padding: 12px 14px;
    margin-bottom: 10px;
  }

  .quand {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }

  .quand .etiquette {
    margin-left: 6px;
  }

  .controle h3 {
    font-size: 17px;
    margin: 2px 0 6px;
  }

  .controle dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: 15px;
  }

  .controle dt {
    color: var(--texte-2);
  }

  .controle dd {
    margin: 0;
  }

  .lignes li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
  }

  .lignes li > span:last-child {
    flex: none;
    font-weight: 600;
  }

  .securite {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    border-left: 5px solid var(--rouge);
  }

  .securite :global(svg) {
    flex: none;
    color: var(--rouge);
  }

  .securite ul {
    margin: 0;
    padding-left: 1.1em;
  }

  .securite li + li {
    margin-top: 6px;
  }

  .technique {
    margin-top: 14px;
    padding: 12px 14px;
  }

  .technique summary {
    cursor: pointer;
    min-height: 32px;
  }

  .technique ul {
    padding-left: 1.2em;
    margin: 6px 0 0;
  }

  .bloc {
    padding: 12px 14px;
    margin: 0;
  }

  .liens a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 50px;
    padding: 0 14px;
    color: inherit;
    text-decoration: none;
  }

  .liens :global(svg) {
    color: var(--texte-3);
  }
</style>
