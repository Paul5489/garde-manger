<script lang="ts">
  import { BookOpen, Plus, Trash2 } from '@lucide/svelte';
  import CarteBocal from '../composants/CarteBocal.svelte';
  import Feuille from '../composants/Feuille.svelte';
  import { libelleDuree } from '../lib/bocaux';
  import { bocaux } from '../lib/bocaux.svelte';
  import { pluriel } from '../lib/format';
  import { recherche } from '../lib/recherche.svelte';
  import { lienNouveauBocal, routeur } from '../lib/routeur.svelte';

  /** Affiché comme une page de la Chambre (sous une barre avec « Retour »). */
  let { enPage = false }: { enPage?: boolean } = $props();

  let feuille = $state(false);
  let finisOuverts = $state(false);

  const r = $derived(bocaux.parRubrique);
  const rien = $derived(!bocaux.liste.length);

  function aller(lien: string) {
    feuille = false;
    routeur.aller(lien);
  }

  function depuisRecette() {
    feuille = false;
    recherche.ouvrirUnivers('fermentation');
    routeur.ouvrirOnglet('recherche');
  }

  function supprimerModele(id: string, nom: string) {
    if (confirm(`Supprimer le modèle « ${nom} » ? (Les bocaux déjà créés ne changent pas.)`)) void bocaux.supprimerModele(id);
  }
</script>

<div class="grand-titre" class:en-page={enPage}>
  <h1>Mes bocaux</h1>
  <button class="bouton-icone" onclick={() => (feuille = true)}><Plus size={24} /> Nouveau</button>
</div>

<div class="contenu">
  {#if rien}
    <div class="vide">
      <p class="emoji" aria-hidden="true">🫙</p>
      <p><strong>Aucun bocal pour l'instant.</strong></p>
      <p class="petit">
        Démarre un bocal depuis une recette de fermentation (bouton « Démarrer un bocal » sur la fiche), ou librement
        pour ton kimchi : l'appli compte les jours et te dit quand goûter.
      </p>
      <button class="bouton" onclick={() => (feuille = true)}><Plus size={20} /> Nouveau bocal</button>
    </div>
  {:else}
    {#each [['a-gouter', "À goûter aujourd'hui"], ['prets', 'Prêts'], ['en-cours', 'En cours']] as const as [cle, titre] (cle)}
      {#if r[cle].length}
        <h2 class="section-titre">{titre} ({r[cle].length})</h2>
        <div class="cartes">
          {#each r[cle] as b (b.id)}<CarteBocal bocal={b} maintenant={bocaux.maintenant} />{/each}
        </div>
      {/if}
    {/each}
    {#if !r['a-gouter'].length && !r.prets.length && !r['en-cours'].length}
      <p class="vide">Aucun bocal en cours.</p>
    {/if}
    {#if r.finis.length}
      <button class="section-titre bascule" onclick={() => (finisOuverts = !finisOuverts)} aria-expanded={finisOuverts}>
        Terminés ({r.finis.length}) {finisOuverts ? '▾' : '▸'}
      </button>
      {#if finisOuverts}
        <div class="cartes">
          {#each r.finis as b (b.id)}<CarteBocal bocal={b} maintenant={bocaux.maintenant} />{/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<Feuille bind:ouvert={feuille} titre="Nouveau bocal">
  <ul class="liste choix">
    <li>
      <button onclick={() => aller(lienNouveauBocal())}>
        <span class="icone" aria-hidden="true">✏️</span>
        <span class="texte"><strong>Bocal libre</strong><span class="discret petit">Tu règles tout (ex. ton kimchi)</span></span>
      </button>
    </li>
    <li>
      <button onclick={depuisRecette}>
        <span class="icone" aria-hidden="true"><BookOpen size={20} /></span>
        <span class="texte">
          <strong>Depuis une recette de fermentation</strong>
          <span class="discret petit">Sel, température et durées pré-remplis (Noma)</span>
        </span>
      </button>
    </li>
  </ul>
  {#if bocaux.modeles.length}
    <h3 class="section-titre">Mes modèles</h3>
    <ul class="liste choix">
      {#each bocaux.modeles as m (m.id)}
        <li class="modele">
          <button onclick={() => aller(lienNouveauBocal({ modele: m.id }))}>
            <span class="icone" aria-hidden="true">🫙</span>
            <span class="texte">
              <strong>{m.nom}</strong>
              <span class="discret petit">
                {m.etapes.length > 1 ? pluriel(m.etapes.length, 'étape') : libelleDuree(m.etapes[0] ?? { unite: 'jours' })}
              </span>
            </span>
          </button>
          <button class="bouton-icone supprimer" onclick={() => supprimerModele(m.id, m.nom)} aria-label="Supprimer le modèle {m.nom}">
            <Trash2 size={18} />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="discret petit astuce">
      Astuce : sur la page d'un bocal, « Enregistrer comme modèle » le garde ici pour la prochaine fois.
    </p>
  {/if}
</Feuille>

<style>
  .en-page {
    padding-top: 4px;
  }

  .cartes {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vide .emoji {
    font-size: 48px;
    margin: 12px 0 0;
  }

  .vide p {
    margin: 6px 0;
  }

  .vide .bouton {
    margin-top: 16px;
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

  .choix li {
    display: flex;
    align-items: center;
  }

  .choix button:first-child {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 10px 14px;
    border: none;
    background: none;
    text-align: left;
  }

  .choix button:first-child:active {
    background: var(--surface-2);
  }

  .icone {
    flex: none;
    width: 28px;
    display: flex;
    justify-content: center;
    font-size: 20px;
    color: var(--accent);
  }

  .texte {
    display: flex;
    flex-direction: column;
  }

  .supprimer {
    color: var(--texte-3);
  }

  .astuce {
    margin: 14px 4px 0;
  }
</style>
