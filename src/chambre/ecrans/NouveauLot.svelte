<script lang="ts">
  // Démarrer un lot depuis une fiche : date et heure d'entrée, quantité de base, poids d'entrée, notes.
  import { ShieldAlert } from '@lucide/svelte';
  import { nombre } from '../../lib/format';
  import { lienChambre, routeur } from '../../lib/routeur.svelte';
  import { quandLisible, t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, recette } from '../donnees';
  import { finPrevue, nouveauLot, occurrences } from '../lots';
  import { lots } from '../lots.svelte';
  import { phaseCave } from '../recettes';
  import { depuisChampDateHeure, versChampDateHeure } from '../temps';

  let { recetteId }: { recetteId: string } = $props();

  const r = $derived(recette(recetteId));
  const technique = $derived(r?.technique ? CONTENU.techniques[r.technique] : undefined);

  let quand = $state(versChampDateHeure(new Date()));
  let quantite = $state('');
  let poids = $state('');
  let notes = $state('');
  let enCours = $state(false);

  const nombreDe = (v: string) => Number(v.replace(',', '.').replace(/\s/g, ''));
  // Poids d'entrée : quand la fin se juge à la perte de poids, sauf si elle se compte depuis l'entrée en Cave.
  const demandePoids = $derived(!!r && r.fin.type === 'perte_poids' && phaseCave(r) < 0);
  const entree = $derived(depuisChampDateHeure(quand));
  const valide = $derived(!!entree && (!demandePoids || nombreDe(poids) > 0) && (quantite.trim() === '' || nombreDe(quantite) > 0));

  // Aperçu des dates, calculé comme pour le vrai lot.
  const apercu = $derived(
    r && entree
      ? nouveauLot(r, technique, { entree, quantiteBase: nombreDe(quantite) || r.base.quantite, poidsEntree: nombreDe(poids) || undefined }, 'apercu')
      : undefined,
  );
  const fin = $derived(apercu ? finPrevue(apercu) : undefined);
  const premiers = $derived(apercu ? occurrences(apercu, chambre.heureRappels).slice(0, 4) : []);
  const courte = $derived((r?.duree.max_j ?? 9) <= 3);
  const securite = $derived([...(technique?.securite ?? []), ...(r?.securite ?? [])]);

  async function demarrer(e: Event) {
    e.preventDefault();
    if (!r || !entree || !valide || enCours) return;
    enCours = true;
    const lot = await lots.creer(r, {
      entree,
      quantiteBase: nombreDe(quantite) || r.base.quantite,
      poidsEntree: demandePoids ? nombreDe(poids) : undefined,
      notes,
    });
    routeur.remplacerPage(lienChambre('lot', lot.id));
  }
</script>

{#if !r}
  <p class="vide">Cette recette n'existe pas.</p>
{:else}
  <form class="contenu" onsubmit={demarrer}>
    <p class="surtitre">Nouveau lot</p>
    <h1 class="titre-serif">{r.nom}</h1>

    <label class="champ-bloc">
      <span>Date et heure d'entrée</span>
      <input class="champ" type="datetime-local" bind:value={quand} required />
    </label>
    <label class="champ-bloc">
      <span>{t(r.base.ingredient)} ({r.base.unite})</span>
      <input class="champ" type="text" inputmode="decimal" bind:value={quantite} placeholder={nombre(r.base.quantite)} />
    </label>
    {#if demandePoids}
      <label class="champ-bloc">
        <span>Poids d'entrée (g) — la fin se juge à {r.fin.cible}&nbsp;% de perte</span>
        <input class="champ" type="text" inputmode="decimal" bind:value={poids} placeholder="ex. 1 000" required />
      </label>
    {:else if r.fin.type === 'perte_poids'}
      <p class="petit discret">Le poids se note à l'entrée en Cave : la perte se compte depuis ce poids.</p>
    {/if}
    <label class="champ-bloc">
      <span>Notes</span>
      <textarea class="champ" rows="2" bind:value={notes} placeholder="Provenance, poids des pièces…"></textarea>
    </label>

    {#if securite.length && (r.famille === 'charc' || r.technique === 'saucisson')}
      <div class="carte securite">
        <ShieldAlert size={22} />
        <ul>
          {#each securite as s (s)}<li>{t(s)}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if fin}
      <div class="carte apercu">
        <p>
          Fin prévue
          <strong>
            {courte
              ? `entre ${quandLisible(fin.min, true, chambre.maintenant)} et ${quandLisible(fin.max, true, chambre.maintenant)}`
              : `entre ${quandLisible(fin.min, false, chambre.maintenant)} et ${quandLisible(fin.max, false, chambre.maintenant)}`}
          </strong>
        </p>
        {#if premiers.length}
          <p class="petit discret">Premiers contrôles :</p>
          <ul>
            {#each premiers as o (o.cle)}
              <li><strong>{quandLisible(o.quand, o.exacte, chambre.maintenant)}</strong> · {t(o.controle.titre)}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <button class="bouton plein" type="submit" disabled={!valide || enCours}>Démarrer le lot</button>
  </form>
{/if}

<style>
  .surtitre {
    margin: 4px 0 2px;
    font-size: 14px;
    color: var(--texte-2);
  }

  h1 {
    font-size: 28px;
    margin-bottom: 14px;
  }

  .champ-bloc {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    font-weight: 600;
  }

  textarea {
    resize: vertical;
    font-weight: 400;
  }

  .securite {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 14px;
    border-left: 5px solid var(--rouge);
    font-size: 15px;
  }

  .securite :global(svg) {
    flex: none;
    color: var(--rouge);
  }

  .securite ul {
    margin: 0;
    padding-left: 1.1em;
  }

  .apercu {
    padding: 12px 14px;
    margin-bottom: 16px;
  }

  .apercu p {
    margin: 0 0 6px;
  }

  .apercu ul {
    margin: 0;
    padding-left: 1.1em;
    font-size: 15px;
  }
</style>
