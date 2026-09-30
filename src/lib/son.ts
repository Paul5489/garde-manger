// Sonnerie des minuteurs, générée par le téléphone (Web Audio) : aucun fichier son nécessaire.

type SessionAudio = { type: string };

let ctx: AudioContext | null = null;

function session(): SessionAudio | undefined {
  return (navigator as Navigator & { audioSession?: SessionAudio }).audioSession;
}

/**
 * À appeler lors d'un toucher (lancement d'un minuteur) : iOS n'autorise le son
 * qu'après une action de l'utilisateur.
 */
export function deverrouillerSon(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    // Un son silencieux très court « débloque » la lecture sur iOS.
    const tampon = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = tampon;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* pas de son disponible : l'alerte reste visible à l'écran */
  }
}

/** Trois bips courts. Renvoie false si le son n'a pas pu être joué. */
export function bip(): boolean {
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    // Pendant la sonnerie, jouer même si l'iPhone est en mode silencieux (comme l'app Horloge).
    const s = session();
    if (s) s.type = 'playback';
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      const debut = t0 + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0, debut);
      gain.gain.linearRampToValueAtTime(0.6, debut + 0.02);
      gain.gain.setValueAtTime(0.6, debut + 0.12);
      gain.gain.linearRampToValueAtTime(0, debut + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(debut);
      osc.stop(debut + 0.18);
    }
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/** Fin de sonnerie : on rend la main aux autres sons (musique…). */
export function finSonnerie(): void {
  const s = session();
  if (s) s.type = 'auto';
}
