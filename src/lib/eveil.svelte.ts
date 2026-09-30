// Garder l'écran allumé pendant qu'on cuisine.
// 1) API Screen Wake Lock (iOS 18.4+ dans une appli installée, site https) ;
// 2) repli : petite vidéo muette en boucle (fonctionne aussi en http pendant les tests).

type Mode = 'inactif' | 'natif' | 'video' | 'echec';

class Eveil {
  mode = $state<Mode>('inactif');
  #verrou: WakeLockSentinel | null = null;
  #video: HTMLVideoElement | null = null;
  #demande = false;

  constructor() {
    // iOS relâche le verrou quand l'appli passe en arrière-plan : on le reprend au retour.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.#demande) void this.#activer();
    });
  }

  async activer() {
    this.#demande = true;
    await this.#activer();
  }

  async #activer() {
    if ('wakeLock' in navigator && window.isSecureContext) {
      try {
        if (!this.#verrou || this.#verrou.released) {
          this.#verrou = await navigator.wakeLock.request('screen');
          this.#verrou.addEventListener('release', () => {
            if (this.mode === 'natif' && !this.#demande) this.mode = 'inactif';
          });
        }
        this.mode = 'natif';
        return;
      } catch {
        // refusé (mode économie d'énergie, appli non visible…) : on tente la vidéo
      }
    }
    await this.#activerVideo();
  }

  async #activerVideo() {
    try {
      if (!this.#video) {
        const v = document.createElement('video');
        v.src = `${import.meta.env.BASE_URL}eveil.mp4`;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('muted', '');
        v.setAttribute('aria-hidden', 'true');
        Object.assign(v.style, {
          position: 'fixed',
          width: '1px',
          height: '1px',
          opacity: '0.01',
          pointerEvents: 'none',
          left: '0',
          bottom: '0',
        });
        document.body.appendChild(v);
        this.#video = v;
      }
      await this.#video.play();
      this.mode = 'video';
    } catch {
      this.mode = 'echec';
    }
  }

  async desactiver() {
    this.#demande = false;
    try {
      await this.#verrou?.release();
    } catch {
      /* déjà relâché */
    }
    this.#verrou = null;
    if (this.#video) {
      this.#video.pause();
      this.#video.remove();
      this.#video = null;
    }
    this.mode = 'inactif';
  }
}

export const eveil = new Eveil();
