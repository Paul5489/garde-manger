# Garde-manger — état du projet et consignes pour Claude Code

Application de cuisine **PWA hors ligne** pour l'iPhone 13 de Paul (iOS 26.6) : recettes et techniques,
mode cuisine avec minuteurs, courses, suivi de fermentations. Nom choisi par Paul : **Garde-manger**.

**Paul n'est pas développeur** : réponds en français, simplement, et dis-lui précisément quoi toucher
sur son Mac ou son iPhone (noms exacts des boutons). Il préfère une question courte plutôt qu'une supposition.
Cahier des charges complet (à relire pour les étapes restantes) : `../prompt-claude-code-appli-recettes.md`.

---

## 1. Règles impératives

- **Aucune recette dans Git, dans `dist/`, ni en ligne** (droit d'auteur, usage personnel). Seul le **code** est public.
  Les recettes sont importées dans le téléphone (IndexedDB) depuis `archive_complete.json`.
- Ne **jamais modifier** `../archive-recettes/` (données sources, lecture seule). Corrections de données = couche
  séparée dans l'appli (ex. `reparerQuantitePro` dans `src/lib/quantites.ts`).
- Garde-fous automatiques, **ne jamais les contourner** :
  - `scripts/verifier-build.mjs` (lancé par `npm run build`) : refuse le build s'il contient un id, titre, texte d'étape,
    ligne d'ingrédient ou description de l'archive, un `.json`, ou une trace du mode dev.
  - `scripts/verifier-depot.mjs` (hook `pre-commit` via `git config core.hooksPath .githooks`, déjà configuré) :
    refuse tout commit contenant du texte de recette ou un fichier de données. Les **tests** peuvent citer des ids
    et titres courts, mais **pas** de lignes d'ingrédients / textes d'étapes réels : écrire des exemples inventés.
- **Demander à Paul avant** toute nouvelle action publique d'un autre type (nouveau dépôt, compte, service en ligne).
  Publier une nouvelle version sur le dépôt/site existant est acquis (accord du 30/09/2026).
- Données personnelles (favoris, notes, courses, bocaux…) : **tables Dexie séparées**, liées par `id` de fiche
  (ids stables), **jamais effacées** par un réimport (l'import ne vide que `fiches` et `meta`).
- Tout en français : interface, dates « 30 sept. 2026 », nombres « 0,5 ». Utiliser `src/lib/format.ts`
  et `insecables()` (`src/lib/texte.ts`) pour les espaces insécables (« 20 % », « 18 °C »).
- Ne jamais afficher `version_originale` (Noma, texte anglais) : il est retiré dès l'import (`alleger()`).
- Commits : identité locale `Paul <196360979+Paul5489@users.noreply.github.com>` (adresse anonyme GitHub,
  **ne pas** mettre l'e-mail personnel de Paul dans des commits publics). Terminer les messages par
  `Co-Authored-By: Claude …`. Pousser avec
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q origin main`.

## 2. Adresses, comptes, fichiers

| Quoi | Où |
|---|---|
| Appli publiée (https) | **https://paul5489.github.io/garde-manger/** |
| Dépôt public (code seul) | https://github.com/Paul5489/garde-manger — branche `main` (source), `gh-pages` (build) |
| Compte GitHub | `Paul5489`, CLI `gh` déjà connecté sur le Mac |
| Archive de recettes (Mac) | `../archive-recettes/donnees/archive_complete.json` (821 fiches, ~7 Mo) |
| Copie pour l'iPhone | iCloud Drive › `Garde-manger/archive_complete.json` — **iCloud de Paul plein** : non synchronisé |
| Guide utilisateur | `GUIDE_IPHONE.md` (à compléter à l'étape 6) |

## 3. Commandes

```bash
npm run dev       # serveur de test sur le Wi-Fi, port 5180 (le 5173 est pris par un autre projet de Paul : ne pas y toucher)
npm test          # Vitest, 61 tests, sur la VRAIE archive (../archive-recettes ; ignorés si absente)
npm run check     # vérification TypeScript/Svelte (doit afficher 0 erreur, 0 avertissement)
npm run build     # build + vérification anti-recettes
npm run publier   # build (base /garde-manger/) + vérifs + envoi de dist/ sur gh-pages. Exige un dépôt propre (tout commité)
npm run icones    # régénère les icônes PNG depuis public/icone.svg
```

`.claude/launch.json` : configuration « garde-manger » (npm run dev, port 5180) pour le panneau navigateur.

## 4. Tester sur l'iPhone

- **Appli installée (cas normal)** : Paul l'a ajoutée à l'écran d'accueil depuis Safari (⋯ › Partager › « Sur l'écran
  d'accueil »). Après `npm run publier`, l'appli affiche le bandeau « Nouvelle version disponible » → « Mettre à jour ».
  Les recettes ont été importées dans l'appli installée (import réussi le 30/09/2026).
- **Test rapide par le Wi-Fi** : `npm run dev`, puis Safari sur l'iPhone → `http://<IP du Mac>:5180`
  (IP : `ipconfig getifaddr en0`, 192.168.1.12 le 30/09/2026). Bouton « Charger depuis le Mac (test) » = import direct.
  ⚠ En http : **pas** de hors ligne, **pas** de Wake Lock (écran qui se verrouille), et ce stockage est distinct de l'appli installée.
- **Envoyer l'archive sur l'iPhone sans iCloud** (serveur dev lancé) : Safari → `http://<IP>:5180/archive` télécharge
  le fichier dans Fichiers › Téléchargements ; ou AirDrop depuis le Finder. Import : Parcourir › Sur mon iPhone › Téléchargements.
- Tests visuels côté Mac : panneau navigateur en 390 × 844 (clair/sombre). Si le panneau est masqué, les captures
  échouent : vérifier par `javascript_tool` / `get_page_text`. En dev, `globalThis.__minuteurs` permet de lancer
  un minuteur de 2 s pour tester la sonnerie (retiré du build).

## 5. Architecture

- **Vite 8 + TypeScript + Svelte 5 (runes)** — appli la plus légère (bundle ~92 Ko gzip). **vite-plugin-pwa** (generateSW,
  `registerType: 'prompt'`) : précache de tout le code, jamais de JSON. **Dexie 4** (IndexedDB), **MiniSearch 7**
  (recherche), **marked** (Markdown), **@lucide/svelte** (icônes).
- **Routage par hash** (`#/recherche`, `#/fiche/<id>`, `#/fiche/<id>/p272`, `#/cuisine/<id>`, `#/reglages`) : marche hors ligne
  et sur GitHub Pages sans configuration. `base` Vite = `process.env.BASE_URL` (`/garde-manger/` à la publication).
- **Onglets** (barre en bas) : Accueil, Recherche, Frigo (étape 4), Courses (étape 3), Bocaux (étape 5). Les onglets
  visités restent montés (on retrouve sa place) ; fiche / réglages / mode cuisine sont des pages empilées par-dessus.
- **Import** dans un Web Worker : lecture → validation → allègement → résumés (`Resume`) + index MiniSearch sérialisé →
  écriture Dexie. Au démarrage on ne charge que le catalogue léger ; les fiches complètes à la demande ; l'index à la 1re recherche.
- Écran allumé : Wake Lock natif (https) ou repli vidéo muette `public/eveil.mp4` (généré avec ffmpeg).
- Minuteurs : **heure de fin enregistrée** (localStorage) ; sonnerie par une **piste audio WAV fabriquée à la volée**
  (silence puis bips à chaque fin, jouée comme de la musique) pour sonner écran verrouillé et en silencieux,
  + Media Session (titre sur l'écran verrouillé, Pause/Lecture = pause/reprise des minuteurs). Bips Web Audio en secours.

## 6. Où se trouve chaque chose

```
index.html, vite.config.ts        page, config (plugin dev « archive du Mac » : /__archive-dev/… et /archive, apply:'serve')
public/                           icônes (icone.svg = source), eveil.mp4
scripts/                          verifier-build.mjs, verifier-depot.mjs, publier.mjs
.githooks/pre-commit              lance verifier-depot.mjs
src/App.svelte                    coquille : onglets gardés en mémoire, pages empilées, liens #/… interceptés
src/app.css                       couleurs (clair/sombre auto), zones sûres, boutons, listes, puces, Markdown
src/lib/
  types.ts                        types Fiche (schéma de l'archive), Resume, InfosArchive
  archive.ts                      lireArchive (validation), alleger, resumer, univers, tempsTotal, documentDeRecherche
  import.worker.ts / importer.ts  import hors fil principal / lanceur
  db.ts                           Dexie : base « garde-manger », v1 = tables fiches, meta (archive, catalogue, index)
  etat.svelte.ts                  état global : statut, catalogue, parId, index (chargé à la demande), fiche(id)
  moteur.ts                       options MiniSearch (boosts, préfixe sur le dernier mot, flou, repli OR)
  recherche.svelte.ts             requête + filtres (univers, type, source, temps, catégorie, cuisine, type de plat) avec comptes
  texte.ts                        normaliser (accents, œ/æ), radical (pluriels), mots vides, casseLisible, insecables, collator
  format.ts                       nombre, date, heure, duree, dureeJours, pluriel (tout en français)
  quantites.ts                    unités lisibles, mise à l'échelle, ligneIngredient (modes « colonnes » pro / « ligne » rédigée)
  portions.svelte.ts              coefficient par fiche (en mémoire de session), portionsDeBase, pas
  durees.ts                       trouverDurees / decouperDurees (« 20 min », « 1 h 30 », « 45 à 60 min »…), chrono
  ingredients.ts                  nomSimplifie, motsCles, ingredientsDeLEtape — base de la normalisation (étape 4)
  minuteurs.svelte.ts             store des minuteurs (lancer, pause, reprendre, ajouter, arreter, supprimer)
  alarme.svelte.ts / piste-alarme.ts  sonnerie écran verrouillé (piste WAV + Media Session) / fabrication du WAV
  son.ts                          bips Web Audio (secours), déverrouillage audio iOS
  eveil.svelte.ts                 garder l'écran allumé
  markdown.ts                     rendu Markdown sûr (HTML brut ignoré, <!-- page N --> → ancre #p-N, titres en capitales adoucis)
  renvois.ts                      page du livre → fiche technique (source.pages) ; liens « voir p. 57 » dans le texte
  routeur.svelte.ts               routes, historique, bouton Retour ; lienFiche, lienCuisine
  stockage-local.ts, portail.ts   localStorage protégé ; déplacer un élément à la racine (feuilles au-dessus des onglets)
src/composants/                   BarreOnglets, BarreHaut, LigneFiche, ListeFiches (affichage progressif), FeuilleFiltres,
                                  Ingredients (toucher = rayer), TableauDenrees, TexteComplet (insère les tableaux des
                                  denrées à la place des repères), Markdown, TexteRenvois, TexteEtape (durées → minuteurs),
                                  ReglagePortions, CarteFermentation, BarreMinuteurs (pastille, liste, alarme), Importeur,
                                  BandeauMiseAJour, AideInstallation (encadré « écran d'accueil » dans Safari iOS), IconeBocal
src/ecrans/                       Bienvenue (1er lancement), Accueil, Recherche, Fiche, ModeCuisine, Reglages, Bientot (onglets à venir)
tests/                            archive-reelle.ts (accès à la vraie archive) + tests par module
```

## 7. Particularités des données (résumé, détails dans ../archive-recettes/README.md)

- 821 fiches : Marc Winer 188 (`mw-`), AFPA 194 (`afpa-`), Cuisine de référence 186 recettes + 180 techniques/annexes
  (`cr-`), Noma 54 recettes + 16 chapitres (`noma-`), notes perso 3. Champs vides omis → accès tolérants partout.
- Quantités : AFPA/CR en kg/l (« 0,040 kg » → « 40 g »), MW en g/ml/cuillères, Noma g/kg. Sans `quantite` :
  `quantite_min/max`, `pour_memoire` (PM), sinon on relit `texte_original` (CR « nom — unité — 0,800 », AFPA « … 4 Pm »).
  Unités bizarres gérées : `p`, `piéce`, `1` (= l), `bt 4/4`. MW/Noma : la ligne d'origine fait foi (affichée telle quelle,
  nombre de tête mis à l'échelle ; Noma : masses/volumes intégrés aussi, jamais les %).
- Temps : `temps.total` sinon somme préparation+cuisson+… ; quelques durées CR mal lues masquées (`dureeLisible`).
  Phases d'étapes CR « DURÉE MOYENNE… » ignorées ; phases MW affichées.
- CR : `renvois_pages` (501, tous résolus vers une technique) ; textes intégraux avec `[TABLEAU DES DENRÉES …]`
  remplacés par `preparations_de_base` quand le nombre correspond.
- Noma : `fermentation` (sel_pct, temperature_c, duree_min/max_jours ou _heures, etapes[] successives, controle,
  conservation…), 50 fiches → base de l'étape 5.

## 8. Décisions prises avec Paul

- 30/09/2026 : nom **Garde-manger** ; Svelte + Dexie + MiniSearch ; données uniquement dans le téléphone
  (Paul a proposé de mettre les recettes en ligne pour la vitesse : refusé, le local est plus rapide et c'est une question de droits).
- Commit à la fin de chaque étape (Paul : « fais ce que tu penses bon »).
- Publication **GitHub Pages** sur son compte (dépôt public, code seul) — accord explicite. Archive copiée dans
  iCloud Drive › Garde-manger — accord explicite (mais iCloud plein : import fait via Téléchargements).
- Sonnerie écran verrouillé activée par défaut (met la musique en pause pendant un minuteur) ; désactivable dans la liste des minuteurs.

## 9. Fait

- **Étape 1** : squelette PWA, import (fichier ou Mac en dev), accueil par univers + « Idées du jour », recherche plein texte
  (accents, ligatures, pluriels, fautes de frappe, repli OR) + filtres à facettes, fiche complète (ingrédients par groupe,
  étapes, matériel, remarques, variantes, utilisations, fermentation, Brix, textes intégraux, renvois de pages, avertissements).
- **Étape 2** : portions (− / +) ou coefficient ×0,5…×4 (y compris tableaux des denrées), mode cuisine (mise en place,
  une étape à la fois, balayage, ingrédients de l'étape, taille du texte, écran allumé, reprise à la même étape),
  minuteurs multiples depuis les durées des étapes, sonnerie écran verrouillé/silencieux, « +1 / +5 min / +reste de fourchette ».
- **Mise en ligne + installation** : publiée, installée sur l'iPhone, recettes importées ; aide à l'installation dans Safari.

## 10. Reste à faire (ordre convenu, faire tester chaque étape sur l'iPhone)

0. **Confirmer avec Paul** dans l'appli installée : écran qui reste allumé en mode cuisine ; minuteur qui sonne écran
   verrouillé + mode silencieux (piste audio). Non confirmé à ce jour ; si la piste ne joue pas en arrière-plan, pistes :
   raccourci iOS « Démarrer le minuteur » (`shortcuts://run-shortcut?name=…&input=text&text=<minutes>`) ou .ics avec alarme.
1. **Étape 3** — favoris ; note perso par recette ; « cuisiné le… » + appréciation (bouton sur la dernière diapo du mode cuisine) ;
   liste de courses (ajout des ingrédients avec les portions choisies, fusion des doublons de même unité, articles libres,
   cases à cocher, rayons, partage texte via `navigator.share`) ; export/import d'une sauvegarde JSON des données perso
   (Réglages) ; accueil : section « Mes favoris ». Ajouter les tables Dexie en **version(2)** (sans toucher à fiches/meta).
   Penser à conserver le coefficient de portions (aujourd'hui en mémoire de session seulement).
2. **Étape 4** — « Avec ce que j'ai » (onglet Frigo) : saisie avec suggestions, normalisation (étendre `ingredients.ts` :
   singulier, sans accents, précisions après la virgule, mots « haché, frais, émincé… »), **fichier de synonymes éditable**
   (échalote/échalotes, crème liquide/crème fleurette, oignon nouveau/cébette/jeunes oignons…), **placard** réglable
   (sel, poivre, eau, huile, sucre… toujours présents), classement par part d'ingrédients possédés + ce qui manque.
   Gestion placard/synonymes dans Réglages. Tests sur la vraie archive.
3. **Étape 5** — « Mes bocaux » : bocal depuis une fiche Noma (pré-rempli par `fermentation`) ou libre (kimchi) ; nom, début,
   poids, % sel, température, durée min/max, étapes successives, statut (en cours/terminé/raté), journal daté + photo
   compressée ; accueil « Jour 4 sur 5 à 7 », barre de progression, « à goûter aujourd'hui », « prêt » ; bouton
   « Ajouter au Calendrier » (.ics avec VALARM : dégustations, fin prévue) ; modèles réutilisables. **Tests du calcul des jours**.
4. **Étape 6** — finitions : compléter `GUIDE_IPHONE.md` (sauvegarde, mise à jour), relecture accessibilité/mode sombre,
   vérifier hors ligne en mode avion, nettoyer (`fake-indexeddb` installé mais inutilisé ; supprimer ou s'en servir pour tester Dexie).

## 11. Problèmes connus et limites

- **iCloud Drive de Paul plein** : le dossier Garde-manger du Mac n'est pas envoyé vers iCloud.
  Utiliser `http://<IP>:5180/archive` (serveur dev lancé) ou AirDrop pour les futurs imports.
- Safari et l'appli installée ont des **stockages séparés** : toujours importer/utiliser depuis l'icône.
- Une web app iOS ne peut pas programmer de notification sans serveur : sonnerie = piste audio (à confirmer, voir §10.0).
  Minuteurs à plus de 2 h de leur fin : non inclus dans la piste tant que l'appli n'est pas rouverte. La piste coupe la musique.
- Bips Web Audio (secours) muets en mode silencieux ; la vidéo de repli « écran allumé » n'a pas marché en http sur l'iPhone.
- Quantités écrites dans le texte des étapes non recalculées (note affichée). Accord des pluriels non géré après
  mise à l'échelle des lignes rédigées (« 2 oignon »).
- Repérage des ingrédients d'une étape par mots-clés simples (peut citer un ingrédient de même nom d'un autre groupe :
  le groupe est alors indiqué).
- Coefficient de portions et étape en cours du mode cuisine : mémorisés seulement tant que l'appli est ouverte.
- Captures du panneau navigateur parfois en retard d'une action : vérifier l'état par JavaScript.
