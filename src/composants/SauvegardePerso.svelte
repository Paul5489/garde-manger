<script lang="ts">
  // Réglages › Mes données : exporter / restaurer une sauvegarde des données personnelles.
  import { FileDown, FileUp } from '@lucide/svelte';
  import { bocaux } from '../lib/bocaux.svelte';
  import { courses } from '../lib/courses.svelte';
  import { db } from '../lib/db';
  import { date, pluriel } from '../lib/format';
  import { frigo } from '../lib/frigo.svelte';
  import { mesRecettes } from '../lib/mes-recettes.svelte';
  import { enregistrerFichier } from '../lib/partage';
  import { perso } from '../lib/perso.svelte';
  import {
    compter,
    exporter,
    lireSauvegarde,
    NOMS_TABLES,
    nomFichierSauvegarde,
    restaurer,
    type Sauvegarde,
  } from '../lib/sauvegarde';
  import { ecrireLocal, lireLocal } from '../lib/stockage-local';

  let champ = $state<HTMLInputElement>();
  // Le fichier est préparé à l'avance : iOS n'ouvre le menu Partager que juste après un toucher.
  let pret = $state<{ fichier: File; sauvegarde: Sauvegarde } | null>(null);
  let derniere = $state<string | null>(lireLocal<string | null>('derniere-sauvegarde', null));
  let message = $state<string | null>(null);
  let erreur = $state<string | null>(null);

  async function preparer() {
    const s = await exporter(db, __VERSION__);
    pret = {
      sauvegarde: s,
      fichier: new File([JSON.stringify(s)], nomFichierSauvegarde(), { type: 'application/json' }),
    };
  }

  $effect(() => {
    void preparer();
  });

  function resume(s: Sauvegarde): string {
    const c = compter(s);
    const parties = (['mesRecettes', 'favoris', 'notes', 'realisations', 'courses', 'bocaux', 'modelesBocaux'] as const)
      .filter((t) => c[t] > 0)
      .map((t) => pluriel(c[t], NOMS_TABLES[t][0], NOMS_TABLES[t][1]));
    return parties.length ? parties.join(', ') : 'aucune donnée pour l’instant';
  }

  async function sauvegarder() {
    if (!pret) return;
    message = erreur = null;
    try {
      const r = await enregistrerFichier(pret.fichier);
      if (r === 'annule') return;
      derniere = new Date().toISOString();
      ecrireLocal('derniere-sauvegarde', derniere);
      message =
        r === 'partage'
          ? '✓ Sauvegarde prête. Choisis « Enregistrer dans Fichiers » (ou AirDrop vers le Mac) si ce n’est pas déjà fait.'
          : '✓ Fichier de sauvegarde téléchargé.';
    } catch (e) {
      erreur = `La sauvegarde a échoué : ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function fichierChoisi(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    message = erreur = null;
    try {
      let json: unknown;
      try {
        json = JSON.parse(await fichier.text());
      } catch {
        throw new Error('Ce fichier est illisible. Choisis un fichier « garde-manger-sauvegarde-….json ».');
      }
      const s = lireSauvegarde(json);
      const quand = s.exporteLe ? ` du ${date(s.exporteLe)}` : '';
      if (!confirm(`Sauvegarde${quand} : ${resume(s)}.\n\nL'ajouter aux données de ce téléphone ? Rien ne sera effacé.`)) return;
      const bilan = await restaurer(s);
      await Promise.all([perso.charger(), courses.charger(), frigo.charger(), bocaux.charger(), mesRecettes.charger()]);
      await preparer();
      message = `✓ Sauvegarde restaurée : ${pluriel(bilan.ajoutes, 'élément ajouté', 'éléments ajoutés')}${
        bilan.misAJour ? `, ${pluriel(bilan.misAJour, 'mis à jour', 'mis à jour')}` : ''
      }.`;
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<input bind:this={champ} type="file" onchange={fichierChoisi} hidden />

<div class="sauvegarde">
  <p class="petit">
    Sur ce téléphone : <strong>{pret ? resume(pret.sauvegarde) : '…'}</strong>.
    {#if derniere}<br /><span class="discret">Dernière sauvegarde : {date(derniere)}.</span>{/if}
  </p>
  <p class="discret petit">
    Enregistre ce fichier dans Fichiers (ou envoie-le sur le Mac) : il te permettra de tout retrouver sur un autre
    iPhone. Les recettes de l'archive n'y sont pas.
  </p>
  <button class="bouton plein" onclick={sauvegarder} disabled={!pret}>
    <FileDown size={20} /> Sauvegarder mes données
  </button>
  <button class="bouton secondaire plein" onclick={() => champ?.click()}>
    <FileUp size={20} /> Restaurer une sauvegarde
  </button>
  {#if erreur}<p class="message erreur" role="alert">{erreur}</p>{/if}
  {#if message}<p class="message succes" role="status">{message}</p>{/if}
</div>

<style>
  .sauvegarde {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  p {
    margin: 0;
  }

  .message {
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 15px;
  }

  .erreur {
    background: var(--accent-doux);
    color: var(--rouge);
  }

  .succes {
    background: var(--vert-doux);
    color: var(--vert);
  }
</style>
