<script lang="ts">
  // Mes recettes : nouvelle recette (texte collé analysé, ou saisie à la main) ou modification.
  import { ClipboardPaste, FileDown, PenLine, Sparkles } from '@lucide/svelte';
  import BarreHaut from '../composants/BarreHaut.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import {
    analyserTexte,
    brouillonVide,
    construireFiche,
    ficheVersBrouillon,
    TYPES_DE_PLAT,
    type Brouillon,
  } from '../lib/mes-recettes';
  import { mesRecettes } from '../lib/mes-recettes.svelte';
  import { etat } from '../lib/etat.svelte';
  import { pluriel } from '../lib/format';
  import { lienFiche, routeur } from '../lib/routeur.svelte';
  import { lireSauvegarde, restaurer, TABLES_VIDES } from '../lib/sauvegarde';
  import { collator } from '../lib/texte';

  let { id }: { id?: string } = $props();

  // L'écran est recréé pour chaque recette (bloc {#key} dans App) : la valeur initiale d'id suffit.
  // svelte-ignore state_referenced_locally
  let etape = $state<'coller' | 'formulaire' | 'introuvable'>(id ? 'formulaire' : 'coller');
  let texte = $state('');
  let b = $state<Brouillon>(brouillonVide());
  let enCours = $state(false);
  let erreur = $state<string | null>(null);
  let champFichier = $state<HTMLInputElement>();

  $effect(() => {
    if (!id) return;
    const f = mesRecettes.trouver(id);
    if (f) b = ficheVersBrouillon(f);
    else etape = 'introuvable';
  });

  // Listes proposées pendant la frappe (catégories et cuisines déjà utilisées).
  const categories = $derived(
    [...new Set(etat.catalogue.map((r) => r.categorie).filter((c): c is string => !!c))].sort(collator.compare),
  );
  const cuisines = $derived([...new Set(etat.catalogue.flatMap((r) => r.cuisines))].sort(collator.compare));

  function analyser() {
    if (!texte.trim()) return;
    b = analyserTexte(texte);
    etape = 'formulaire';
    requestAnimationFrame(() => document.querySelector('.calque')?.scrollTo({ top: 0 }));
  }

  function aLaMain() {
    b = brouillonVide();
    etape = 'formulaire';
  }

  async function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    if (!b.titre.trim() || enCours) return;
    enCours = true;
    try {
      const existante = id ? mesRecettes.trouver(id) : undefined;
      const fiche = construireFiche($state.snapshot(b), existante);
      await mesRecettes.enregistrer(fiche);
      annonce.afficher(existante ? 'Recette modifiée.' : 'Recette ajoutée à « Mes recettes ».');
      routeur.remplacerPage(lienFiche(fiche.id));
    } catch (err) {
      erreur = err instanceof Error ? err.message : String(err);
    } finally {
      enCours = false;
    }
  }

  /** Fichier de recette préparé sur le Mac (même format qu'une sauvegarde) : ajouté sans rien effacer. */
  async function fichierChoisi(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    erreur = null;
    try {
      const s = lireSauvegarde(JSON.parse(await fichier.text()));
      const recettes = s.donnees.mesRecettes;
      if (!recettes.length) throw new Error("Ce fichier ne contient aucune recette à ajouter.");
      await restaurer({ ...s, donnees: { ...TABLES_VIDES(), mesRecettes: recettes } });
      await mesRecettes.charger();
      const premiere = recettes[0] as { id: string; titre: string };
      annonce.afficher(
        recettes.length === 1 ? `« ${premiere.titre} » ajoutée.` : `${pluriel(recettes.length, 'recette ajoutée', 'recettes ajoutées')}.`,
      );
      if (recettes.length === 1) routeur.remplacerPage(lienFiche(premiere.id));
      else routeur.retour();
    } catch (err) {
      erreur =
        err instanceof SyntaxError
          ? "Ce fichier est illisible. Choisis un fichier de recette Garde-manger (.json)."
          : err instanceof Error
            ? err.message
            : String(err);
    }
  }

  const titreEcran = $derived(id ? 'Modifier la recette' : 'Nouvelle recette');
</script>

<input bind:this={champFichier} type="file" onchange={fichierChoisi} hidden />

