<script lang="ts">
  // Choix des ingrédients d'une fiche à mettre dans la liste de courses (avec les portions choisies).
  import { Check } from '@lucide/svelte';
  import Feuille from './Feuille.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import { courses } from '../lib/courses.svelte';
  import { pluriel } from '../lib/format';
  import { propositionsDeLaFiche } from '../lib/liste-courses';
  import { portions, texteQuantites } from '../lib/portions.svelte';
  import { routeur } from '../lib/routeur.svelte';
  import type { Fiche } from '../lib/types';

  let { fiche, ouvert = $bindable(false) }: { fiche: Fiche; ouvert: boolean } = $props();

  const coef = $derived(portions.coef(fiche.id));
  const sections = $derived(propositionsDeLaFiche(fiche, coef));
  const quantites = $derived(texteQuantites(fiche, coef));
  const dejaLa = $derived(courses.recette(fiche.id));

  let choix = $state(new Set<string>());
  // À chaque ouverture : on repart des choix proposés (eau, sel, poivre, alternatives et facultatifs décochés).
  $effect(() => {
    if (!ouvert) return;
    choix = new Set(sections.flatMap((s, i) => s.items.flatMap((p, j) => (p.coche ? [`${i}-${j}`] : []))));
  });

  const total = $derived(sections.reduce((n, s) => n + s.items.length, 0));

  function basculer(cle: string) {
    const s = new Set(choix);
    if (s.has(cle)) s.delete(cle);
    else s.add(cle);
    choix = s;
  }

  function tout(cocher: boolean) {
    choix = cocher ? new Set(sections.flatMap((s, i) => s.items.map((_, j) => `${i}-${j}`))) : new Set();
  }

  async function ajouter() {
    const choisis = sections.flatMap((s, i) => s.items.filter((_, j) => choix.has(`${i}-${j}`)));
    if (!choisis.length) return;
    const miseAJour = !!dejaLa;
    await courses.ajouterRecette({ ficheId: fiche.id, titre: fiche.titre, coef, quantites }, choisis);
    ouvert = false;
    annonce.afficher(
      miseAJour
        ? 'Liste de courses mise à jour'
        : `${pluriel(choisis.length, 'ingrédient ajouté', 'ingrédients ajoutés')} à ta liste`,
      { libelle: 'Voir', faire: () => routeur.ouvrirOnglet('courses') },
    );
  }
</script>

<Feuille bind:ouvert titre="Ajouter aux courses" sousTitre={quantites ? `Pour ${quantites} · à régler sur la fiche` : 'Quantités de la fiche'}>
  {#if dejaLa}
    <p class="deja carte">
      Cette recette est déjà dans ta liste{#if dejaLa.quantites}&nbsp;(pour {dejaLa.quantites}){/if} : ses
      ingrédients seront remplacés par ceux-ci.
    </p>
  {/if}
  <div class="tout">
    <button class="puce" onclick={() => tout(true)}>Tout cocher</button>
    <button class="puce" onclick={() => tout(false)}>Tout décocher</button>
  </div>
  {#each sections as s, i (i)}
    {#if s.titre}<h3>{s.titre}</h3>{/if}
    <ul class="liste">
      {#each s.items as p, j (j)}
        {@const cle = `${i}-${j}`}
        <li>
          <button class="choix" role="checkbox" aria-checked={choix.has(cle)} onclick={() => basculer(cle)}>
            <span class="case" class:cochee={choix.has(cle)} aria-hidden="true">
              {#if choix.has(cle)}<Check size={16} strokeWidth={3} />{/if}
            </span>
            <span class="nom">{p.nom}</span>
            <span class="qte">{p.quantite}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
  {#snippet pied()}
    <button class="bouton plein" onclick={ajouter} disabled={!choix.size}>
      {#if choix.size}Ajouter {choix.size} sur {total}{:else}Rien de coché{/if}
    </button>
  {/snippet}
</Feuille>

<style>
  .deja {
    margin: 4px 0 10px;
    padding: 10px 14px;
    font-size: 14.5px;
    color: var(--texte-2);
  }

  .tout {
    display: flex;
    gap: 8px;
    margin: 4px 0 6px;
  }

  h3 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--texte-2);
    margin: 16px 4px 8px;
  }

  .liste {
    margin-top: 8px;
  }

  .choix {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 8px 14px;
    border: none;
    background: none;
    text-align: left;
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

  .case.cochee {
    border-color: var(--accent);
    background: var(--accent);
  }

  .nom {
    flex: 1;
    min-width: 0;
  }

  .qte {
    flex: none;
    color: var(--texte-2);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
</style>
