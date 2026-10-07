<script lang="ts">
  // Pages d'explication de la chambre (modes.json) : matériel, touches des Inkbird, ménager le matériel,
  // énergie, nettoyages, coupure de courant, calibrage, vérification de la semaine, pH-mètre.
  import { Check } from '@lucide/svelte';
  import { date } from '../../lib/format';
  import { couleurMode, t } from '../affichage';
  import { chambre } from '../chambre.svelte';
  import { CONTENU, MODES, MODES_PAR_ID } from '../donnees';
  import type { Tache } from '../taches';

  let { section }: { section: string } = $props();

  const M = CONTENU.modes;
  const TITRES: Record<string, string> = {
    appareils: 'Mon matériel',
    'ph-metre': 'pH-mètre',
    touches: 'Les touches des Inkbird',
    menager: 'Ménager le matériel',
    energie: 'Économiser l’énergie',
    nettoyage: 'Nettoyages',
    coupure: 'Coupure de courant',
    calibrage: 'Calibrage des sondes',
    verification: 'Vérification de la semaine',
  };
  const NOMS_GUIDE: Record<string, string> = {
    appli: 'Le plus simple',
    premier_reglage: 'Premier réglage',
    entrer: 'Entrer dans le menu',
    naviguer: 'Passer d’un code à l’autre',
    modifier: 'Changer une valeur',
    sortir: 'Sortir',
    reglage_rapide: 'Changer seulement HS',
    apres_un_reglage: 'Juste après un réglage',
    voyant_froid_clignote: 'Le voyant froid clignote',
    voyant_vert_clignote: 'Le voyant vert clignote',
    alarme: 'Alarme',
  };
  const NETTOYAGES = { leger: 'Léger', moyen: 'Moyen', grand: 'Grand' } as const;

  const phMetre = M.installation.materiel.find((a) => a.id === 'ph_metre');
  let coches = $state<Record<number, boolean>>({});

  function fait(tache: Tache) {
    void chambre.fait(tache);
    coches = {};
  }
</script>

