<script lang="ts">
  // Stock : les produits finis, triés par date limite, avec une alerte 7 jours avant.
  import { CalendarPlus, Check, RotateCcw, Snowflake, Trash2 } from '@lucide/svelte';
  import { annonce } from '../../lib/annonce.svelte';
  import { recette } from '../donnees';
  import FeuilleRappels from '../composants/FeuilleRappels.svelte';
  import { evenementsStock } from '../ics';
  import { date } from '../../lib/format';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { congelationDuStock, conservationCongelateur, etatStock } from '../lots';
  import { lots } from '../lots.svelte';
  import { joursCalendaires } from '../temps';
  import type { ArticleStock } from '../types';

  let finisOuverts = $state(false);
  let feuilleRappels = $state(false);
  const rappels = $derived(feuilleRappels ? evenementsStock(lots.stock, chambre.maintenant, chambre.heureRappels) : []);
  const parEcheance = (a: ArticleStock, b: ArticleStock) => (a.limite ?? '9999').localeCompare(b.limite ?? '9999');
  const enStock = $derived(lots.stock.filter((s) => s.statut === 'en-stock').sort(parEcheance));
  const finis = $derived(lots.stock.filter((s) => s.statut === 'fini').sort((a, b) => b.modifieLe - a.modifieLe));

  function echeance(a: ArticleStock): string {
    if (!a.limite) return 'Pas de date limite';
    const j = joursCalendaires(chambre.maintenant, a.limite);
    if (j < 0) return `Dépassée depuis le ${date(a.limite)}`;
    if (j === 0) return 'À finir aujourd’hui';
    return j <= 7 ? `À finir dans ${j} jour${j > 1 ? 's' : ''} (${date(a.limite)})` : `Jusqu’au ${date(a.limite)}`;
  }

  const recetteDe = (a: ArticleStock) => lots.lot(a.lotId ?? '')?.recette ?? recette(a.recetteId);
  const congelation = (a: ArticleStock) => congelationDuStock(a, recetteDe(a));

  async function congeler(a: ArticleStock) {
    const c = conservationCongelateur(a, recetteDe(a));
    if (!c || !confirm(`Mettre « ${a.nom} » au congélateur aujourd'hui ? (Garde : ${c.duree}.)`)) return;
    await lots.congeler(a.id);
    annonce.afficher(`${a.nom} : au congélateur, ${c.duree}.`);
  }

  async function supprimer(a: ArticleStock) {
    if (confirm(`Retirer « ${a.nom} » du stock ?`)) await lots.supprimerStock(a.id);
  }
</script>

<div class="contenu">
  <h1 class="titre-serif">Stock</h1>
  {#if !enStock.length}
    <p class="carte vide-carte">Rien en stock. Un lot terminé (« Mettre en stock ») arrive ici avec sa date limite.</p>
  {:else}
    <ul class="liste">
      {#each enStock as a (a.id)}
        {@const e = etatStock(a, chambre.maintenant)}
        <li class={e}>
          <div class="texte">
            <a href={a.lotId ? lienChambre('lot', a.lotId) : lienChambre('recette', a.recetteId)}><strong>{a.nom}</strong></a>
            <span class="petit discret">{a.conservation.mode} {t(a.conservation.comment)}{a.quantite ? ` · ${a.quantite}` : ''}</span>
            <span class="petit echeance">{echeance(a)}</span>
            {#if a.conservation.mode !== 'Congélateur'}
              {@const cg = congelation(a)}
              <span class="petit congelateur">
                Congélateur :
                {#if !cg}?{:else if cg.possible === 'oui'}possible, {t(cg.duree ?? '')} — {t(cg.texte)}{:else}{cg.possible === 'non' ? 'non' : 'inutile'} — {t(cg.texte)}{/if}
              </span>
              {#if cg?.possible === 'oui'}
                <button class="bouton secondaire congeler" onclick={() => congeler(a)}><Snowflake size={16} /> Mettre au congélateur</button>
              {/if}
            {/if}
          </div>
          <button class="bouton-icone" onclick={() => lots.stockFini(a.id)} aria-label="{a.nom} : fini"><Check size={20} /></button>
          <button class="bouton-icone" onclick={() => supprimer(a)} aria-label="Retirer {a.nom} du stock"><Trash2 size={18} /></button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if enStock.some((a) => a.limite)}
    <button class="bouton secondaire plein rappels" onclick={() => (feuilleRappels = true)}><CalendarPlus size={18} /> Dates limites dans le Calendrier</button>
  {/if}

  {#if finis.length}
    <button class="section-titre bascule" onclick={() => (finisOuverts = !finisOuverts)} aria-expanded={finisOuverts}>
      Finis ({finis.length}) {finisOuverts ? '▾' : '▸'}
    </button>
    {#if finisOuverts}
      <ul class="liste">
        {#each finis as a (a.id)}
          <li>
            <div class="texte"><strong>{a.nom}</strong><span class="petit discret">{a.conservation.mode} {t(a.conservation.comment)}</span></div>
            <button class="bouton-icone" onclick={() => lots.stockFini(a.id, false)} aria-label="Remettre {a.nom} en stock"><RotateCcw size={18} /></button>
            <button class="bouton-icone" onclick={() => supprimer(a)} aria-label="Supprimer {a.nom}"><Trash2 size={18} /></button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<FeuilleRappels
  bind:ouvert={feuilleRappels}
  titre="Dates limites du stock"
  evenements={rappels}
  nomFichier="rappels-stock.ics"
  sequence={Math.floor(chambre.maintenant / 1000)}
  maintenant={chambre.maintenant}
/>

<style>
  .rappels {
    margin-top: 12px;
  }

  h1 {
    font-size: 28px;
    margin: 4px 0 14px;
  }

  .vide-carte {
    padding: 14px;
    margin: 0;
    color: var(--texte-2);
  }

  li {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 6px 8px 14px;
    border-left: 4px solid transparent;
  }

  li.bientot {
    border-left-color: var(--ambre);
  }

  li.depasse {
    border-left-color: var(--rouge);
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .texte a {
    color: inherit;
    text-decoration: none;
  }

  .congelateur {
    color: var(--texte-2);
    margin-top: 2px;
  }

  .congeler {
    align-self: flex-start;
    min-height: 36px;
    margin-top: 6px;
    padding: 0 12px;
    font-size: 15px;
  }

  .bientot .echeance {
    color: var(--ambre);
    font-weight: 600;
  }

  .depasse .echeance {
    color: var(--rouge);
    font-weight: 600;
  }

  .bouton-icone {
    color: var(--texte-2);
  }

  .bascule {
    display: block;
    border: none;
    background: none;
    padding: 8px 0;
    min-height: 44px;
    text-align: left;
    width: 100%;
  }
</style>
