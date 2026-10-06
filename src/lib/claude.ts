// Lecture d'une recette par Claude (texte collé et/ou photos) → fiche au format de l'application.
// Chargé seulement quand on lance une analyse (le kit Anthropic et zod pèsent lourd).
// Appel direct depuis le téléphone avec la clé API de Paul (gardée dans le téléphone, jamais ailleurs).

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { CONSIGNES, UNITES, versFiche, type RecetteLue } from './lecture-recette';
import { TYPES_DE_PLAT } from './mes-recettes';
import type { Fiche } from './types';

export const MODELE_CLAUDE = 'claude-opus-5-5';
/** Tarifs du modèle (dollars par million de jetons), pour afficher le coût de chaque analyse. */
const PRIX_ENTREE = 4;
const PRIX_SORTIE = 20;

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

const SchemaRecette: z.ZodType<RecetteLue> = z.object({
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
