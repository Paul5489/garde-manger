<script lang="ts">
  import { fly } from 'svelte/transition';

  // Mise à jour de l'application (code seulement) : proposée, jamais imposée pendant qu'on cuisine.
  let disponible = $state(false);
  let appliquer: ((recharger?: boolean) => Promise<void>) | null = null;

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    import('virtual:pwa-register').then(({ registerSW }) => {
      appliquer = registerSW({
        immediate: true,
        onNeedRefresh() {
          disponible = true;
        },
        onRegisteredSW(_url, reg) {
          // Vérifie s'il existe une nouvelle version à chaque retour dans l'application.
          if (!reg) return;
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
          });
        },
      });
    });
  }
</script>

{#if disponible}
  <div class="bandeau carte" role="status" transition:fly={{ y: -80, duration: 250 }}>
    <span>Nouvelle version de l'application disponible.</span>
    <button class="bouton" onclick={() => appliquer?.(true)}>Mettre à jour</button>
    <button class="bouton-icone" onclick={() => (disponible = false)} aria-label="Plus tard">Plus tard</button>
  </div>
{/if}

<style>
  .bandeau {
    position: fixed;
    top: calc(var(--haut) + 8px);
    left: 12px;
    right: 12px;
    z-index: 50;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 12px 14px;
    font-size: 15px;
  }

  .bandeau span {
    flex: 1 1 100%;
  }

  .bouton {
    min-height: 40px;
    font-size: 15px;
  }
</style>
