<script lang="ts">
  import { etatEtape, gouteAujourdhui, libelleAvancement, type Bocal } from '../lib/bocaux';
  import { date, nombre } from '../lib/format';
  import { lienBocal } from '../lib/routeur.svelte';

  let { bocal: b, maintenant, lien = true }: { bocal: Bocal; maintenant: number; lien?: boolean } = $props();

  const e = $derived(etatEtape(b, maintenant));
  const goute = $derived(gouteAujourdhui(b, maintenant));
  const badge = $derived.by((): [string, string] | null => {
    if (b.statut === 'termine') return ['Terminé', 'vert'];
    if (b.statut === 'rate') return ['Raté', 'rouge'];
    if (e.phase === 'pret') return e.derniere ? ['Prêt', 'vert'] : ['Étape suivante', 'vert'];
    if (e.phase === 'depasse') return e.derniere ? ['Dépassé', 'rouge'] : ['Étape suivante', 'rouge'];
    if (e.phase === 'a-gouter') return goute ? ['Goûté ✓', 'discret'] : ['À goûter', 'ambre'];
    return null;
  });
  const max = $derived(e.etape.max ?? e.etape.min);
  // Bocal à une seule étape : la température est réglée sur le bocal.
  const temperature = $derived(e.etape.temperatureC ?? (b.etapes.length === 1 ? b.temperatureC : undefined));
  const debutZone = $derived(e.etape.min !== undefined && max ? (e.etape.min / max) * 100 : 100);
</script>

<svelte:element this={lien ? 'a' : 'div'} class="carte-bocal carte" href={lien ? lienBocal(b.id) : undefined}>
  <div class="haut">
    <span class="nom">{b.nom}</span>
    {#if badge}<span class="badge {badge[1]}">{badge[0]}</span>{/if}
  </div>
  {#if b.statut !== 'en-cours'}
    <p class="ligne discret">{b.statut === 'termine' ? 'Terminé' : 'Raté'} le {date(b.finLe ?? b.debut)} · mis en bocal le {date(b.debut)}</p>
  {:else}
    {#if b.etapes.length > 1}
      <p class="ligne etape">Étape {e.index + 1}/{b.etapes.length} · {e.etape.nom}</p>
    {/if}
    <p class="ligne">
      <strong>{libelleAvancement(e)}</strong>
      {#if temperature !== undefined}<span class="discret"> · {nombre(temperature)}&nbsp;°C</span>{/if}
    </p>
    {#if e.etape.min !== undefined}
      <div class="barre {e.phase}" aria-hidden="true">
        <div class="zone" style:left="{debutZone}%"></div>
        <div class="rempli" style:width="{e.progression * 100}%"></div>
      </div>
    {/if}
  {/if}
</svelte:element>

<style>
  .carte-bocal {
    display: block;
    padding: 12px 14px 14px;
    color: inherit;
    text-decoration: none;
  }

  a.carte-bocal:active {
    filter: brightness(0.96);
  }

  .haut {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .nom {
    font-weight: 700;
    font-size: 17px;
    line-height: 1.25;
  }

  .badge {
    flex: none;
    padding: 2px 9px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .badge.vert {
    background: var(--vert-doux);
    color: var(--vert);
  }

  .badge.ambre {
    background: var(--ambre-doux);
    color: var(--ambre);
  }

  .badge.rouge {
    background: var(--accent-doux);
    color: var(--rouge);
  }

  .badge.discret {
    background: var(--surface-2);
    color: var(--texte-2);
  }

  .ligne {
    margin: 4px 0 0;
    font-size: 15px;
  }

  .etape {
    color: var(--texte-2);
    font-size: 14px;
  }

  .barre {
    position: relative;
    height: 8px;
    margin-top: 10px;
    border-radius: 4px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    background: color-mix(in srgb, var(--vert) 28%, transparent);
  }

  .rempli {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 4px;
    background: var(--ambre);
  }

  .pret .rempli {
    background: var(--vert);
  }

  .depasse .rempli {
    background: var(--rouge);
  }
</style>
