// Mes bocaux : liste en mémoire (petite) + journal (chargé bocal par bocal, il contient les photos).

import {
  nouveauBocal,
  rubrique,
  type Bocal,
  type EntreeJournal,
  type ModeleBocal,
  type ReglagesBocal,
  type Rubrique,
  type StatutBocal,
} from './bocaux';
import { db, nouvelId } from './db';

class Bocaux {
  liste = $state.raw<Bocal[]>([]);
  modeles = $state.raw<ModeleBocal[]>([]);
  charge = $state(false);
  /** Horloge (minute) : les jours et les heures avancent tout seuls. */
  maintenant = $state(Date.now());

  parRubrique = $derived.by(() => {
    const r: Record<Rubrique, Bocal[]> = { 'a-gouter': [], prets: [], 'en-cours': [], finis: [] };
    for (const b of this.liste) r[rubrique(b, this.maintenant)].push(b);
    r.finis.sort((a, b) => (b.finLe ?? b.debut).localeCompare(a.finLe ?? a.debut));
    for (const k of ['a-gouter', 'prets', 'en-cours'] as const) r[k].sort((a, b) => a.debut.localeCompare(b.debut));
    return r;
  });
  /** À goûter aujourd'hui + prêts : pastille de l'onglet. */
  aSignaler = $derived(this.parRubrique['a-gouter'].length + this.parRubrique.prets.length);

  constructor() {
    if (typeof document === 'undefined') return;
    setInterval(() => (this.maintenant = Date.now()), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.maintenant = Date.now();
    });
  }

  async charger() {
    const [liste, modeles] = await Promise.all([db.bocaux.toArray(), db.modelesBocaux.toArray()]);
    this.liste = liste;
    this.modeles = modeles.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    this.maintenant = Date.now();
    this.charge = true;
  }

  bocal(id: string): Bocal | undefined {
    return this.liste.find((b) => b.id === id);
  }

  async creer(reglages: ReglagesBocal, debut: Date | string): Promise<Bocal> {
    const b = nouveauBocal(nettoyer(reglages), debut, nouvelId());
    await this.#ecrire(b);
    return b;
  }

  /** Change les réglages (et la date de début) sans perdre l'avancement ni le journal. */
  async modifier(id: string, reglages: ReglagesBocal, debut: Date | string) {
    const b = this.bocal(id);
    if (!b) return;
    const propres = nettoyer(reglages);
    const etapes = propres.etapes.map((e, i) => (b.etapes[i]?.debut && i > 0 ? { ...e, debut: b.etapes[i].debut } : e));
    await this.#ecrire({
      ...b,
      ...propres,
      etapes,
      etapeCourante: Math.min(b.etapeCourante, etapes.length - 1),
      debut: new Date(debut).toISOString(),
      modifieLe: Date.now(),
    });
  }

  /** Passe à l'étape suivante (elle commence maintenant). */
  async etapeSuivante(id: string) {
    const b = this.bocal(id);
    if (!b || b.etapeCourante >= b.etapes.length - 1) return;
    const i = b.etapeCourante + 1;
    const etapes = b.etapes.map((e, k) => (k === i ? { ...e, debut: new Date().toISOString() } : e));
    await this.#ecrire({ ...b, etapes, etapeCourante: i, modifieLe: Date.now() });
  }

  /** Revient à l'étape précédente (en cas d'erreur). */
  async etapePrecedente(id: string) {
    const b = this.bocal(id);
    if (!b || b.etapeCourante <= 0) return;
    const etapes = b.etapes.map((e, k) => (k === b.etapeCourante ? { ...e, debut: undefined } : e));
    await this.#ecrire({ ...b, etapes, etapeCourante: b.etapeCourante - 1, modifieLe: Date.now() });
  }

  async changerStatut(id: string, statut: StatutBocal) {
    const b = this.bocal(id);
    if (!b) return;
    const maj: Bocal = { ...b, statut, modifieLe: Date.now() };
    if (statut === 'en-cours') delete maj.finLe;
    else maj.finLe = new Date().toISOString();
    await this.#ecrire(maj);
  }

  async supprimer(id: string) {
    this.liste = this.liste.filter((b) => b.id !== id);
    await db.transaction('rw', db.bocaux, db.journal, async () => {
      await db.bocaux.delete(id);
      await db.journal.where('bocalId').equals(id).delete();
    });
  }

  // ───── Journal ─────

  async journalDe(id: string): Promise<EntreeJournal[]> {
    const e = await db.journal.where('bocalId').equals(id).toArray();
    return e.sort((a, b) => b.date.localeCompare(a.date));
  }

  async ajouterAuJournal(bocalId: string, texte: string, photo?: string): Promise<EntreeJournal> {
    const date = new Date().toISOString();
    const e: EntreeJournal = { id: nouvelId(), bocalId, date, texte: texte.trim(), modifieLe: Date.now() };
    if (photo) e.photo = photo;
    await db.journal.put(e);
    const b = this.bocal(bocalId);
    if (b) await this.#ecrire({ ...b, derniereNoteLe: date, modifieLe: Date.now() });
    return e;
  }

  async supprimerDuJournal(e: EntreeJournal) {
    await db.journal.delete(e.id);
    // « Goûté aujourd'hui » suit la note la plus récente qui reste.
    const b = this.bocal(e.bocalId);
    if (!b) return;
    const reste = await this.journalDe(e.bocalId);
    const maj: Bocal = { ...b, modifieLe: Date.now() };
    if (reste[0]) maj.derniereNoteLe = reste[0].date;
    else delete maj.derniereNoteLe;
    await this.#ecrire(maj);
  }

  // ───── Modèles ─────

  modele(id: string): ModeleBocal | undefined {
    return this.modeles.find((m) => m.id === id);
  }

  async enregistrerModele(reglages: ReglagesBocal): Promise<ModeleBocal> {
    const m: ModeleBocal = { ...nettoyer(reglages), id: nouvelId(), modifieLe: Date.now() };
    m.etapes = m.etapes.map(({ debut: _d, ...e }) => e);
    this.modeles = [...this.modeles, m].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    await db.modelesBocaux.put(m);
    return m;
  }

  async supprimerModele(id: string) {
    this.modeles = this.modeles.filter((m) => m.id !== id);
    await db.modelesBocaux.delete(id);
  }

  async #ecrire(b: Bocal) {
    this.liste = [...this.liste.filter((x) => x.id !== b.id), b];
    await db.bocaux.put(b);
  }
}

/** Retire les champs vides (l'archive fait pareil : champs absents plutôt que vides). */
function nettoyer<T extends ReglagesBocal>(r: T): T {
  const o = { ...r };
  for (const k of Object.keys(o) as (keyof T)[]) {
    const v = typeof o[k] === 'string' ? (o[k] as string).trim() : o[k];
    if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) delete o[k];
    else o[k] = v as T[keyof T];
  }
  o.etapes = r.etapes.map((e) => {
    const x = { ...e, nom: e.nom.trim() || 'Fermentation' };
    for (const k of ['min', 'max', 'temperatureC'] as const) if (x[k] === undefined || Number.isNaN(x[k])) delete x[k];
    if (x.min !== undefined && (x.max === undefined || x.max < x.min)) x.max = x.min;
    if (x.min === undefined) delete x.max;
    return x;
  });
  if (!o.etapes.length) o.etapes = [{ nom: 'Fermentation', unite: 'jours' }];
  return o;
}

export const bocaux = new Bocaux();
