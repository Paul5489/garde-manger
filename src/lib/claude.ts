// Lecture d'une recette par Claude (texte collé et/ou photos) → fiche au format de l'application.
// Chargé seulement quand on lance une analyse (le kit Anthropic et zod pèsent lourd).
// Appel direct depuis le téléphone avec la clé API de Paul (gardée dans le téléphone, jamais ailleurs).

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { duree } from './format';
import { normaliserUnite } from './quantites';
import { nouvelIdRecette, TYPES_DE_PLAT } from './mes-recettes';
import type { Duree, Fermentation, Fiche, GroupeIngredients } from './types';

export const MODELE_CLAUDE = 'claude-opus-5-5';
/** Tarifs du modèle (dollars par million de jetons), pour afficher le coût de chaque analyse. */
const PRIX_ENTREE = 4;
const PRIX_SORTIE = 20;

const UNITES = [
  'g', 'kg', 'ml', 'cl', 'l', 'cuillère à soupe', 'cuillère à café', 'pincée', 'gousse', 'pièce', 'botte',
  'feuille', 'branche', 'brin', 'bâton', 'tranche', 'sachet', 'boîte', 'pot', 'verre', 'tasse', 'bol', 'poignée',
  'morceau', 'bouquet', 'zeste', 'trait', 'goutte', 'cube', 'tête', 'cm',
] as const;

const SchemaIngredient = z.object({
  texte: z
    .string()
    .describe("Ligne affichée en français, quantité en chiffres en tête : « 50 g de fleurs d'hibiscus séchées »"),
  nom: z.string().describe("Nom de l'ingrédient seul, sans quantité ni préparation : « fleurs d'hibiscus séchées »"),
  quantite: z.number().nullable(),
  quantite_max: z.number().nullable().describe('Haut de la fourchette (« 5 à 6 feuilles » → 6), sinon null'),
  // Texte libre (une liste fermée ferait rejeter toute la recette pour une seule unité inattendue).
  unite: z.string().nullable().describe(`Unité, de préférence parmi : ${UNITES.join(', ')} ; null si aucune`),
  optionnel: z.boolean(),
  alternative_du_precedent: z.boolean().describe("true si la ligne commence une alternative « ou … » de l'ingrédient précédent"),
});

const SchemaRecette = z.object({
  recette_trouvee: z.boolean(),
  probleme: z.string().nullable().describe("Si aucune recette n'est lisible : explication courte en français"),
  titre: z.string(),
  description: z.string().nullable(),
  type_de_plat: z.string().nullable().describe(`De préférence parmi : ${TYPES_DE_PLAT.join(', ')}`),
  categorie: z.string().nullable(),
  cuisine: z.array(z.string()),
  portions: z.object({ nombre: z.number(), unite: z.string() }).nullable(),
  rendement: z.string().nullable(),
  temps: z.object({
    preparation_min: z.number().nullable(),
    cuisson_min: z.number().nullable(),
    repos_min: z.number().nullable(),
    repos_texte: z.string().nullable(),
  }),
  groupes: z.array(z.object({ groupe: z.string().nullable(), ingredients: z.array(SchemaIngredient) })),
  etapes: z.array(z.object({ titre: z.string().nullable(), texte: z.string() })),
  notes: z.array(z.string()),
  materiel: z.array(z.string()),
  fermentation: z
    .object({
      type: z.string().nullable(),
      sel_pct: z.number().nullable(),
      temperature_c: z.number().nullable(),
      duree_min_jours: z.number().nullable(),
      duree_max_jours: z.number().nullable(),
      controle: z.string().nullable(),
      conservation: z.string().nullable(),
    })
    .nullable(),
  modifications_appliquees: z.array(z.string()),
});

type RecetteLue = z.infer<typeof SchemaRecette>;

