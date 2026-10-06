// « Avec ce que j'ai » : ingrédients possédés, placard, synonymes (réglages perso, sauvegardés)
// et index des ingrédients des recettes (construit à l'import, ou ici pour une archive plus ancienne).

import {
  classer,
  construireIndexIngredients,
  construireVocabulaire,
  preparer,
  VERSION_INDEX_INGREDIENTS,
  type IndexIngredients,
} from './classement-frigo';
import { db } from './db';
import { masquees } from './masquees.svelte';
import { mesRecettes } from './mes-recettes.svelte';
import type { ReponseIndex } from './index-ingredients.worker';
import { Dictionnaire, PLACARD_DEFAUT, predicatListe, SYNONYMES_DEFAUT } from './normalisation';
import { collator, normaliser } from './texte';

type CleReglage = 'frigo' | 'placard' | 'synonymes';

class Frigo {
  /** Ingrédients que j'ai (tels que saisis). */
  possedes = $state.raw<string[]>([]);
  #placard = $state.raw<string[] | null>(null);
  #synonymes = $state.raw<string[][] | null>(null);

  placard = $derived(this.#placard ?? PLACARD_DEFAUT);
  synonymes = $derived(this.#synonymes ?? SYNONYMES_DEFAUT);
  placardModifie = $derived(this.#placard !== null);
  synonymesModifies = $derived(this.#synonymes !== null);

  dico = $derived(new Dictionnaire(this.synonymes));
  auPlacard = $derived(predicatListe(this.dico, this.placard));
  #jetonsPlacard = $derived(this.placard.map((n) => this.dico.alternatives(n)).filter((a) => a.length));
  #jetonsPossedes = $derived(this.possedes.map((n) => this.dico.alternatives(n)).filter((a) => a.length));

  index = $state.raw<IndexIngredients | null>(null);
  statutIndex = $state<'attente' | 'preparation' | 'pret' | 'erreur'>('attente');
  #indexPour: string | null = null;

  /**
   * Index de l'archive + ingrédients de mes recettes, calculés à la volée (quelques fiches) : une recette
   * ajoutée, modifiée ou supprimée compte tout de suite. Une recette perso remplace la fiche de même id.
   */
  #indexComplet = $derived.by(() => {
    if (!this.index) return null;
    const perso = construireIndexIngredients(mesRecettes.liste).fiches;
    const ids = new Set(mesRecettes.liste.map((f) => f.id));
    const caches = masquees.ids;
    return {
      ...this.index,
      fiches: [...this.index.fiches.filter((f) => !ids.has(f.id)), ...perso].filter((f) => !caches.has(f.id)),
    };
  });
  preparees = $derived(this.#indexComplet ? preparer(this.#indexComplet, this.dico) : []);
  vocabulaire = $derived(construireVocabulaire(this.preparees, this.dico, this.synonymes));
  resultats = $derived(classer(this.preparees, this.#jetonsPossedes, this.#jetonsPlacard));
  /** Déjà choisis ou au placard : pas proposés en suggestion. */
  exclus = $derived([...this.#jetonsPossedes, ...this.#jetonsPlacard]);

  async charger() {
    const [frigo, placard, synonymes] = await Promise.all(
      (['frigo', 'placard', 'synonymes'] as const).map((c) => db.reglages.get(c)),
    );
    this.possedes = listeDeTextes(frigo?.valeur) ?? [];
    this.#placard = listeDeTextes(placard?.valeur);
    const s = synonymes?.valeur;
    this.#synonymes = Array.isArray(s) ? s.map(listeDeTextes).filter((g): g is string[] => !!g && g.length >= 2) : null;
  }

  /**
   * Charge l'index des ingrédients de l'archive importée (repère : date d'import). Mes recettes y sont
   * ajoutées à la volée (#indexComplet). S'il manque ou date d'une version précédente, il est construit
   * en arrière-plan.
   */
  async chargerIndex(importeLe: string | undefined) {
    if (!importeLe || this.#indexPour === importeLe) return;
    this.#indexPour = importeLe;
    this.statutIndex = 'preparation';
    try {
      const e = await db.meta.get('ingredients');
      const lu = e?.valeur as IndexIngredients | undefined;
      this.index = lu?.version === VERSION_INDEX_INGREDIENTS ? lu : await construireEnArrierePlan();
      this.statutIndex = 'pret';
    } catch {
      this.#indexPour = null;
      this.statutIndex = 'erreur';
    }
  }

  /** Ajoute un ingrédient (sans doublon, en ignorant accents et majuscules). */
  async ajouter(nom: string) {
    const propre = nom.replace(/\s+/g, ' ').trim();
    if (!propre || this.possedes.some((p) => normaliser(p) === normaliser(propre))) return;
    this.possedes = [...this.possedes, majusculeInitiale(propre)];
    await this.#enregistrer('frigo', this.possedes);
  }

  async retirer(nom: string) {
    this.possedes = this.possedes.filter((p) => p !== nom);
    await this.#enregistrer('frigo', this.possedes);
  }

  async vider() {
    this.possedes = [];
    await this.#enregistrer('frigo', []);
  }

  /** Nouveau placard (null : liste d'origine). */
  async definirPlacard(liste: string[] | null) {
    this.#placard = liste ? [...new Set(liste.map((n) => majusculeInitiale(n.trim())).filter(Boolean))].sort(collator.compare) : null;
    await this.#enregistrer('placard', this.#placard);
  }

  async ajouterAuPlacard(nom: string) {
    const propre = nom.replace(/\s+/g, ' ').trim();
    if (!propre || this.placard.some((p) => normaliser(p) === normaliser(propre))) return;
    await this.definirPlacard([...this.placard, propre]);
  }

  async retirerDuPlacard(nom: string) {
    await this.definirPlacard(this.placard.filter((p) => p !== nom));
  }

  /** Nouveaux synonymes (null : liste d'origine). */
  async definirSynonymes(groupes: string[][] | null) {
    this.#synonymes = groupes;
    await this.#enregistrer('synonymes', groupes);
  }

  async #enregistrer(cle: CleReglage, valeur: unknown) {
    await db.reglages.put({ cle, valeur, modifieLe: Date.now() });
  }
}

function listeDeTextes(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : null;
}

function majusculeInitiale(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Construit l'index dans un fil séparé (lecture de toutes les recettes du téléphone). */
function construireEnArrierePlan(): Promise<IndexIngredients> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./index-ingredients.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ReponseIndex>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.index);
      else reject(new Error(e.data.message));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'erreur inconnue'));
    };
    worker.postMessage(null);
  });
}

export const frigo = new Frigo();
