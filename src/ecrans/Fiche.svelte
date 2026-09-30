<script lang="ts">
  import { tick } from 'svelte';
  import { Clock, ExternalLink, Users } from '@lucide/svelte';
  import BarreHaut from '../composants/BarreHaut.svelte';
  import CarteFermentation from '../composants/CarteFermentation.svelte';
  import Ingredients from '../composants/Ingredients.svelte';
  import ListeFiches from '../composants/ListeFiches.svelte';
  import Markdown from '../composants/Markdown.svelte';
  import TableauDenrees from '../composants/TableauDenrees.svelte';
  import TexteComplet from '../composants/TexteComplet.svelte';
  import TexteRenvois from '../composants/TexteRenvois.svelte';
  import { NOMS_SOURCES, NOMS_TYPES, categorieDe } from '../lib/archive';
  import { etat } from '../lib/etat.svelte';
  import { duree, nombre } from '../lib/format';
  import { fichesDeLaPage } from '../lib/renvois';
  import { lienFiche } from '../lib/routeur.svelte';
  import { casseLisible, insecables, majuscule } from '../lib/texte';
  import type { Duree, Etape, Fiche, GroupeMateriel, Resume } from '../lib/types';

  let { id, page }: { id: string; page?: number } = $props();

  let fiche = $state.raw<Fiche | null | undefined>(undefined);
  let conteneur = $state<HTMLElement>();
  let defile = $state(false);

  // Position de lecture de chaque fiche, pour y revenir avec « Retour ».
  const positions = new Map<string, number>();
  let idAffiche = '';

  $effect(() => {
    const cible = id;
    const pageCible = page;
    if (idAffiche && conteneur) positions.set(idAffiche, conteneur.scrollTop);
    let annule = false;
    etat.fiche(cible).then(async (f) => {
      if (annule) return;
      fiche = f ?? null;
      idAffiche = cible;
      await tick();
      if (!conteneur) return;
      const ancre = pageCible ? conteneur.querySelector<HTMLElement>(`#p-${pageCible}`) : null;
      if (ancre) {
        ancre.classList.add('cible');
        ancre.scrollIntoView({ block: 'start' });
      } else conteneur.scrollTop = positions.get(cible) ?? 0;
    });
    return () => {
      annule = true;
    };
  });

  const LIBELLES_TEMPS: Record<string, string> = {
    preparation: 'Préparation',
    cuisson: 'Cuisson',
    realisation: 'Réalisation',
    repos: 'Repos',
    marinade: 'Marinade',
    sechage: 'Séchage',
    maceration: 'Macération',
    total: 'Total',
  };

  function texteDuree(d: Duree): string {
    if (d.minutes) return duree(d.minutes);
    if (d.minutes_min && d.minutes_max)
      return d.minutes_min === d.minutes_max ? duree(d.minutes_min) : `${duree(d.minutes_min)} à ${duree(d.minutes_max)}`;
    return d.texte;
  }

  /** Écarte les durées mal lues dans le livre (« DURÉE MOYENNE DE CUISSON : », « selon la quan- »…). */
  function dureeLisible(d: Duree): boolean {
    if (d.minutes || d.minutes_min || d.minutes_max) return true;
    const t = d.texte ?? '';
    return (/\d/.test(t) && !t.includes('??')) || /^(variable|quelques)/i.test(t);
  }

  const temps = $derived(
    Object.entries(fiche?.temps ?? {})
      .filter(([cle, d]) => cle in LIBELLES_TEMPS && dureeLisible(d))
      .sort(([a], [b]) => Object.keys(LIBELLES_TEMPS).indexOf(a) - Object.keys(LIBELLES_TEMPS).indexOf(b))
      .map(([cle, d]) => ({ libelle: LIBELLES_TEMPS[cle], valeur: texteDuree(d) })),
  );

  const surtitre = $derived(
    fiche
      ? [NOMS_SOURCES[fiche.source.id], categorieDe(fiche), ...(fiche.classement?.cuisine ?? []).filter((c) => c !== 'Française')]
          .filter(Boolean)
          .join(' · ')
      : '',
  );

  /** Phases utiles (Marc Winer : « Farce », « Sauce »…) ; on ignore les en-têtes de colonne du livre. */
  function phaseUtile(e: Etape): string | null {
    const p = e.phase?.trim();
    if (!p || /^DUR[ÉE]E/i.test(p)) return null;
    return casseLisible(p);
  }

  const materiel = $derived.by(() => {
    const m = fiche?.materiel ?? [];
    const simples = m.filter((x): x is string => typeof x === 'string');
    const groupes = m.filter((x): x is GroupeMateriel => typeof x === 'object' && x !== null);
    return { simples, groupes };
  });

  function renvois(e: Etape): (Resume & { page: number })[] {
    const vus = new Set<string>();
    const res: (Resume & { page: number })[] = [];
    for (const p of e.renvois_pages ?? []) {
      const n = Number(p);
      for (const r of fichesDeLaPage(etat.catalogue, n)) {
        if (vus.has(r.id)) continue;
        vus.add(r.id);
        res.push({ ...r, page: n });
      }
    }
    return res;
  }

  const recettesDuChapitre = $derived(
    (fiche?.recettes_du_chapitre ?? []).map((i) => etat.parId.get(i)).filter((r): r is Resume => !!r),
  );

  const livre = $derived(fiche?.source.id === 'cuisine-de-reference');

  function surDefilement() {
    defile = (conteneur?.scrollTop ?? 0) > 60;
  }
