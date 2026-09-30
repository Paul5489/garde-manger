<script lang="ts">
  // Nouveau bocal (libre, depuis une fiche ou un modèle) ou modification d'un bocal.
  import { Plus, Trash2 } from '@lucide/svelte';
  import BarreHaut from '../composants/BarreHaut.svelte';
  import { reglagesDepuisFiche, type EtapeBocal, type ReglagesBocal, type UniteDuree } from '../lib/bocaux';
  import { bocaux } from '../lib/bocaux.svelte';
  import { annonce } from '../lib/annonce.svelte';
  import { aujourdhui, nombre } from '../lib/format';
  import { etat } from '../lib/etat.svelte';
  import { lireNombre } from '../lib/quantites';
  import { lienBocal, routeur } from '../lib/routeur.svelte';

  let { id, fiche, modele }: { id?: string; fiche?: string; modele?: string } = $props();

  interface EtapeSaisie {
    nom: string;
    min: string;
    max: string;
    unite: UniteDuree;
    temperature: string;
  }

  const texteNombre = (n?: number) => (n === undefined ? '' : nombre(n, 2).replace(/\s/g, ''));
  const versSaisie = (e: EtapeBocal): EtapeSaisie => ({
    nom: e.nom,
    min: texteNombre(e.min),
    max: texteNombre(e.max),
    unite: e.unite,
    temperature: texteNombre(e.temperatureC),
  });

  let pret = $state(false);
  let introuvable = $state(false);
  let nom = $state('');
  let type = $state('');
  let jour = $state(aujourdhui());
  let poids = $state('');
  let sel = $state('');
  let temperature = $state('');
  let etapes = $state<EtapeSaisie[]>([{ nom: 'Fermentation', min: '', max: '', unite: 'jours', temperature: '' }]);
  let notes = $state('');
  let commeModele = $state(false);
  let ficheId = $state<string | undefined>(undefined);
  let debutOriginal: string | undefined;
  let enCours = $state(false);

  function remplir(r: ReglagesBocal) {
    nom = r.nom;
    type = r.type ?? '';
    poids = texteNombre(r.poidsG);
    sel = texteNombre(r.selPct);
    temperature = texteNombre(r.temperatureC);
    etapes = r.etapes.length ? r.etapes.map(versSaisie) : etapes;
    notes = r.notes ?? '';
    ficheId = r.ficheId;
  }

  // Pré-remplissage (une seule fois).
  $effect(() => {
    if (pret || !bocaux.charge) return;
    if (id) {
      const b = bocaux.bocal(id);
      if (!b) {
        introuvable = true;
        return;
      }
      remplir(b);
      debutOriginal = b.debut;
      jour = aujourdhui(new Date(b.debut));
      pret = true;
    } else if (modele) {
      const m = bocaux.modele(modele);
      if (m) remplir(m);
      pret = true;
    } else if (fiche) {
      void etat.fiche(fiche).then((f) => {
        if (f) remplir(reglagesDepuisFiche(f));
        pret = true;
      });
    } else pret = true;
  });

  const lire = (t: string) => (t.trim() ? lireNombre(t.trim().replace(/\s/g, '')) : undefined);
  const selGrammes = $derived.by(() => {
    const p = lire(poids);
    const s = lire(sel);
    return p && s ? Math.round(p * s) / 100 : undefined;
  });

  function ajouterEtape() {
    etapes = [...etapes, { nom: `Étape ${etapes.length + 1}`, min: '', max: '', unite: 'jours', temperature: '' }];
  }

  function retirerEtape(i: number) {
    etapes = etapes.filter((_, k) => k !== i);
  }

  /** Date choisie → début : l'heure actuelle si c'est aujourd'hui, midi sinon ; inchangée si la date n'a pas bougé. */
  function debutChoisi(): Date {
    if (debutOriginal && aujourdhui(new Date(debutOriginal)) === jour) return new Date(debutOriginal);
    if (jour === aujourdhui()) return new Date();
    const [a, m, j] = jour.split('-').map(Number);
    return new Date(a, m - 1, j, 12);
  }

  async function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    if (enCours || !nom.trim()) return;
    enCours = true;
    try {
      const reglages: ReglagesBocal = {
        nom,
        type,
        ficheId,
        poidsG: lire(poids),
        selPct: lire(sel),
        temperatureC: lire(temperature),
        notes,
        etapes: etapes.map((s) => ({
          nom: s.nom,
          unite: s.unite,
          min: lire(s.min),
          max: lire(s.max) ?? lire(s.min),
          temperatureC: lire(s.temperature),
        })),
      };
      if (id) {
        await bocaux.modifier(id, reglages, debutChoisi());
        routeur.retour();
      } else {
        const b = await bocaux.creer(reglages, debutChoisi());
        if (commeModele) await bocaux.enregistrerModele(reglages);
        routeur.remplacerPage(lienBocal(b.id));
        annonce.afficher(commeModele ? 'Bocal démarré, modèle enregistré' : 'Bocal démarré');
      }
    } finally {
      enCours = false;
    }
  }

  const titre = $derived(id ? 'Modifier le bocal' : 'Nouveau bocal');
