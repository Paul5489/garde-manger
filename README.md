# Garde-manger

Application de cuisine personnelle pour iPhone (web app installable, 100 % hors ligne) :

- recettes et techniques : recherche plein texte (accents, pluriels, fautes de frappe), filtres, fiches complètes ;
- portions recalculées, mode cuisine pas à pas (écran allumé), minuteurs qui sonnent écran verrouillé ;
- favoris, notes, carnet « cuisiné le… » ;
- liste de courses (fusion des doublons, rayons, partage) ;
- « Avec ce que j'ai » : recettes classées selon les ingrédients disponibles (normalisation, synonymes, placard) ;
- suivi de fermentations (jours, étapes, journal avec photos, rappels pour le Calendrier) ;
- sauvegarde / restauration des données personnelles.

**Ce dépôt ne contient que le code.** Aucune recette n'y figure : les recettes (usage personnel,
protégées par le droit d'auteur) sont importées directement dans le téléphone depuis un fichier privé
et ne quittent jamais l'appareil. Des contrôles automatiques bloquent tout enregistrement ou
publication qui contiendrait du texte de recette.

Svelte 5, TypeScript, Vite, vite-plugin-pwa, IndexedDB (Dexie), MiniSearch. Tests : Vitest (`npm test`).
