<script lang="ts" module>
  import { ecrireLocal, lireLocal } from '../lib/stockage-local';

  // Étape en cours de chaque recette, gardée dans le téléphone : on reprend là où on en était
  // (même après avoir fermé l'appli), pendant 12 heures.
  const CLE_ETAPES = 'etapes-cuisine';
  const REPRISE_MAX = 12 * 3600_000;

  function etapeMemorisee(id: string): number {
    const e = lireLocal<Record<string, [number, number]>>(CLE_ETAPES, {})[id];
    return e && Date.now() - e[1] < REPRISE_MAX ? e[0] : 0;
  }

  function memoriserEtape(id: string, index: number) {
    const maintenant = Date.now();
    const toutes = Object.fromEntries(
      Object.entries(lireLocal<Record<string, [number, number]>>(CLE_ETAPES, {})).filter(
        ([cle, [, t]]) => cle !== id && maintenant - t < REPRISE_MAX,
      ),
    );
    if (index > 0) toutes[id] = [index, maintenant];
    ecrireLocal(CLE_ETAPES, toutes);
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { ALargeSmall, ChevronLeft, ChevronRight, ListChecks, Sun, SunDim, Timer, X } from '@lucide/svelte';
  import FormulaireRealisation from '../composants/FormulaireRealisation.svelte';
  import Ingredients from '../composants/Ingredients.svelte';
  import TexteEtape from '../composants/TexteEtape.svelte';
  import { libelleDuree } from '../lib/durees';
  import { eveil } from '../lib/eveil.svelte';
  import { etat } from '../lib/etat.svelte';
  import { nombre } from '../lib/format';
  import { ingredientsDeLEtape } from '../lib/ingredients';
  import { minuteurs } from '../lib/minuteurs.svelte';
  import { portail } from '../lib/portail';
  import { portions, portionsDeBase, texteQuantites } from '../lib/portions.svelte';
  import { ligneIngredient } from '../lib/quantites';
  import { fichesDeLaPage } from '../lib/renvois';
  import { lienFiche, routeur } from '../lib/routeur.svelte';
  import { casseLisible, insecables, majuscule } from '../lib/texte';
  import type { Etape, Fiche } from '../lib/types';

  let { id }: { id: string } = $props();

  let fiche = $state.raw<Fiche | null | undefined>(undefined);
  let index = $state(0);
  let sens = $state(1);
  let taille = $state(lireLocal<number>('taille-cuisine', 1));
  let listeOuverte = $state(false);
  let zone = $state<HTMLElement>();
  let noteEnregistree = $state(false);

  $effect(() => {
    const cible = id;
    etat.fiche(cible).then((f) => {
      fiche = f ?? null;
      index = f ? Math.min(etapeMemorisee(cible), (f.etapes?.length ?? 0) + 1) : 0;
    });
  });

  eveil.activer();
  onDestroy(() => {
    eveil.desactiver();
  });

  const etapes = $derived(fiche?.etapes ?? []);
  // Diapositives : 0 = mise en place, 1..n = étapes, n+1 = fin.
  const nbDiapos = $derived(etapes.length + 2);
  const etape = $derived(index >= 1 && index <= etapes.length ? etapes[index - 1] : null);
  const coef = $derived(fiche ? portions.coef(fiche.id) : 1);
  const base = $derived(fiche ? portionsDeBase(fiche) : undefined);
  const titreCourt = $derived(fiche ? (fiche.titre.length > 28 ? fiche.titre.slice(0, 26).trimEnd() + '…' : fiche.titre) : '');

  function aller(i: number) {
    if (!fiche || i < 0 || i >= nbDiapos) return;
    sens = i > index ? 1 : -1;
    index = i;
    // Arrivé à la fin : la prochaine fois, on repart de la mise en place.
    memoriserEtape(fiche.id, i === nbDiapos - 1 ? 0 : i);
    tick().then(() => zone?.scrollTo({ top: 0 }));
  }

  function phase(e: Etape | null | undefined): string | null {
    const p = e?.phase?.trim();
    return p && !/^DUR[ÉE]E/i.test(p) ? casseLisible(p) : null;
  }

  // Balayage gauche / droite pour changer d'étape.
  let depart: { x: number; y: number } | null = null;
  function toucher(e: TouchEvent) {
    const t = e.touches[0];
    depart = { x: t.clientX, y: t.clientY };
  }
  function relacher(e: TouchEvent) {
    if (!depart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - depart.x;
    const dy = t.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) aller(index + (dx < 0 ? 1 : -1));
  }
  function clavier(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') aller(index + 1);
    if (e.key === 'ArrowLeft') aller(index - 1);
    if (e.key === 'Escape') quitter();
  }

  /** Retour à la fiche (même si l'appli a été rechargée entre-temps et qu'il n'y a plus d'historique). */
  function quitter() {
    if (routeur.profondeur > 0) routeur.retour();
    else routeur.remplacer(lienFiche(id));
  }

  function changerTaille() {
    taille = (taille % 3) + 1;
    ecrireLocal('taille-cuisine', taille);
  }

  const cites = $derived(fiche && etape ? ingredientsDeLEtape(fiche, etape) : []);
  const plusieursGroupes = $derived(new Set(cites.map((c) => c.groupe ?? '')).size > 1);

  // Si l'écran n'a pas pu être maintenu allumé, on réessaie au prochain toucher (geste de l'utilisateur).
  function reessayerEveil() {
    if (eveil.mode === 'echec') void eveil.activer();
  }
  const renvois = $derived(
    (etape?.renvois_pages ?? []).flatMap((p) =>
      fichesDeLaPage(etat.catalogue, Number(p))
        .slice(0, 1)
        .map((r) => ({ ...r, page: Number(p) })),
    ),
  );
</script>

<svelte:window onkeydown={clavier} onpointerup={reessayerEveil} />

<div class="cuisine taille-{taille}">
  <header class="entete">
    <button class="bouton-icone" onclick={quitter} aria-label="Quitter le mode cuisine">
      <X size={26} />
    </button>
    <div class="progression">
      <span class="compteur">
        {#if index === 0}Mise en place{:else if etape}Étape {index} / {etapes.length}{:else}Terminé{/if}
      </span>
      <div class="barre" aria-hidden="true">
        <div class="rempli" style:width="{(index / Math.max(1, nbDiapos - 1)) * 100}%"></div>
      </div>
    </div>
    <span
      class="eveil"
      class:ok={eveil.mode === 'natif' || eveil.mode === 'video'}
      title={eveil.mode === 'echec' ? "L'écran peut se mettre en veille" : 'Écran maintenu allumé'}
      aria-label={eveil.mode === 'echec' ? "L'écran peut se mettre en veille" : 'Écran maintenu allumé'}
    >
      {#if eveil.mode === 'echec'}<SunDim size={20} />{:else}<Sun size={20} />{/if}
    </span>
    <button class="bouton-icone" onclick={changerTaille} aria-label="Taille du texte"><ALargeSmall size={24} /></button>
    <button class="bouton-icone" onclick={() => (listeOuverte = true)} aria-label="Tous les ingrédients">
      <ListChecks size={24} />
    </button>
  </header>

  <main class="zone" bind:this={zone} ontouchstart={toucher} ontouchend={relacher}>
    {#if fiche === undefined}
      <p class="vide">Chargement…</p>
    {:else if fiche === null}
      <p class="vide">Fiche introuvable.</p>
    {:else}
      {@const f = fiche}
      {#key index}
        <article class="diapo" in:fly={{ x: 70 * sens, duration: 220 }}>
          {#if index === 0}
            <p class="surtitre">{f.titre}</p>
            <h1>Mise en place</h1>
            {#if base || coef !== 1}
              <p class="info-portions">
                {#if base}Pour <strong>{nombre(base * coef)} {f.portions?.unite ?? 'portions'}</strong>{:else}Quantités ×{nombre(coef)}{/if}
                <span class="discret"> · à changer sur la fiche</span>
              </p>
            {/if}
            {#if f.ingredients?.length}
              <div class="carte bloc"><Ingredients groupes={f.ingredients} source={f.source.id} {coef} /></div>
            {/if}
            {#if f.materiel?.length}
              <h2>Matériel</h2>
              <ul class="materiel">
                {#each f.materiel as m, i (i)}
                  {#if typeof m === 'string'}<li>{m}</li>
                  {:else}{#each m.elements ?? [] as el, j (j)}<li>{el}</li>{/each}{/if}
                {/each}
              </ul>
            {/if}
            {#if !etapes.length}<p class="vide">Cette fiche n'a pas d'étapes détaillées.</p>{/if}
          {:else if etape}
            {@const n = index}
            {#if phase(etape)}<p class="phase">{phase(etape)}</p>{/if}
            <p class="numero">Étape {n}</p>
            <p class="texte-principal">
              <TexteEtape
                texte={majuscule(etape.texte)}
                livre={f.source.id === 'cuisine-de-reference'}
                libelle="{titreCourt} — étape {n}"
                ficheId={f.id}
              />
            </p>
            {#if etape.duree?.minutes}
              {@const secondes = etape.duree.minutes * 60}
              <button class="duree-etape" onclick={() => minuteurs.lancer(`${titreCourt} — étape ${n}`, secondes, { ficheId: f.id })}>
                <Timer size={18} /> Minuteur {libelleDuree(secondes)}
              </button>
            {/if}
            {#if etape.details?.length}
              <ul class="details">
                {#each etape.details as d, j (j)}
                  <li>
                    <TexteEtape
                      texte={d}
                      livre={f.source.id === 'cuisine-de-reference'}
                      libelle="{titreCourt} — étape {n}"
                      ficheId={f.id}
                    />
                  </li>
                {/each}
              </ul>
            {/if}
            {#each renvois as r (r.id)}
              <a class="renvoi" href={lienFiche(r.id, r.page)}>→ Voir p. {r.page} : {r.titre}</a>
            {/each}
            {#if cites.length}
              <section class="carte bloc cites">
                <h2>Ingrédients de l'étape</h2>
                <ul>
                  {#each cites as c, k (k)}
                    {@const l = ligneIngredient(c.item, f.source.id, coef)}
                    <li>
                      {#if l.quantite}<strong>{l.quantite}</strong>{/if}
                      {insecables(l.texte)}
                      {#if plusieursGroupes && c.groupe}<span class="groupe-cite">· {casseLisible(c.groupe)}</span>{/if}
                    </li>
                  {/each}
                </ul>
              </section>
            {/if}
          {:else}
            <div class="fin">
              <p class="emoji" aria-hidden="true">🍽️</p>
              <h1>Bon appétit !</h1>
              <p class="discret">{f.titre}</p>
              {#if noteEnregistree}
                <p class="carte note-ok">✓ Noté dans ton carnet (en bas de la fiche).</p>
              {:else}
                <div class="carte bloc-carnet">
                  <FormulaireRealisation
                    ficheId={f.id}
                    quantites={texteQuantites(f, coef)}
                    onenregistre={() => (noteEnregistree = true)}
                  />
                </div>
              {/if}
              <button class="bouton plein" class:secondaire={!noteEnregistree} onclick={quitter}>
                Revenir à la fiche
              </button>
            </div>
          {/if}
        </article>
      {/key}
    {/if}
  </main>

  <footer class="pied">
    <button class="bouton secondaire" onclick={() => aller(index - 1)} disabled={index === 0}>
      <ChevronLeft size={22} /> Précédent
    </button>
    {#if index < nbDiapos - 1}
      <button class="bouton" onclick={() => aller(index + 1)}>
        {index === 0 ? 'Commencer' : index === etapes.length ? 'Terminer' : 'Suivant'}
        <ChevronRight size={22} />
      </button>
    {/if}
  </footer>
</div>

{#if listeOuverte && fiche}
  <div use:portail>
    <div class="voile" transition:fade={{ duration: 150 }} onclick={() => (listeOuverte = false)} aria-hidden="true"></div>
    <div class="feuille" role="dialog" aria-modal="true" aria-label="Ingrédients" transition:fly={{ y: 500, duration: 240 }}>
      <header class="entete-feuille">
        <h2>Ingrédients</h2>
        <button class="bouton-icone" onclick={() => (listeOuverte = false)} aria-label="Fermer"><X size={24} /></button>
      </header>
      <Ingredients groupes={fiche.ingredients ?? []} source={fiche.source.id} {coef} />
    </div>
  </div>
{/if}

<style>
  .cuisine {
    position: fixed;
    inset: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    background: var(--fond);
    --t: 22px;
  }

  .taille-2 {
    --t: 26px;
  }

  .taille-3 {
    --t: 31px;
  }

  .entete {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: calc(var(--haut) + 4px) calc(6px + var(--droite)) 6px calc(6px + var(--gauche));
    border-bottom: 0.5px solid var(--trait);
  }

  .progression {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
  }

  .compteur {
    display: block;
    font-weight: 700;
    font-size: 15px;
    text-align: center;
  }

  .barre {
    height: 4px;
    border-radius: 2px;
    background: var(--surface-3);
    margin-top: 5px;
    overflow: hidden;
  }

  .rempli {
    height: 100%;
    background: var(--accent);
    transition: width 0.25s ease;
  }

  .eveil {
    display: flex;
    padding: 0 6px;
    color: var(--texte-3);
  }

  .eveil.ok {
    color: var(--ambre);
  }

  .zone {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 18px calc(20px + var(--droite)) 120px calc(20px + var(--gauche));
  }

  .diapo {
    max-width: 680px;
    margin: 0 auto;
  }

  .surtitre {
    margin: 0;
    color: var(--texte-2);
    font-size: 15px;
  }

  h1 {
    font-family: var(--police-titre);
    font-size: calc(var(--t) + 8px);
    margin: 4px 0 12px;
  }

  h2 {
    font-size: 17px;
    margin: 18px 0 8px;
  }

  .info-portions {
    margin: 0 0 12px;
  }

  .bloc {
    padding: 4px 14px;
  }

  .materiel {
    padding-left: 1.2em;
    margin: 0;
  }

  .phase {
    margin: 0 0 4px;
    color: var(--accent);
    font-weight: 700;
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .numero {
    margin: 0 0 6px;
    color: var(--texte-2);
    font-weight: 600;
    font-size: 15px;
  }

  .texte-principal {
    font-size: var(--t);
    line-height: 1.35;
    font-weight: 500;
    margin: 0 0 14px;
  }

  .details {
    margin: 0 0 14px;
    padding-left: 1.1em;
    font-size: calc(var(--t) - 3px);
    line-height: 1.4;
  }

  .details li {
    margin: 8px 0;
  }

  .duree-etape {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    margin-bottom: 14px;
    border: none;
    border-radius: 12px;
    background: var(--ambre-doux);
    color: var(--ambre);
    font-weight: 700;
    font-size: 16px;
  }

  .renvoi {
    display: block;
    margin: 0 0 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .cites {
    padding: 4px 16px 10px;
    margin-top: 8px;
  }

  .cites h2 {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin: 10px 0 4px;
  }

  .cites ul {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: calc(var(--t) - 4px);
  }

  .cites li {
    padding: 5px 0;
  }

  .groupe-cite {
    color: var(--texte-3);
    font-size: 0.8em;
  }

  .cites li + li {
    border-top: 0.5px solid var(--trait);
  }

  .fin {
    text-align: center;
    padding-top: 40px;
  }

  .fin .emoji {
    font-size: 64px;
    margin: 0;
  }

  .fin .bouton {
    margin-top: 24px;
  }

  .bloc-carnet {
    margin: 24px auto 0;
    max-width: 440px;
    padding: 16px;
  }

  .note-ok {
    margin: 24px auto 0;
    max-width: 440px;
    padding: 14px 16px;
    color: var(--vert);
    font-weight: 600;
  }

  .pied {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 10px;
    padding: 12px calc(16px + var(--droite)) calc(12px + var(--bas)) calc(16px + var(--gauche));
    background: color-mix(in srgb, var(--fond) 88%, transparent);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-top: 0.5px solid var(--trait);
  }

  .pied .bouton {
    flex: 1;
    min-height: 56px;
    font-size: 18px;
  }

  .voile {
    position: fixed;
    inset: 0;
    z-index: 45;
    background: rgb(0 0 0 / 0.35);
  }

  .feuille {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 46;
    max-height: calc(100% - var(--haut) - 24px);
    overflow-y: auto;
    padding: 6px 16px calc(20px + var(--bas));
    background: var(--fond);
    border-radius: 18px 18px 0 0;
  }

  .entete-feuille {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .entete-feuille h2 {
    font-family: var(--police-titre);
    font-size: 22px;
    margin: 0;
  }
</style>
