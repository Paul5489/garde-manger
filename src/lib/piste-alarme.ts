// Fabrication de la piste audio de sonnerie (fichier WAV) : silence, puis bips aux heures voulues.

const TAUX = 4000; // échantillons par seconde (8 bits mono : 4 Ko par seconde)
export const DUREE_SONNERIE = 30; // secondes de bips à chaque fin de minuteur

/** Fabrique un fichier WAV : silence, avec des bips à chaque instant demandé (en secondes). */
export function fabriquerPiste(instants: number[]): Blob {
  const duree = Math.max(...instants) + DUREE_SONNERIE + 1;
  const n = Math.ceil(duree * TAUX);
  const octets = new Uint8Array(44 + n);
  const vue = new DataView(octets.buffer);
  const texte = (pos: number, t: string) => [...t].forEach((c, i) => (octets[pos + i] = c.charCodeAt(0)));
  texte(0, 'RIFF');
  vue.setUint32(4, 36 + n, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  vue.setUint32(16, 16, true);
  vue.setUint16(20, 1, true); // PCM
  vue.setUint16(22, 1, true); // mono
  vue.setUint32(24, TAUX, true);
  vue.setUint32(28, TAUX, true);
  vue.setUint16(32, 1, true);
  vue.setUint16(34, 8, true);
  texte(36, 'data');
  vue.setUint32(40, n, true);
  octets.fill(128, 44); // silence (8 bits non signé)

  const ton = (debut: number, longueur: number, freq: number) => {
    const i0 = Math.round(debut * TAUX);
    const i1 = Math.min(n, Math.round((debut + longueur) * TAUX));
    const fondu = TAUX * 0.006;
    for (let i = i0; i < i1; i++) {
      const env = Math.min(1, (i - i0) / fondu, (i1 - i) / fondu);
      octets[44 + i] = 128 + Math.round(110 * env * Math.sin((2 * Math.PI * freq * (i - i0)) / TAUX));
    }
  };
  for (const t of instants)
    for (let k = 0; k < DUREE_SONNERIE; k++) {
      ton(t + k, 0.16, 880);
      ton(t + k + 0.24, 0.16, 1175);
      ton(t + k + 0.48, 0.16, 880);
    }
  return new Blob([octets], { type: 'audio/wav' });
}
