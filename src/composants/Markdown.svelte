<script lang="ts">
  import { markdownVersHtml } from '../lib/markdown';
  import { insecables } from '../lib/texte';

  let { texte }: { texte: string } = $props();
  const html = $derived(markdownVersHtml(insecables(texte)));
</script>

<!-- Le HTML brut du texte source est ignoré par le rendu (voir lib/markdown.ts). -->
<div class="markdown">{@html html}</div>
