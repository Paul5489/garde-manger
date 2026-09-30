// Liste de courses : ingrédients d'une fiche → articles (nom simplifié, rayon, quantité),
// fusion des doublons (même nom), totaux lisibles et texte à partager.

import type { Apport, ArticleCourses } from './db';
import { date as formaterDate, nombre } from './format';
import { formaterMesure, mesureIngredient, normaliserUnite } from './quantites';
import { casseLisible, collator, majuscule, MOTS_VIDES, normaliser, radical } from './texte';
import type { Fiche, GroupeIngredients, Ingredient } from './types';

// ───── Rayons ─────

export interface Rayon {
  id: string;
  nom: string;
  emoji: string;
}

/** Dans l'ordre d'un magasin (et de la liste). */
export const RAYONS: Rayon[] = [
  { id: 'fruits-legumes', nom: 'Fruits et légumes', emoji: '🥬' },
  { id: 'boucherie', nom: 'Boucherie, volaille', emoji: '🥩' },
  { id: 'poissonnerie', nom: 'Poissonnerie', emoji: '🐟' },
  { id: 'cremerie', nom: 'Crèmerie, œufs', emoji: '🧀' },
  { id: 'boulangerie', nom: 'Boulangerie', emoji: '🥖' },
  { id: 'epicerie-salee', nom: 'Épicerie salée', emoji: '🥫' },
  { id: 'epicerie-sucree', nom: 'Épicerie sucrée', emoji: '🍯' },
  { id: 'epices', nom: 'Épices, sel, poivre', emoji: '🧂' },
  { id: 'asiatique', nom: 'Produits asiatiques', emoji: '🥢' },
  { id: 'boissons', nom: 'Vins, alcools, boissons', emoji: '🍷' },
  { id: 'surgeles', nom: 'Surgelés', emoji: '🧊' },
  { id: 'autres', nom: 'Autres', emoji: '🛒' },
];

export const RAYON_PAR_ID = new Map(RAYONS.map((r) => [r.id, r]));

