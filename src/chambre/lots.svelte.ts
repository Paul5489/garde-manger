// Lots et stock de la chambre, en mémoire + Dexie (tables « lots » et « stock », sauvegardées).

import { db, nouvelId } from '../lib/db';
import { CONTENU, recette as recetteParId } from './donnees';
import { conservationCongelateur, dateLimite, indexEntreeReglage, nouveauLot, type NouveauLot } from './lots';
import type { ArticleStock, Conservation, ControleCoche, Lot, MesurePh, RecetteChambre } from './types';

class Lots {
  liste = $state.raw<Lot[]>([]);
  stock = $state.raw<ArticleStock[]>([]);
  charge = $state(false);

  enCours = $derived(this.liste.filter((l) => l.statut === 'en-cours').sort((a, b) => a.entree.localeCompare(b.entree)));
  finis = $derived(
    this.liste.filter((l) => l.statut !== 'en-cours').sort((a, b) => (b.finLe ?? b.entree).localeCompare(a.finLe ?? a.entree)),
  );

  async charger() {
    const [l, s] = await Promise.all([db.lots.toArray(), db.stock.toArray()]);
    this.liste = l;
    this.stock = s;
    this.charge = true;
  }

  lot(id: string): Lot | undefined {
    return this.liste.find((l) => l.id === id);
  }

  async #ecrire(l: Lot) {
    const lot = { ...l, modifieLe: Date.now() };
    await db.lots.put(lot);
    this.liste = [...this.liste.filter((x) => x.id !== lot.id), lot];
    return lot;
  }

  async #modifier(id: string, f: (l: Lot) => Lot) {
    const l = this.lot(id);
    if (l) await this.#ecrire(f(l));
  }

  async creer(r: RecetteChambre, n: NouveauLot): Promise<Lot> {
    const technique = r.technique ? CONTENU.techniques[r.technique] : undefined;
    return this.#ecrire(nouveauLot(r, technique, n, nouvelId()));
  }

  async cocher(id: string, cle: string, coche: Omit<ControleCoche, 'le'> | null) {
    await this.#modifier(id, (l) => {
      const controles = { ...l.controles };
      if (coche) controles[cle] = { ...coche, le: new Date().toISOString() };
      else delete controles[cle];
      return { ...l, controles };
    });
  }

  /** Pesée (et, si donnée, l'occurrence du contrôle « Pesée » qu'elle coche). */
  async peser(id: string, g: number, le: Date, cle?: string) {
    await this.#modifier(id, (l) => ({
      ...l,
      pesees: [...l.pesees, { le: le.toISOString(), g }],
      controles: cle ? { ...l.controles, [cle]: { etat: 'ok', le: new Date().toISOString() } } : l.controles,
    }));
  }

  async supprimerPesee(id: string, le: string) {
    await this.#modifier(id, (l) => ({ ...l, pesees: l.pesees.filter((p) => p.le !== le) }));
  }

  async mesurerPh(id: string, valeur: number, moment: MesurePh['moment'], le: Date, cle?: string) {
    await this.#modifier(id, (l) => ({
      ...l,
      ph: [...l.ph, { le: le.toISOString(), valeur, moment }],
      controles: cle ? { ...l.controles, [cle]: { etat: 'ok', le: new Date().toISOString() } } : l.controles,
    }));
  }

  async supprimerPh(id: string, le: string) {
    await this.#modifier(id, (l) => ({ ...l, ph: l.ph.filter((p) => p.le !== le) }));
  }

  /** Passe à la phase suivante, qui commence à la date donnée (avec le poids à son entrée, s'il est demandé). */
  async passerPhase(id: string, le: Date, poids?: number) {
    await this.#modifier(id, (l) => {
      const i = l.phaseCourante + 1;
      if (i >= l.phases.length) return l;
      const phases = l.phases.map((p, k) => (k === i ? { ...p, debut: le.toISOString(), ...(poids ? { poids } : {}) } : p));
      // L'étape de réglage « Entrée en mode … » est faite en même temps.
      const r = indexEntreeReglage(l.recette, i);
      const controles = r >= 0 ? { ...l.controles, [`reglage:${r}`]: { etat: 'ok' as const, le: new Date().toISOString() } } : l.controles;
      return { ...l, phases, phaseCourante: i, controles };
    });
  }

  async revenirPhase(id: string) {
    await this.#modifier(id, (l) => {
      if (l.phaseCourante === 0) return l;
      const phases = l.phases.map((p, k) => (k === l.phaseCourante ? {} : p));
      const controles = { ...l.controles };
      delete controles[`reglage:${indexEntreeReglage(l.recette, l.phaseCourante)}`];
      return { ...l, phases, phaseCourante: l.phaseCourante - 1, controles };
    });
  }

  async modifierNotes(id: string, notes: string) {
    await this.#modifier(id, (l) => ({ ...l, notes: notes.trim() || undefined }));
  }

  /** Termine le lot ; avec une conservation, crée une entrée de stock. */
  async terminer(id: string, fin: { le: Date; rate?: boolean; conservation?: Conservation; quantite?: string }) {
    const l = this.lot(id);
    if (!l) return;
    await this.#ecrire({ ...l, statut: fin.rate ? 'rate' : 'termine', finLe: fin.le.toISOString() });
    if (!fin.rate && fin.conservation) {
      const a: ArticleStock = {
        id: nouvelId(),
        lotId: l.id,
        recetteId: l.recetteId,
        nom: l.nom,
        quantite: fin.quantite?.trim() || undefined,
        conservation: { ...fin.conservation },
        congelation: l.recette.congelation ? { ...l.recette.congelation } : undefined,
        depuis: fin.le.toISOString(),
        limite: dateLimite(fin.le, fin.conservation),
        statut: 'en-stock',
        modifieLe: Date.now(),
      };
      await db.stock.put(a);
      this.stock = [...this.stock, a];
    }
  }

  async reprendre(id: string) {
    await this.#modifier(id, (l) => ({ ...l, statut: 'en-cours', finLe: undefined }));
  }

  async supprimer(id: string) {
    await db.lots.delete(id);
    this.liste = this.liste.filter((l) => l.id !== id);
  }

  async #ecrireStock(a: ArticleStock) {
    const x = { ...a, modifieLe: Date.now() };
    await db.stock.put(x);
    this.stock = [...this.stock.filter((s) => s.id !== x.id), x];
  }

  async stockFini(id: string, fini = true) {
    const a = this.stock.find((s) => s.id === id);
    if (a) await this.#ecrireStock({ ...a, statut: fini ? 'fini' : 'en-stock' });
  }

  /** Met un produit du stock au congélateur : nouvelle date limite comptée depuis aujourd'hui. */
  async congeler(id: string, le: Date = new Date()) {
    const a = this.stock.find((s) => s.id === id);
    if (!a) return;
    const conservation = conservationCongelateur(a, this.lot(a.lotId ?? '')?.recette ?? recetteParId(a.recetteId));
    if (!conservation) return;
    await this.#ecrireStock({ ...a, conservation, depuis: le.toISOString(), limite: dateLimite(le, conservation) });
  }

  async supprimerStock(id: string) {
    await db.stock.delete(id);
    this.stock = this.stock.filter((s) => s.id !== id);
  }
}

export const lots = new Lots();
