# Garde-manger — état du projet et consignes pour Claude Code

Application de cuisine **PWA hors ligne** pour l'iPhone 13 de Paul (iOS 26.6) : recettes et techniques,
mode cuisine avec minuteurs, courses, suivi de fermentations. Nom choisi par Paul : **Garde-manger**.

**Paul n'est pas développeur** : réponds en français, simplement, et dis-lui précisément quoi toucher
sur son Mac ou son iPhone (noms exacts des boutons). Il préfère une question courte plutôt qu'une supposition.
Cahier des charges complet (à relire pour les étapes restantes) : `../prompt-claude-code-appli-recettes.md`.

---

## 1. Règles impératives

- **Avant de modifier quoi que ce soit** : `git fetch` puis `git log --oneline HEAD..origin/main`. D'autres conversations
  (parfois dans le cloud) travaillent aussi sur ce dépôt : le 06/10/2026, deux versions parallèles ont dû être réunies.

- **Aucune recette dans Git, dans `dist/`, ni en ligne** (droit d'auteur, usage personnel). Seul le **code** est public.
  Les recettes sont importées dans le téléphone (IndexedDB) depuis `archive_complete.json`.
- Ne **jamais modifier** `../archive-recettes/` (données sources, lecture seule). Corrections de données = couche
  séparée dans l'appli (ex. `reparerQuantitePro` dans `src/lib/quantites.ts`).
- Garde-fous automatiques, **ne jamais les contourner** :
  - `scripts/verifier-build.mjs` (lancé par `npm run build`) : refuse le build s'il contient un id, titre, texte d'étape,
    ligne d'ingrédient, description, remarque ou section de l'archive **ou des fichiers `../mes-recettes/*.json`**
    (fermentation, bissap : `scripts/recettes-du-mac.mjs`), un `.json`, ou une trace du mode dev.
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
| Guide utilisateur | `GUIDE_IPHONE.md` (complet : installation, import par AirDrop, chaque onglet, sauvegarde, dépannage) |

## 3. Commandes

```bash
npm run dev       # serveur de test sur le Wi-Fi, port 5180 (le 5173 est pris par un autre projet de Paul : ne pas y toucher)
npm test          # Vitest, 208 tests, dont sur la VRAIE archive (../archive-recettes ; ignorés si absente)
                  # et sur une base IndexedDB simulée (fake-indexeddb : tests/donnees-perso.test.ts)
npm run check     # vérification TypeScript/Svelte (doit afficher 0 erreur, 0 avertissement)
npm run build     # build + vérification anti-recettes
npm run publier   # build (base /garde-manger/) + vérifs + envoi de dist/ sur gh-pages. Exige un dépôt propre (tout commité)
npm run icones    # régénère les icônes PNG depuis public/icone.svg
```

`.claude/launch.json` : « garde-manger » (npm run dev, port 5180) et « garde-manger-build » (vite preview du dossier
`dist/`, port 4180, après `npm run build`) pour tester le service worker et le hors ligne dans le panneau navigateur
(arrêter le serveur ferme le panneau : rouvrir ensuite `http://localhost:4180` par URL, la page doit venir du cache).

## 4. Tester sur l'iPhone

- **Appli installée (cas normal)** : Paul l'a ajoutée à l'écran d'accueil depuis Safari (⋯ › Partager › « Sur l'écran
  d'accueil »). Après `npm run publier`, l'appli affiche le bandeau « Nouvelle version disponible » → « Mettre à jour ».
  Les recettes ont été importées dans l'appli installée (import réussi le 30/09/2026).
- **Test rapide par le Wi-Fi** : `npm run dev`, puis Safari sur l'iPhone → `http://<IP du Mac>:5180`
  (IP : `ipconfig getifaddr en0`, 192.168.1.12 le 30/09/2026). Bouton « Charger depuis le Mac (test) » = import direct.
  ⚠ En http : **pas** de hors ligne, **pas** de Wake Lock (écran qui se verrouille), et ce stockage est distinct de l'appli installée.
- **Envoyer l'archive sur l'iPhone sans iCloud** (serveur dev lancé) : Safari → `http://<IP>:5180/archive` télécharge
  le fichier dans Fichiers › Téléchargements ; ou AirDrop depuis le Finder. Import : Parcourir › Sur mon iPhone › Téléchargements.
- Tests visuels côté Mac : panneau navigateur en 390 × 844 (clair/sombre). Contrastes : toutes les paires de couleurs
  de `app.css` passent WCAG AA (4,5:1) dans les deux thèmes (vérifié le 01/10/2026) ; puces et étiquettes de minuteur
  ont une zone tactile agrandie (`::after`) sans changer d'apparence. Si le panneau est masqué, les captures
  échouent : vérifier par `javascript_tool` / `get_page_text`. En dev, `globalThis.__minuteurs` permet de lancer
  un minuteur de 2 s pour tester la sonnerie (retiré du build).

## 5. Architecture

- **Vite 8 + TypeScript + Svelte 5 (runes)** — appli légère (bundle ~141 Ko gzip). **vite-plugin-pwa** (generateSW,
  `registerType: 'prompt'`) : précache de tout le code, jamais de JSON. **Dexie 4** (IndexedDB), **MiniSearch 7**
  (recherche), **marked** (Markdown), **@lucide/svelte** (icônes).
- **Routage par hash** (`#/recherche`, `#/fiche/<id>`, `#/fiche/<id>/p272`, `#/cuisine/<id>`, `#/reglages[/frigo]`,
  `#/bocal/<id>`, `#/bocal/<id>/modifier`, `#/bocal/nouveau[/fiche/<id>|/modele/<id>]`) : marche hors ligne
  et sur GitHub Pages sans configuration. `base` Vite = `process.env.BASE_URL` (`/garde-manger/` à la publication).
- **Onglets** (barre en bas) : Accueil, Recherche, Frigo, Courses, Bocaux (pastilles : articles à acheter ;
  bocaux à goûter + prêts). Pages empilées : fiche, réglages, mode cuisine, bocal, édition de bocal. Les onglets
  visités restent montés (on retrouve sa place) ; fiche / réglages / mode cuisine sont des pages empilées par-dessus.
- **Import** dans un Web Worker : lecture → validation → allègement → résumés (`Resume`) + index MiniSearch sérialisé →
  écriture Dexie. Au démarrage on ne charge que le catalogue léger ; les fiches complètes à la demande ; l'index à la 1re recherche.
- **Données perso** (Dexie **version(2)**) : `favoris`, `notes`, `realisations` (« cuisiné le… »), `courses`,
  `recettesCourses`, `reglages` (rayons choisis à la main ; placard et synonymes à l'étape 4). Chaque
  enregistrement a `modifieLe` (ms). Chargées en mémoire au démarrage (`perso.svelte.ts`, `courses.svelte.ts`,
  `$state.raw` + mises à jour immuables : ne jamais écrire un proxy `$state` dans IndexedDB).
  L'import des recettes passe par `remplacerRecettes()` (db.ts) qui ne touche qu'à `fiches` et `meta` (testé).
- **Avec ce que j'ai** : l'import écrit `meta.ingredients` (`IndexIngredients` : pour chaque recette, les noms bruts
  de ses ingrédients, alternatives regroupées, facultatifs marqués ; ~280 Ko). Absent ou `version` ancienne
  (`VERSION_INDEX_INGREDIENTS`) → reconstruit par `index-ingredients.worker.ts` depuis `db.fiches` (cas de l'iPhone
  de Paul, importé avant l'étape 4). Au classement, les noms deviennent des **jetons** (`normalisation.ts`) :
  mots normalisés + singulier, sans mots vides ni mots de préparation (les couleurs et « frais » restent),
  **composés** fixes (« pomme de terre », « lait de coco », « vinaigre de vin »… avec une « famille » éventuelle :
  « huile d'olive » est une huile), puis **synonymes** (éditables). Correspondance = les jetons de l'un sont tous
  dans l'autre (« poireau » ↔ « blancs de poireaux »). Classement : manquants croissants puis part possédée ;
  placard et facultatifs neutres. Réglages perso dans `reglages` : `frigo`, `placard`, `synonymes` (null = défaut).
- **Mes recettes** (Dexie **version(4)** : `mesRecettes`, format `Fiche`, `source.id = 'perso'`, ids `perso-<titre>-<aléa>` ;
  les recettes ajoutées le 05/10 par fichier ont la source `notes-perso` : est « ma recette » toute fiche de source
  `perso` ou d'id `perso-…` (`estMaRecette`, archive.ts). Univers `perso`, champs en plus `texte_source`, `creeLe`, `modifieLe`). Ajoutées par Paul dans l'appli : texte collé
  analysé **dans le téléphone** (`mes-recettes.ts` : `analyserTexte` → `Brouillon` → formulaire → `construireFiche`),
  ou fichier préparé sur le Mac (format sauvegarde ne contenant que `mesRecettes`, ajouté par fusion). Fusionnées au
  catalogue (`etat.catalogue` = `catalogueArchive` + mes recettes), à la recherche (petit index MiniSearch dédié,
  **résultats placés avant ceux de l'archive** : les scores de deux index de tailles différentes ne se comparent pas),
  au Frigo (index d'ingrédients calculé à la volée) et à la sauvegarde. Jamais touchées par un réimport.
- **Onglet Ajouter** (6e onglet, 06/10/2026) : texte collé (ou photo prise dans l'app Claude) + consignes de
  modification → **app Claude de l'iPhone, gratuite** (ci-dessous), ou « Ranger sans Claude » (analyse locale), ou
  saisie à la main, ou fichier `.json`. Le résultat passe par `ajout.svelte.ts` puis le formulaire `EditionRecette`
  (vérifier → enregistrer) ; `construireFiche` reprend tels quels les ingrédients/étapes non retouchés et garde
  fermentation, matériel… **Aucun appel à l'API Claude depuis l'appli** : l'option payante (clé API Anthropic,
  `claude.ts`, SDK + zod) a existé en v1.3–1.4 puis a été retirée à la demande de Paul (06/10/2026) ; `main.ts`
  efface une clé éventuellement gardée (`garde-manger:cle-claude`). Ne pas la réintroduire sans qu'il le demande.
- **Façon gratuite (app Claude de l'iPhone)**, demandée par Paul le 06/10/2026 (« sans payer ») : l'onglet Ajouter
  copie une demande toute prête (`demandePourAppClaude` : mêmes consignes que l'API + modèle de réponse JSON +
  consignes de Paul + texte de la recette), Paul la colle dans l'app Claude (photo jointe là-bas si besoin), copie
  la réponse et la recolle (« Coller la réponse de Claude » : `navigator.clipboard.readText`, sinon zone de saisie) ;
  `lireReponseClaude` trouve le bloc JSON et tolère champs manquants ou mal typés. Module léger commun :
  `lecture-recette.ts` (CONSIGNES, RecetteLue, versFiche, unités).
  Une réponse JSON collée par erreur dans la zone « Texte copié » est reconnue par « Ranger sans Claude ».
- **Modifier n'importe quelle recette** (06/10/2026) : crayon / « Modifier » sur toutes les fiches de type recette.
  Une recette de l'archive modifiée = copie **de même id** dans `mesRecettes` (source, classement, texte du livre…
  gardés) qui la remplace partout (`etat.catalogue`, recherche « mes recettes d'abord », Frigo), même après réimport ;
  « Revenir à l'original » supprime la copie. `construireFiche(b, existante)` part d'une copie de la fiche et ne
  change que les champs retouchés (détection par comparaison avec `ficheVersBrouillon`) ; lignes d'ingrédients
  lisibles pour les fiches pro (« 40 g beurre », « Sel fin (PM) »), étapes avec détails en lignes « - … », durée et
  renvois gardés pour les étapes au texte inchangé ; toute ligne finissant par « : » ouvre un groupe. Testé : toutes
  les recettes de l'archive passent le formulaire sans changement, quantités identiques à > 97 % après retouche.
- **Accueil « par type de plat »** (choix de Paul, 06/10/2026, parmi 3 maquettes) : Aujourd'hui (bocaux à goûter /
  prêts / en cours, courses à acheter), « Que veux-tu cuisiner ? » (`rubriques.ts` : type de plat déduit des chapitres
  des livres et du type de plat des blogs / mes recettes ; aussi filtre « Type de plat » de la Recherche, qui remplace
  l'ancien), favoris et cuisiné récemment en bandeaux (`Bandeau.svelte`), « Par origine ». Plus d'« Idées du jour ».
- **Supprimer une recette** : recette perso = effacée ; fiche de l'archive = **masquée** (`masquees.svelte.ts`,
  réglage `fichesSupprimees`, donc sauvegardé et gardé au réimport), filtrée du catalogue et du Frigo,
  récupérable dans Réglages › Recettes supprimées ; « Annuler » dans l'annonce.
- **Pages « hors cuisine » écartées** (`exclusions.ts`, demande de Paul du 06/10/2026) : 13 fiches (préfaces,
  remerciements, auteurs, Généralités = hygiène/sécurité/tenue, hygiène des aliments, documents BEP/CAP, référentiel
  et répertoire du livre, bibliographie, pages de garde, introduction et « à propos » Noma, fournisseurs). Repérées par
  empreinte FNV-1a de l'id (l'appli publiée ne doit contenir aucun id en clair). Écartées à l'import **et** au
  démarrage (catalogue filtré : effet immédiat sans réimport). Gardés : techniques, produits, vocabulaire, équipement.
- **Fiches AFPA complétées par le livre** (`methode-livre.ts`, demande de Paul du 06/10/2026) : les fiches AFPA ne
  donnent qu'un plan en étapes courtes. 98 paires AFPA → La Cuisine de référence, **vérifiées une à une** (empreintes
  FNV-1a, ids en commentaire) : 40 « même plat » (la méthode détaillée du livre remplace le plan, qui reste dans
  « Plan de travail AFPA d'origine »), 28 « plat proche » (étapes AFPA gardées ; chacune reçoit les explications de
  l'étape équivalente du livre, rapprochement par mots + programmation dynamique dans l'ordre, rien d'ajouté),
  30 « préparation de base » (lien vers la fiche technique du livre, étapes inchangées). Ingrédients, quantités et
  portions restent ceux de l'AFPA ; un encadré prévient que les quantités citées dans les étapes sont celles du livre
  (8 couverts). Calculé à l'ouverture (`etat.fiche`), jamais enregistré ; une recette modifiée par Paul garde ce qu'il
  a écrit. Écartées après revue : foie de veau à l'ancienne (≠ à l'anglaise), gratin dauphinois, travers laqués,
  raie meunière, canard braisé à l'orange, tendrons, fricassée à l'estragon, entrecôte Choron, moules poulette, et
  les paires où moins de 3 étapes trouvaient leur équivalent.
- **Fermentation = Noma + Koji Alchemy** (demande de Paul du 06/10/2026) : les **70 fiches Noma de l'archive sont
  retirées** (`estAncienneFermentation` : ids `noma-…`, à l'import, au démarrage, dans le Frigo ; le compte s'affiche
  à l'import) et remplacées par **22 recettes + 1 page « Les recettes importantes »** (comparaison des deux livres
  en tableaux, par où commencer, sommaire avec liens `#/fiche/…`), résumées en français par Claude chat. Ce document
  est gardé hors du dépôt : `../mes-recettes/fermentation-noma-koji-alchemy.md` ; le script
  `../mes-recettes/fermentation-vers-garde-manger.py` (repères de fermentation par recette, lignes d'ingrédients
  retouchées) produit `../mes-recettes/garde-manger-fermentation.json` (format sauvegarde, `mesRecettes` seul,
  ids `ferm-…`), ajouté par Ajouter › « Ajouter un fichier de recette ». Sources `noma`, `koji-alchemy`, `noma-koji`
  (`estSourceFermentation`) : univers et type de plat Fermentation, lignes d'ingrédients lues comme le Noma.
  Ces fiches sont dans `mesRecettes` sans être « mes recettes » (`estMaRecette` faux) ; `etat.aUnOriginal(id)` évite
  « Revenir à l'original » (qui les effacerait) ; supprimées = masquées, récupérables. Carte Fermentation :
  `temperature_texte`. Markdown : liens internes `#/…` gardés, tableaux qui défilent de côté.
  Serveur de dev : `http://<IP>:5180/mes-recettes/<fichier>.json` télécharge un fichier de ce dossier.
- **Bocaux** (Dexie **version(3)** : `bocaux`, `journal` (photos en data URL JPEG ~1280 px, chargé bocal par bocal),
  `modelesBocaux`). Un bocal a toujours ≥ 1 étape (`min`/`max` en jours ou heures, facultatifs) ; début de la 1re =
  `debut` du bocal, des suivantes = `debut` posé à « Étape suivante » (sinon estimé). Jour N = jours de calendrier
  écoulés (mise en bocal = « aujourd'hui », jour 0). Phases : attente → à goûter (dès min − 20 %, au moins 1 j avant)
  → prêt (min..max) → dépassé. `derniereNoteLe` = « goûté aujourd'hui ». Rappels : .ics (heure locale flottante,
  18 h, VALARM à l'heure) ouvert par un lien blob (Calendrier iOS) ou partagé en fichier.
- Sauvegarde : JSON `{ format: 'garde-manger-sauvegarde', version: 1, exporteLe, donnees: { <table>: [...] } }`,
  restauration = **fusion** (ajout, ou remplacement si `modifieLe` plus récent ; jamais d'effacement).
  Fichier préparé à l'ouverture des Réglages car iOS n'ouvre le menu Partager que juste après un toucher.
- Petites préférences en localStorage (`stockage-local.ts`) : coefficient de portions par fiche, étape du mode
  cuisine (12 h), taille du texte, date de la dernière sauvegarde, minuteurs.
- Écran allumé : Wake Lock natif (https) ou repli vidéo muette `public/eveil.mp4` (généré avec ffmpeg).
- Minuteurs : **heure de fin enregistrée** (localStorage) ; sonnerie par une **piste audio WAV fabriquée à la volée**
  (silence puis bips à chaque fin, jouée comme de la musique) pour sonner écran verrouillé et en silencieux,
  + Media Session (titre sur l'écran verrouillé, Pause/Lecture = pause/reprise des minuteurs). Bips Web Audio en secours.

## 6. Où se trouve chaque chose

```
index.html, vite.config.ts        page, config (plugin dev « archive du Mac » : /__archive-dev/… et /archive, apply:'serve')
public/                           icônes (icone.svg = source), eveil.mp4
scripts/                          verifier-build.mjs, verifier-depot.mjs (+ recettes-du-mac.mjs : textes à ne jamais publier), publier.mjs
.githooks/pre-commit              lance verifier-depot.mjs
src/App.svelte                    coquille : onglets gardés en mémoire, pages empilées, liens #/… interceptés
src/app.css                       couleurs (clair/sombre auto), zones sûres, boutons, listes, puces, Markdown
src/lib/
  types.ts                        types Fiche (schéma de l'archive), Resume, InfosArchive
  archive.ts                      lireArchive (validation), alleger, resumer, univers, tempsTotal, documentDeRecherche
  import.worker.ts / importer.ts  import hors fil principal / lanceur
  db.ts                           Dexie : base « garde-manger », v1 = fiches, meta ; v2 = données perso ; remplacerRecettes, nouvelId
  perso.svelte.ts                 favoris, notes, réalisations (« cuisiné le… ») en mémoire + Dexie
  courses.svelte.ts               liste de courses : ajout d'une recette (remplace l'ajout précédent), articles libres,
                                  cocher, rayon choisi à la main (mémorisé par clé), retirer une recette, vider
  liste-courses.ts                nomPourCourses (sans « émincé », « pour… »), cleCourses (fusion), RAYONS + rayonDe
                                  (règles regex, ~95 % classés), quantiteTotale, propositionsDeLaFiche (placard décoché),
                                  texteListe
  normalisation.ts                Dictionnaire (jetons d'un nom, alternatives « ou »), COMPOSES, SYNONYMES_DEFAUT,
                                  PLACARD_DEFAUT, correspond, predicatListe, lire/ecrireSynonymes (texte des Réglages)
  classement-frigo.ts             construireIndexIngredients, preparer, classer, construireVocabulaire, suggestions
  frigo.svelte.ts                 ingrédients possédés, placard, synonymes, index (chargé ou reconstruit), résultats
  index-ingredients.worker.ts     reconstruction de l'index des ingrédients hors fil principal
  bocaux.ts                       types Bocal/EntreeJournal/ModeleBocal, joursEntre, etatEtape (phase, progression, fins),
                                  libelleAvancement (« Jour 4 sur 5 à 7 »), rubrique, reglagesDepuisFiche (Noma),
                                  evenementsCalendrier, fichierIcs (échappement, pliage 75 octets)
  bocaux.svelte.ts                liste + modèles en mémoire, horloge (minute), étapes, statut, journal, modèles
  photo.ts                        compression des photos (canvas → JPEG)
  mes-recettes.ts                 analyse d'un texte collé (titres de sections, lignes d'ingrédients → quantité/unité/nom,
                                  portions, temps, « Titre : texte » → titre d'étape), construireFiche, ficheVersBrouillon
  mes-recettes.svelte.ts          mes recettes en mémoire + Dexie (charger, trouver, enregistrer, supprimer), index dédié
  exclusions.ts                   empreintes des pages hors cuisine, estExclue (et empreinte, réutilisée)
  methode-livre.ts                paires AFPA → livre, rapprochement des étapes, completerAvecLeLivre
  sauvegarde.ts                   exporter, lireSauvegarde (validation, messages clairs), restaurer (fusion)
  partage.ts, annonce.svelte.ts   menu Partager (texte / fichier) avec repli ; petit message temporaire en bas
  etat.svelte.ts                  état global : statut, catalogue, parId, index (chargé à la demande), fiche(id)
  moteur.ts                       options MiniSearch (boosts, préfixe sur le dernier mot, flou, repli OR)
  recherche.svelte.ts             requête + filtres (univers, type, source, temps, catégorie, cuisine, type de plat) avec comptes
  texte.ts                        normaliser (accents, œ/æ), radical (pluriels), mots vides, casseLisible, insecables, collator
  format.ts                       nombre, date, heure, duree, dureeJours, pluriel (tout en français)
  quantites.ts                    unités lisibles, mise à l'échelle, ligneIngredient (modes « colonnes » pro / « ligne » rédigée),
                                  mesureIngredient (quantité chiffrée brute, pour les courses)
  portions.svelte.ts              coefficient par fiche (gardé en localStorage), portionsDeBase, pas, texteQuantites
  durees.ts                       trouverDurees / decouperDurees (« 20 min », « 1 h 30 », « 45 à 60 min »…), chrono
  ingredients.ts                  nomSimplifie, motsCles, ingredientsDeLEtape — base de la normalisation (étape 4)
  minuteurs.svelte.ts             store des minuteurs (lancer, pause, reprendre, ajouter, arreter, supprimer)
  alarme.svelte.ts / piste-alarme.ts  sonnerie écran verrouillé (piste WAV + Media Session) / fabrication du WAV
  son.ts                          bips Web Audio (secours), déverrouillage audio iOS
  eveil.svelte.ts                 garder l'écran allumé
  markdown.ts                     rendu Markdown sûr (HTML brut ignoré, <!-- page N --> → ancre #p-N, titres en capitales adoucis)
  renvois.ts                      page du livre → fiche technique (source.pages) ; liens « voir p. 57 » dans le texte
  routeur.svelte.ts               routes, historique, bouton Retour ; lienFiche, lienCuisine ; #/reglages/<section>
  stockage-local.ts, portail.ts   localStorage protégé ; déplacer un élément à la racine (feuilles au-dessus des onglets)
src/composants/                   BarreOnglets, BarreHaut, LigneFiche, ListeFiches (affichage progressif), FeuilleFiltres,
                                  Ingredients (toucher = rayer), TableauDenrees, TexteComplet (insère les tableaux des
                                  denrées à la place des repères), Markdown, TexteRenvois, TexteEtape (durées → minuteurs),
                                  ReglagePortions, CarteFermentation, BarreMinuteurs (pastille, liste, alarme), Importeur,
                                  BandeauMiseAJour, AideInstallation (encadré « écran d'accueil » dans Safari iOS), IconeBocal,
                                  Feuille (feuille du bas générique, sans champ de saisie : le clavier iOS la cacherait),
                                  Etoiles, FormulaireRealisation, CarnetFiche, FeuilleCourses, SauvegardePerso, Annonce,
                                  LigneFrigo, ReglagesFrigo (placard + synonymes), CarteBocal (avancement + barre)
src/ecrans/                       Bienvenue (1er lancement), Accueil, Recherche, Fiche, ModeCuisine, Reglages, Courses,
                                  Frigo, Bocaux (onglet), Bocal (page d'un bocal), EditionBocal (nouveau / modifier),
                                  EditionRecette (#/recette/nouvelle, #/recette/<id>/modifier : coller → ranger → formulaire)
tests/                            archive-reelle.ts (accès à la vraie archive et au fichier de fermentation) + tests par module
```

## 7. Particularités des données (résumé, détails dans ../archive-recettes/README.md)

- 821 fiches : Marc Winer 188 (`mw-`), AFPA 194 (`afpa-`), Cuisine de référence 186 recettes + 180 techniques/annexes
  (`cr-`), Noma 54 recettes + 16 chapitres (`noma-`, retirés de l'appli depuis la 1.8.0), notes perso 3. Champs vides omis → accès tolérants partout.
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
- 30/09/2026 (étape 3, choix par défaut non discutés, à ajuster si Paul le souhaite) : appréciation en 1 à 5 étoiles ;
  courses = un article par nom avec les quantités additionnées par unité (« 500 g + 2 pièces »), unités « entières »
  (pièce, botte, boîte…) arrondies au-dessus ; eau/sel/poivre, alternatives et facultatifs proposés décochés ;
  12 rayons dans l'ordre d'un magasin (dont « Produits asiatiques ») ; restauration d'une sauvegarde = fusion.
- 30/09/2026 : écran allumé en mode cuisine **et** sonnerie des minuteurs écran verrouillé / silencieux
  **confirmés par Paul** dans l'appli installée.
- 30/09/2026 (étape 4, choix par défaut) : placard d'origine = eau, sel, poivre, huile, sucre ; résultats groupés
  « Tu as tout / Il manque 1 / 2 / 3 ou plus » puis par part possédée ; synonymes édités comme un texte
  (une ligne par groupe, virgules) ; « crème » générique couvre crème liquide et crème fraîche.
- 01/10/2026 (étape 6) : version **1.0.0** ; couleurs du thème clair légèrement foncées pour l'accessibilité
  (texte secondaire/tertiaire, vert, ambre, accent).
- 30/09/2026 (étape 5, choix par défaut) : rappels du Calendrier à 18 h ; dégustation un peu avant la durée
  minimale ; pas de modèle de bocal fourni d'office (les fiches Noma servent de base, Paul crée les siens).

- 06/10/2026 : **ménage** des pages hors cuisine (liste ci-dessus, choisie selon le critère de Paul : « les recettes
  et les explications des produits, rien sur les auteurs, l'hygiène, les diplômes »). Le pied des fiches n'affiche
  plus le nom de l'auteur. Le poids n'était pas un problème (≈ 6,5 Mo dans le téléphone, sans souci pour un iPhone 13).
- 05/10/2026 (autre conversation) : Paul voulait que ses recettes soient « juste ajoutées aux autres » (mêlées aux
  listes, à la recherche, au Frigo). 06/10/2026 : il demande un endroit pour **saisir** ses recettes (coller un texte
  d'Internet) → carte « Mes recettes » + bouton « Ajouter » sur l'Accueil (pas de 6e onglet : barre pleine), recettes
  toujours mêlées aux autres, plus un univers « Mes recettes » dans les filtres. Analyse locale du texte collé (hors ligne,
  gratuit, sans compte). Puis, le même jour, Paul a demandé **Claude IA dans l'appli** (copier-coller ou photo
  analysés par Claude) et ne tient pas à une rubrique « Mes recettes » : onglet **Ajouter** à la place de la carte
  de l'Accueil (filtre d'univers « Mes recettes » gardé). Puis « sans payer » : façon gratuite par l'app Claude ;
  enfin « enlève l'option payante » : plus de clé API ni d'appel direct (06/10/2026).
- 06/10/2026 : livre *Koji Alchemy* : l'epub (Anna's Archive) **n'est pas utilisé** — ne pas y toucher. Paul a fourni
  à la place un résumé en français de 22 recettes Noma + Koji Alchemy fait par Claude chat, qu'il a demandé de mettre
  à la place des anciennes fiches Noma (v1.8.0, fiches seulement dans son téléphone).
- 06/10/2026 : recette du **bissap à l'ananas** (bonbons à la menthe à la place de la menthe fraîche) préparée en fichier
  `~/Documents/Cuisine/mes-recettes/garde-manger-recette-bissap.json` (hors dépôt), à ajouter via Mes recettes.

## 9. Fait

- **Étape 1** : squelette PWA, import (fichier ou Mac en dev), accueil par univers + « Idées du jour », recherche plein texte
  (accents, ligatures, pluriels, fautes de frappe, repli OR) + filtres à facettes, fiche complète (ingrédients par groupe,
  étapes, matériel, remarques, variantes, utilisations, fermentation, Brix, textes intégraux, renvois de pages, avertissements).
- **Étape 2** : portions (− / +) ou coefficient ×0,5…×4 (y compris tableaux des denrées), mode cuisine (mise en place,
  une étape à la fois, balayage, ingrédients de l'étape, taille du texte, écran allumé, reprise à la même étape),
  minuteurs multiples depuis les durées des étapes, sonnerie écran verrouillé/silencieux, « +1 / +5 min / +reste de fourchette ».
- **Mise en ligne + installation** : publiée, installée sur l'iPhone, recettes importées ; aide à l'installation dans Safari.
- **Étape 3** (30/09/2026) : favoris (cœur sur la fiche, accueil « Mes favoris », filtre Recherche « Mes fiches »),
  note perso (Mon carnet, enregistrement automatique, résumé en haut de fiche), « cuisiné le… » + étoiles (dernière
  diapo du mode cuisine ou bouton sur la fiche, accueil « Cuisiné récemment »), liste de courses (onglet Courses,
  feuille « Ajouter aux courses » avec les portions choisies, fusion, rayons, articles libres, panier, partage,
  pastille sur l'onglet), sauvegarde/restauration JSON (Réglages › Mes données), portions et étape du mode cuisine
  mémorisées. Testé dans le panneau navigateur (390 × 844, clair/sombre) ; **à faire tester sur l'iPhone**.
- **Étape 4** (30/09/2026) : onglet Frigo « Avec ce que j'ai » (saisie avec suggestions, ingrédients gardés,
  résultats par manquants avec filtre d'univers), normalisation + composés + synonymes éditables, placard réglable
  (aussi utilisé par « Ajouter aux courses »), Réglages › Avec ce que j'ai. Tests sur la vraie archive (99 % des noms
  compris, potages en tête pour poireaux/pommes de terre/crème, classement complet < 10 ms). **À faire tester sur l'iPhone**.
- **Étape 5** (30/09/2026) : onglet Bocaux (à goûter aujourd'hui / prêts / en cours / terminés), bocal depuis une
  fiche Noma (50 fiches testées) ou libre, étapes successives, sel à peser, journal daté avec photo compressée,
  modèles réutilisables, rappels .ics, section « Mes bocaux » de l'Accueil, bouton « Démarrer un bocal » sur les
  fiches de fermentation. Tests du calcul des jours (changement d'heure, fin d'année, heures). **À faire tester sur l'iPhone**.
- **Étape 6** (01/10/2026) : guide iPhone réécrit (import par AirDrop, tour des onglets, dépannage), README,
  contrastes WCAG AA, zones tactiles, audit des noms accessibles (aucun bouton sans nom), hors ligne vérifié sur le Mac
  (service worker : 16 fichiers en cache dont les 2 workers et eveil.mp4 ; appli servie serveur arrêté), ménage du code.

- **05/10/2026** (v1.1.0, autre conversation) : recettes ajoutées hors archive (`mesRecettes`), par fichier de
  sauvegarde. Correction : espace manquante après « ou » dans les ingrédients en alternative.
- **06/10/2026** (v1.2.0) : écran « Nouvelle recette » (coller → rangement automatique → formulaire), modification
  et suppression, ménage des pages hors cuisine, recherche « mes recettes d'abord ». Les deux versions (05/10 et
  06/10, menées en parallèle) ont été réunies avec l'accord de Paul.

- **1.8.0** (06/10/2026) : fermentation remplacée : anciennes fiches Noma retirées, 22 recettes Noma + Koji Alchemy
  + page de comparaison ajoutées par fichier (`garde-manger-fermentation.json`, à importer sur l'iPhone).
- **1.7.0** (06/10/2026) : les fiches AFPA sans explications reçoivent la méthode détaillée de La Cuisine de
  référence (98 recettes), en gardant les quantités AFPA ; plan AFPA d'origine consultable.
- **1.6.0** (06/10/2026) : modifier n'importe quelle recette (copie qui remplace l'original, « Revenir à l'original ») ;
  nouvel accueil par type de plat.
- **1.5.0** (06/10/2026) : option payante retirée (bouton « Analyser avec Claude », Réglages › Claude, kit Anthropic,
  prise de photo dans Garde-manger) ; seule reste la façon gratuite par l'app Claude (+ rangement local).
- **1.4.0** (06/10/2026) : façon gratuite avec l'app Claude (copier la demande → coller la réponse) mise en premier ;
  l'appel direct par clé API devient l'option « en un toucher, payante ».
- **1.3.0** (06/10/2026) : onglet Ajouter (Claude : texte ou photo, ou rangement local), suppression de n'importe
  quelle recette (archive masquée, récupérable), carte « Mes recettes » de l'Accueil retirée.
- **1.2.1** (06/10/2026) : la recherche signale les fiches trouvées mais cachées par un filtre (« 1 fiche trouvée, mais
  cachée par les filtres choisis » + bouton), et le champ de recherche de l'Accueil repart sans filtre. Cause probable de
  « je ne trouve pas le bissap » : un filtre d'univers resté actif après avoir touché une tuile de l'Accueil.

## 10. Reste à faire

Toutes les étapes du cahier des charges sont faites. Il reste à **faire tester sur l'iPhone** (appli installée) :
00. **Ajouter `garde-manger-fermentation.json`** (v1.8.0 : Ajouter › « Ajouter un fichier de recette ») : sans lui,
   plus aucune fiche de fermentation dans l'appli (le Noma de l'archive est retiré).
0. Ajout du bissap (`~/Documents/Cuisine/mes-recettes/garde-manger-recette-bissap.json`, id `perso-bissap-ananas`,
   source `notes-perso` pour marcher aussi avec la v1.1.0) et de l'écran « Nouvelle recette » (coller une recette).
1. Étapes 3 à 5 : menu Partager (liste de courses, fichier de sauvegarde → « Enregistrer dans Fichiers » / AirDrop),
   restauration depuis Fichiers, champ date iOS, clavier des champs « Ajouter un article » et Frigo (suggestions),
   reconstruction de l'index des ingrédients au 1er passage sur Frigo, photo du journal (appareil / photothèque).
2. **« Ajouter au Calendrier »** (lien blob .ics) depuis l'appli installée — si ça n'ouvre rien, garder « Envoyer le
   fichier » (Fichiers › Ajouter tout) ou essayer une URL `data:text/calendar`.
3. Le **mode avion** (guide § 12).
Ensuite : corrections selon ses retours ; idées possibles si Paul le demande (pluriels après mise à l'échelle des
lignes rédigées, rappels Calendrier mis à jour à chaque étape, partage d'une recette en texte).

## 11. Problèmes connus et limites

- Un seul renvoi de page pointait vers les Généralités écartées (« voir p. 12 », crudités) : il n'est plus cliquable.
- Mes recettes : l'analyse du texte collé est faite par règles simples ; les textes très désordonnés (publicités,
  commentaires) demandent plus de corrections dans le formulaire. Mots-nombres (« Une pincée ») non mis à l'échelle.

- **iCloud Drive de Paul plein** : le dossier Garde-manger du Mac n'est pas envoyé vers iCloud.
  Utiliser `http://<IP>:5180/archive` (serveur dev lancé) ou AirDrop pour les futurs imports.
- Safari et l'appli installée ont des **stockages séparés** : toujours importer/utiliser depuis l'icône.
- Une web app iOS ne peut pas programmer de notification sans serveur : sonnerie = piste audio (confirmée par Paul le 30/09/2026).
  Minuteurs à plus de 2 h de leur fin : non inclus dans la piste tant que l'appli n'est pas rouverte. La piste coupe la musique.
- Bips Web Audio (secours) muets en mode silencieux ; la vidéo de repli « écran allumé » n'a pas marché en http sur l'iPhone.
- Quantités écrites dans le texte des étapes non recalculées (note affichée). Accord des pluriels non géré après
  mise à l'échelle des lignes rédigées (« 2 oignon »).
- Repérage des ingrédients d'une étape par mots-clés simples (peut citer un ingrédient de même nom d'un autre groupe :
  le groupe est alors indiqué).
- Frigo : quelques noms bruités de l'archive restent tels quels (« Petit oignon Beurre », listes à virgules de la
  Cuisine de référence réduites au 1er nom) ; « crème » ou « huile » génériques couvrent toutes les variantes.
  Les sous-préparations (fond brun, pâte brisée…) comptent comme manquantes si on ne les a pas saisies.
- Bocaux : les photos alourdissent la sauvegarde (~150 Ko chacune). Rappels du Calendrier : figés au moment de
  l'ajout (si on passe à l'étape suivante plus tôt ou plus tard, rajouter les rappels ; les anciens restent).
- Restaurer une sauvegarde **ajoute** : un favori retiré depuis la sauvegarde revient (pas de trace des suppressions).
- Menu Partager : en http (test par le Wi-Fi) le fichier de sauvegarde est téléchargé et la liste copiée
  (pas de `navigator.share` hors https). Tester le partage dans l'appli installée.
- Noms d'ingrédients pour les courses : nettoyage par règles simples (quelques restes bruités de l'archive,
  ex. « Piment sec ou frais ou tabasco » ; alternatives « ciboule ou ciboulette » gardées telles quelles).
- Captures du panneau navigateur parfois en retard d'une action : vérifier l'état par JavaScript.