/** Règles de classement, testées dans l'ordre sur le nom normalisé (la première qui correspond gagne). */
const REGLES: [string, RegExp][] = [
  ['surgeles', /\b(surgele|glacon)/],
  // Préparations de base achetées toutes faites (sinon « veau », « poisson »… les enverraient au mauvais rayon).
  ['epicerie-salee', /^(fonds?|fumets?|bouillons?|glace de viande|demi glace|jus de (veau|viande|volaille|roti))\b/],
  [
    'asiatique',
    /\b(sauces? (de )?soja|shoyu|tamari|mirin|sake|shaoxing|miso|gochujang|gochugaru|doenjang|sauces? (d )?hu[iî]tres?|hoisin|sauces? (de )?poisson|nuoc mam|nam pla|huile de sesame|graines de sesame|sesame|vinaigre (de riz|noir)|dashi|kombu|nori|wakame|bonite|katsuobushi|panko|tofu|nouilles|vermicelles? de riz|galettes? de riz|feuilles? de riz|riz gluant|farine de riz|lait de coco|creme de coco|pate de curry|sriracha|sambal|kecap|ketjap|doubanjiang|toban|douchi|sucre de palme|5 epices|cinq epices|rayu|yuzu|umeboshi|kimchi|koji|shichimi|sansho|poivre de sichuan|furikake|tapioca|tamarin|galanga|combava|kaffir|shiitake|mu[- ]err|glutamate|msg|narutomaki|wonton|kuzu|sate|khao khua|dou ?ban ?jiang|pak soy|ginseng|jujubes?)\b/,
  ],
  ['epicerie-salee', /^vinaigres?\b/],
  [
    'boissons',
    /\b(vin|vins|cognac|armagnac|calvados|madere|porto|rhum|kirsch|grand marnier|cointreau|whisky|vodka|gin|biere|cidre|champagne|noilly|vermouth|liqueur|eau de vie|marc|pastis|xeres|sherry|marsala|banyuls|alcool|creme de (cassis|mure|framboise|peche)|eau gazeuse|limonade|riesling|gewurztraminer|sauternes)\b/,
  ],
  [
    'epices',
    /(^sel\b|\bsel (fin|gros|de guerande|non iode|nitrite)|gros sel|fleur de sel|\bpoivre\b|muscade|cannelle|cumin|curcuma|curry|paprika|piment d.espelette|cayenne|piment en poudre|flocons de piment|piments? seches?|girofle|safran|cardamome|coriandre en (poudre|grains)|graines de (coriandre|fenouil|cumin|moutarde|carvi|pavot)|genievre|quatre epices|4 epices|herbes de provence|origan|laurier|mignonnette|badiane|anis|fenugrec|garam masala|ras el hanout|zaatar|sumac|epices?\b|piment d alep|carvi)/,
  ],
  [
    'poissonnerie',
    /\b(poissons?|saumon|cabillaud|lieu|merlan|soles?|bar|loup|dorade|daurade|turbot|barbue|lotte|raie|thon|sardines?|maquereaux?|harengs?|truites?|anchois|crevettes?|gambas|langoustines?|homards?|langoustes?|crabes?|tourteaux?|moules|hu[iî]tres?|saint jacques|st jacques|petoncles?|calamars?|calmars?|encornets?|seiches?|poulpes?|palourdes?|coques|bulots?|bigorneaux|oursins?|colin|merlu|rougets?|grondin|saint pierre|flétan|fletan|haddock|morue|brochet|sandre|perche|anguille|carpe|oeufs de (saumon|lump|truite|poisson)|poutargue|fruits de mer|merlans?|turbotins?|etrilles?|carapaces?|crustaces)\b/,
  ],
  [
    'boucherie',
    /\b(veau|boeuf|porc|agneau|mouton|poulets?|poulardes?|volailles?|canards?|lard|lardons|jambon|saucisses?|saucisson|chorizo|poitrine|epaule|gigot|jarret|joues?|foie|foies|rognons?|ris|cailles?|pintades?|lapin|dinde|magrets?|os|moelle|crepine|bacon|pancetta|viande|bavette|onglet|entrecote|faux filet|paleron|macreuse|gite|queue de boeuf|tripes|boudin|andouille|merguez|chair a saucisse|coppa|speck|pigeons?|carcasses?|abattis|escalopes?|cotes? de|filet mignon|noix de veau|graisse de canard|poule|coquelet|chevreuil|sanglier|lievre|faisan|perdreau|entrecotes?|contre filets?|rumstecks?|steaks?|steacks?|plats? de cotes?|langue|jumeau|coq|saindoux|intestins|tournedos|hampe|gibier)\b/,
  ],
  [
    'epicerie-sucree',
    /\b(sucre|sucres|cassonade|vergeoise|farine|maizena|fecule|levure|bicarbonate|gelatine|agar|chocolat|cacao|vanille|miel|confiture|sirop|glucose|fondant|praline|pralin|amandes?|noisettes?|noix|pistaches?|raisins secs|fruits confits|pruneaux|abricots secs|dattes|figues sechees|pate d amande|colorant|extrait|arome|fleur d oranger|eau de rose|biscuits?|boudoirs?|speculoos|cafe|the|poudre a creme|lait concentre|creme de marrons?|marrons? glaces?|nougatine|meringue|pepites|cerneaux|feuilles? de gelatine|couverture|nappage|trimoline|stabilisateur|feuilles? d or|mimosa|cornflakes|angelique|bigarreaux confits)\b/,
  ],
  [
    'cremerie',
    /(^jaunes?\b|\b(lait|beurre|creme|oeufs?|jaunes? d oeufs?|blancs? d oeufs?|fromages?|gruyere|emmental|comte|parmesan|mozzarella|chevre|roquefort|bleu|feta|ricotta|mascarpone|yaourts?|yogourt|faisselle|petits? suisses?|babeurre|beaufort|reblochon|camembert|brie|munster|pecorino|cheddar|burrata|fontina|pates? (feuilletee|brisee|sablee)|feuilles? de brick|brick)\b)/,
  ],
  ['boulangerie', /\b(pain|pains|baguette|brioche|mie de pain|croutons|pain de mie)\b/],
  [
    'epicerie-salee',
    /\b(huile|huiles|vinaigre|moutarde|ketchup|mayonnaise|sauce|concentre|coulis|tomates? (pelees|concassees en boite|en conserve)|puree de tomate|pates|spaghetti|tagliatelles?|macaroni|penne|lasagnes?|riz|semoule|boulgour|quinoa|lentilles|pois chiches|haricots (secs|blancs|rouges|lingots|coco)|flageolets|olives|capres|cornichons|raifort|tabasco|worcestershire|harissa|pesto|tapenade|conserve|boite|cubes?|polenta|gnocchi|chips|chapelure|orge|pois casses|spaghettis|tarbais|grains de ble|ble)\b/,
  ],
  ['epices', /\ben poudre\b/],
  [
    'fruits-legumes',
    /\b(oignons?|echalotes?|echalottes?|ail|carottes?|poireaux?|celeri|celeri rave|navets?|pommes? de terre|patates?|tomates?|courgettes?|aubergines?|poivrons?|piments?|concombres?|salades?|laitues?|mache|roquette|epinards?|choux?|brocolis?|fenouil|artichauts?|asperges?|haricots? verts?|petits pois|pois gourmands|feves?|champignons?|cepes?|girolles?|morilles?|truffes?|radis|betteraves?|panais|topinambours?|potiron|courges?|butternut|potimarron|citrouille|mais|avocats?|citrons?|oranges?|pamplemousses?|mandarines?|clementines?|pommes?|poires?|peches?|abricots?|prunes?|cerises?|fraises?|framboises?|myrtilles?|cassis|groseilles?|mures?|raisins?|bananes?|ananas|mangues?|papayes?|kiwis?|figues?|melons?|pasteques?|grenades?|fruits? de la passion|litchis?|rhubarbe|coings?|kakis?|persil|cerfeuil|estragon|ciboulette|ciboules?|basilic|menthe|coriandre|aneth|thym|romarin|sauge|sarriette|marjolaine|verveine|oseille|cresson|gingembre|citronnelle|cebettes?|pousses?|germes?|pak cho[iy]|bok choy|daikon|shiso|bouquet garni|legumes?|fruits?|zestes?|salsifis|endives?|blettes?|cardons?|mesclun|herbes|bigarreaux|culantro|fleurs? de bananier|petales)\b/,
  ],
];

