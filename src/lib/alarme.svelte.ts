// Sonnerie qui fonctionne écran verrouillé et en mode silencieux.
// iOS coupe les « sons d'effets » (Web Audio) en silencieux et endort l'appli écran verrouillé,
// mais laisse jouer un morceau audio comme de la musique. On fabrique donc une piste :
// du silence jusqu'à l'heure de fin de chaque minuteur, puis des bips. Elle joue même si l'appli dort.

import { DUREE_SONNERIE, fabriquerPiste } from './piste-alarme';
import { ecrireLocal, lireLocal } from './stockage-local';

const HORIZON = 2 * 3600; // on programme les fins à moins de 2 h (au-delà, reprogrammé plus tard)

export interface FinProgrammee {
  fin: number; // heure de fin (ms)
  libelle: string;
}

class Alarme {
  /** Réglage : sonner même écran verrouillé (met la musique en pause pendant un minuteur). */
  active = $state(lireLocal<boolean>('sonnerie-verrouille', true));
  /** La piste joue réellement (sinon on se rabat sur les bips de l'appli ouverte). */
  enLecture = $state(false);
  #audio: HTMLAudioElement | null = null;
  #url: string | null = null;
  #enAttente: FinProgrammee[] | null = null;
  #actions: { pause?: () => void; lecture?: () => void } = {};

  constructor() {
    // Si la lecture a été refusée (pas de toucher récent), on réessaie au prochain toucher.
    document.addEventListener('pointerup', () => {
      if (this.#enAttente) this.programmer(this.#enAttente);
    });
  }

  definirActive(v: boolean, fins: FinProgrammee[]) {
    this.active = v;
    ecrireLocal('sonnerie-verrouille', v);
    this.programmer(v ? fins : []);
  }

  /** Commandes de l'écran verrouillé (Pause / Lecture) reliées aux minuteurs. */
  surCommandes(actions: { pause: () => void; lecture: () => void }) {
    this.#actions = actions;
  }

  /** (Re)programme la piste pour les minuteurs en cours. Appelé à chaque changement. */
  programmer(fins: FinProgrammee[]) {
    const maintenant = Date.now();
    const aVenir = fins
      .map((f) => ({ ...f, dans: (f.fin - maintenant) / 1000 }))
      .filter((f) => f.dans > -DUREE_SONNERIE && f.dans <= HORIZON)
      .sort((a, b) => a.dans - b.dans);
    if (!this.active || !aVenir.length) {
      this.arreter();
      return;
    }
    const audio = (this.#audio ??= this.#creerAudio());
    const piste = fabriquerPiste(aVenir.map((f) => Math.max(0, f.dans)));
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = URL.createObjectURL(piste);
    audio.src = this.#url;
    this.#metadonnees(aVenir[0]);
    audio
      .play()
      .then(() => {
        this.enLecture = true;
        this.#enAttente = null;
      })
      .catch(() => {
        this.enLecture = false;
        this.#enAttente = fins;
      });
  }

  arreter() {
    this.#enAttente = null;
    this.enLecture = false;
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.removeAttribute('src');
      this.#audio.load();
    }
    if (this.#url) {
      URL.revokeObjectURL(this.#url);
      this.#url = null;
    }
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  #creerAudio(): HTMLAudioElement {
    const a = new Audio();
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.addEventListener('pause', () => (this.enLecture = false));
    a.addEventListener('ended', () => (this.enLecture = false));
    a.addEventListener('playing', () => (this.enLecture = true));
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      ms.setActionHandler('pause', () => this.#actions.pause?.());
      ms.setActionHandler('play', () => this.#actions.lecture?.());
    }
    return a;
  }

  #metadonnees(prochain: FinProgrammee) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const fin = new Date(prochain.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `⏱ ${prochain.libelle}`,
      artist: `Garde-manger · sonne à ${fin}`,
      artwork: [{ src: `${import.meta.env.BASE_URL}pwa-512x512.png`, sizes: '512x512', type: 'image/png' }],
    });
  }
}

export const alarme = new Alarme();
