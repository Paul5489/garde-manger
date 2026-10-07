<script lang="ts">
  // Assistant « Changer de mode », écran par écran. Rien n'est piloté : Paul règle les Inkbird lui-même
  // (appli INKBIRD ou touches), l'appli lui dit quoi faire et pourquoi.
  import { Check, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { annonce } from '../../lib/annonce.svelte';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { couleurMode, glossaire, pourquoiDuCode, t, valeurCode } from '../affichage';
  import { etapesAssistant } from '../assistant';
  import { modeAvant } from '../calendrier';
  import { chambre } from '../chambre.svelte';
  import { MODES, MODES_PAR_ID } from '../donnees';
  import type { IdMode } from '../types';

  let { vers: versId }: { vers?: string } = $props();

  const actif = $derived(chambre.actif);
  // Mode de départ : le mode actuel ; si le calendrier est déjà passé au mode visé (ou un jour de nettoyage),
  // celui d'avant au calendrier.
  const de = $derived(
    actif.mode && (actif.mode.id !== versId || actif.manuel) ? actif.mode : actif.manuel ? undefined : MODES_PAR_ID.get(modeAvant(chambre.maintenant)),
  );
  const vers = $derived(versId ? MODES_PAR_ID.get(versId as IdMode) : undefined);
  const etapes = $derived(vers ? etapesAssistant(de?.id === vers.id ? undefined : de, vers, chambre.miseEnServiceFaite) : []);
  // Mode proposé en premier : celui du calendrier.
  const propose = $derived(actif.prevu !== 'nettoyage' ? actif.prevu : actif.apres);

  let i = $state(0);
  let coches = $state<Record<string, boolean>>({});
  let haut = $state<HTMLElement>();

  function aller(n: number) {
    i = n;
    haut?.scrollIntoView({ block: 'start' });
  }

  async function terminer() {
    if (!vers) return;
    await chambre.changerDeMode(vers.id);
    annonce.afficher(`La chambre est en mode ${vers.nom}.`);
    routeur.retour();
  }

  const etape = $derived(etapes[i]);
</script>

<div class="contenu" bind:this={haut}>
  {#if !vers}
    <h1 class="titre-serif">Changer de mode</h1>
    <p class="discret">
      Mode actuel : <strong>{actif.mode?.nom ?? 'jour de nettoyage'}</strong>. Vers quel mode passes-tu ?
    </p>
    <ul class="liste modes">
      {#each [...MODES].sort((a, b) => Number(b.id === propose) - Number(a.id === propose)) as m (m.id)}
        <li>
          <button onclick={() => routeur.remplacerPage(lienChambre('changer', m.id))} style:--couleur={couleurMode(m)}>
            <span class="pastille" aria-hidden="true"></span>
            <span class="texte">
              <strong>{m.nom}</strong>
              <span class="petit discret">{m.id === propose ? 'Prévu au calendrier · ' : ''}{t(m.cible)}</span>
            </span>
            <ChevronRight size={18} />
          </button>
        </li>
      {/each}
    </ul>
  {:else if etape}
    <p class="surtitre" style:--couleur={couleurMode(vers)}>
      {de && de.id !== vers.id ? `${de.nom} → ` : ''}<strong>{vers.nom}</strong>
    </p>
    <div class="progression" role="progressbar" aria-valuemin={1} aria-valuemax={etapes.length} aria-valuenow={i + 1} aria-label="Étape {i + 1} sur {etapes.length}">
      <div style:width="{((i + 1) / etapes.length) * 100}%"></div>
    </div>
    <p class="numero petit discret">Étape {i + 1} sur {etapes.length}</p>

    {#if etape.type === 'code'}
      {@const g = glossaire(etape.appareil, etape.code)}
      <h1 class="titre-serif">{etape.appareil === 'itc' ? 'ITC · température' : 'IHC · humidité'}</h1>
      <div class="ecran-controleur" aria-label="{etape.code} à {valeurCode(etape.appareil, etape.code, etape.valeur)}">
        <span class="lettres">{etape.code}</span>
        <span class="valeur">{valeurCode(etape.appareil, etape.code, etape.valeur)}</span>
        {#if etape.avant !== undefined}
          <span class="avant">avant : {valeurCode(etape.appareil, etape.code, etape.avant)}</span>
        {:else if etape.inchange}
          <span class="avant">inchangé</span>
        {/if}
      </div>
      <p class="consigne">{t(etape.consigne)}</p>
      {#if g}<p class="discret"><strong>{g.nom}.</strong> {t(g.explication)}</p>{/if}
      {@const raisons = pourquoiDuCode(vers, etape.appareil, etape.code, typeof etape.valeur === 'number' ? etape.valeur : undefined)}
      {#if raisons.length}
        <div class="carte note pourquoi">
          <strong>Pourquoi {valeurCode(etape.appareil, etape.code, etape.valeur)}</strong>
          {#each raisons as p (p)}<p>{t(p)}</p>{/each}
        </div>
      {/if}
      {#if etape.note}<div class="carte note"><p>{t(etape.note)}</p></div>{/if}
    {:else}
      <h1 class="titre-serif">{etape.titre}</h1>
      {#each etape.textes as tx (tx)}<p>{t(tx)}</p>{/each}
      {#if etape.cases?.length}
        <ul class="liste cases">
          {#each etape.cases as c, k (k)}
            {@const cle = `${i}-${k}`}
            <li>
              <label>
                <input type="checkbox" bind:checked={coches[cle]} />
                <span>{t(c)}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
      {#if etape.note}<div class="carte note"><p>{t(etape.note)}</p></div>{/if}
      {#if etape.pourquoi?.length}
        <div class="carte note pourquoi">
          <strong>Pourquoi</strong>
          {#each etape.pourquoi as p (p)}<p>{t(p)}</p>{/each}
        </div>
      {/if}
    {/if}

    <div class="navigation">
      {#if i > 0}
        <button class="bouton secondaire" onclick={() => aller(i - 1)} aria-label="Étape précédente"><ChevronLeft size={20} /></button>
      {/if}
      {#if i < etapes.length - 1}
        <button class="bouton suivant" onclick={() => aller(i + 1)}>Suivant <ChevronRight size={20} /></button>
      {:else}
        <button class="bouton suivant" onclick={terminer}><Check size={20} /> La chambre est en mode {vers.nom}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  h1 {
    font-size: 26px;
    margin: 6px 0 12px;
  }

  .surtitre {
    margin: 4px 0 8px;
    color: var(--texte-2);
  }

  .surtitre strong {
    color: var(--couleur);
  }

  .progression {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .progression div {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }

  .numero {
    margin: 6px 0 0;
  }

  .modes button {
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 10px 14px;
    color: inherit;
    text-decoration: none;
  }

  .modes button:active {
    background: var(--surface-2);
  }

  .modes :global(svg) {
    color: var(--texte-3);
  }

  .pastille {
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--couleur);
  }

  .texte {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .ecran-controleur {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 12px 16px;
    border-radius: 18px;
    background: #1d2420;
    color: #e9f5e4;
  }

  .lettres {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 54px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #9be38c;
    line-height: 1.1;
  }

  .valeur {
    font-size: 34px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .avant {
    font-size: 14px;
    color: #b9c9b4;
  }

  .consigne {
    font-size: 19px;
    font-weight: 600;
    margin: 16px 0 10px;
  }

  .note {
    padding: 12px 14px;
    margin-top: 14px;
    border-left: 4px solid var(--ambre);
  }

  .note p {
    margin: 4px 0 0;
  }

  .pourquoi {
    border-left-color: var(--vert);
  }

  .cases label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    min-height: 52px;
  }

  .cases input {
    flex: none;
    width: 24px;
    height: 24px;
    margin: 0;
    accent-color: var(--vert);
  }

  .navigation {
    display: flex;
    gap: 10px;
    margin-top: 24px;
  }

  .suivant {
    flex: 1;
  }
</style>
