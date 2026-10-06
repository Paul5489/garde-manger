<script lang="ts">
  // Clé API Anthropic : permet à Claude de lire les recettes collées ou photographiées (onglet Ajouter).
  import { Check, ExternalLink, KeyRound, Trash2 } from '@lucide/svelte';
  import { cleClaude } from '../lib/cle-claude.svelte';

  let saisie = $state('');
  let etatTest = $state<'' | 'test' | 'ok' | 'erreur'>('');
  let message = $state('');

  const apercu = $derived(cleClaude.presente ? `${cleClaude.valeur.slice(0, 10)}…${cleClaude.valeur.slice(-4)}` : '');

  async function enregistrer() {
    const cle = saisie.trim();
    if (!cle) return;
    etatTest = 'test';
    message = '';
    try {
      const { testerCle } = await import('../lib/claude');
      await testerCle(cle);
      cleClaude.definir(cle);
      saisie = '';
      etatTest = 'ok';
      message = 'Clé enregistrée et vérifiée : Claude peut lire tes recettes.';
    } catch (e) {
      etatTest = 'erreur';
      message = e instanceof Error ? e.message : String(e);
    }
  }

  function effacer() {
    if (!confirm('Retirer la clé Claude de ce téléphone ?')) return;
    cleClaude.effacer();
    etatTest = '';
    message = '';
  }
</script>

<div class="claude">
  {#if cleClaude.presente}
    <p class="etat-cle"><Check size={18} /> Clé enregistrée <span class="discret">({apercu})</span></p>
  {:else}
    <p class="petit">
      Pour que Claude lise les recettes que tu colles ou prends en photo (onglet <strong>Ajouter</strong>), il faut
      une clé d'accès Anthropic. C'est payant à l'usage : environ <strong>5 à 15 centimes par recette</strong>.
    </p>
    <ol class="petit etapes">
      <li>
        Ouvre <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">console.anthropic.com
          <ExternalLink size={13} /></a> dans Safari et crée un compte.
      </li>
      <li><strong>Billing</strong> : ajoute un peu de crédit (5 $ suffisent pour des dizaines de recettes).</li>
      <li><strong>API keys</strong> › <strong>Create key</strong>, puis <strong>Copy</strong>.</li>
      <li>Reviens ici, colle la clé ci-dessous et touche <strong>Enregistrer</strong>.</li>
    </ol>
  {/if}

  <label class="champ-libelle">
    <span>{cleClaude.presente ? 'Remplacer la clé' : 'Clé API (commence par sk-ant-)'}</span>
    <input
      class="champ"
      type="password"
      bind:value={saisie}
      placeholder="sk-ant-…"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
  </label>
  <div class="boutons">
    <button class="bouton" onclick={enregistrer} disabled={!saisie.trim() || etatTest === 'test'}>
      <KeyRound size={18} /> {etatTest === 'test' ? 'Vérification…' : 'Enregistrer'}
    </button>
    {#if cleClaude.presente}
      <button class="bouton secondaire" onclick={effacer}><Trash2 size={18} /> Retirer</button>
    {/if}
  </div>
  {#if message}<p class="message" class:ok={etatTest === 'ok'} role="status">{message}</p>{/if}
  <p class="discret petit">
    La clé reste uniquement dans ce téléphone (elle n'est pas dans la sauvegarde). Seul le texte ou la photo de
    la recette à lire est envoyé à Claude, au moment où tu touches « Analyser ».
  </p>
</div>

<style>
  .claude {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  p {
    margin: 0;
  }

  .etat-cle {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--vert);
    font-weight: 600;
  }

  .etapes {
    margin: 0;
    padding-left: 1.3em;
  }

  .etapes li {
    margin: 4px 0;
  }

  .champ-libelle {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .champ-libelle > span {
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-2);
  }

  .boutons {
    display: flex;
    gap: 8px;
  }

  .boutons .bouton {
    flex: 1;
  }

  .message {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--accent-doux);
    color: var(--rouge);
    font-size: 15px;
  }

  .message.ok {
    background: var(--vert-doux);
    color: var(--vert);
  }
</style>