</script>

<div class="ecran calque" bind:this={conteneur} onscroll={surDefilement}>
  <BarreHaut titre={fiche?.titre ?? ''} avecTrait={defile} />

  {#if fiche === undefined}
    <p class="vide">Chargement…</p>
  {:else if fiche === null}
    <div class="vide">
      <p>Cette fiche n'existe pas (ou plus) dans l'archive importée.</p>
    </div>
  {:else}
    {@const f = fiche}
    <article class="contenu fiche">
      <p class="surtitre">
        {#if f.type !== 'recette'}<span class="etiquette">{NOMS_TYPES[f.type]}</span>{/if}
        {surtitre}
      </p>
      <h1 class="titre-serif">{f.titre}</h1>

      {#if f.description}<p class="chapeau">{insecables(f.description)}</p>{/if}

      {#if temps.length || f.portions?.nombre || f.rendement || f.calories}
        <div class="meta">
          {#each temps as t (t.libelle)}
            <span class="info"><Clock size={15} /> {t.libelle} <strong>{t.valeur}</strong></span>
          {/each}
          {#if f.portions?.nombre}
            <span class="info"><Users size={15} /> <strong>{nombre(f.portions.nombre)} {f.portions.unite ?? 'portions'}</strong></span>
          {/if}
          {#if f.rendement}<span class="info">Rendement <strong>{f.rendement}</strong></span>{/if}
          {#if f.calories}<span class="info">{f.calories}</span>{/if}
        </div>
      {/if}

      {#if f.fermentation}<CarteFermentation fermentation={f.fermentation} />{/if}

      {#if f.ingredients?.length}
        <section>
          <h2 class="titre-section">Ingrédients</h2>
          <div class="carte bloc"><Ingredients groupes={f.ingredients} source={f.source.id} /></div>
        </section>
      {/if}

      {#each f.ingredients_supplementaires ?? [] as t, i (i)}
        <TableauDenrees tableau={t} source={f.source.id} />
      {/each}

      {#if f.etapes?.length}
        <section>
          <h2 class="titre-section">Étapes</h2>
          <ol class="etapes">
            {#each f.etapes as e, i (i)}
              {@const phase = phaseUtile(e)}
              {#if phase && phase !== phaseUtile(f.etapes[i - 1] ?? { texte: '' })}
                <li class="phase"><h3>{phase}</h3></li>
              {/if}
              <li class="etape">
                <span class="numero" aria-hidden="true">{e.numero ?? i + 1}</span>
                <div class="corps-etape">
                  <p class="texte-etape">
                    {insecables(majuscule(e.texte))}
                    {#if e.duree}<span class="etiquette duree"><Clock size={13} /> {texteDuree(e.duree)}</span>{/if}
                  </p>
                  {#if e.details?.length}
                    <ul class="details">
                      {#each e.details as d, j (j)}<li>{#if livre}<TexteRenvois texte={insecables(d)} />{:else}{insecables(d)}{/if}</li>{/each}
                    </ul>
                  {/if}
                  {#each renvois(e) as r (r.id)}
                    <a class="renvoi" href={lienFiche(r.id, r.page)}>
                      → Voir p. {r.page} : {r.titre}
                    </a>
                  {/each}
                </div>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      {#if materiel.simples.length || materiel.groupes.length}
        <section>
          <h2 class="titre-section">Matériel</h2>
          {#if materiel.simples.length}
            <ul class="puces-texte">{#each materiel.simples as m, i (i)}<li>{m}</li>{/each}</ul>
          {/if}
          {#each materiel.groupes as g, i (i)}
            <h3 class="sous-titre">{g.type}</h3>
            <ul class="puces-texte">{#each g.elements ?? [] as m, j (j)}<li>{m}</li>{/each}</ul>
          {/each}
        </section>
      {/if}

      {#if f.techniques_mises_en_oeuvre?.length}
        <section>
          <h2 class="titre-section">Techniques mises en œuvre</h2>
          <ul class="puces-texte">{#each f.techniques_mises_en_oeuvre as t, i (i)}<li>{t}</li>{/each}</ul>
        </section>
      {/if}

      {#if f.notes?.length}
        <section>
          <h2 class="titre-section">Remarques</h2>
          <div class="carte bloc notes">
            {#each f.notes as n, i (i)}<Markdown texte={n} />{/each}
          </div>
        </section>
      {/if}

      {#if f.variantes?.length}
        <section>
          <h2 class="titre-section">Variantes et plats similaires</h2>
          {#each f.variantes as v, i (i)}
            <div class="variante">
              {#if v.titre}<h3 class="sous-titre">{v.titre}</h3>{/if}
              {#if v.texte}<Markdown texte={v.texte} />{/if}
            </div>
          {/each}
        </section>
      {/if}

      {#if f.utilisations?.length}
        <section>
          <h2 class="titre-section">Idées d'utilisation</h2>
          {#each f.utilisations as v, i (i)}
            <div class="variante">
              {#if v.titre}<h3 class="sous-titre">{v.titre}</h3>{/if}
              {#if v.texte}<Markdown texte={v.texte} />{/if}
            </div>
          {/each}
        </section>
      {/if}

      {#if f.tableau_brix_alcool?.length}
        <section>
          <h2 class="titre-section">Baisse du Brix → alcool</h2>
          <div class="carte bloc brix">
            {#each f.tableau_brix_alcool.filter((l) => l.baisse_brix > 0) as l (l.baisse_brix)}
              <span><strong>{nombre(l.baisse_brix)} °Bx</strong> → {nombre(l.alcool_pct)} %</span>
            {/each}
          </div>
        </section>
      {/if}

      {#if f.type !== 'recette'}
        {#if f.texte_complet}
          <section class="texte-integral">
            <TexteComplet texte={f.texte_complet} titre={f.titre} tableaux={f.preparations_de_base} source={f.source.id} />
          </section>
        {:else if f.sections?.length}
          {#each f.sections as s, i (i)}
            <section>
              {#if s.titre}<h2 class="titre-section">{s.titre}</h2>{/if}
              {#if s.texte}<Markdown texte={s.texte} />{/if}
            </section>
          {/each}
        {/if}
      {/if}

      {#if recettesDuChapitre.length}
        <section>
          <h2 class="titre-section">Recettes du chapitre</h2>
          <ListeFiches fiches={recettesDuChapitre} masquerSource />
        </section>
      {/if}

      {#if f.type === 'recette' && f.source.id === 'cuisine-de-reference' && f.texte_complet}
        <details class="integral-recette">
          <summary>Texte intégral de la fiche (livre)</summary>
          <TexteComplet texte={f.texte_complet} source={f.source.id} renvoiIngredients />
        </details>
      {/if}

      <footer class="pied">
        <p>
          <strong>{f.source.nom}</strong>{#if f.source.auteur} — {f.source.auteur}{/if}
          {#if f.source.pages?.length}<br />Pages {f.source.pages[0]}{#if f.source.pages.length > 1}–{f.source.pages[f.source.pages.length - 1]}{/if}{/if}
          {#if f.source.fiche_n} · fiche n° {f.source.fiche_n}{/if}
        </p>
        {#if f.extraction?.avertissements?.length}
          <ul>{#each f.extraction.avertissements as a, i (i)}<li>{a}</li>{/each}</ul>
        {/if}
        {#if f.source.url}
          <a href={f.source.url} target="_blank" rel="noopener noreferrer" class="lien-externe">
            Voir sur le site <ExternalLink size={14} />
          </a>
        {/if}
      </footer>
    </article>
  {/if}
</div>

<style>
  .calque {
    z-index: 10;
  }

  .fiche {
    padding-top: 4px;
  }

  .surtitre {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 6px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 30px;
    line-height: 1.12;
  }

  .chapeau {
    margin: 12px 0 0;
    color: var(--texte-2);
    font-size: 16.5px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .info {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--ombre);
    font-size: 14px;
    color: var(--texte-2);
  }

  .info strong {
    color: var(--texte);
  }

  .titre-section {
    font-family: var(--police-titre);
    font-size: 22px;
    margin: 30px 0 10px;
  }

  .bloc {
    padding: 4px 14px;
  }

  .notes {
    padding: 4px 16px;
  }

  .etapes {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .phase h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
    margin: 20px 0 6px;
  }

  .etape {
    display: flex;
    gap: 12px;
    padding: 10px 0;
  }

  .numero {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 15px;
    background: var(--accent-doux);
    color: var(--accent);
    font-weight: 700;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .corps-etape {
    flex: 1;
    min-width: 0;
  }

  .texte-etape {
    margin: 3px 0 0;
    font-size: 17px;
  }

  .duree {
    margin-left: 4px;
    vertical-align: 1px;
  }

  .details {
    margin: 6px 0 0;
    padding-left: 1.1em;
    color: var(--texte);
    font-size: 16px;
  }

  .details li {
    margin: 3px 0;
  }

  .renvoi {
    display: block;
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--ombre);
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
  }

  .puces-texte {
    margin: 0;
    padding-left: 1.2em;
  }

  .puces-texte li {
    margin: 4px 0;
  }

  .sous-titre {
    font-size: 16px;
    font-weight: 700;
    margin: 14px 0 4px;
  }

  .variante + .variante {
    margin-top: 6px;
  }

  .brix {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    padding: 12px 14px;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .texte-integral {
    margin-top: 12px;
  }

  .integral-recette {
    margin-top: 28px;
    border-top: 0.5px solid var(--trait);
    padding-top: 12px;
  }

  .integral-recette summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-weight: 600;
    color: var(--accent);
  }

  .pied {
    margin-top: 36px;
    padding-top: 12px;
    border-top: 0.5px solid var(--trait);
    font-size: 13.5px;
    color: var(--texte-2);
  }

  .pied ul {
    padding-left: 1.1em;
    margin: 6px 0;
  }

  .lien-externe {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
  }
</style>