<div class="ecran calque">
  <BarreHaut titre={titreEcran} avecTrait />
  <div class="contenu">
    {#if etape === 'introuvable'}
      <p class="vide">Cette recette n'existe plus.</p>
    {:else if etape === 'coller'}
      <h1 class="titre-serif">Nouvelle recette</h1>
      <p class="discret">
        Colle le texte d'une recette (copié sur un site, un message…). L'appli range elle-même le titre, les
        ingrédients et les étapes ; tu vérifies ensuite avant d'enregistrer.
      </p>
      <label class="champ-libelle">
        <span>Texte de la recette</span>
        <textarea
          class="champ grand"
          bind:value={texte}
          rows="12"
          placeholder={'Titre\n\nIngrédients\n200 g de farine\n2 œufs…\n\nPréparation\nMélanger…'}
        ></textarea>
      </label>
      <button class="bouton plein" onclick={analyser} disabled={!texte.trim()}>
        <Sparkles size={20} /> Ranger la recette
      </button>
      <div class="autres">
        <button class="bouton secondaire plein" onclick={aLaMain}><PenLine size={20} /> Remplir à la main</button>
        <button class="bouton secondaire plein" onclick={() => champFichier?.click()}>
          <FileDown size={20} /> Ajouter un fichier de recette
        </button>
      </div>
      <p class="discret petit">
        <ClipboardPaste size={14} /> Pour coller : touche longuement la zone de texte, puis « Coller ».
      </p>
      {#if erreur}<p class="message-erreur" role="alert">{erreur}</p>{/if}
    {:else}
      <h1 class="titre-serif">{titreEcran}</h1>
      {#if !id && b.texteSource}
        <p class="aide carte">✓ Recette rangée automatiquement. Vérifie chaque partie, corrige si besoin, puis enregistre.</p>
      {/if}
      <form onsubmit={enregistrer}>
        <label class="champ-libelle">
          <span>Titre</span>
          <input class="champ" bind:value={b.titre} required placeholder="Bissap à l'ananas" autocomplete="off" />
        </label>
        <label class="champ-libelle">
          <span>Présentation <span class="discret">(facultatif)</span></span>
          <textarea class="champ" rows="2" bind:value={b.description}></textarea>
        </label>

        <div class="grille-2">
          <label class="champ-libelle">
            <span>Type de plat</span>
            <input class="champ" bind:value={b.typeDePlat} list="types-plat" placeholder="Boisson" autocomplete="off" />
          </label>
          <label class="champ-libelle">
            <span>Cuisine</span>
            <input class="champ" bind:value={b.cuisine} list="cuisines" placeholder="Africaine" autocomplete="off" />
          </label>
        </div>
        <label class="champ-libelle">
          <span>Catégorie <span class="discret">(facultatif)</span></span>
          <input class="champ" bind:value={b.categorie} list="categories" placeholder="Boissons" autocomplete="off" />
        </label>
        <datalist id="types-plat">{#each TYPES_DE_PLAT as t (t)}<option value={t}></option>{/each}</datalist>
        <datalist id="cuisines">{#each cuisines as c (c)}<option value={c}></option>{/each}</datalist>
        <datalist id="categories">{#each categories as c (c)}<option value={c}></option>{/each}</datalist>

        <div class="grille-2">
          <label class="champ-libelle">
            <span>Portions</span>
            <input class="champ" bind:value={b.portions} inputmode="decimal" placeholder="4" />
          </label>
          <label class="champ-libelle">
            <span>Unité</span>
            <input class="champ" bind:value={b.unitePortions} placeholder="personnes" autocomplete="off" />
          </label>
        </div>
        <label class="champ-libelle">
          <span>Rendement <span class="discret">(si pas de portions : « 1,3 litre »)</span></span>
          <input class="champ" bind:value={b.rendement} autocomplete="off" />
        </label>
        <div class="grille-3">
          <label class="champ-libelle">
            <span>Préparation</span>
            <input class="champ" bind:value={b.preparation} placeholder="15 min" autocomplete="off" />
          </label>
          <label class="champ-libelle">
            <span>Cuisson</span>
            <input class="champ" bind:value={b.cuisson} placeholder="10 min" autocomplete="off" />
          </label>
          <label class="champ-libelle">
            <span>Repos</span>
            <input class="champ" bind:value={b.repos} placeholder="2 h" autocomplete="off" />
          </label>
        </div>

        <label class="champ-libelle">
          <span>Ingrédients <span class="discret">— un par ligne ; « Pour la sauce : » crée un groupe</span></span>
          <textarea class="champ grand" rows="10" bind:value={b.ingredients} placeholder={'50 g de sucre\n1 litre d’eau'}></textarea>
        </label>
        <label class="champ-libelle">
          <span>Étapes <span class="discret">— une par ligne ; « Titre : texte » donne un titre</span></span>
          <textarea class="champ grand" rows="10" bind:value={b.etapes}></textarea>
        </label>
        <label class="champ-libelle">
          <span>Remarques, astuces <span class="discret">(facultatif)</span></span>
          <textarea class="champ" rows="3" bind:value={b.notes}></textarea>
        </label>

        {#if erreur}<p class="message-erreur" role="alert">{erreur}</p>{/if}
        <button class="bouton plein" type="submit" disabled={enCours || !b.titre.trim()}>
          {id ? 'Enregistrer les modifications' : 'Enregistrer la recette'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .calque {
    z-index: 10;
  }

  h1 {
    font-size: 28px;
    margin: 4px 0 8px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .champ-libelle {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  form .champ-libelle {
    margin-bottom: 0;
  }

  .champ-libelle > span {
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-2);
  }

  .champ-libelle > span .discret {
    font-weight: 400;
  }

  textarea.champ {
    resize: vertical;
    line-height: 1.4;
    font-size: 16px;
  }

  textarea.grand {
    min-height: 12em;
  }

  .grille-2,
  .grille-3 {
    display: grid;
    gap: 8px;
  }

  .grille-2 {
    grid-template-columns: 1fr 1fr;
  }

  .grille-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .grille-2 .champ,
  .grille-3 .champ {
    min-width: 0;
  }

  .autres {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 10px 0 14px;
  }

  .aide {
    padding: 10px 14px;
    margin: 0 0 14px;
    font-size: 15px;
    background: var(--vert-doux);
    color: var(--vert);
    box-shadow: none;
  }

  .message-erreur {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--accent-doux);
    color: var(--rouge);
    font-size: 15px;
  }

  p :global(svg) {
    vertical-align: -2px;
  }
</style>
