// Lecture d'une recette par l'app Claude de l'iPhone (gratuit, compris dans l'abonnement de Paul) :
// l'appli prépare une demande à coller dans Claude, puis lit la réponse recollée et en fait une fiche
// « Mes recettes ». Aucun appel à un service extérieur depuis l'appli (pas de clé API : choix de Paul).

import { duree } from './format';
import { nouvelIdRecette, TYPES_DE_PLAT } from './mes-recettes';
import { normaliserUnite } from './quantites';
import type { Duree, Fermentation, Fiche, GroupeIngredients } from './types';

export const UNITES = [
  'g', 'kg', 'ml', 'cl', 'l', 'cuillère à soupe', 'cuillère à café', 'pincée', 'gousse', 'pièce', 'botte',
  'feuille', 'branche', 'brin', 'bâton', 'tranche', 'sachet', 'boîte', 'pot', 'verre', 'tasse', 'bol', 'poignée',
  'morceau', 'bouquet', 'zeste', 'trait', 'goutte', 'cube', 'tête', 'cm',
] as const;

export interface IngredientLu {
  texte: string;
  nom: string;
  quantite: number | null;
  quantite_max: number | null;
  unite: string | null;
  optionnel: boolean;
  alternative_du_precedent: boolean;
}

/** Recette telle que Claude la rend (même forme pour l'API et pour l'app Claude). */
export interface RecetteLue {
  recette_trouvee: boolean;
  probleme: string | null;
  titre: string;
  description: string | null;
  type_de_plat: string | null;
  categorie: string | null;
  cuisine: string[];
  portions: { nombre: number; unite: string } | null;
  rendement: string | null;
  temps: { preparation_min: number | null; cuisson_min: number | null; repos_min: number | null; repos_texte: string | null };
  groupes: { groupe: string | null; ingredients: IngredientLu[] }[];
  etapes: { titre: string | null; texte: string }[];
  notes: string[];
  materiel: string[];
  fermentation: {
    type: string | null;
    sel_pct: number | null;
    temperature_c: number | null;
    duree_min_jours: number | null;
    duree_max_jours: number | null;
    controle: string | null;
    conservation: string | null;
  } | null;
  modifications_appliquees: string[];
}

export const CONSIGNES = `Tu lis une recette de cuisine (texte collé et/ou photos de pages) et tu la transformes en fiche pour Garde-manger, l'application de cuisine de Paul, un cuisinier amateur francophone.

Règles :
- Tout en français. Si la recette est dans une autre langue, traduis-la. Convertis les mesures américaines ou impériales (cups, oz, lb, °F…) en unités métriques (g, ml, °C), en arrondissant raisonnablement.
- Garde exactement les quantités de la source. Nombres en chiffres, décimales avec une virgule dans les textes (« 0,5 »).
- Ingrédients : un par ligne, regroupés si la source a des groupes (« Pour la sauce »). Le champ « texte » commence par la quantité en chiffres suivie de l'unité puis du nom (« 2 gousses d'ail hachées ») ; s'il n'y a pas de quantité, écris simplement l'ingrédient (« Sel, poivre »). Un ingrédient facultatif a optionnel = true.
- Étapes : dans l'ordre, une action ou un petit groupe d'actions par étape, à l'infinitif (« Porter l'eau à ébullition »). Garde toutes les durées, températures et repères de cuisson. Donne un titre court à une étape seulement si la source en a un.
- Ignore tout ce qui n'est pas la recette : publicités, commentaires, histoire de l'auteur, appels à s'abonner.
- type_de_plat : choisis dans la liste si possible. cuisine : origine du plat (« Coréenne », « Française »…).
- fermentation : seulement pour une recette de fermentation (kimchi, kombucha, lacto-fermentation, miso…), sinon null.
- Si Paul donne des consignes de modification (remplacer un ingrédient, changer les portions…), applique-les partout de façon cohérente (ingrédients ET étapes) et résume chacune dans modifications_appliquees.
- Si aucune recette n'est lisible, mets recette_trouvee = false et explique pourquoi dans probleme.`;

/** « c. à s. », « cuillères à soupe », « grammes »… → unité des fiches (« cuillère à soupe », « g »). */
function uniteFiche(u: string): string {
  const n = u.trim().toLowerCase().replace(/\.$/, '');
  if (/^c\.?\s*(à|a)?\s*s|^cuill[eè]res?\s+(à|a)\s+soupe|^cs$|^tbsp/.test(n)) return 'cuillère à soupe';
  if (/^c\.?\s*(à|a)?\s*c|^cuill[eè]res?\s+(à|a)\s+caf[eé]|^cc$|^tsp/.test(n)) return 'cuillère à café';
  const connue = UNITES.find((x) => x === n || `${x}s` === n || `${x}x` === n);
  return connue ?? normaliserUnite(u) ?? u;
}

