<script lang="ts">
  // Réglages de la chambre : les 7 modes, le mode choisi à la main, la mise en service, l'entretien,
  // et tout ce qui explique le matériel.
  import { CalendarPlus, ChevronRight } from '@lucide/svelte';
  import FeuilleRappels from '../composants/FeuilleRappels.svelte';
  import { evenementsChambre } from '../ics';
  import { demanderPastille, etatPastille } from '../../lib/pastilles.svelte';
  import { date } from '../../lib/format';
  import { lienChambre } from '../../lib/routeur.svelte';
  import { couleurMode, t } from '../affichage';
  import { chambre, estFacultative } from '../chambre.svelte';
  import { CONTENU, MODES } from '../donnees';

  const actif = $derived(chambre.actif);
  const requises = CONTENU.modes.mise_en_service.filter((e) => !estFacultative(e.titre));
  const faites = $derived(requises.filter((e) => chambre.miseEnService.includes(e.titre)).length);
  const derniere = (cle: 'verification' | 'calibrage' | 'etalonnage-ph') =>
    chambre.faites[cle] ? `Fait le ${date(chambre.faites[cle]!)}` : 'Jamais noté';

  let feuilleRappels = $state(false);
  const rappels = $derived(feuilleRappels ? evenementsChambre(chambre.maintenant, chambre.heureRappels, chambre.faites) : []);
  let pastille = $state(etatPastille());

  async function autoriserPastille() {
    pastille = await demanderPastille();
  }

  const COMPRENDRE: [string, string, string][] = [
    ['appareils', 'Mon matériel', 'Frigo, Inkbird, tapis, ventilateur, déshumidificateur, pH-mètre'],
    ['touches', 'Les touches des Inkbird', 'Entrer, changer une valeur, sortir'],
    ['menager', 'Ménager le matériel', 'Surtout le compresseur du frigo'],
    ['energie', 'Économiser l’énergie', 'Budget de l’année et bonnes habitudes'],
    ['nettoyage', 'Nettoyages', 'Léger, moyen, grand, et quand les faire'],
    ['coupure', 'Coupure de courant', 'Que vérifier au retour du courant'],
  ];
</script>