const CONSIGNES = `Tu lis une recette de cuisine (texte collé et/ou photos de pages) et tu la transformes en fiche pour Garde-manger, l'application de cuisine de Paul, un cuisinier amateur francophone.

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

export interface EntreeAnalyse {
  cle: string;
  /** Pour les tests : remplace l'accès réseau. */
  fetch?: typeof fetch;
  texte?: string;
  /** Photos en data URL JPEG (déjà réduites). */
  photos?: string[];
  consignes?: string;
}

export interface ResultatAnalyse {
  fiche: Fiche;
  modifications: string[];
  /** Coût estimé en dollars (null si le modèle utilisé n'est pas celui attendu). */
  coutDollars: number | null;
}

export class ErreurClaude extends Error {}

function client(cle: string, f?: typeof fetch): Anthropic {
  // dangerouslyAllowBrowser : l'appli tourne dans le téléphone de Paul, avec sa propre clé, sans serveur.
  return new Anthropic({
    apiKey: cle,
    dangerouslyAllowBrowser: true,
    timeout: 180_000,
    maxRetries: f ? 0 : 2,
    ...(f ? { fetch: f } : {}),
  });
}

/** Vérifie la clé sans rien dépenser (fiche du modèle). */
export async function testerCle(cle: string, f?: typeof fetch): Promise<void> {
  try {
    await client(cle, f).models.retrieve(MODELE_CLAUDE);
  } catch (e) {
    throw traduireErreur(e);
  }
}

export async function analyserRecette(entree: EntreeAnalyse): Promise<ResultatAnalyse> {
  const contenu: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const photo of entree.photos ?? []) {
    const [entete, donnees] = photo.split(',', 2);
    const type = entete.match(/^data:(image\/(?:jpeg|png|webp|gif));base64$/)?.[1] as
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp'
      | 'image/gif'
      | undefined;
    if (!type || !donnees) continue;
    contenu.push({ type: 'image', source: { type: 'base64', media_type: type, data: donnees } });
  }
  let demande = '';
  if (entree.texte?.trim()) demande += `Texte de la recette :\n"""\n${entree.texte.trim()}\n"""\n\n`;
  if (contenu.length) demande += `${contenu.length > 1 ? 'Les photos montrent' : 'La photo montre'} la recette.\n\n`;
  demande += entree.consignes?.trim()
    ? `Consignes de modification de Paul : ${entree.consignes.trim()}`
    : 'Pas de consigne de modification.';
  contenu.push({ type: 'text', text: demande });

  let reponse;
  try {
    reponse = await client(entree.cle, entree.fetch).beta.messages.parse({
      model: MODELE_CLAUDE,
      max_tokens: 16000,
      // Si un filtre de sécurité refusait la demande, l'API la relance sur le modèle recommandé.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: CONSIGNES,
      output_config: { effort: 'medium', format: betaZodOutputFormat(SchemaRecette) },
      messages: [{ role: 'user', content: contenu }],
    });
  } catch (e) {
    throw traduireErreur(e);
  }

  if (reponse.stop_reason === 'refusal') throw new ErreurClaude('Claude a refusé de lire ce contenu.');
  if (reponse.stop_reason === 'max_tokens')
    throw new ErreurClaude('La recette est trop longue pour être lue en une fois : essaie avec moins de texte ou de photos.');
  const lue = reponse.parsed_output;
  if (!lue) throw new ErreurClaude("La réponse de Claude n'a pas pu être lue. Réessaie.");
  if (!lue.recette_trouvee) throw new ErreurClaude(lue.probleme || "Claude n'a pas trouvé de recette dans ce contenu.");

  const u = reponse.usage;
  const coutDollars =
    reponse.model === MODELE_CLAUDE
      ? ((u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)) * PRIX_ENTREE +
          u.output_tokens * PRIX_SORTIE) /
        1_000_000
      : null;

  return {
    fiche: versFiche(lue, entree.texte, (entree.photos?.length ?? 0) > 0),
    modifications: lue.modifications_appliquees,
    coutDollars,
  };
}

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

/** Messages d'erreur compréhensibles (classes d'erreur du kit Anthropic, de la plus précise à la plus large). */
function traduireErreur(e: unknown): Error {
  if (e instanceof ErreurClaude) return e;
  if (e instanceof Anthropic.AuthenticationError)
    return new ErreurClaude('Clé Claude refusée : vérifie-la dans Réglages › Claude (lecture des recettes).');
  if (e instanceof Anthropic.PermissionDeniedError)
    return new ErreurClaude("Cette clé n'a pas le droit d'utiliser Claude. Vérifie ton compte Anthropic.");
  if (e instanceof Anthropic.RateLimitError)
    return new ErreurClaude('Trop de demandes en même temps : réessaie dans une minute.');
  if (e instanceof Anthropic.InternalServerError)
    return new ErreurClaude('Le service Claude est momentanément surchargé : réessaie dans quelques minutes.');
  if (e instanceof Anthropic.APIConnectionError)
    return new ErreurClaude("Pas de connexion à Claude : l'analyse a besoin d'Internet (le reste de l'appli marche hors ligne).");
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402 || e.type === 'billing_error')
      return new ErreurClaude("Ton compte Anthropic n'a plus de crédit : recharge-le sur console.anthropic.com (Billing).");
    if (e.type === 'invalid_request_error')
      return new ErreurClaude(`Demande refusée par Anthropic : ${e.message}`);
    return new ErreurClaude(`Erreur du service Claude (${e.status ?? '?'}) : ${e.message}`);
  }
  return new ErreurClaude(e instanceof Error ? e.message : String(e));
}