<div class="contenu">
  <h1 class="titre-serif">{TITRES[section] ?? 'Chambre'}</h1>

  {#if section === 'appareils'}
    {#each M.installation.materiel as a (a.id)}
      <section class="carte bloc" id="appareil-{a.id}">
        <h2>{a.nom}</h2>
        <p class="role">{t(a.role)}</p>
        <p class="petit discret">{t(a.caracteristiques)}</p>
        {#if a.a_savoir.length}
          <ul>
            {#each a.a_savoir as s (s)}<li>{t(s)}</li>{/each}
          </ul>
        {/if}
      </section>
    {/each}
    <h2 class="section-titre">Les prises</h2>
    <ul class="liste lignes">
      {#each M.installation.prises as p (p.prise)}
        <li><span class="discret">{p.prise}</span><span>{t(p.appareil)}</span></li>
      {/each}
    </ul>
    <h2 class="section-titre">Sondes</h2>
    <ul class="carte puces">
      {#each M.installation.sondes as s (s)}<li>{t(s)}</li>{/each}
    </ul>
    <h2 class="section-titre">Câbles</h2>
    <p class="carte bloc">{t(M.installation.cables)}</p>
    <h2 class="section-titre">Humidificateur</h2>
    <p class="carte bloc">{t(M.installation.humidificateur)}</p>
    {#if M.installation.notes.length}
      <h2 class="section-titre">À savoir</h2>
      <ul class="carte puces">
        {#each M.installation.notes as s (s)}<li>{t(s)}</li>{/each}
      </ul>
    {/if}
  {:else if section === 'ph-metre'}
    {#if phMetre}
      <section class="carte bloc">
        <h2>{phMetre.nom}</h2>
        <p class="role">{t(phMetre.role)}</p>
        <ul>
          {#each phMetre.a_savoir as s (s)}<li>{t(s)}</li>{/each}
        </ul>
      </section>
    {/if}
    <div class="carte bloc fait">
      <p>{chambre.faites['etalonnage-ph'] ? `Dernier étalonnage : ${date(chambre.faites['etalonnage-ph'])}.` : 'Aucun étalonnage noté.'}</p>
      <button class="bouton plein" onclick={() => fait('etalonnage-ph')}><Check size={20} /> Étalonné aujourd'hui</button>
    </div>
  {:else if section === 'touches'}
    <h2 class="section-titre">ITC-308 · température</h2>
    <dl class="carte guide">
      {#each Object.entries(M.guide_itc) as [cle, texte] (cle)}
        <dt>{NOMS_GUIDE[cle] ?? cle}</dt>
        <dd>{t(texte)}</dd>
      {/each}
    </dl>
    <h2 class="section-titre">IHC-200 · humidité</h2>
    <dl class="carte guide">
      {#each Object.entries(M.guide_ihc) as [cle, texte] (cle)}
        <dt>{NOMS_GUIDE[cle] ?? cle}</dt>
        <dd>{t(texte)}</dd>
      {/each}
    </dl>
  {:else if section === 'menager'}
    <ol class="regles">
      {#each M.menager_le_materiel as r (r.regle)}
        <li class="carte"><strong>{t(r.regle)}</strong><p>{t(r.pourquoi)}</p></li>
      {/each}
    </ol>
  {:else if section === 'energie'}
    <p class="carte bloc budget">{t(M.economiser_energie.budget)}</p>
    <h2 class="section-titre">Consommation estimée par mode</h2>
    <ul class="liste lignes">
      {#each MODES as m (m.id)}
        <li style:--couleur={couleurMode(m)}><span class="nom-mode">{m.nom}</span><span>{t(`${m.energie.estimation_kwh_jour} kWh par jour`)}</span></li>
      {/each}
    </ul>
    <h2 class="section-titre">Les règles</h2>
    <ol class="regles">
      {#each M.economiser_energie.regles as r (r.regle)}
        <li class="carte"><strong>{t(r.regle)}</strong><p>{t(r.pourquoi)}</p></li>
      {/each}
    </ol>
  {:else if section === 'nettoyage'}
    <dl class="carte guide">
      {#each Object.entries(M.nettoyage) as [cle, texte] (cle)}
        <dt>{NETTOYAGES[cle as keyof typeof NETTOYAGES]}</dt>
        <dd>{t(texte)}</dd>
      {/each}
    </dl>
    <h2 class="section-titre">Au fil de l'année</h2>
    <ul class="regles">
      {#each M.transitions as tr (`${tr.de}-${tr.vers}`)}
        <li class="carte">
          <strong>{MODES_PAR_ID.get(tr.de)?.nom} → {MODES_PAR_ID.get(tr.vers)?.nom}</strong>
          <span class="etiquette">{tr.nettoyage ? `nettoyage ${NETTOYAGES[tr.nettoyage].toLowerCase()}` : 'sans nettoyage'}</span>
          <p>{t(tr.note)}</p>
        </li>
      {/each}
    </ul>
  {:else if section === 'coupure'}
    <p class="carte bloc">{t(M.coupure_de_courant)}</p>
  {:else if section === 'calibrage'}
    <ul class="carte puces">
      {#each M.installation.calibrage as s (s)}<li>{t(s)}</li>{/each}
    </ul>
    <div class="carte bloc fait">
      <p>{chambre.faites.calibrage ? `Dernier calibrage : ${date(chambre.faites.calibrage)}.` : 'Aucun calibrage noté.'}</p>
      <button class="bouton plein" onclick={() => fait('calibrage')}><Check size={20} /> Calibré aujourd'hui</button>
    </div>
  {:else if section === 'verification'}
    <p class="discret">Une fois par semaine, sans ouvrir la chambre si possible.</p>
    <ul class="liste cases">
      {#each M.verification_hebdomadaire as v, i (v)}
        <li>
          <label><input type="checkbox" bind:checked={coches[i]} /><span>{t(v)}</span></label>
        </li>
      {/each}
    </ul>
    <div class="carte bloc fait">
      <p>{chambre.faites.verification ? `Dernière vérification : ${date(chambre.faites.verification)}.` : 'Aucune vérification notée.'}</p>
      <button class="bouton plein" onclick={() => fait('verification')}><Check size={20} /> Vérification faite</button>
    </div>
  {:else}
    <p class="vide">Page introuvable.</p>
  {/if}
</div>

<style>
  h1 {
    font-size: 28px;
    margin: 4px 0 14px;
  }

  h2 {
    font-size: 18px;
  }

  .bloc {
    display: block;
    padding: 12px 14px;
    margin: 0 0 10px;
  }

  .bloc p {
    margin: 4px 0 0;
  }

  .bloc ul {
    margin: 8px 0 0;
    padding-left: 1.2em;
  }

  .bloc li + li {
    margin-top: 4px;
  }

  .role {
    font-weight: 500;
  }

  .lignes li {
    display: grid;
    grid-template-columns: minmax(110px, 38%) 1fr;
    gap: 12px;
    padding: 10px 14px;
    font-size: 15px;
  }

  .nom-mode {
    font-weight: 600;
    color: var(--couleur);
  }

  .puces {
    margin: 0;
    padding: 12px 14px 12px 32px;
  }

  .puces li + li {
    margin-top: 6px;
  }

  .guide {
    margin: 0;
    padding: 6px 14px 12px;
  }

  .guide dt {
    font-weight: 700;
    margin-top: 10px;
  }

  .guide dd {
    margin: 2px 0 0;
  }

  .regles {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .regles li {
    padding: 12px 14px;
  }

  .regles p {
    margin: 6px 0 0;
    color: var(--texte-2);
  }

  .regles .etiquette {
    margin-left: 6px;
  }

  .budget {
    border-left: 5px solid var(--vert);
  }

  .fait {
    margin-top: 16px;
  }

  .fait p {
    margin: 0 0 10px;
  }

  .cases label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
  }

  .cases input {
    flex: none;
    width: 24px;
    height: 24px;
    margin: 0;
    accent-color: var(--vert);
  }
</style>