<div class="contenu">
  <h1 class="titre-serif">Réglages de la chambre</h1>

  <div class="carte bloc">
    {#if actif.manuel}
      <p>Mode <strong>{actif.mode?.nom}</strong>, choisi à la main le {date(actif.depuis)}.</p>
      <button class="bouton secondaire plein" onclick={() => chambre.suivreLeCalendrier()}>Suivre à nouveau le calendrier</button>
    {:else}
      <p>Le mode suit le calendrier{actif.mode ? ` : ${actif.mode.nom} en ce moment` : ' : jour de nettoyage'}.</p>
      <p class="petit discret">Si une campagne commence ou finit en retard, change de mode avec l'assistant : l'appli suivra ton choix.</p>
    {/if}
    <a class="bouton plein" href={lienChambre('changer')}>Changer de mode</a>
  </div>

  <h2 class="section-titre">Les modes</h2>
  <ul class="liste">
    {#each MODES as m (m.id)}
      <li>
        <a href={lienChambre('mode', m.id)} style:--couleur={couleurMode(m)}>
          <span class="pastille" aria-hidden="true"></span>
          <span class="texte">
            <strong>{m.nom}</strong>{#if actif.id === m.id}<span class="etiquette actuel">actuel</span>{/if}
            <span class="petit discret">{t(m.cible)}</span>
          </span>
          <ChevronRight size={18} />
        </a>
      </li>
    {/each}
  </ul>

  <h2 class="section-titre">Mise en service et entretien</h2>
  <ul class="liste">
    <li>
      <a href={lienChambre('mise-en-service')}>
        <span class="texte">
          <strong>Mise en service</strong>
          <span class="petit discret">{chambre.miseEnServiceFaite ? 'Terminée' : `${faites} sur ${requises.length} étapes`}</span>
        </span>
        <ChevronRight size={18} />
      </a>
    </li>
    <li>
      <a href={lienChambre('infos', 'verification')}>
        <span class="texte"><strong>Vérification de la semaine</strong><span class="petit discret">{derniere('verification')}</span></span>
        <ChevronRight size={18} />
      </a>
    </li>
    <li>
      <a href={lienChambre('infos', 'calibrage')}>
        <span class="texte"><strong>Calibrage des sondes</strong><span class="petit discret">Une fois par an · {derniere('calibrage')}</span></span>
        <ChevronRight size={18} />
      </a>
    </li>
    <li>
      <a href={lienChambre('infos', 'ph-metre')}>
        <span class="texte"><strong>pH-mètre</strong><span class="petit discret">Étalonnage chaque mois · {derniere('etalonnage-ph')}</span></span>
        <ChevronRight size={18} />
      </a>
    </li>
  </ul>

  <h2 class="section-titre">Comprendre</h2>
  <ul class="liste">
    {#each COMPRENDRE as [cle, titre, sous] (cle)}
      <li>
        <a href={lienChambre('infos', cle)}>
          <span class="texte"><strong>{titre}</strong><span class="petit discret">{sous}</span></span>
          <ChevronRight size={18} />
        </a>
      </li>
    {/each}
  </ul>

  <h2 class="section-titre">Rappels</h2>
  <div class="carte bloc">
    <label class="heure">
      <span>Heure des contrôles sans heure précise et des rappels</span>
      <select class="champ" value={chambre.heureRappels} onchange={(e) => chambre.reglerHeure(Number(e.currentTarget.value))}>
        {#each [6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20] as h (h)}<option value={h}>{h} h</option>{/each}
      </select>
    </label>
    <p class="petit discret">
      Dans le Calendrier de l'iPhone, sur un an : changements de mode, vidages du réservoir, vérification de la
      semaine, calibrage des sondes, pH-mètre. Les rappels des lots se mettent depuis chaque lot.
    </p>
    <button class="bouton secondaire plein" onclick={() => (feuilleRappels = true)}><CalendarPlus size={18} /> Rappels de la chambre</button>
  </div>

  <h2 class="section-titre">Pastille sur l'icône</h2>
  <div class="carte bloc">
    {#if pastille === 'active'}
      <p>✓ La pastille de l'icône montre le nombre de choses à faire aujourd'hui.</p>
    {:else if pastille === 'impossible'}
      <p class="petit discret">
        La pastille ne marche que dans l'appli installée sur l'écran d'accueil (iOS 16.4 ou plus), pas dans Safari.
      </p>
    {:else if pastille === 'refusee'}
      <p class="petit discret">
        Les notifications sont refusées : pour la pastille, autorise-les dans Réglages de l'iPhone › Notifications ›
        Garde-manger.
      </p>
    {:else}
      <p class="petit discret">
        Le nombre de choses à faire aujourd'hui sur l'icône de l'appli. L'iPhone demande pour cela d'autoriser les
        notifications : c'est gratuit, et l'appli n'en enverra aucune.
      </p>
      <button class="bouton secondaire plein" onclick={autoriserPastille}>Autoriser la pastille</button>
    {/if}
  </div>

  <p class="role petit discret">{t(CONTENU.modes.role_de_l_appli)}</p>
</div>

<FeuilleRappels
  bind:ouvert={feuilleRappels}
  titre="Rappels de la chambre"
  sousTitre="Selon le calendrier, sur un an"
  evenements={rappels}
  nomFichier="rappels-chambre.ics"
  sequence={Math.floor(chambre.maintenant / 1000)}
  maintenant={chambre.maintenant}
/>

<style>
  h1 {
    font-size: 28px;
    margin: 4px 0 14px;
  }

  .bloc {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bloc p {
    margin: 0;
  }

  .liste a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 10px 14px;
    color: inherit;
    text-decoration: none;
  }

  .liste a:active {
    background: var(--surface-2);
  }

  .liste :global(svg) {
    flex: none;
    color: var(--texte-3);
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .pastille {
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--couleur);
  }

  .actuel {
    margin-left: 8px;
    background: var(--vert-doux);
    color: var(--vert);
    align-self: flex-start;
  }

  .heure {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .heure select {
    width: auto;
    flex: none;
  }

  .role {
    margin-top: 28px;
    text-align: center;
  }
</style>
