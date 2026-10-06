<script lang="ts">
  // Onglet « Ajouter » : coller le texte d'une recette (ou la photographier dans l'app Claude) ; l'app Claude
  // de l'iPhone la met au format des autres fiches, gratuitement (copier la demande → recoller la réponse).
  // Ou rangement sans Claude, hors ligne, pour un texte bien présenté.
  import {
    Camera,
    ClipboardCheck,
    ClipboardPaste,
    Copy,
    ExternalLink,
    FileDown,
    PenLine,
    WandSparkles,
  } from '@lucide/svelte';
  import ListeFiches from '../composants/ListeFiches.svelte';
  import { ajout } from '../lib/ajout.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import { etat } from '../lib/etat.svelte';
  import { pluriel } from '../lib/format';
  import {
    demandePourAppClaude,
    ErreurLecture,
    lireReponseClaude,
    ressembleReponseClaude,
    versFiche,
  } from '../lib/lecture-recette';
  import { analyserTexte, ficheVersBrouillon } from '../lib/mes-recettes';
  import { mesRecettes } from '../lib/mes-recettes.svelte';
  import { lienEditionRecette, lienFiche, routeur } from '../lib/routeur.svelte';
  import { lireSauvegarde, restaurer, TABLES_VIDES } from '../lib/sauvegarde';
  import type { Resume } from '../lib/types';

  let mode = $state<'texte' | 'photo'>('texte');
  let texte = $state('');
  let consignes = $state('');
  let erreur = $state<string | null>(null);
  let champFichier = $state<HTMLInputElement>();

  // Façon gratuite (app Claude) : demande copiée, puis réponse recollée.
  let demandeCopiee = $state(false);
  let demandeACopier = $state<string | null>(null);
  let reponseManuelle = $state<string | null>(null);
  /** Où afficher le message d'erreur : près du bouton qui vient d'être touché. */
  let zoneErreur = $state<'gratuit' | 'autres'>('gratuit');

  const recentes = $derived(
    mesRecettes.liste
      .slice(0, 5)
      .map((f) => etat.parId.get(f.id))
      .filter((r): r is Resume => !!r),
  );

  /** Façon gratuite, étape 1 : copier la demande (consignes + recette) pour l'app Claude. */
  async function copierDemande() {
    erreur = null;
    zoneErreur = 'gratuit';
    const demande = demandePourAppClaude({ texte: mode === 'texte' ? texte : undefined, consignes, photo: mode === 'photo' });
    try {
      await navigator.clipboard.writeText(demande);
      demandeCopiee = true;
      demandeACopier = null;
    } catch {
      // Presse-papiers indisponible : on montre la demande pour la copier à la main.
      demandeACopier = demande;
      demandeCopiee = true;
    }
  }

  /** Façon gratuite, étape 3 : coller la réponse de Claude. */
  async function collerReponse() {
    erreur = null;
    zoneErreur = 'gratuit';
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('vide');
      importerReponse(t);
    } catch (e) {
      if (e instanceof ErreurLecture) erreur = e.message;
      else reponseManuelle = ''; // lecture refusée : zone où coller soi-même
    }
  }

  function importerReponse(t: string) {
    erreur = null;
    try {
      const r = lireReponseClaude(t);
      const fiche = versFiche(
        r,
        mode === 'texte' && texte.trim() && !ressembleReponseClaude(texte) ? texte : undefined,
        mode === 'photo',
      );
      ajout.enAttente = {
        brouillon: ficheVersBrouillon(fiche),
        base: fiche,
        info: "✓ Recette préparée par l'app Claude (gratuit). Vérifie-la, corrige si besoin, puis enregistre.",
        modifications: r.modifications_appliquees,
      };
      vider();
      demandeCopiee = false;
      reponseManuelle = null;
      routeur.aller(lienEditionRecette());
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }

  /** Sans Claude : rangement automatique dans le téléphone (texte bien présenté, consignes non appliquées). */
  function rangerSansClaude() {
    if (!texte.trim()) return;
    zoneErreur = 'autres';
    // Réponse de l'app Claude collée ici par erreur : on la lit comme telle.
    if (ressembleReponseClaude(texte)) {
      importerReponse(texte);
      return;
    }
    ajout.enAttente = {
      brouillon: analyserTexte(texte),
      info: '✓ Recette rangée sans Claude. Vérifie chaque partie (et applique toi-même tes modifications), puis enregistre.',
    };
    vider();
    routeur.aller(lienEditionRecette());
  }

  function vider() {
    texte = '';
    consignes = '';
  }

  /** Fichier de recette préparé sur le Mac (même format qu'une sauvegarde) : ajouté sans rien effacer. */
  async function fichierChoisi(e: Event) {
    zoneErreur = 'autres';
    const input = e.currentTarget as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    erreur = null;
    try {
      const s = lireSauvegarde(JSON.parse(await fichier.text()));
      const recettes = s.donnees.mesRecettes;
      if (!recettes.length) throw new Error('Ce fichier ne contient aucune recette à ajouter.');
      await restaurer({ ...s, donnees: { ...TABLES_VIDES(), mesRecettes: recettes } });
      await mesRecettes.charger();
      const premiere = recettes[0] as { id: string; titre: string };
      annonce.afficher(
        recettes.length === 1 ? `« ${premiere.titre} » ajoutée.` : `${pluriel(recettes.length, 'recette ajoutée', 'recettes ajoutées')}.`,
      );
      if (recettes.length === 1) routeur.aller(lienFiche(premiere.id));
    } catch (err) {
      erreur =
        err instanceof SyntaxError
          ? 'Ce fichier est illisible. Choisis un fichier de recette Garde-manger (.json).'
          : err instanceof Error
            ? err.message
            : String(err);
    }
  }
</script>

<input bind:this={champFichier} type="file" onchange={fichierChoisi} hidden />

<div class="grand-titre"><h1>Ajouter</h1></div>

<div class="contenu">
  <div class="choix" role="tablist" aria-label="Source de la recette">
    <button role="tab" aria-selected={mode === 'texte'} class:actif={mode === 'texte'} onclick={() => (mode = 'texte')}>
      <ClipboardPaste size={18} /> Texte copié
    </button>
    <button role="tab" aria-selected={mode === 'photo'} class:actif={mode === 'photo'} onclick={() => (mode = 'photo')}>
      <Camera size={18} /> Photo
    </button>
  </div>

  <div class="carte bloc">
    {#if mode === 'texte'}
      <label class="champ-libelle">
        <span>Colle ici le texte de la recette <span class="discret">(site, message, livre…)</span></span>
        <textarea class="champ grand" bind:value={texte} rows="10" placeholder="Touche longuement ici, puis « Coller »"></textarea>
      </label>
    {:else}
      <p class="petit aide-photo">
        📷 Tu prendras la photo de la recette <strong>directement dans l'app Claude</strong>, à l'étape 2 ci-dessous
        (bien à plat, toute la recette lisible ; deux photos si elle tient sur deux pages). Note juste ici tes
        modifications éventuelles.
      </p>
    {/if}

    <label class="champ-libelle consignes">
      <span>Modifications à faire <span class="discret">(facultatif)</span></span>
      <input
        class="champ"
        bind:value={consignes}
        placeholder="Ex. : remplace la menthe par 2 bonbons à la menthe"
        autocomplete="off"
      />
    </label>

  </div>

  <h2 class="section-titre">Avec l'app Claude — gratuit</h2>
  <div class="carte bloc gratuit">
    <ol class="etapes-gratuit">
      <li class:fait={demandeCopiee}>
        <button class="bouton plein" onclick={copierDemande} disabled={mode === 'texte' && !texte.trim()}>
          {#if demandeCopiee}<ClipboardCheck size={20} /> Demande copiée{:else}<Copy size={20} /> Copier la demande pour Claude{/if}
        </button>
        {#if mode === 'texte' && !texte.trim()}<span class="discret petit">Colle d'abord la recette ci-dessus.</span>{/if}
        {#if demandeACopier}
          <textarea class="champ" readonly rows="4" value={demandeACopier} onfocus={(e) => e.currentTarget.select()}></textarea>
          <span class="discret petit">Sélectionne tout ce texte et copie-le.</span>
        {/if}
      </li>
      <li>
        <a class="bouton secondaire plein" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={18} /> Ouvrir l'app Claude
        </a>
        <span class="discret petit">
          Colle la demande{#if mode === 'photo'}, ajoute la photo de la recette (bouton +){/if}, envoie. Quand Claude a
          répondu, touche <strong>Copier</strong> sous sa réponse et reviens ici.
        </span>
      </li>
      <li>
        <button class="bouton plein" onclick={collerReponse}><ClipboardPaste size={20} /> Coller la réponse de Claude</button>
        {#if reponseManuelle !== null}
          <textarea class="champ" rows="4" bind:value={reponseManuelle} placeholder="Touche longuement ici, puis « Coller »"></textarea>
          <button class="bouton secondaire plein" onclick={() => importerReponse(reponseManuelle ?? '')} disabled={!reponseManuelle?.trim()}>
            Lire la réponse
          </button>
        {/if}
      </li>
    </ol>
    {#if erreur && zoneErreur === 'gratuit'}<p class="message-erreur" role="alert">{erreur}</p>{/if}
  </div>

  <h2 class="section-titre">Autres façons</h2>
  <div class="autres">
    {#if mode === 'texte'}
      <button class="bouton secondaire plein" onclick={rangerSansClaude} disabled={!texte.trim()}>
        <WandSparkles size={20} /> Ranger sans Claude (hors ligne)
      </button>
      <span class="discret petit">Pour un texte déjà bien présenté : l'appli range seule, sans appliquer tes modifications.</span>
    {/if}
    <a class="bouton secondaire plein" href={lienEditionRecette()}><PenLine size={20} /> Écrire une recette à la main</a>
    <button class="bouton secondaire plein" onclick={() => champFichier?.click()}>
      <FileDown size={20} /> Ajouter un fichier de recette (.json)
    </button>
    {#if erreur && zoneErreur === 'autres'}<p class="message-erreur" role="alert">{erreur}</p>{/if}
  </div>

  {#if recentes.length}
    <h2 class="section-titre">Mes dernières recettes ajoutées</h2>
    <ListeFiches fiches={recentes} masquerSource />
  {/if}
</div>

<style>
  .choix {
    display: flex;
    gap: 4px;
    padding: 4px;
    margin: 4px 0 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }

  .choix button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    border: none;
    border-radius: 9px;
    background: none;
    color: var(--texte-2);
    font-weight: 600;
    font-size: 15px;
  }

  .choix button.actif {
    background: var(--surface);
    color: var(--texte);
    box-shadow: var(--ombre);
  }

  .bloc {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
  }

  .champ-libelle {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .champ-libelle > span {
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-2);
  }

  .champ-libelle > span .discret {
    font-weight: 400;
  }

  textarea.champ {
    resize: vertical;
    line-height: 1.4;
    font-size: 16px;
    min-height: 11em;
  }

  .aide-photo {
    margin: 0;
  }

  .gratuit {
    border: 2px solid var(--vert);
  }

  .etapes-gratuit {
    margin: 0;
    padding-left: 1.4em;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .etapes-gratuit li {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .etapes-gratuit li::marker {
    font-weight: 700;
    color: var(--vert);
  }

  .etapes-gratuit li.fait .bouton {
    background: var(--vert);
  }

  .message-erreur {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--accent-doux);
    color: var(--rouge);
    font-size: 15px;
  }

  .autres {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .autres .discret {
    margin: -2px 4px 6px;
  }
</style>
