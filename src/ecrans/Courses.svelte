<script lang="ts">
  import { Check, ChevronRight, CircleMinus, Plus, Share, Trash2, X } from '@lucide/svelte';
  import Feuille from '../composants/Feuille.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import { courses } from '../lib/courses.svelte';
  import type { ArticleCourses } from '../lib/db';
  import { pluriel } from '../lib/format';
  import { parRayon, quantiteTotale, RAYON_PAR_ID, RAYONS, texteListe } from '../lib/liste-courses';
  import { partagerTexte } from '../lib/partage';
  import { lienFiche, routeur } from '../lib/routeur.svelte';
  import { collator } from '../lib/texte';

  let saisie = $state('');
  let champ = $state<HTMLInputElement>();
  let modification = $state(false);
  let pourRayon = $state<ArticleCourses | null>(null);
  let feuilleRayon = $state(false);

  const groupes = $derived(parRayon(courses.restants));
  const panier = $derived([...courses.coches].sort((a, b) => collator.compare(a.nom, b.nom)));
  const titres = $derived(new Map(courses.recettes.map((r) => [r.ficheId, r.titre])));

  // On quitte le mode « Modifier » en changeant d'onglet, ou quand la liste est vide.
  $effect(() => {
    if (routeur.route.nom !== 'courses' || !courses.articles.length) modification = false;
  });

  function origine(a: ArticleCourses): string {
    const ids = [...new Set(a.apports.map((p) => p.ficheId).filter((id): id is string => !!id))];
    return ids.map((id) => titres.get(id)).filter(Boolean).join(', ');
  }

  async function ajouter(e: SubmitEvent) {
    e.preventDefault();
    const t = saisie.trim();
    if (!t) return;
    saisie = '';
    await courses.ajouterLibre(t);
  }

  function toucher(a: ArticleCourses) {
    if (modification) {
      pourRayon = a;
      feuilleRayon = true;
    } else void courses.basculer(a.id);
  }

  async function choisirRayon(id: string) {
    if (pourRayon) await courses.changerRayon(pourRayon.id, id);
    feuilleRayon = false;
  }

  async function partager() {
    champ?.blur();
    try {
      const r = await partagerTexte('Courses', texteListe(courses.articles));
      if (r === 'copie') annonce.afficher('Liste copiée : colle-la où tu veux');
    } catch {
      annonce.afficher("Le partage n'a pas fonctionné");
    }
  }

  function vider() {
    if (confirm('Vider toute la liste de courses ?')) void courses.vider();
  }

  function retirerRecette(ficheId: string, titre: string) {
    if (confirm(`Retirer les ingrédients de « ${titre} » de la liste ?`)) void courses.retirerRecette(ficheId);
  }
</script>

