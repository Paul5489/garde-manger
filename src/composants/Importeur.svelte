<script lang="ts">
  import { Download, Laptop } from '@lucide/svelte';
  import { demanderStockagePersistant } from '../lib/db';
  import { etat } from '../lib/etat.svelte';
  import { pluriel } from '../lib/format';
  import { importerArchive } from '../lib/importer';
  import type { MessageImport } from '../lib/import.worker';

  let { libelle = 'Importer mes recettes' }: { libelle?: string } = $props();

  let champ = $state<HTMLInputElement>();
  let enCours = $state(false);
  let etape = $state('');
  let pourcentage = $state(0);
  let erreur = $state<string | null>(null);
  let succes = $state<string | null>(null);

  async function lancer(source: MessageImport) {
    enCours = true;
    erreur = null;
    succes = null;
    try {
      const infos = await importerArchive(source, (e, p) => {
        etape = e;
        pourcentage = p;
      });
      pourcentage = 100;
      await demanderStockagePersistant();
      await etat.demarrer();
      succes = `${pluriel(infos.nbFiches, 'fiche importée', 'fiches importées')}.`;
      if (infos.ignorees) succes += ` ${pluriel(infos.ignorees, 'fiche illisible ignorée', 'fiches illisibles ignorées')}.`;
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    } finally {
      enCours = false;
    }
  }

  function fichierChoisi(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (fichier) lancer({ fichier });
  }

  // Développement uniquement : charger l'archive directement depuis le Mac (retiré du build final).
  const chargerDuMac = import.meta.env.DEV
    ? () => lancer({ url: '/__archive-dev/archive_complete.json' })
    : undefined;
</script>

<!-- Pas de filtre de type : sur iPhone, un filtre peut griser le fichier .json. Le contenu est vérifié à l'import. -->
<input bind:this={champ} type="file" onchange={fichierChoisi} hidden />

<div class="importeur">
  {#if enCours}
    <div class="progression" role="status">
      <div class="barre"><div class="remplissage" style:width="{pourcentage}%"></div></div>
      <p class="discret petit">{etape}</p>
    </div>
  {:else}
    <button class="bouton plein" onclick={() => champ?.click()}>
      <Download size={20} />
      {libelle}
    </button>
    {#if chargerDuMac}
      <button class="bouton secondaire plein" onclick={chargerDuMac}>
        <Laptop size={20} />
        Charger depuis le Mac (test)
      </button>
    {/if}
  {/if}
  {#if erreur}<p class="message erreur" role="alert">{erreur}</p>{/if}
  {#if succes}<p class="message succes" role="status">✓ {succes}</p>{/if}
</div>

<style>
  .importeur {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .progression {
    padding: 8px 0;
  }

  .barre {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .remplissage {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progression p {
    margin: 8px 0 0;
    text-align: center;
  }

  .message {
    margin: 4px 0 0;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 15px;
  }

  .erreur {
    background: var(--accent-doux);
    color: var(--rouge);
  }

  .succes {
    background: var(--vert-doux);
    color: var(--vert);
  }
</style>