</script>

<div class="ecran calque">
  <BarreHaut titre={titre} avecTrait />
  <div class="contenu">
    {#if introuvable}
      <p class="vide">Ce bocal n'existe plus.</p>
    {:else if !pret}
      <p class="vide">Chargement…</p>
    {:else}
      <h1 class="titre-serif">{titre}</h1>
      <form onsubmit={enregistrer}>
        <label class="champ-libelle">
          <span>Nom</span>
          <input class="champ" bind:value={nom} required placeholder="Kimchi de chou" autocomplete="off" />
        </label>
        <label class="champ-libelle">
          <span>Type <span class="discret">(facultatif)</span></span>
          <input class="champ" bind:value={type} placeholder="lacto-fermentation, kombucha…" autocomplete="off" />
        </label>
        <label class="champ-libelle">
          <span>Mis en bocal le</span>
          <input class="champ" type="date" bind:value={jour} max={aujourdhui()} required />
        </label>

        <div class="grille">
          <label class="champ-libelle">
            <span>Poids (g)</span>
            <input class="champ" bind:value={poids} inputmode="decimal" placeholder="1000" />
          </label>
          <label class="champ-libelle">
            <span>Sel (%)</span>
            <input class="champ" bind:value={sel} inputmode="decimal" placeholder="2" />
          </label>
          <label class="champ-libelle">
            <span>Temp. (°C)</span>
            <input class="champ" bind:value={temperature} inputmode="decimal" placeholder="21" />
          </label>
        </div>
        {#if selGrammes !== undefined}
          <p class="calcul">Sel à peser : <strong>{nombre(selGrammes, 1)}&nbsp;g</strong></p>
        {/if}

        <h2 class="section-titre">{etapes.length > 1 ? 'Étapes successives' : 'Durée prévue'}</h2>
        {#each etapes as e, i (i)}
          <div class="carte etape">
            {#if etapes.length > 1}
              <div class="entete-etape">
                <input class="champ nom-etape" bind:value={e.nom} aria-label="Nom de l'étape {i + 1}" />
                <button type="button" class="bouton-icone" onclick={() => retirerEtape(i)} aria-label="Retirer l'étape {i + 1}">
                  <Trash2 size={18} />
                </button>
              </div>
            {/if}
            <div class="duree">
              <input class="champ court" bind:value={e.min} inputmode="decimal" placeholder="min" aria-label="Durée minimale" />
              <span>à</span>
              <input class="champ court" bind:value={e.max} inputmode="decimal" placeholder="max" aria-label="Durée maximale" />
              <select class="champ unite" bind:value={e.unite} aria-label="Unité">
                <option value="jours">jours</option>
                <option value="heures">heures</option>
              </select>
            </div>
            {#if etapes.length > 1}
              <label class="temp-etape">
                <span class="discret petit">Température</span>
                <input class="champ court" bind:value={e.temperature} inputmode="decimal" placeholder="°C" />
              </label>
            {/if}
          </div>
        {/each}
        <button type="button" class="bouton-icone ajout-etape" onclick={ajouterEtape}><Plus size={18} /> Ajouter une étape</button>
        <p class="discret petit">Ex. vinaigre : fermentation alcoolique, puis acétification. Laisse vide si la durée est libre.</p>

        <label class="champ-libelle">
          <span>Notes <span class="discret">(facultatif)</span></span>
          <textarea class="champ" rows="3" bind:value={notes} placeholder="Ingrédients, recette de base, idées…"></textarea>
        </label>

        {#if !id && !modele}
          <label class="option">
            <input type="checkbox" bind:checked={commeModele} />
            <span>Enregistrer aussi comme <strong>modèle</strong> (pour le refaire facilement)</span>
          </label>
        {/if}

        <button class="bouton plein valider" type="submit" disabled={enCours || !nom.trim()}>
          {id ? 'Enregistrer' : 'Démarrer le bocal'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .calque {
    z-index: 10;
  }

  h1 {
    font-size: 28px;
    margin: 4px 0 12px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
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

  .grille {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .grille .champ {
    min-width: 0;
  }

  .calcul {
    margin: -4px 4px 0;
    color: var(--vert);
  }

  .section-titre {
    margin-bottom: 0;
  }

  .etape {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }

  .entete-etape {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nom-etape {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }

  .duree {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .court {
    width: 5em;
    flex: none;
    text-align: center;
  }

  .unite {
    flex: 1;
    min-width: 0;
  }

  .temp-etape {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ajout-etape {
    align-self: flex-start;
    gap: 6px;
  }

  .option {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .option input {
    width: 24px;
    height: 24px;
    margin: 0;
    flex: none;
    accent-color: var(--accent);
  }

  .valider {
    margin-top: 8px;
  }
</style>