{#snippet ligne(a: ArticleCourses)}
  {@const q = quantiteTotale(a.apports)}
  {@const o = origine(a)}
  <li class="article" class:coche={a.coche}>
    {#if modification}
      <button class="supprimer" onclick={() => courses.supprimer(a.id)} aria-label="Supprimer {a.nom}">
        <CircleMinus size={24} />
      </button>
    {/if}
    <button
      class="corps"
      onclick={() => toucher(a)}
      role={modification ? undefined : 'checkbox'}
      aria-checked={modification ? undefined : a.coche}
      aria-label={modification ? `Changer le rayon de ${a.nom}` : undefined}
    >
      {#if !modification}
        <span class="case" aria-hidden="true">{#if a.coche}<Check size={16} strokeWidth={3} />{/if}</span>
      {/if}
      <span class="texte">
        <span class="nom">{a.nom}</span>
        {#if o}<span class="origine">{o}</span>{/if}
      </span>
      {#if q}<span class="qte">{q}</span>{/if}
      {#if modification}
        <span class="rayon-mini" aria-hidden="true">{RAYON_PAR_ID.get(a.rayon)?.emoji ?? '🛒'}<ChevronRight size={16} /></span>
      {/if}
    </button>
  </li>
{/snippet}

<div class="grand-titre">
  <h1>Courses</h1>
  {#if courses.articles.length}
    <div class="actions">
      <button class="bouton-icone" onclick={partager} aria-label="Partager la liste"><Share size={23} /></button>
      <button class="bouton-icone" onclick={() => (modification = !modification)}>
        {modification ? 'OK' : 'Modifier'}
      </button>
    </div>
  {/if}
</div>

<div class="contenu">
  <form class="ajout" onsubmit={ajouter}>
    <input
      bind:this={champ}
      bind:value={saisie}
      class="champ"
      type="text"
      placeholder="Ajouter un article…"
      autocomplete="off"
      autocapitalize="sentences"
      enterkeyhint="done"
      aria-label="Nouvel article"
    />
    <button class="bouton ajouter" type="submit" disabled={!saisie.trim()} aria-label="Ajouter"><Plus size={24} /></button>
  </form>

  {#if !courses.articles.length}
    <div class="vide">
      <p class="emoji" aria-hidden="true">🧺</p>
      <p><strong>Ta liste est vide.</strong></p>
      <p class="petit">
        Ajoute un article ci-dessus, ou depuis une recette avec le bouton « Ajouter aux courses » (les quantités
        suivent les portions choisies).
      </p>
    </div>
  {:else}
    {#if modification}
      <p class="aide discret petit">Touche un article pour changer son rayon (l'appli s'en souviendra).</p>
    {:else if !courses.restants.length}
      <p class="bravo">✓ Tout est dans le panier !</p>
    {/if}

    {#each groupes as g (g.rayon.id)}
      <h2 class="section-titre"><span aria-hidden="true">{g.rayon.emoji}</span> {g.rayon.nom}</h2>
      <ul class="liste">
        {#each g.articles as a (a.id)}{@render ligne(a)}{/each}
      </ul>
    {/each}

    {#if panier.length}
      <div class="entete-panier">
        <h2 class="section-titre">Dans le panier ({panier.length})</h2>
        <button class="bouton-icone" onclick={() => courses.retirerCoches()}>Retirer</button>
      </div>
      <ul class="liste">
        {#each panier as a (a.id)}{@render ligne(a)}{/each}
      </ul>
    {/if}

    {#if courses.recettes.length}
      <h2 class="section-titre">Recettes de la liste</h2>
      <ul class="liste">
        {#each courses.recettes as r (r.ficheId)}
          <li class="recette">
            <a href={lienFiche(r.ficheId)}>
              <span class="nom">{r.titre}</span>
              {#if r.quantites}<span class="origine">Pour {r.quantites}</span>{/if}
            </a>
            <button
              class="bouton-icone retirer"
              onclick={() => retirerRecette(r.ficheId, r.titre)}
              aria-label="Retirer les ingrédients de {r.titre}"
            >
              <X size={20} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="bouton secondaire plein vider-liste" onclick={vider}>
      <Trash2 size={19} /> Vider la liste ({pluriel(courses.articles.length, 'article')})
    </button>
  {/if}
</div>

<Feuille bind:ouvert={feuilleRayon} titre="Rayon" sousTitre={pourRayon?.nom}>
  <ul class="liste rayons">
    {#each RAYONS as r (r.id)}
      <li>
        <button class="rayon" onclick={() => choisirRayon(r.id)} aria-pressed={pourRayon?.rayon === r.id}>
          <span aria-hidden="true">{r.emoji}</span>
          <span class="nom-rayon">{r.nom}</span>
          {#if pourRayon?.rayon === r.id}<Check size={20} />{/if}
        </button>
      </li>
    {/each}
  </ul>
</Feuille>

<style>
  .actions {
    display: flex;
    align-items: center;
    margin-right: -8px;
  }

  .ajout {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .ajout .champ {
    flex: 1;
    min-width: 0;
  }

  .ajouter {
    flex: none;
    width: 48px;
    min-height: 44px;
    padding: 0;
  }

  .vide .emoji {
    font-size: 48px;
    margin: 12px 0 0;
  }

  .vide p {
    margin: 6px 0;
  }

  .aide {
    margin: 14px 4px 0;
  }

  .bravo {
    margin: 16px 4px 0;
    color: var(--vert);
    font-weight: 600;
  }

  .article {
    display: flex;
    align-items: center;
  }

  .supprimer {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    min-height: 48px;
    margin-left: 4px;
    border: none;
    background: none;
    color: var(--rouge);
  }

  .corps {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 8px 14px;
    border: none;
    background: none;
    text-align: left;
  }

  .corps:active {
    background: var(--surface-2);
  }

  .case {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    border: 2px solid var(--texte-3);
    color: var(--sur-accent);
  }

  .coche .case {
    border-color: var(--vert);
    background: var(--vert);
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .nom {
    font-size: 16.5px;
    line-height: 1.3;
  }

  .origine {
    font-size: 13px;
    color: var(--texte-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .qte {
    flex: none;
    max-width: 45%;
    text-align: right;
    font-size: 15px;
    color: var(--texte-2);
    font-variant-numeric: tabular-nums;
  }

  .coche .nom,
  .coche .qte {
    text-decoration: line-through;
    color: var(--texte-3);
  }

  .rayon-mini {
    flex: none;
    display: flex;
    align-items: center;
    color: var(--texte-3);
  }

  .entete-panier {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .entete-panier .bouton-icone {
    margin-bottom: 0;
  }

  .recette {
    display: flex;
    align-items: center;
  }

  .recette a {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    color: inherit;
    text-decoration: none;
  }

  .recette .nom {
    font-weight: 600;
  }

  .retirer {
    color: var(--texte-3);
  }

  .vider-liste {
    margin-top: 28px;
    color: var(--rouge);
  }

  .rayons {
    margin-top: 4px;
  }

  .rayon {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 8px 14px;
    border: none;
    background: none;
    text-align: left;
    font-size: 17px;
  }

  .rayon[aria-pressed='true'] {
    color: var(--accent);
    font-weight: 600;
  }

  .nom-rayon {
    flex: 1;
  }
</style>
