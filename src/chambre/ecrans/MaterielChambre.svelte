<script lang="ts">
  // Matériel à acheter, par échéance (materiel.json), à cocher ; puis le matériel des recettes prévues.
  import { ChevronRight } from '@lucide/svelte';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, recette } from '../donnees';
  import { NomMois } from '../recettes';

  const total = CONTENU.materiel.reduce((n, a) => n + a.articles.length, 0);
  const achetes = $derived(CONTENU.materiel.reduce((n, a) => n + a.articles.filter((x) => chambre.achats.includes(x)).length, 0));

  // Recettes prévues (étoiles), avec ce qu'il reste à cocher sur leur fiche.
  const prevues = $derived(
    [...new Set(chambre.etoiles.map((e) => e.split('@')[0]))]
      .map((id) => recette(id))
      .filter((r) => !!r)
      .map((r) => ({
        r: r!,
        mois: chambre.etoiles.filter((e) => e.startsWith(`${r!.id}@`)).map((e) => Number(e.split('@')[1])),
        restant: r!.materiel.filter((m) => !(chambre.materielFiches[r!.id] ?? []).includes(m)).length,
      })),
  );
</script>

<div class="contenu">
  <h1 class="titre-serif">Matériel à acheter</h1>
  <p class="discret">{achetes} sur {total} achetés.</p>

  {#each CONTENU.materiel as groupe (groupe.echeance)}
    <h2 class="section-titre">{groupe.echeance}</h2>
    <ul class="liste cases">
      {#each groupe.articles as a (a)}
        {@const coche = chambre.achats.includes(a)}
        <li class:coche>
          <label>
            <input type="checkbox" checked={coche} onchange={(e) => chambre.cocherAchat(a, e.currentTarget.checked)} />
            <span>{t(a)}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/each}

  <h2 class="section-titre">Matériel des recettes prévues</h2>
  {#if prevues.length}
    <ul class="liste prevues">
      {#each prevues as p (p.r.id)}
        <li>
          <a href={lienChambre('recette', p.r.id)}>
            <span class="texte">
              <strong>{p.r.nom}</strong>
              <span class="petit discret">
                {p.mois.map((m) => NomMois(m)).join(', ')} · {p.restant ? `${p.restant} sur ${p.r.materiel.length} à préparer` : 'tout est prêt ✓'}
              </span>
            </span>
            <ChevronRight size={18} />
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="carte vide-carte petit discret">
      Mets une étoile ★ aux recettes que tu prévois (calendrier ou fiche) : leur matériel apparaîtra ici.
    </p>
  {/if}
</div>

<style>
  h1 {
    font-size: 28px;
    margin: 4px 0 4px;
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

  .cases .coche span {
    color: var(--texte-3);
    text-decoration: line-through;
  }

  .prevues a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 9px 14px;
    color: inherit;
    text-decoration: none;
  }

  .prevues :global(svg) {
    color: var(--texte-3);
  }

  .texte {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .vide-carte {
    padding: 14px;
    margin: 0;
  }
</style>
