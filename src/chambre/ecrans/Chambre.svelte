<script lang="ts">
  // Onglet Chambre : le mode actif, ce qu'il y a à faire aujourd'hui, et l'accès à tout le reste
  // (réglages de la chambre, bocaux…). L'appli ne pilote rien : ce sont les Inkbird qui régulent.
  import {
    Archive,
    BookOpen,
    CalendarDays,
    Check,
    ChevronRight,
    CircleAlert,
    FlaskConical,
    Settings2,
    ShoppingBag,
    Wrench,
  } from '@lucide/svelte';
  import IconeBocal from '../../composants/IconeBocal.svelte';
  import { etatEtape, libelleAvancement } from '../../lib/bocaux';
  import { bocaux } from '../../lib/bocaux.svelte';
  import { dateCourte, pluriel } from '../../lib/format';
  import { lienBocal, lienChambre, routeur } from '../../lib/routeur.svelte';
  import { ecrireLocal, lireLocal } from '../../lib/stockage-local';
  import { couleurMode, quandLisible, t } from '../affichage';
  import { finPrevue } from '../lots';
  import { lots } from '../lots.svelte';
  import { modeAvant, prochainsChangements } from '../calendrier';
  import { chambre, estFacultative } from '../chambre.svelte';
  import { CONTENU, mode as modeParId } from '../donnees';
  import { joursCalendaires } from '../temps';
  import type { EtatTache, Tache } from '../taches';
  import CarteMode from '../composants/CarteMode.svelte';

  const actif = $derived(chambre.actif);
  const etapesRequises = CONTENU.modes.mise_en_service.filter((e) => !estFacultative(e.titre));
  const faitesMes = $derived(etapesRequises.filter((e) => chambre.miseEnService.includes(e.titre)).length);

  // Proposée au premier passage sur l'onglet (une seule fois).
  $effect(() => {
    if (!chambre.charge || chambre.miseEnServiceFaite || chambre.miseEnService.length) return;
    if (lireLocal('chambre-mise-en-service-proposee', false)) return;
    ecrireLocal('chambre-mise-en-service-proposee', true);
    routeur.aller(lienChambre('mise-en-service'));
  });

  const TACHES: Record<Tache, { titre: string; lien?: string }> = {
    reservoir: { titre: 'Vider le réservoir du déshumidificateur' },
    verification: { titre: 'Vérification de la semaine', lien: lienChambre('infos', 'verification') },
    calibrage: { titre: 'Calibrage annuel des sondes', lien: lienChambre('infos', 'calibrage') },
    'etalonnage-ph': { titre: 'Étalonner le pH-mètre', lien: lienChambre('infos', 'ph-metre') },
  };

  function detail(e: EtatTache): string {
    if (e.tache === 'reservoir') return e.rythme === 1 ? 'Chaque jour dans ce mode' : `Tous les ${e.rythme} jours dans ce mode`;
    if (e.tache === 'etalonnage-ph') return 'Au moins une fois par mois, et avant chaque séance de saucissons';
    if (e.tache === 'calibrage') return 'Une fois par an';
    return 'Courbes, réservoir, glace, ventilateur, bruit du frigo';
  }

  const dues = $derived(chambre.taches.filter((e) => e.due));
  const aGouter = $derived(bocaux.parRubrique['a-gouter']);
  const prets = $derived(bocaux.parRubrique.prets);
  const enCours = $derived(bocaux.parRubrique['en-cours']);

  const changement = $derived(chambre.changementAFaire ? actif : null);
  const suivant = $derived(prochainsChangements(chambre.maintenant, 1)[0]);
  const versSuivant = $derived(suivant && suivant.vers !== 'nettoyage' ? modeParId(suivant.vers) : undefined);

  const actionsLots = $derived(chambre.actionsLots);
  // Sauvegarde : une fois par mois (pas de synchronisation, tout est dans le téléphone).
  const sauvegardeDue = $derived(chambre.sauvegardeDue);
  // Bientôt : lots qui finissent dans la semaine, produits à finir.
  const finissent = $derived(
    lots.enCours
      .map((l) => ({ l, fin: finPrevue(l).min }))
      .filter(({ l, fin }) => joursCalendaires(chambre.maintenant, fin) > 0 && joursCalendaires(chambre.maintenant, fin) <= 7 && !actionsLots.some((a) => a.lot.id === l.id && a.type === 'fin')),
  );

  const rien = $derived(!dues.length && !changement && !aGouter.length && !prets.length && !actionsLots.length && !sauvegardeDue);

  /** La chambre reste dans le mode d'avant au calendrier, jusqu'à ce que l'assistant soit suivi. */
  function pasEncore() {
    void chambre.changerDeMode(modeAvant(chambre.maintenant));
  }
