# Garde-manger — consignes pour Claude Code

Application de cuisine (PWA hors ligne) pour l'iPhone 13 de Paul. Paul n'est pas développeur :
réponds en français, simplement, et dis-lui précisément quoi faire sur son Mac ou son iPhone.
Cahier des charges complet : `../prompt-claude-code-appli-recettes.md`.

## Règles impératives
- **Les recettes ne doivent jamais être dans Git, dans `dist/` ni en ligne** (droit d'auteur, usage personnel).
  Elles sont importées sur le téléphone (IndexedDB) depuis `archive_complete.json`.
- Ne jamais modifier `../archive-recettes/` (données sources, lecture seule).
- `npm run build` lance `scripts/verifier-build.mjs`, qui refuse le build si une recette s'y trouve. Ne pas contourner.
- Demander à Paul avant de créer un compte, un dépôt distant ou de publier quoi que ce soit.
- Données personnelles (favoris, notes, courses, bocaux…) : tables séparées, liées par `id` de fiche,
  jamais effacées par un réimport.
- Tout en français : interface, dates (« 30 sept. 2026 »), nombres (« 0,5 »). Voir `src/lib/format.ts`.

## Commandes
- `npm run dev` — serveur sur le réseau local, port **5180** (le 5173 est pris par un autre projet de Paul).
  Adresse iPhone : `http://<IP du Mac>:5180` (`ipconfig getifaddr en0`).
- `npm test` — tests Vitest sur la vraie archive (`../archive-recettes`, ignorés si absente).
- `npm run check` — vérification TypeScript/Svelte.
- `npm run build` — build + vérification anti-recettes.

## Organisation
- `src/lib/` : logique (archive, quantités/unités, recherche MiniSearch, base Dexie, routeur par `#/…`).
- `src/composants/`, `src/ecrans/` : interface Svelte 5 (runes).
- `src/lib/import.worker.ts` : import de l'archive hors du fil principal.
- Le bouton « Charger depuis le Mac » n'existe qu'en développement (`import.meta.env.DEV`, plugin Vite `apply: 'serve'`).
