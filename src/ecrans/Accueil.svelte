<script lang="ts">
  // Accueil « par type de plat » (choix de Paul, 06/10/2026) : ce qui m'attend aujourd'hui,
  // « Que veux-tu cuisiner ? » (toutes sources mélangées), mes favoris et ce que j'ai cuisiné récemment.
  import { ChevronRight, Search, Settings } from '@lucide/svelte';
  import AideInstallation from '../composants/AideInstallation.svelte';
  import Bandeau from '../composants/Bandeau.svelte';
  import { UNIVERS } from '../lib/archive';
  import { etatEtape, libelleAvancement } from '../lib/bocaux';
  import { bocaux } from '../lib/bocaux.svelte';
  import { courses } from '../lib/courses.svelte';
  import { etat } from '../lib/etat.svelte';
  import { nombre, pluriel } from '../lib/format';
  import { perso } from '../lib/perso.svelte';
  import { recherche } from '../lib/recherche.svelte';
  import { lienBocal, routeur } from '../lib/routeur.svelte';
  import { rubriqueDe, RUBRIQUES, type Rubrique } from '../lib/rubriques';
  import type { Resume, Univers } from '../lib/types';

  // Nombre de fiches par type de plat et par origine.
  const parRubrique = $derived.by(() => {
    const c = new Map<Rubrique, number>();
    for (const r of etat.catalogue) c.set(rubriqueDe(r), (c.get(rubriqueDe(r)) ?? 0) + 1);
    return c;
  });
  const parUnivers = $derived.by(() => {
    const c = new Map<Univers, number>();
    for (const r of etat.catalogue) for (const u of r.univers) c.set(u, (c.get(u) ?? 0) + 1);
    return c;
  });
  const tuiles = $derived(RUBRIQUES.filter((r) => r.id === 'techniques' || (parRubrique.get(r.id) ?? 0) > 0));

  const favoris = $derived(perso.idsFavoris.map((id) => etat.parId.get(id)).filter((r): r is Resume => !!r));
  const recents = $derived(
    perso.idsCuisines
      .map((id) => etat.parId.get(id))
      .filter((r): r is Resume => !!r)
      .slice(0, 10),
  );

  // « Aujourd'hui » : bocaux à goûter ou prêts, bocaux en cours, courses à faire.
  const aGouter = $derived(bocaux.parRubrique['a-gouter']);
  const prets = $derived(bocaux.parRubrique.prets);
  const enCours = $derived(bocaux.parRubrique['en-cours']);
  const rienAujourdhui = $derived(!aGouter.length && !prets.length && !enCours.length && !courses.restants.length);

  function ouvrirRubrique(r: Rubrique) {
    recherche.ouvrirRubrique(r);
    routeur.ouvrirOnglet('recherche');
  }

  function ouvrirUnivers(u: Univers) {
    recherche.ouvrirUnivers(u);
    routeur.ouvrirOnglet('recherche');
  }

  function toutVoirFavoris() {
    recherche.ouvrirFavoris();
    routeur.ouvrirOnglet('recherche');
  }

  function chercher() {
    // Le champ de l'accueil cherche dans toutes les fiches : on retire les filtres d'une visite précédente.
    recherche.effacerFiltres();
    routeur.ouvrirOnglet('recherche');
    requestAnimationFrame(() => document.getElementById('champ-recherche')?.focus());
  }
</script>

<div class="grand-titre">
  <h1>Garde-manger</h1>
  <a class="bouton-icone" href="#/reglages" aria-label="Réglages"><Settings size={24} /></a>
</div>

