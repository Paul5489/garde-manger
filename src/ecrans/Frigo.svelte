<script lang="ts">
  import { Plus, X } from '@lucide/svelte';
  import LigneFrigo from '../composants/LigneFrigo.svelte';
  import { UNIVERS } from '../lib/archive';
  import { suggestions } from '../lib/classement-frigo';
  import { etat } from '../lib/etat.svelte';
  import { pluriel } from '../lib/format';
  import { frigo } from '../lib/frigo.svelte';
  import { majuscule } from '../lib/texte';
  import type { Resume, Univers } from '../lib/types';

  let saisie = $state('');
  let champ = $state<HTMLInputElement>();
  let univers = $state<Univers | null>(null);
  const PAS = 60;
  let limite = $state(PAS);

  // L'index des ingrédients suit l'archive importée et Mes recettes.
  $effect(() => {
    void frigo.chargerIndex(etat.versionRecettes, etat.mesRecettes);
  });

  const proposes = $derived(saisie.trim() ? suggestions(frigo.vocabulaire, saisie, frigo.exclus) : []);

  const tous = $derived(
    frigo.resultats.flatMap((r) => {
      const f = etat.parId.get(r.id);
      return f ? [{ r, f }] : [];
    }),
  );
  const parUnivers = $derived.by(() => {
    const c = new Map<Univers, number>();
    for (const x of tous) for (const u of x.f.univers) c.set(u, (c.get(u) ?? 0) + 1);
    return UNIVERS.filter((u) => c.has(u.id)).map((u) => ({ ...u, n: c.get(u.id)! }));
  });
  const filtres = $derived(univers ? tous.filter((x) => x.f.univers.includes(univers!)) : tous);

  // On repart du haut de la liste quand les ingrédients ou le filtre changent.
  $effect(() => {
    void frigo.possedes;
    void univers;
    limite = PAS;
  });

  function titreGroupe(n: number): string {
    if (n === 0) return 'Tu as tout';
    if (n <= 2) return `Il manque ${pluriel(n, 'ingrédient')}`;
    return 'Il en manque 3 ou plus';
  }

  const groupes = $derived.by(() => {
    const g: { titre: string; total: number; items: { r: (typeof tous)[number]['r']; f: Resume }[] }[] = [];
    const totaux = new Map<string, number>();
    for (const x of filtres) {
      const t = titreGroupe(x.r.manquants.length);
      totaux.set(t, (totaux.get(t) ?? 0) + 1);
    }
    for (const x of filtres.slice(0, limite)) {
      const t = titreGroupe(x.r.manquants.length);
      if (g[g.length - 1]?.titre !== t) g.push({ titre: t, total: totaux.get(t)!, items: [] });
      g[g.length - 1].items.push(x);
    }
    return g;
  });

  async function ajouter(nom: string) {
    saisie = '';
    await frigo.ajouter(nom);
    champ?.focus();
  }

  function valider(e: SubmitEvent) {
    e.preventDefault();
    if (saisie.trim()) void ajouter(saisie);
  }

  function toutEffacer() {
    if (confirm('Effacer tous les ingrédients ?')) void frigo.vider();
  }
</script>

<div class="grand-titre"><h1>Avec ce que j'ai</h1></div>

<div class="contenu">
  <form class="ajout" onsubmit={valider}>
    <input
      bind:this={champ}
      bind:value={saisie}
      class="champ"
      type="text"
      placeholder="Un ingrédient que tu as…"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="done"
      aria-label="Ingrédient que tu as"
    />
    <button class="bouton ajouter" type="submit" disabled={!saisie.trim()} aria-label="Ajouter"><Plus size={24} /></button>
  </form>

  {#if proposes.length}
    <ul class="liste suggestions" aria-label="Suggestions">
      {#each proposes as m (m.nom)}
        <li>
          <button class="suggestion" onclick={() => ajouter(m.nom)}>
            <span>{m.nom}</span>
            {#if m.n >= 1}<span class="discret petit">{pluriel(Math.round(m.n), 'recette')}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if frigo.possedes.length}
    <div class="choisis">
      {#each frigo.possedes as p (p)}
        <button class="puce active" onclick={() => frigo.retirer(p)} aria-label="Retirer {p}">{p} <X size={15} /></button>
      {/each}
      <button class="puce effacer" onclick={toutEffacer}>Tout effacer</button>
    </div>
  {/if}

  <p class="placard discret petit">
    Toujours à la maison : {frigo.placard.join(', ')} ·
    <a href="#/reglages/frigo">Modifier</a>
  </p>

  {#if !frigo.possedes.length}
    <div class="vide">
      <p class="emoji" aria-hidden="true">🧺</p>
      <p><strong>Qu'est-ce qu'on mange ?</strong></p>
      <p class="petit">
        Indique ce que tu as dans le frigo et les placards : l'appli te propose les recettes où il te manque le
        moins de choses, et te dit quoi.
      </p>
    </div>
  {:else if frigo.statutIndex === 'preparation' || frigo.statutIndex === 'attente'}
    <p class="vide">Préparation des ingrédients des recettes…</p>
  {:else if frigo.statutIndex === 'erreur'}
    <p class="vide">Impossible de lire les ingrédients des recettes. Réimporte l'archive dans les Réglages.</p>
  {:else if !tous.length}
    <p class="vide">Aucune recette n'utilise ces ingrédients. Essaie un nom plus simple (« poireau » plutôt que « blanc de poireau »).</p>
  {:else}
    {#if parUnivers.length > 1}
      <div class="filtres" role="group" aria-label="Univers">
        <button class="puce" class:active={!univers} onclick={() => (univers = null)}>Tout <span class="n">{tous.length}</span></button>
        {#each parUnivers as u (u.id)}
          <button class="puce" class:active={univers === u.id} onclick={() => (univers = univers === u.id ? null : u.id)}>
            {u.emoji} {majuscule(u.titre.replace('Cuisine ', ''))} <span class="n">{u.n}</span>
          </button>
        {/each}
      </div>
    {/if}
    {#each groupes as g (g.titre)}
      <h2 class="section-titre">{g.titre} ({g.total})</h2>
      <ul class="liste">
        {#each g.items as x (x.r.id)}
          <li><LigneFrigo fiche={x.f} resultat={x.r} /></li>
        {/each}
      </ul>
    {/each}
    {#if limite < filtres.length}
      <button class="bouton secondaire plein plus" onclick={() => (limite += PAS)}>
        Voir plus ({filtres.length - limite} autres)
      </button>
    {/if}
  {/if}
</div>

<style>
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

  .suggestions {
    margin-top: 8px;
  }

  .suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 46px;
    padding: 8px 14px;
    border: none;
    background: none;
    text-align: left;
  }

  .suggestion:active {
    background: var(--surface-2);
  }

  .choisis {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .effacer {
    color: var(--texte-2);
  }

  .placard {
    margin: 12px 4px 0;
  }

  .vide .emoji {
    font-size: 48px;
    margin: 12px 0 0;
  }

  .vide p {
    margin: 6px 0;
  }

  .filtres {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 11px -16px -5px;
    padding: 5px 16px;
  }

  .n {
    font-size: 12.5px;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }

  .plus {
    margin-top: 16px;
  }
</style>