</script>

<div class="grand-titre">
  <h1>Chambre</h1>
  <a class="bouton-icone" href={lienChambre('reglages')} aria-label="Réglages de la chambre"><Settings2 size={24} /></a>
</div>

<div class="contenu">
  {#if chambre.verification.erreurs.length}
    <div class="carte alerte" role="alert">
      <p><strong>Les données de la chambre ont un problème :</strong></p>
      <ul>
        {#each chambre.verification.erreurs.slice(0, 5) as e (e)}<li>{e}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if chambre.charge && !chambre.miseEnServiceFaite}
    <a class="carte mise-en-service" href={lienChambre('mise-en-service')}>
      <Wrench size={22} />
      <span class="texte">
        <strong>Mise en service</strong>
        <span class="petit discret">À faire avant le premier koji · {faitesMes} sur {etapesRequises.length}</span>
      </span>
      <ChevronRight size={18} class="chevron" />
    </a>
  {/if}

  <CarteMode {actif} debutVague={chambre.debutVague} maintenant={chambre.maintenant} />
  <div class="boutons-mode">
    <a class="bouton secondaire" href={lienChambre('changer')}>Changer de mode</a>
    {#if actif.manuel}
      <button class="bouton secondaire" onclick={() => chambre.suivreLeCalendrier()}>Suivre le calendrier</button>
    {/if}
  </div>

  <h2 class="section-titre">Aujourd'hui</h2>
  {#if rien}
    <p class="carte calme">Rien à faire aujourd'hui. ✓</p>
  {:else}
    <ul class="liste actions">
      {#if changement}
        <li class="changement" style:--couleur={couleurMode(actif.mode ?? (actif.apres ? modeParId(actif.apres) : undefined))}>
          <a href={lienChambre('changer', actif.mode?.id ?? actif.apres ?? '')}>
            <span class="pictogramme" aria-hidden="true">🔁</span>
            <span class="texte">
              {#if actif.mode}
                <span>Passer en mode <strong>{actif.mode.nom}</strong></span>
                <span class="petit discret">Prévu au calendrier le {dateCourte(actif.depuis)} · l'assistant te guide</span>
              {:else}
                <strong>Jour de nettoyage</strong>
                <span class="petit discret">Puis mode {actif.apres ? modeParId(actif.apres).nom : ''}</span>
              {/if}
            </span>
            <ChevronRight size={18} class="chevron" />
          </a>
          {#if actif.mode}
            <button class="pas-encore petit" onclick={pasEncore}>Pas encore : la chambre reste dans le mode d'avant</button>
          {/if}
        </li>
      {/if}
      {#each actionsLots as a, i (`${a.lot.id}-${a.type}-${a.occ?.cle ?? i}`)}
        <li class:bloque={a.type === 'bloque'}>
          <a href={lienChambre('lot', a.lot.id)}>
            <span class="pictogramme" aria-hidden="true">{a.type === 'bloque' ? '⛔' : a.type === 'phase' ? '➡️' : a.type === 'fin' ? '🏁' : a.occ?.type === 'pesee' ? '⚖️' : a.occ?.type === 'ph' ? '🧪' : '👀'}</span>
            <span class="texte">
              {#if a.type === 'bloque'}
                <span><strong>{a.lot.nom}</strong> : ne pas sécher</span>
                <span class="petit">Cuire en saucisses fraîches dans les 24 h, ou jeter.</span>
              {:else if a.type === 'phase'}
                <span>{a.lot.nom} : commencer <strong>{a.phase}</strong></span>
                <span class="petit discret">Prévu à partir d'aujourd'hui</span>
              {:else if a.type === 'fin'}
                <span>{a.lot.nom} : <strong>fin du lot</strong></span>
                <span class="petit discret">{t(a.lot.recette.fin.texte)}</span>
              {:else if a.occ}
                <span>{a.lot.nom} : <strong>{t(a.occ.controle.titre)}</strong></span>
                <span class="petit discret">{quandLisible(a.occ.quand, a.occ.exacte, chambre.maintenant)}</span>
              {/if}
            </span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#each dues as e (e.tache)}
        <li class="tache">
          {#if TACHES[e.tache].lien}
            <a href={TACHES[e.tache].lien}>
              <span class="texte"><strong>{TACHES[e.tache].titre}</strong><span class="petit discret">{detail(e)}</span></span>
              <ChevronRight size={18} class="chevron" />
            </a>
          {:else}
            <span class="texte"
              ><strong>{TACHES[e.tache].titre}</strong><span class="petit discret"
                >{detail(e)}{#if actif.mode && e.tache === 'reservoir'} · {t(actif.mode.reservoir.texte)}{/if}</span
              ></span
            >
          {/if}
          <button class="fait" onclick={() => chambre.fait(e.tache)} aria-label="{TACHES[e.tache].titre} : fait"><Check size={20} /> Fait</button>
        </li>
      {/each}
      {#if sauvegardeDue}
        <li>
          <a href="#/reglages/donnees">
            <span class="pictogramme" aria-hidden="true">💾</span>
            <span class="texte"
              ><span><strong>Sauvegarder mes données</strong></span><span class="petit discret"
                >Une fois par mois : tes lots, bocaux et réglages ne sont que dans ce téléphone</span
              ></span
            >
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/if}
      {#each aGouter as b (b.id)}
        <li>
          <a href={lienBocal(b.id)}>
            <span class="pictogramme" aria-hidden="true">👅</span>
            <span class="texte"><span>Goûter : <strong>{b.nom}</strong></span> <span class="petit discret">{libelleAvancement(etatEtape(b, bocaux.maintenant))}</span></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#each prets as b (b.id)}
        <li>
          <a href={lienBocal(b.id)}>
            <span class="pictogramme" aria-hidden="true">✅</span>
            <span class="texte"><span>Prêt : <strong>{b.nom}</strong></span></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  {#if suivant || finissent.length || chambre.stockAFinir.length}
    <h2 class="section-titre">Bientôt</h2>
    <ul class="liste actions">
      {#each finissent as { l, fin } (l.id)}
        <li>
          <a href={lienChambre('lot', l.id)}>
            <span class="pictogramme" aria-hidden="true">🏁</span>
            <span class="texte"><span>{l.nom} : <strong>fin</strong></span><span class="petit discret">À partir du {dateCourte(fin)}</span></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#each chambre.stockAFinir as a (a.id)}
        <li>
          <a href={lienChambre('stock')}>
            <span class="pictogramme" aria-hidden="true">📦</span>
            <span class="texte"><span>À finir : <strong>{a.nom}</strong></span><span class="petit discret">{a.limite ? `Avant le ${dateCourte(a.limite)}` : ''}</span></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#if suivant}<li>
        <a href={versSuivant ? lienChambre('mode', versSuivant.id) : lienChambre('reglages')}>
          <span class="pastille-mode" style:--couleur={couleurMode(versSuivant)} aria-hidden="true"></span>
          <span class="texte">
            <span>{#if versSuivant}Mode <strong>{versSuivant.nom}</strong>{:else}<strong>{suivant.segment.nom}</strong>{/if}</span>
            <span class="petit discret">
              Le {dateCourte(suivant.le)} · dans {pluriel(joursCalendaires(chambre.maintenant, suivant.le), 'jour')}
            </span>
          </span>
          <ChevronRight size={18} class="chevron" />
        </a>
      </li>{/if}
    </ul>
  {/if}

  <h2 class="section-titre">La chambre</h2>
  <div class="tuiles">
    <a class="carte tuile" href={lienChambre('lots')}>
      <FlaskConical size={26} />
      <strong>Mes lots</strong>
      <span class="petit discret">{lots.enCours.length ? pluriel(lots.enCours.length, 'en cours', 'en cours') : 'Aucun en cours'}</span>
    </a>
    <a class="carte tuile" href={lienChambre('stock')}>
      <Archive size={26} />
      <strong>Stock</strong>
      <span class="petit discret">{pluriel(lots.stock.filter((a) => a.statut === 'en-stock').length, 'produit')}</span>
    </a>
    <a class="carte tuile" href={lienChambre('calendrier')}>
      <CalendarDays size={26} />
      <strong>Calendrier</strong>
      <span class="petit discret">Modes, rendez-vous, recettes de saison</span>
    </a>
    <a class="carte tuile" href={lienChambre('recettes')}>
      <BookOpen size={26} />
      <strong>Recettes</strong>
      <span class="petit discret">{CONTENU.recettes.length} recettes, avec calculateur</span>
    </a>
    <a class="carte tuile" href={lienChambre('materiel')}>
      <ShoppingBag size={26} />
      <strong>Matériel</strong>
      <span class="petit discret">À acheter, par échéance</span>
    </a>
    <a class="carte tuile" href={lienChambre('reglages')}>
      <Settings2 size={26} />
      <strong>Réglages</strong>
      <span class="petit discret">7 modes, mise en service, matériel</span>
    </a>
    <a class="carte tuile" href={lienChambre('bocaux')}>
      <IconeBocal size={26} />
      <strong>Mes bocaux</strong>
      <span class="petit discret">{enCours.length + aGouter.length + prets.length ? pluriel(enCours.length + aGouter.length + prets.length, 'en cours', 'en cours') : 'Aucun en cours'}</span>
    </a>
  </div>

  {#if chambre.verification.avertissements.length}
    <p class="discret petit avertissements"><CircleAlert size={14} /> {chambre.verification.avertissements.join(' · ')}</p>
  {/if}
</div>

<style>
  .alerte {
    padding: 12px 14px;
    border-left: 5px solid var(--rouge);
    margin-bottom: 12px;
    font-size: 15px;
  }

  .alerte p,
  .alerte ul {
    margin: 0;
  }

  .mise-en-service {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 40px 14px 14px;
    margin-bottom: 12px;
    color: inherit;
    text-decoration: none;
    border-left: 5px solid var(--ambre);
  }

  .mise-en-service :global(svg:first-child) {
    color: var(--ambre);
    flex: none;
  }

  .boutons-mode {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .boutons-mode > * {
    flex: 1;
    padding: 0 12px;
  }

  .calme {
    padding: 14px;
    margin: 0;
    color: var(--texte-2);
  }

  .texte {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .actions li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .actions a {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 54px;
    padding: 10px 36px 10px 14px;
    color: inherit;
    text-decoration: none;
  }

  .actions a:active {
    background: var(--surface-2);
  }

  :global(.chevron) {
    color: var(--texte-3);
  }

  .actions a :global(.chevron),
  .mise-en-service :global(.chevron) {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }

  .tache > .texte {
    padding: 10px 14px;
  }

  .tache a {
    padding-right: 30px;
  }

  .fait {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin: 0 10px 0 4px;
    padding: 0 12px;
    border: none;
    border-radius: 22px;
    background: var(--vert-doux);
    color: var(--vert);
    font-weight: 600;
  }

  .changement {
    border-left: 5px solid var(--couleur);
  }

  .bloque {
    border-left: 5px solid var(--rouge);
  }

  .bloque .petit {
    color: var(--rouge);
    font-weight: 600;
  }

  .pas-encore {
    flex-basis: 100%;
    text-align: left;
    border: none;
    background: none;
    color: var(--accent);
    padding: 0 14px 12px 50px;
    min-height: 32px;
  }

  .pictogramme {
    flex: none;
    width: 24px;
    text-align: center;
    font-size: 20px;
  }

  .pastille-mode {
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0 5px;
    border-radius: 7px;
    background: var(--couleur);
  }

  .tuiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tuile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px;
    min-height: 112px;
    color: inherit;
    text-decoration: none;
  }

  .tuile :global(svg) {
    color: var(--accent);
    margin-bottom: 4px;
  }

  .tuile:active {
    background: var(--surface-2);
  }

  .avertissements {
    margin-top: 20px;
  }
</style>
