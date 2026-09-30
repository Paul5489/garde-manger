<script lang="ts">
  let { titre, etape, texte }: { titre: string; etape: number; texte: string } = $props();
</script>

<div class="grand-titre"><h1>{titre}</h1></div>
<div class="contenu">
  <div class="carte bientot">
    <p class="etiquette">Étape {etape}</p>
    <p>{texte}</p>
  </div>
</div>

<style>
  .bientot {
    padding: 18px;
    margin-top: 12px;
    color: var(--texte-2);
  }
</style>
