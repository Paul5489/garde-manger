<script lang="ts">
  import { BellOff, Pause, Play, Plus, Timer, X } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { chrono, libelleDuree } from '../lib/durees';
  import { heure } from '../lib/format';
  import { alarme } from '../lib/alarme.svelte';
  import { minuteurs, type Minuteur } from '../lib/minuteurs.svelte';
  import { portail } from '../lib/portail';

  let { enCuisine = false }: { enCuisine?: boolean } = $props();

  let ouvert = $state(false);
  const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

  const premier = $derived(minuteurs.visibles[0]);
  const actifs = $derived(minuteurs.visibles.filter((m) => m.etat !== 'fini'));

  function etatTexte(m: Minuteur): string {
    if (m.etat === 'pause') return 'En pause';
    if (m.etat === 'fini') return `Terminé à ${heure(m.finiA ?? Date.now())}`;
    return `Fin à ${heure(m.fin ?? Date.now())}`;
  }

  $effect(() => {
    if (!minuteurs.visibles.length) ouvert = false;
  });
</script>

<!-- Pastille flottante : le minuteur le plus proche -->
{#if premier && !minuteurs.sonnent.length}
  <button
    class="pastille-minuteur"
    class:en-cuisine={enCuisine}
    class:pause={premier.etat === 'pause'}
    onclick={() => (ouvert = true)}
    transition:fly={{ y: 40, duration: 200 }}
    aria-label="Minuteurs"
  >
    <Timer size={18} strokeWidth={2.4} />
    <span class="temps">{chrono(minuteurs.restant(premier) / 1000)}</span>
    {#if actifs.length > 1}<span class="plus">+{actifs.length - 1}</span>{/if}
  </button>
{/if}

<!-- Alarme : minuteur terminé -->
{#if minuteurs.sonnent.length}
  <div use:portail>
    <div class="alarme-voile" transition:fade={{ duration: 150 }}></div>
    <div class="alarmes" role="alertdialog" aria-label="Minuteur terminé" transition:fly={{ y: -60, duration: 220 }}>
      {#each minuteurs.sonnent as m (m.id)}
        <div class="alarme carte">
          <p class="titre-alarme">⏰ Terminé !</p>
          <p class="libelle-alarme">{m.libelle}</p>
          <p class="discret petit">{libelleDuree(m.duree / 1000)} · {etatTexte(m)}</p>
          <div class="actions-alarme">
            <button class="bouton" onclick={() => minuteurs.supprimer(m.id)}><BellOff size={18} /> Arrêter</button>
            {#if m.supplement}
              <button class="bouton secondaire" onclick={() => minuteurs.ajouter(m.id, m.supplement! / 1000)}>
                +{libelleDuree(m.supplement / 1000)}
              </button>
            {/if}
            <button class="bouton secondaire" onclick={() => minuteurs.ajouter(m.id, 60)}>+1 min</button>
            <button class="bouton secondaire" onclick={() => minuteurs.ajouter(m.id, 300)}>+5 min</button>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Liste des minuteurs -->
{#if ouvert}
  <div use:portail>
    <div class="voile" transition:fade={{ duration: 180 }} onclick={() => (ouvert = false)} aria-hidden="true"></div>
    <div class="feuille" role="dialog" aria-modal="true" aria-label="Minuteurs" transition:fly={{ y: 500, duration: 250 }}>
      <header>
        <h2>Minuteurs</h2>
        <button class="bouton-icone" onclick={() => (ouvert = false)} aria-label="Fermer"><X size={24} /></button>
      </header>
      <ul class="liste-minuteurs">
        {#each minuteurs.visibles as m (m.id)}
          <li>
            <div class="infos">
              <span class="grand-chrono" class:en-pause={m.etat === 'pause'}>{chrono(minuteurs.restant(m) / 1000)}</span>
              <span class="nom">{m.libelle}</span>
              <span class="discret petit">{etatTexte(m)}</span>
            </div>
            <div class="commandes">
              {#if m.etat === 'actif'}
                <button class="rond" onclick={() => minuteurs.pause(m.id)} aria-label="Pause"><Pause size={20} /></button>
              {:else if m.etat === 'pause'}
                <button class="rond" onclick={() => minuteurs.reprendre(m.id)} aria-label="Reprendre"><Play size={20} /></button>
              {/if}
              <button class="rond" onclick={() => minuteurs.ajouter(m.id, 60)} aria-label="Ajouter 1 minute">
                <Plus size={16} /><span class="mini">1</span>
              </button>
              <button class="rond discret-rond" onclick={() => minuteurs.supprimer(m.id)} aria-label="Supprimer">
                <X size={20} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
      <label class="option">
        <input
          type="checkbox"
          checked={alarme.active}
          onchange={(e) => alarme.definirActive(e.currentTarget.checked, minuteurs.fins)}
        />
        <span>
          <strong>Sonner même écran verrouillé ou en silencieux</strong>
          <span class="discret petit">Ta musique est mise en pause tant qu'un minuteur tourne.</span>
        </span>
      </label>
      <h3 class="section-titre">Nouveau minuteur</h3>
      <div class="presets">
        {#each PRESETS as p (p)}
          <button class="puce" onclick={() => minuteurs.lancer(`Minuteur ${libelleDuree(p * 60)}`, p * 60)}>
            {libelleDuree(p * 60)}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .pastille-minuteur {
    position: fixed;
    right: calc(14px + var(--droite));
    bottom: calc(var(--hauteur-onglets) + var(--bas) + 12px);
    z-index: 26;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 16px 0 14px;
    border: none;
    border-radius: 22px;
    background: var(--ambre);
    color: var(--surface);
    font-weight: 700;
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
  }

  .pastille-minuteur.en-cuisine {
    bottom: calc(var(--bas) + 88px);
  }

  .pastille-minuteur.pause {
    background: var(--texte-2);
  }

  .temps {
    font-variant-numeric: tabular-nums;
    font-size: 17px;
  }

  .plus {
    font-size: 13px;
    opacity: 0.85;
  }

  .alarme-voile {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(0 0 0 / 0.45);
  }

  .alarmes {
    position: fixed;
    top: calc(var(--haut) + 12px);
    left: calc(12px + var(--gauche));
    right: calc(12px + var(--droite));
    z-index: 61;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100% - var(--haut) - 24px);
    overflow-y: auto;
  }

  .alarme {
    padding: 16px;
    border: 3px solid var(--ambre);
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      border-color: transparent;
    }
  }

  .titre-alarme {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    color: var(--ambre);
  }

  .libelle-alarme {
    margin: 4px 0 2px;
    font-size: 18px;
    font-weight: 600;
  }

  .actions-alarme {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .actions-alarme .bouton {
    flex: 1 1 auto;
  }

  .voile {
    position: fixed;
    inset: 0;
    z-index: 45;
    background: rgb(0 0 0 / 0.35);
  }

  .feuille {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 46;
    max-height: calc(100% - var(--haut) - 24px);
    overflow-y: auto;
    padding: 6px 16px calc(20px + var(--bas));
    background: var(--fond);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -8px 30px rgb(0 0 0 / 0.2);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  header h2 {
    font-family: var(--police-titre);
    font-size: 22px;
  }

  .liste-minuteurs {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .liste-minuteurs li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 0.5px solid var(--trait);
  }

  .infos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .grand-chrono {
    font-size: 34px;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .grand-chrono.en-pause {
    color: var(--texte-3);
  }

  .nom {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .commandes {
    display: flex;
    gap: 6px;
  }

  .rond {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    border: none;
    background: var(--ambre-doux);
    color: var(--ambre);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .discret-rond {
    background: var(--surface-2);
    color: var(--texte-2);
  }

  .mini {
    font-size: 13px;
    font-weight: 700;
  }

  .option {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 0 4px;
  }

  .option input {
    width: 24px;
    height: 24px;
    margin: 2px 0 0;
    accent-color: var(--accent);
    flex: none;
  }

  .option span {
    display: flex;
    flex-direction: column;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