function minutes(m: number | null, texte?: string | null): Duree | undefined {
  if (!m || m <= 0) return texte ? { texte } : undefined;
  return { texte: texte || duree(m), minutes: Math.round(m) };
}

/** Recette lue par Claude → fiche « Mes recettes ». */
export function versFiche(r: RecetteLue, texteSource?: string, depuisPhotos = false): Fiche {
  const maintenant = Date.now();
  const groupes: GroupeIngredients[] = r.groupes
    .filter((g) => g.ingredients.length)
    .map((g) => ({
      ...(g.groupe ? { groupe: g.groupe } : {}),
      items: g.ingredients.map((i) => ({
        nom: i.nom || i.texte,
        texte_original: i.texte,
        ...(i.quantite !== null ? { quantite: i.quantite } : {}),
        ...(i.quantite !== null && i.quantite_max !== null && i.quantite_max !== i.quantite
          ? { quantite_min: i.quantite, quantite_max: i.quantite_max }
          : {}),
        ...(i.unite?.trim() ? { unite: uniteFiche(i.unite) } : {}),
        ...(i.optionnel ? { optionnel: true } : {}),
        ...(i.alternative_du_precedent ? { alternative_du_precedent: true } : {}),
      })),
    }));
  const temps: Record<string, Duree> = {};
  const p = minutes(r.temps.preparation_min);
  const c = minutes(r.temps.cuisson_min);
  const rp = minutes(r.temps.repos_min, r.temps.repos_texte);
  if (p) temps.preparation = p;
  if (c) temps.cuisson = c;
  if (rp) temps.repos = rp;

  const f: Fiche = {
    id: nouvelIdRecette(r.titre),
    type: 'recette',
    titre: r.titre.trim() || 'Recette sans titre',
    langue: 'fr',
    source: { id: 'perso', nom: 'Mes recettes' },
    classement: {
      ...(r.categorie ? { categorie: r.categorie } : {}),
      ...(r.type_de_plat?.trim() ? { type_de_plat: [r.type_de_plat.trim()] } : {}),
      ...(r.cuisine.length ? { cuisine: r.cuisine } : {}),
    },
    creeLe: maintenant,
    modifieLe: maintenant,
  };
  if (r.description) f.description = r.description;
  if (r.portions && r.portions.nombre > 0)
    f.portions = { nombre: r.portions.nombre, unite: r.portions.unite, texte: `${r.portions.nombre} ${r.portions.unite}` };
  if (r.rendement) f.rendement = r.rendement;
  if (Object.keys(temps).length) f.temps = temps;
  if (groupes.length) f.ingredients = groupes;
  if (r.etapes.length)
    f.etapes = r.etapes.map((e, i) => ({ numero: i + 1, texte: e.texte, ...(e.titre ? { phase: e.titre } : {}) }));
  if (r.notes.length) f.notes = r.notes;
  if (r.materiel.length) f.materiel = r.materiel;
  if (r.fermentation) {
    const fe: Fermentation = {};
    for (const [cle, valeur] of Object.entries(r.fermentation)) if (valeur !== null) (fe as Record<string, unknown>)[cle] = valeur;
    if (Object.keys(fe).length) f.fermentation = fe;
  }
  const source = [texteSource?.trim(), depuisPhotos ? '(lue sur photo)' : ''].filter(Boolean).join('\n\n');
  if (source) f.texte_source = source;
  return f;
}


// ───── Façon gratuite : l'app Claude de l'iPhone ─────

/** Modèle de réponse attendu (montré à Claude dans la demande). */
const MODELE_REPONSE = `{
  "recette_trouvee": true,
  "probleme": null,
  "titre": "…",
  "description": "… ou null",
  "type_de_plat": "un de : ${TYPES_DE_PLAT.join(', ')} (ou null)",
  "categorie": null,
  "cuisine": ["…"],
  "portions": { "nombre": 4, "unite": "personnes" },
  "rendement": null,
  "temps": { "preparation_min": 15, "cuisson_min": 20, "repos_min": null, "repos_texte": null },
  "groupes": [
    { "groupe": null, "ingredients": [
      { "texte": "50 g de farine", "nom": "farine", "quantite": 50, "quantite_max": null, "unite": "g",
        "optionnel": false, "alternative_du_precedent": false }
    ] }
  ],
  "etapes": [ { "titre": null, "texte": "…" } ],
  "notes": [],
  "materiel": [],
  "fermentation": null,
  "modifications_appliquees": []
}`;

