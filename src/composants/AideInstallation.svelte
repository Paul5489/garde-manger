<script lang="ts">
  import { Ellipsis, Share, SquarePlus } from '@lucide/svelte';

  // Affiché seulement sur iPhone/iPad quand l'appli est ouverte dans Safari (pas depuis l'icône).
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installee = nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const visible = ios && !installee;
</script>

{#if visible}
  <section class="aide carte" aria-label="Installer l'application">
    <h2>📲 Mettre Garde-manger sur l'écran d'accueil</h2>
    <p class="petit discret">Tu es dans Safari. Pour avoir l'icône de l'appli (et l'écran qui reste allumé) :</p>
    <ol>
      <li>Touche <span class="bouton-ios"><Ellipsis size={16} /></span> à droite de l'adresse, en bas de l'écran
        <span class="discret">(ou directement <span class="bouton-ios"><Share size={15} /></span> Partager)</span>.</li>
      <li>Touche <strong>Partager</strong>, puis fais défiler jusqu'à
        <span class="bouton-ios"><SquarePlus size={15} /></span> <strong>Sur l'écran d'accueil</strong>.</li>
      <li>Laisse « Ouvrir comme app web » activé et touche <strong>Ajouter</strong>.</li>
      <li>Ouvre ensuite <strong>Garde-manger depuis l'icône</strong>. S'il redemande l'import, choisis le même
        fichier dans <strong>Sur mon iPhone › Téléchargements</strong>.</li>
    </ol>
  </section>
{/if}

<style>
  .aide {
    padding: 14px 16px 10px;
    margin: 12px 0;
    border: 2px solid var(--accent);
    text-align: left;
  }

  h2 {
    font-size: 17px;
    margin-bottom: 4px;
  }

  p {
    margin: 0 0 6px;
  }

  ol {
    margin: 0;
    padding-left: 1.3em;
    font-size: 15.5px;
  }

  li {
    margin: 6px 0;
  }

  .bouton-ios {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 24px;
    padding: 0 4px;
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--accent);
    vertical-align: -5px;
  }
</style>
