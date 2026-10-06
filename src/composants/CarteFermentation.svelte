<script lang="ts">
  import { dureeJours, nombre } from '../lib/format';
  import { insecables, majuscule } from '../lib/texte';
  import type { EtapeFermentation, Fermentation } from '../lib/types';

  let { fermentation: f }: { fermentation: Fermentation } = $props();

  function dureeEtape(e: EtapeFermentation | Fermentation): string | null {
    if (e.duree_min_heures !== undefined) {
      const max = e.duree_max_heures ?? e.duree_min_heures;
      return e.duree_min_heures === max ? `${nombre(max)} h` : `${nombre(e.duree_min_heures)} à ${nombre(max)} h`;
    }
    if (e.duree_min_jours !== undefined) return dureeJours(e.duree_min_jours, e.duree_max_jours ?? e.duree_min_jours);
    return null;
  }

  const lignes = $derived(
    [
      ['Sel', f.sel_pct !== undefined ? `${nombre(f.sel_pct)} %` : f.sel_texte],
      ['Température', f.temperature_texte ?? (f.temperature_c !== undefined ? `${nombre(f.temperature_c)} °C` : undefined)],
      ['Humidité', f.humidite_pct ? `${f.humidite_pct.replace(/ à /, ' à ')} %` : undefined],
      ['Durée', f.etapes?.length ? undefined : dureeEtape(f)],
      ['Brix de départ', f.brix_depart !== undefined ? `${nombre(f.brix_depart)} °Bx` : undefined],
      ['Ensemencement', f.ensemencement],
    ].filter((l): l is [string, string] => !!l[1]),
  );
</script>

<section class="carte fermentation">
  <h2>🫙 Fermentation{#if f.type}<span class="type">&nbsp;· {f.type}</span>{/if}</h2>
  {#if lignes.length}
    <dl>
      {#each lignes as [cle, valeur] (cle)}
        <dt>{cle}</dt>
        <dd>{insecables(majuscule(valeur))}</dd>
      {/each}
    </dl>
  {/if}
  {#if f.etapes?.length}
    <ol class="phases">
      {#each f.etapes as e, i (i)}
        <li>
          <strong>{majuscule(e.nom ?? `Étape ${i + 1}`)}</strong>
          <span class="discret">
            {[e.temperature_c !== undefined ? `${nombre(e.temperature_c)} °C` : null, dureeEtape(e)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
  {#if f.duree_texte}<p class="texte-duree">{insecables(majuscule(f.duree_texte))}</p>{/if}
  {#if f.controle}<p><strong>Contrôle&nbsp;:</strong> {insecables(f.controle)}</p>{/if}
  {#if f.conservation}<p><strong>Conservation&nbsp;:</strong> {insecables(f.conservation)}</p>{/if}
</section>

<style>
  .fermentation {
    padding: 14px 16px;
    margin: 18px 0 8px;
    background: var(--vert-doux);
    box-shadow: none;
  }

  h2 {
    font-size: 17px;
    color: var(--vert);
    margin-bottom: 8px;
  }

  .type {
    font-weight: 500;
    font-size: 15px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 14px;
    margin: 0 0 8px;
  }

  dt {
    color: var(--texte-2);
    font-size: 15px;
  }

  dd {
    margin: 0;
    font-weight: 600;
  }

  .phases {
    margin: 4px 0 8px;
    padding-left: 1.3em;
  }

  .phases li {
    margin: 4px 0;
  }

  .phases .discret {
    display: block;
    font-size: 15px;
  }

  p {
    margin: 6px 0;
    font-size: 15.5px;
  }

  .texte-duree {
    color: var(--texte-2);
  }
</style>