/** Demande complète à coller dans l'app Claude (avec le texte de la recette s'il y en a un). */
export function demandePourAppClaude(entree: { texte?: string; consignes?: string; photo?: boolean }): string {
  const parties = [
    CONSIGNES,
    `Réponds UNIQUEMENT avec un bloc de code JSON de cette forme (mêmes noms de champs, null quand une information manque), sans aucun texte avant ou après :\n${MODELE_REPONSE}`,
    entree.consignes?.trim()
      ? `Consignes de modification de Paul : ${entree.consignes.trim()}`
      : 'Pas de consigne de modification.',
  ];
  if (entree.texte?.trim()) parties.push(`Texte de la recette :\n"""\n${entree.texte.trim()}\n"""`);
  else if (entree.photo) parties.push('La recette est sur la ou les photos jointes à ce message.');
  return parties.join('\n\n');
}

export class ErreurLecture extends Error {}

/** Le texte collé ressemble-t-il à une réponse de Claude (fiche JSON) plutôt qu'à une recette ? */
export function ressembleReponseClaude(texte: string): boolean {
  return /"titre"\s*:/.test(texte) && /"(groupes|etapes)"\s*:/.test(texte);
}

const chaine = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null);
const nombreOuNull = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim()) {
    const n = Number(x.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const objet = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const textes = (x: unknown): string[] => liste(x).map(chaine).filter((t): t is string => !!t);

/**
 * Lit la réponse copiée depuis l'app Claude : on prend le bloc JSON (même entouré de texte ou de ```json),
 * et on tolère les champs manquants ou mal typés.
 */
export function lireReponseClaude(brut: string): RecetteLue {
  const debut = brut.indexOf('{');
  const fin = brut.lastIndexOf('}');
  const incomplete = new ErreurLecture(
    "La réponse de Claude est incomplète ou abîmée. Copie-la à nouveau en entier (bouton « Copier » sous sa réponse).",
  );
  if (debut < 0)
    throw new ErreurLecture(
      "Je ne trouve pas la fiche dans ce texte. Dans l'app Claude, touche « Copier » sous sa réponse, puis recolle-la ici.",
    );
  if (fin <= debut) throw incomplete;
  let o: Record<string, unknown>;
  try {
    o = objet(JSON.parse(brut.slice(debut, fin + 1).replace(/[“”]/g, '"')));
  } catch {
    throw incomplete;
  }
  if (o.recette_trouvee === false)
    throw new ErreurLecture(chaine(o.probleme) ?? "Claude n'a pas trouvé de recette dans ce que tu lui as donné.");
  const titre = chaine(o.titre);
  if (!titre) throw new ErreurLecture("La réponse de Claude n'a pas de titre de recette : ce n'est sans doute pas la bonne réponse.");
  const t = objet(o.temps);
  const p = objet(o.portions);
  const fe = o.fermentation ? objet(o.fermentation) : null;
  return {
    recette_trouvee: true,
    probleme: null,
    titre,
    description: chaine(o.description),
    type_de_plat: chaine(o.type_de_plat),
    categorie: chaine(o.categorie),
    cuisine: textes(o.cuisine),
    portions: nombreOuNull(p.nombre) ? { nombre: nombreOuNull(p.nombre)!, unite: chaine(p.unite) ?? 'personnes' } : null,
    rendement: chaine(o.rendement),
    temps: {
      preparation_min: nombreOuNull(t.preparation_min),
      cuisson_min: nombreOuNull(t.cuisson_min),
      repos_min: nombreOuNull(t.repos_min),
      repos_texte: chaine(t.repos_texte),
    },
    groupes: liste(o.groupes).map((g) => {
      const gr = objet(g);
      return {
        groupe: chaine(gr.groupe),
        ingredients: liste(gr.ingredients)
          .map(objet)
          .map((i) => ({
            texte: chaine(i.texte) ?? chaine(i.nom) ?? '',
            nom: chaine(i.nom) ?? chaine(i.texte) ?? '',
            quantite: nombreOuNull(i.quantite),
            quantite_max: nombreOuNull(i.quantite_max),
            unite: chaine(i.unite),
            optionnel: i.optionnel === true,
            alternative_du_precedent: i.alternative_du_precedent === true,
          }))
          .filter((i) => i.texte),
      };
    }),
    etapes: liste(o.etapes)
      .map((e) => (typeof e === 'string' ? { titre: null, texte: e.trim() } : { titre: chaine(objet(e).titre), texte: chaine(objet(e).texte) ?? '' }))
      .filter((e) => e.texte),
    notes: textes(o.notes),
    materiel: textes(o.materiel),
    fermentation: fe
      ? {
          type: chaine(fe.type),
          sel_pct: nombreOuNull(fe.sel_pct),
          temperature_c: nombreOuNull(fe.temperature_c),
          duree_min_jours: nombreOuNull(fe.duree_min_jours),
          duree_max_jours: nombreOuNull(fe.duree_max_jours),
          controle: chaine(fe.controle),
          conservation: chaine(fe.conservation),
        }
      : null,
    modifications_appliquees: textes(o.modifications_appliquees),
  };
}
