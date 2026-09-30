<script lang="ts">
  import Importeur from '../composants/Importeur.svelte';
</script>

<div class="bienvenue">
  <img src="{import.meta.env.BASE_URL}icone.svg" alt="" class="logo" width="96" height="96" />
  <h1 class="titre-serif">Garde-manger</h1>
  <p class="intro">Tes recettes, techniques, courses et bocaux, dans ta poche et hors ligne.</p>

  <div class="carte etapes">
    <h2>Pour commencer</h2>
    <ol>
      <li>Touche <strong>Importer mes recettes</strong>.</li>
      <li>
        Touche <strong>Parcourir</strong>, puis choisis <strong>archive_complete.json</strong> : dans
        <strong>Sur mon iPhone › Téléchargements</strong> (reçu par AirDrop ou téléchargé), ou dans
        <strong>iCloud Drive › Garde-manger</strong>.
      </li>
      <li>Patiente quelques secondes : les recettes sont copiées dans le téléphone.</li>
    </ol>
    <Importeur />
  </div>

  <p class="discret petit note">
    Les recettes restent uniquement dans ce téléphone. Aucune donnée n'est envoyée sur Internet.
  </p>
</div>

<style>
  .bienvenue {
    height: 100%;
    overflow-y: auto;
    padding: calc(var(--haut) + 40px) calc(20px + var(--droite)) calc(var(--bas) + 24px) calc(20px + var(--gauche));
    max-width: 520px;
    margin: 0 auto;
    text-align: center;
  }

  .logo {
    border-radius: 22px;
    box-shadow: var(--ombre);
  }

  h1 {
    font-size: 34px;
    margin-top: 16px;
  }

  .intro {
    color: var(--texte-2);
    margin: 8px 0 28px;
  }

  .etapes {
    text-align: left;
    padding: 18px 18px 20px;
  }

  .etapes h2 {
    font-size: 17px;
    margin-bottom: 6px;
  }

  ol {
    padding-left: 1.3em;
    margin: 0 0 18px;
  }

  li {
    margin: 6px 0;
  }

  .note {
    margin-top: 20px;
  }
</style>
