import { describe, expect, it } from 'vitest';
import { fabriquerPiste } from '../src/lib/piste-alarme';

describe('piste de sonnerie (écran verrouillé)', () => {
  it('silence jusqu’à la fin du minuteur, puis des bips', async () => {
    const piste = fabriquerPiste([2]);
    const o = new Uint8Array(await piste.arrayBuffer());
    const texte = (a: number, b: number) => String.fromCharCode(...o.slice(a, b));
    expect(texte(0, 4)).toBe('RIFF');
    expect(texte(8, 12)).toBe('WAVE');
    expect(o.length).toBe(44 + (2 + 30 + 1) * 4000);
    const echantillon = (s: number) => o[44 + Math.round(s * 4000)];
    // Silence avant la fin
    expect(new Set(o.slice(44, 44 + 2 * 4000))).toEqual(new Set([128]));
    // Bips juste après la fin (le signal s'écarte du silence)
    const bip = o.slice(44 + Math.round(2.02 * 4000), 44 + Math.round(2.12 * 4000));
    expect(Math.max(...bip) - Math.min(...bip)).toBeGreaterThan(150);
    expect(echantillon(1.5)).toBe(128);
  });

  it('plusieurs minuteurs dans la même piste', async () => {
    const o = new Uint8Array(await fabriquerPiste([1, 40]).arrayBuffer());
    const zone = (s: number) => o.slice(44 + Math.round(s * 4000), 44 + Math.round((s + 0.1) * 4000));
    expect(Math.max(...zone(40.02))).toBeGreaterThan(200);
    expect(new Set(zone(35.8))).toEqual(new Set([128])); // entre les deux sonneries
  });

  it('taille raisonnable : 20 minutes ≈ 5 Mo', () => {
    expect(fabriquerPiste([20 * 60]).size).toBeLessThan(5.2e6);
  });
});