/** Rayon probable d'un ingrédient d'après son nom. */
export function rayonDe(nom: string): string {
  const n = normaliser(nom).replace(/[’'-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [rayon, motif] of REGLES) if (motif.test(n)) return rayon;
  return 'autres';
}

// ───── Noms ─────

/** Mots de préparation retirés du nom (« émincé », « pelé et râpé », « en dés »…). */
const PREPARATIONS = new Set(
  [
    'pele', 'pelee', 'rape', 'rapee', 'hache', 'hachee', 'emince', 'emincee', 'cisele', 'ciselee', 'concasse',
    'concassee', 'coupe', 'coupee', 'tranche', 'tranchee', 'epluche', 'epluchee', 'ecrase', 'ecrasee', 'presse',
    'pressee', 'egoutte', 'egouttee', 'rince', 'rincee', 'lave', 'lavee', 'pare', 'paree', 'desosse', 'desossee',
    'denoyaute', 'denoyautee', 'epepine', 'epepinee', 'effeuille', 'effeuillee', 'equeute', 'equeutee', 'blanchi',
    'blanchie', 'fondu', 'fondue', 'ramolli', 'ramollie', 'tamise', 'tamisee', 'battu', 'battue', 'mixe', 'mixee',
    'pommade', 'finement', 'grossierement', 'froid', 'froide', 'chaud', 'chaude', 'tiede', 'bouillant', 'bouillante',
    'glacee', 'facultatif', 'facultative', 'optionnel', 'environ', 'reduit', 'reduite', 'detaille', 'detaillee',
    'taille', 'taillee', 'lamine', 'laminee', 'nettoye', 'nettoyee', 'vide', 'videe', 'ecaille', 'ecaillee',
    'dur', 'dure', 'mollet',
  ].map(radical),
);

/** Tailles de découpe précédées de « en » (« en dés », « en fines rondelles »). */
const DECOUPES = new Set(
  [
    'de', 'des', 'rondelle', 'lamelle', 'julienne', 'brunoise', 'morceau', 'tranche', 'cube', 'batonnet', 'quartier',
    'mirepoix', 'paysanne', 'fine', 'petit', 'petite', 'gros', 'grosse', 'lanière', 'laniere', 'dés', 'tronçon',
    'troncon', 'segment', 'filet', 'copeau', 'cheveux', 'chiffonnade', 'deux', 'quatre', 'huit', 'moitie', 'poudre',
  ].map((m) => radical(normaliser(m))),
);

/** Mots qui ne peuvent pas terminer un nom (restes après suppression des préparations). */
const LIAISONS = new Set(['et', 'ou', 'de', 'd', 'du', 'des', 'en', 'a', 'au', 'aux', 'la', 'le', 'les', 'l', 'puis', 'avec']);

function normMot(mot: string): string {
  return radical(normaliser(mot).replace(/[^a-z0-9]/g, ''));
}

/**
 * Nom d'ingrédient pour la liste de courses : sans parenthèses, précisions après la virgule,
 * « pour … », « selon le goût » ni mots de préparation. « ail émincées » → « Ail ».
 */
export function nomPourCourses(nom: string): string {
  let t = casseLisible(nom ?? '')
    .replace(/\([^)]*\)?/g, ' ')
    .replace(/\s+(ou\s+)?(selon (le|les|votre|ton|vos|tes) go[uû]ts?|au go[uû]t|à volonté|a volonte|de préférence|si possible|au choix|de bonne qualité|prêts? à l.emploi|à température ambiante).*$/i, '')
    .split(/[,;:]|\. | \+ | - | – | pour /)[0];
  // Mots de préparation, et « en dés », « en fines rondelles »…
  const mots = t.split(/\s+/).filter(Boolean);
  const gardes: string[] = [];
  for (let i = 0; i < mots.length; i++) {
    const n = normMot(mots[i]);
    if (PREPARATIONS.has(n)) continue;
    if (n === 'en' && i + 1 < mots.length && DECOUPES.has(normMot(mots[i + 1]))) {
      // Saute « en » et les mots de découpe qui suivent (« en fines rondelles »).
      while (i + 1 < mots.length && DECOUPES.has(normMot(mots[i + 1]))) i++;
      // « en poudre » identifie le produit (ail en poudre) : on le garde.
      if (normMot(mots[i]) === 'poudre') gardes.push('en', mots[i]);
      continue;
    }
    gardes.push(mots[i]);
  }
  while (gardes.length > 1 && LIAISONS.has(normMot(gardes[gardes.length - 1]).replace(/'/g, ''))) gardes.pop();
  t = gardes.join(' ').replace(/\s+([’'])/g, '$1').trim();
  return majuscule(t || (nom ?? '').trim());
}

/** Clé de fusion des doublons : « Oignons » et « oignon » donnent la même clé. */
export function cleCourses(nom: string): string {
  const mots = normaliser(nom)
    .split(/[^a-z0-9]+/)
    .filter((m) => m && !MOTS_VIDES.has(m))
    .map(radical);
  return mots.join(' ') || normaliser(nom).trim();
}

/** Toujours à la maison : proposé décoché quand on ajoute une recette (le placard réglable viendra à l'étape 4). */
const TOUJOURS_LA = new Set(
  ['sel', 'poivre', 'sel fin', 'gros sel', 'sel gros', 'poivre moulin', 'sel poivre', 'poivre noir', 'pincee sel'].map(cleCourses),
);

export function estToujoursLa(cle: string): boolean {
  // L'eau du robinet, sous toutes ses formes (« eau froide », « eau ou fond blanc »), mais pas l'eau de vie ni l'eau de rose.
  if (/^eau( |$)/.test(cle) && !/^eau (vie|rose|fleur|gazeuse|minerale)/.test(cle)) return true;
  return TOUJOURS_LA.has(cle);
}

// ───── Quantités ─────

/** Ramène une quantité à l'unité de base de sa famille : kg → g, l / cl → ml, sans unité → pièce. */
export function versUniteDeBase(valeur: number, unite?: string): { valeur: number; unite: string } {
  const u = normaliserUnite(unite);
  switch (u) {
    case undefined:
    case 'pièce':
      return { valeur, unite: 'pièce' };
    case 'kg':
      return { valeur: valeur * 1000, unite: 'g' };
    case 'l':
      return { valeur: valeur * 1000, unite: 'ml' };
    case 'cl':
      return { valeur: valeur * 10, unite: 'ml' };
    default:
      return { valeur, unite: u };
  }
}

/** Unités qui s'achètent entières : « 0,25 botte » de menthe → 1 botte. */
const ENTIERES = new Set([
  'pièce', 'botte', 'boîte', 'boîte 4/4', 'bt', 'sachet', 'paquet', 'tête', 'bouquet', 'gousse', 'feuille', 'tranche',
  'bâton', 'branche', 'morceau', 'tige', 'plaque', 'rouleau', 'pot', 'bocal', 'bouteille', 'barquette',
]);

/** « 500 g + 2 pièces » : total d'un article, par unité (les « pour mémoire » ne comptent pas). */
export function quantiteTotale(apports: Apport[]): string {
  const sommes = new Map<string, number>();
  for (const a of apports) {
    if (a.valeur === undefined || !(a.valeur > 0) || !a.unite) continue;
    sommes.set(a.unite, (sommes.get(a.unite) ?? 0) + a.valeur);
  }
  const ordre = ['g', 'ml', 'pièce'];
  const unites = [...sommes.keys()].sort((a, b) => {
    const ia = ordre.indexOf(a);
    const ib = ordre.indexOf(b);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || collator.compare(a, b);
  });
  const parties = unites.map((u) => {
    const v = sommes.get(u)!;
    if (u === 'g') return formaterMesure(v / 1000, 'kg');
    if (u === 'ml') return formaterMesure(v / 1000, 'l');
    // On n'achète pas une demi-pièce ni un quart de botte : arrondi au-dessus.
    const n = ENTIERES.has(u) ? Math.ceil(v - 1e-6) : v;
    if (u === 'pièce') return unites.length > 1 ? `${nombre(n, 0)} ${n > 1 ? 'pièces' : 'pièce'}` : nombre(n, 0);
    return formaterMesure(n, u);
  });
  return parties.join(' + ');
}

// ───── Propositions depuis une fiche ─────

export interface Proposition {
  nom: string;
  cle: string;
  rayon: string;
  apport: Apport;
  /** Proposé coché (pas les alternatives, les facultatifs ni l'eau, le sel, le poivre). */
  coche: boolean;
  /** Détail affiché dans la feuille de choix (« 40 g », « PM »). */
  quantite: string;
}

export interface SectionPropositions {
  titre?: string;
  items: Proposition[];
}

function proposition(item: Ingredient, fiche: Pick<Fiche, 'id' | 'source'>, coef: number): Proposition | null {
  const nom = nomPourCourses(item.nom ?? item.texte_original ?? '');
  if (!nom) return null;
  const cle = cleCourses(nom);
  const m = mesureIngredient(item, fiche.source.id);
  const apport: Apport = { ficheId: fiche.id };
  if (m.valeur !== undefined && m.valeur > 0) Object.assign(apport, versUniteDeBase(m.valeur * coef, m.unite));
  return {
    nom,
    cle,
    rayon: rayonDe(nom),
    apport,
    coche: !item.alternative_du_precedent && !item.optionnel && !estToujoursLa(cle),
    quantite: apport.valeur !== undefined ? quantiteTotale([apport]) : m.pm ? 'PM' : '',
  };
}

function section(titre: string | undefined, groupes: GroupeIngredients[], fiche: Pick<Fiche, 'id' | 'source'>, coef: number): SectionPropositions[] {
  return groupes.map((g, i) => ({
    titre: [i === 0 ? titre : undefined, g.groupe?.trim() ? casseLisible(g.groupe) : undefined].filter(Boolean).join(' — ') || undefined,
    items: (g.items ?? []).map((it) => proposition(it, fiche, coef)).filter((p): p is Proposition => !!p),
  }));
}

/** Ingrédients d'une fiche (y compris tableaux des denrées), prêts à ajouter aux courses. */
export function propositionsDeLaFiche(
  fiche: Pick<Fiche, 'id' | 'source' | 'ingredients' | 'ingredients_supplementaires' | 'preparations_de_base'>,
  coef = 1,
): SectionPropositions[] {
  const tableau = (t: { titre?: string }) => casseLisible((t.titre ?? '').replace(/\s+/g, ' ').trim()) || undefined;
  return [
    ...section(undefined, fiche.ingredients ?? [], fiche, coef),
    ...(fiche.ingredients_supplementaires ?? []).flatMap((t) => section(tableau(t), t.ingredients ?? [], fiche, coef)),
    ...(fiche.preparations_de_base ?? []).flatMap((t) => section(tableau(t), t.ingredients ?? [], fiche, coef)),
  ].filter((s) => s.items.length);
}

// ───── Liste ─────

/** Articles non cochés, rangés par rayon (ordre du magasin) puis par nom. */
export function parRayon(articles: ArticleCourses[]): { rayon: Rayon; articles: ArticleCourses[] }[] {
  const groupes = new Map<string, ArticleCourses[]>();
  for (const a of articles) {
    const r = RAYON_PAR_ID.has(a.rayon) ? a.rayon : 'autres';
    if (!groupes.has(r)) groupes.set(r, []);
    groupes.get(r)!.push(a);
  }
  return RAYONS.filter((r) => groupes.has(r.id)).map((rayon) => ({
    rayon,
    articles: groupes.get(rayon.id)!.sort((a, b) => collator.compare(a.nom, b.nom)),
  }));
}

/** Texte à partager (Messages, Notes…) : les articles restant à acheter, par rayon. */
export function texteListe(articles: ArticleCourses[], jour: Date = new Date()): string {
  const lignes = [`Courses — ${formaterDate(jour)}`];
  for (const g of parRayon(articles.filter((a) => !a.coche))) {
    lignes.push('', `${g.rayon.emoji} ${g.rayon.nom}`);
    for (const a of g.articles) {
      const q = quantiteTotale(a.apports);
      lignes.push(`- ${a.nom}${q ? ` : ${q}` : ''}`);
    }
  }
  return lignes.join('\n').replace(/[\u00a0\u202f]/g, ' ');
}
