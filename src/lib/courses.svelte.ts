// Liste de courses : articles (fusionnés par nom), recettes ajoutées, rayons choisis à la main.
// Mises à jour immuables ($state.raw) : les objets enregistrés dans IndexedDB restent de simples objets.

import { db, nouvelId, type Apport, type ArticleCourses, type RecetteCourses } from './db';
import { cleCourses, rayonDe, type Proposition } from './liste-courses';
import { majuscule } from './texte';

class Courses {
  articles = $state.raw<ArticleCourses[]>([]);
  recettes = $state.raw<RecetteCourses[]>([]);
  /** Rayon choisi à la main pour un article (par clé), réutilisé les fois suivantes. */
  rayonsPerso = $state.raw<Record<string, string>>({});

  restants = $derived(this.articles.filter((a) => !a.coche));
  coches = $derived(this.articles.filter((a) => a.coche));

  async charger() {
    const [articles, recettes, rayons] = await Promise.all([
      db.courses.toArray(),
      db.recettesCourses.toArray(),
      db.reglages.get('rayons'),
    ]);
    this.articles = articles;
    this.recettes = recettes.sort((a, b) => b.modifieLe - a.modifieLe);
    this.rayonsPerso = (rayons?.valeur as Record<string, string> | undefined) ?? {};
  }

  recette(ficheId: string): RecetteCourses | undefined {
    return this.recettes.find((r) => r.ficheId === ficheId);
  }

  rayonPour(cle: string, nom: string): string {
    return this.rayonsPerso[cle] ?? rayonDe(nom);
  }

  /** Ajoute les ingrédients choisis d'une recette (remplace ceux d'un ajout précédent de la même recette). */
  async ajouterRecette(recette: Omit<RecetteCourses, 'modifieLe'>, choix: Proposition[]) {
    const maintenant = Date.now();
    let articles = sansRecette(this.articles, recette.ficheId, maintenant);
    for (const p of choix) articles = ajouterApport(articles, p.nom, p.cle, p.apport, maintenant, this.rayonPour(p.cle, p.nom));
    const r: RecetteCourses = { ...recette, modifieLe: maintenant };
    this.recettes = [r, ...this.recettes.filter((x) => x.ficheId !== r.ficheId)];
    await db.recettesCourses.put(r);
    await this.#enregistrer(articles);
  }

  /** Article saisi à la main (« Papier cuisson », « Citrons »). */
  async ajouterLibre(texte: string) {
    const nom = majuscule(texte.trim().replace(/\s+/g, ' '));
    if (!nom) return;
    const cle = cleCourses(nom);
    await this.#enregistrer(ajouterApport(this.articles, nom, cle, {}, Date.now(), this.rayonPour(cle, nom)));
  }

  async basculer(id: string) {
    await this.#modifier(id, (a) => ({ ...a, coche: !a.coche }));
  }

  async changerRayon(id: string, rayon: string) {
    const a = this.articles.find((x) => x.id === id);
    if (!a) return;
    this.rayonsPerso = { ...this.rayonsPerso, [a.cle]: rayon };
    await db.reglages.put({ cle: 'rayons', valeur: this.rayonsPerso, modifieLe: Date.now() });
    await this.#modifier(id, (x) => ({ ...x, rayon }));
  }

  async supprimer(id: string) {
    await this.#enregistrer(this.articles.filter((a) => a.id !== id));
  }

  async retirerCoches() {
    await this.#enregistrer(this.articles.filter((a) => !a.coche));
  }

  /** Retire les quantités apportées par une recette (les articles qui n'en dépendaient que d'elle disparaissent). */
  async retirerRecette(ficheId: string) {
    await this.#enregistrer(sansRecette(this.articles, ficheId, Date.now()));
  }

  async vider() {
    await this.#enregistrer([]);
  }

  async #modifier(id: string, changer: (a: ArticleCourses) => ArticleCourses) {
    await this.#enregistrer(this.articles.map((a) => (a.id === id ? { ...changer(a), modifieLe: Date.now() } : a)));
  }

  /** Remplace la liste en mémoire et n'écrit dans le téléphone que ce qui a changé. */
  async #enregistrer(nouvelle: ArticleCourses[]) {
    const avant = new Map(this.articles.map((a) => [a.id, a]));
    const gardes = new Set(nouvelle.map((a) => a.id));
    const supprimes = [...avant.keys()].filter((id) => !gardes.has(id));
    const modifies = nouvelle.filter((a) => avant.get(a.id) !== a);
    // Une recette dont il ne reste aucun article sort de la liste.
    const utilisees = new Set(nouvelle.flatMap((a) => a.apports.map((p) => p.ficheId)));
    const recettesParties = this.recettes.filter((r) => !utilisees.has(r.ficheId)).map((r) => r.ficheId);
    this.articles = nouvelle;
    if (recettesParties.length) this.recettes = this.recettes.filter((r) => utilisees.has(r.ficheId));
    await db.transaction('rw', db.courses, db.recettesCourses, async () => {
      if (supprimes.length) await db.courses.bulkDelete(supprimes);
      if (modifies.length) await db.courses.bulkPut(modifies);
      if (recettesParties.length) await db.recettesCourses.bulkDelete(recettesParties);
    });
  }
}

/** Retire les apports d'une recette ; un article sans plus aucun apport disparaît. */
function sansRecette(articles: ArticleCourses[], ficheId: string, maintenant: number): ArticleCourses[] {
  return articles.flatMap((a) => {
    if (!a.apports.some((p) => p.ficheId === ficheId)) return [a];
    const apports = a.apports.filter((p) => p.ficheId !== ficheId);
    return apports.length ? [{ ...a, apports, modifieLe: maintenant }] : [];
  });
}

/** Ajoute un apport à l'article de même clé (qui redevient « à acheter »), ou crée l'article. */
function ajouterApport(
  articles: ArticleCourses[],
  nom: string,
  cle: string,
  apport: Apport,
  maintenant: number,
  rayon: string,
): ArticleCourses[] {
  const i = articles.findIndex((a) => a.cle === cle);
  if (i < 0) {
    return [...articles, { id: nouvelId(), nom, cle, rayon, apports: [apport], coche: false, ajouteLe: maintenant, modifieLe: maintenant }];
  }
  const a = articles[i];
  // Un ajout à la main déjà présent n'est pas dupliqué.
  const dejaLibre = !apport.ficheId && a.apports.some((p) => !p.ficheId);
  const copie = [...articles];
  copie[i] = { ...a, apports: dejaLibre ? a.apports : [...a.apports, apport], coche: false, modifieLe: maintenant };
  return copie;
}

export const courses = new Courses();
