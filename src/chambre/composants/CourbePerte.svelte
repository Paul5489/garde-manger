<script lang="ts">
  // Courbe de la perte de poids d'un lot : pesées, cible, et tendance jusqu'à la fin estimée.
  import { nombre } from '../../lib/format';
  import type { Perte } from '../lots';

  let { perte }: { perte: Perte } = $props();

  const L = 320;
  const H = 150;
  const M = { g: 30, d: 10, h: 10, b: 22 };
  const JOUR = 86_400_000;

  const finJours = $derived(perte.finEstimee ? (perte.finEstimee.getTime() - perte.reference.le.getTime()) / JOUR : 0);
  const maxX = $derived(Math.max(7, ...perte.points.map((p) => p.jours), finJours) * 1.05);
  const maxY = $derived(Math.max(10, (perte.cible ?? 0) + 5, ...perte.points.map((p) => p.pct)));
  const x = (j: number) => M.g + (j / maxX) * (L - M.g - M.d);
  const y = (pct: number) => H - M.b - (pct / maxY) * (H - M.h - M.b);
  const ligne = $derived(perte.points.map((p) => `${x(p.jours)},${y(p.pct)}`).join(' '));
  const dernier = $derived(perte.points.at(-1)!);
  const graduationsY = $derived([0, ...(perte.cible !== undefined ? [perte.cible] : []), Math.round(maxY / 10) * 10].filter((v, i, a) => a.indexOf(v) === i && v <= maxY));
  const graduationsX = $derived(Array.from({ length: Math.floor(maxX / 7) + 1 }, (_, i) => i * 7).filter((j) => j <= maxX));
</script>

<svg viewBox="0 0 {L} {H}" role="img" aria-label="Perte de poids : {nombre(perte.pct, 1)} %{perte.cible !== undefined ? `, cible ${perte.cible} %` : ''}">
  {#each graduationsY as v (v)}
    <line x1={M.g} x2={L - M.d} y1={y(v)} y2={y(v)} class="grille" />
    <text x={M.g - 4} y={y(v) + 4} text-anchor="end">{v}%</text>
  {/each}
  {#each graduationsX as j (j)}
    <text x={x(j)} y={H - 6} text-anchor="middle">{j === 0 ? 'j0' : `${j / 7} sem.`}</text>
  {/each}
  {#if perte.cible !== undefined}
    <line x1={M.g} x2={L - M.d} y1={y(perte.cible)} y2={y(perte.cible)} class="cible" />
  {/if}
  {#if perte.finEstimee && perte.cible !== undefined}
    <line x1={x(dernier.jours)} y1={y(dernier.pct)} x2={x(finJours)} y2={y(perte.cible)} class="tendance" />
  {/if}
  <polyline points={ligne} class="courbe" />
  {#each perte.points as p, i (i)}
    <circle cx={x(p.jours)} cy={y(p.pct)} r="3.5" class="point" />
  {/each}
</svg>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }

  text {
    font-size: 10px;
    fill: var(--texte-3);
  }

  .grille {
    stroke: var(--trait);
    stroke-width: 1;
  }

  .cible {
    stroke: var(--vert);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }

  .tendance {
    stroke: var(--texte-3);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }

  .courbe {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
  }

  .point {
    fill: var(--surface);
    stroke: var(--accent);
    stroke-width: 2;
  }
</style>
