<script lang="ts">
  // Formulaire d'une recette perso : nouvelle (préparée dans l'onglet Ajouter, ou écrite à la main)
  // ou modification. Vérifier, corriger, enregistrer.
  import BarreHaut from '../composants/BarreHaut.svelte';
  import { ajout } from '../lib/ajout.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import {
    brouillonVide,
    construireFiche,
    ficheVersBrouillon,
    TYPES_DE_PLAT,
    type Brouillon,
  } from '../lib/mes-recettes';
  import { estMaRecette, NOMS_SOURCES } from '../lib/archive';
  import { mesRecettes } from '../lib/mes-recettes.svelte';
  import { etat } from '../lib/etat.svelte';
  import { lienFiche, routeur } from '../lib/routeur.svelte';
  import { collator } from '../lib/texte';
  import type { Fiche } from '../lib/types';

  let { id }: { id?: string } = $props();

  // L'écran est recréé pour chaque recette (bloc {#key} dans App) : la valeur initiale d'id suffit.
  // Recette préparée dans l'onglet Ajouter (lue par Claude ou rangée sans Claude), prise une seule fois.
  // svelte-ignore state_referenced_locally
  const enAttente = id ? null : ajout.prendre();

  /** Recette modifiée : à moi, ou de l'archive (une copie modifiée la remplacera, l'original reste disponible). */
  let existante = $state.raw<Fiche | undefined>(undefined);
  // svelte-ignore state_referenced_locally
  let chargee = $state(!id);
  let introuvable = $state(false);
  let b = $state<Brouillon>(enAttente?.brouillon ?? brouillonVide());
  // svelte-ignore state_referenced_locally
  if (id)
    etat.fiche(id).then((f) => {
      if (f) {
        existante = f;
        b = ficheVersBrouillon(f);
      } else introuvable = true;
      chargee = true;
    });
  /** Fiche de départ : tout ce qui n'est pas retouché est gardé tel quel. */
  const base = $derived<Fiche | undefined>(existante ?? enAttente?.base);
  const deLArchive = $derived(!!existante && !estMaRecette(existante) && etat.aUnOriginal(existante.id));
  let enCours = $state(false);
  let erreur = $state<string | null>(null);

  // Listes proposées pendant la frappe (catégories et cuisines déjà utilisées).
  const categories = $derived(
    [...new Set(etat.catalogue.map((r) => r.categorie).filter((c): c is string => !!c))].sort(collator.compare),
  );
  const cuisines = $derived([...new Set(etat.catalogue.flatMap((r) => r.cuisines))].sort(collator.compare));

  async function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    if (!b.titre.trim() || enCours) return;
    enCours = true;
    try {
      const fiche = construireFiche($state.snapshot(b), base);
      await mesRecettes.enregistrer(fiche);
      annonce.afficher(existante ? 'Recette modifiée.' : 'Recette ajoutée.');
      routeur.remplacerPage(lienFiche(fiche.id));
    } catch (err) {
      erreur = err instanceof Error ? err.message : String(err);
    } finally {
      enCours = false;
    }
  }

  // svelte-ignore state_referenced_locally
  const titreEcran = id ? 'Modifier la recette' : 'Nouvelle recette';
</script>

<div class="ecran calque">
  <BarreHaut titre={titreEcran} avecTrait />
  <div class="contenu">
    {#if !chargee}
      <p class="vide">Chargement…</p>
    {:else if introuvable}
      <p class="vide">Cette recette n'existe plus.</p>
    {:else}
      <h1 class="titre-serif">{titreEcran}</h1>
      {#if deLArchive && existante}
        <p class="aide carte">
          Tu modifies une recette de « {NOMS_SOURCES[existante.source.id] ?? existante.source.nom} ». Ta version la remplacera
          partout ; l'original reste disponible (bouton « Revenir à l'original » en bas de la fiche).
        </p>
      {/if}
      {#if enAttente?.info}
        <div class="aide carte">
          <p>{enAttente.info}</p>
          {#if enAttente.modifications?.length}
            <ul>{#each enAttente.modifications as m, i (i)}<li>{m}</li>{/each}</ul>
          {/if}
        </div>
      {/if}
      <form onsubmit={enregistrer}>
        <label class="champ-libelle">
          <span>Titre</span>
          <input class="champ" bind:value={b.titre} required placeholder="Tarte aux poireaux" autocomplete="off" />
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

  .aide p,
  .aide ul {
    margin: 0;
  }

  .aide ul {
    margin-top: 6px;
    padding-left: 1.2em;
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

</style>