<div class="contenu">
  <AideInstallation />
  <button class="faux-champ" onclick={chercher}>
    <Search size={19} />
    Rechercher une recette, un ingrédient…
  </button>

  {#if !rienAujourdhui}
    <h2 class="section-titre">Aujourd'hui</h2>
    <ul class="liste aujourdhui">
      {#each aGouter as b (b.id)}
        <li>
          <a href={lienBocal(b.id)}>
            <span class="pictogramme" aria-hidden="true">🥄</span>
            <span class="texte">À goûter : <strong>{b.nom}</strong>
              <span class="discret">· {libelleAvancement(etatEtape(b, bocaux.maintenant))}</span></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#each prets as b (b.id)}
        <li>
          <a href={lienBocal(b.id)}>
            <span class="pictogramme" aria-hidden="true">✅</span>
            <span class="texte">Prêt : <strong>{b.nom}</strong></span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/each}
      {#if enCours.length && !aGouter.length && !prets.length}
        <li>
          <a href="#/chambre/bocaux">
            <span class="pictogramme" aria-hidden="true">🫙</span>
            <span class="texte">{pluriel(enCours.length, 'bocal en cours', 'bocaux en cours')}</span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/if}
      {#if courses.restants.length}
        <li>
          <a href="#/courses">
            <span class="pictogramme" aria-hidden="true">🛒</span>
            <span class="texte">Courses : <strong>{pluriel(courses.restants.length, 'article', 'articles')}</strong> à acheter</span>
            <ChevronRight size={18} class="chevron" />
          </a>
        </li>
      {/if}
    </ul>
  {/if}

  <h2 class="section-titre">Que veux-tu cuisiner ?</h2>
  <div class="rubriques">
    {#each tuiles as t (t.id)}
      <button class="tuile" class:large={t.id === 'techniques'} onclick={() => ouvrirRubrique(t.id)}>
        <span class="emoji" aria-hidden="true">{t.emoji}</span>
        <span class="texte-tuile">
          <span class="nom-tuile">{t.titre}</span>
          <span class="nombre">{pluriel(parRubrique.get(t.id) ?? 0, 'fiche')}</span>
        </span>
      </button>
    {/each}
  </div>

  {#if favoris.length}
    <div class="entete-section">
      <h2 class="section-titre">Mes favoris</h2>
      <button class="tout-voir" onclick={toutVoirFavoris}>Tout voir <ChevronRight size={16} /></button>
    </div>
    <Bandeau fiches={favoris} />
  {/if}

  {#if recents.length}
    <h2 class="section-titre">Cuisiné récemment</h2>
    <Bandeau fiches={recents} />
  {/if}

  <h2 class="section-titre">Par origine</h2>
  <div class="origines">
    {#each UNIVERS.filter((u) => u.id !== 'techniques' && u.id !== 'fermentation' && (parUnivers.get(u.id) ?? 0) > 0) as u (u.id)}
      <button class="puce" onclick={() => ouvrirUnivers(u.id)}>
        <span aria-hidden="true">{u.emoji}</span>
        {u.titre}
        <span class="discret">{nombre(parUnivers.get(u.id) ?? 0, 0)}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .faux-champ {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    margin-top: 6px;
    border: none;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--texte-3);
    font-size: 17px;
    text-align: left;
  }

  .aujourdhui a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 12px 8px 14px;
    color: inherit;
    text-decoration: none;
  }

  .aujourdhui a:active {
    background: var(--surface-2);
  }

  .pictogramme {
    font-size: 20px;
    width: 26px;
    text-align: center;
  }

  .aujourdhui .texte {
    flex: 1;
    min-width: 0;
    font-size: 15.5px;
  }

  .aujourdhui :global(.chevron) {
    flex: none;
    color: var(--texte-3);
  }

  .rubriques {
    display: grid;
    /* minmax(0, 1fr) : les colonnes ne s'élargissent jamais au-delà de l'écran */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .tuile {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 10px 12px;
    border: none;
    border-radius: var(--rayon);
    background: var(--surface);
    box-shadow: var(--ombre);
    text-align: left;
    color: var(--texte);
  }

  .tuile:active {
    background: var(--surface-2);
  }

  .tuile.large {
    grid-column: 1 / -1;
  }

  .emoji {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--accent-doux);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 21px;
  }

  .texte-tuile {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .nom-tuile {
    font-weight: 600;
    font-size: 15.5px;
    line-height: 1.2;
    hyphens: auto;
    overflow-wrap: break-word;
  }

  .nombre {
    font-size: 12.5px;
    color: var(--texte-3);
    font-variant-numeric: tabular-nums;
  }

  .entete-section {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .tout-voir {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 44px;
    border: none;
    background: none;
    color: var(--accent);
    font-size: 15px;
    font-weight: 600;
    padding: 0 0 0 8px;
  }

  .origines {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 8px;
  }

  .origines .puce {
    min-height: 40px;
  }
</style>
