// État de la chambre de fermentation, gardé dans le téléphone (table « reglages », clés « chambre:… » :
// incluses dans la sauvegarde, jamais effacées par un réimport des recettes).

import { db } from '../lib/db';
import { pastilles } from '../lib/pastilles.svelte';
import { lireLocal } from '../lib/stockage-local';
import { bocaux } from '../lib/bocaux.svelte';
import { CONTENU, verifierContenu } from './donnees';
import {
  aFaire,
  debutVagueCave,
  debutsDesPhases,
  etatPh,
  etatStock,
  finPrevue,
  passageSuivant,
  perteDePoids,
  reglagesAFaire,
  type Occurrence,
  type ReglageDuLot,
} from './lots';
import { lots } from './lots.svelte';
import { modeActif, tachesDuJour, type DatesTaches, type ModeManuel, type Tache } from './taches';
import { joursCalendaires } from './temps';
import type { ArticleStock, IdMode, Lot } from './types';

export interface ActionLot {
  lot: Lot;
  type: 'controle' | 'phase' | 'fin' | 'bloque' | 'jeter' | 'reglage';
  occ?: Occurrence;
  reglage?: ReglageDuLot;
  /** Nom de la phase à commencer. */
  phase?: string;
}

function finDuJour(d: number): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

const CLES = {
  mode: 'chambre:mode',
  miseEnService: 'chambre:mise-en-service',
  taches: 'chambre:taches',
  heure: 'chambre:heure-rappels',
  changement: 'chambre:dernier-changement',
  etoiles: 'chambre:etoiles',
  achats: 'chambre:achats',
  materielFiches: 'chambre:materiel-fiches',
} as const;

/** Dernier changement de mode fait avec l'assistant (ou choisi à la main). */
export interface ChangementFait {
  de: string;
  vers: IdMode;
  le: string;
}

/** Étapes facultatives de la mise en service (« … (option) »). */
export const estFacultative = (titre: string) => /\(option\)/i.test(titre);
const ETAPES_REQUISES = CONTENU.modes.mise_en_service.filter((e) => !estFacultative(e.titre)).map((e) => e.titre);

/** Étapes de la mise en service qui valent aussi une tâche (calibrage annuel, étalonnage mensuel). */
const TACHE_DE_L_ETAPE: Record<string, Tache> = {
  'Calibrer les sondes': 'calibrage',
  'Étalonner le pH-mètre': 'etalonnage-ph',
};

class Chambre {
  charge = $state(false);
  /** Horloge (minute). */
  maintenant = $state(Date.now());
  manuel = $state.raw<ModeManuel | null>(null);
  /** Étapes de la mise en service faites (titres). */
  miseEnService = $state.raw<string[]>([]);
  faites = $state.raw<DatesTaches>({});
  /** Heure des contrôles sans heure précise et des rappels du Calendrier. */
  heureRappels = $state(8);
  dernierChangement = $state.raw<ChangementFait | null>(null);
  /** Recettes prévues, par mois : « coppa@11 ». */
  etoiles = $state.raw<string[]>([]);
  /** Matériel à acheter déjà acheté (texte de l'article). */
  achats = $state.raw<string[]>([]);
  /** Matériel coché sur chaque fiche. */
  materielFiches = $state.raw<Record<string, string[]>>({});

  readonly verification = verifierContenu();

  actif = $derived(modeActif(this.maintenant, this.manuel));
  miseEnServiceFaite = $derived(ETAPES_REQUISES.every((t) => this.miseEnService.includes(t)));
  /** Dernière entrée d'un produit en Cave (lot en cours), ou début du mode : rythme du réservoir, phase de l'IHC. */
  debutVague = $derived.by(() => {
    const d = debutVagueCave(lots.liste);
    return d && d > this.actif.depuis ? d : this.actif.depuis;
  });
  taches = $derived(
    tachesDuJour({
      maintenant: this.maintenant,
      actif: this.actif,
      faites: this.faites,
      debutVague: this.debutVague,
      miseEnService: this.miseEnServiceFaite,
    }),
  );

  /** Ce que les lots en cours demandent aujourd'hui : contrôles, phase à commencer, fin, pH bloquant. */
  actionsLots = $derived.by(() => {
    const res: ActionLot[] = [];
    const ce = finDuJour(this.maintenant);
    for (const lot of lots.enCours) {
      const ph = etatPh(lot);
      if (ph.bloque) res.push({ lot, type: 'bloque' });
      if (ph.jeter) res.push({ lot, type: 'jeter' });
      // Réglages de la chambre à faire (entrée en Cave, passage de l'IHC à 76 %, phase 2 du koji…).
      const reglages = reglagesAFaire(lot, this.maintenant, this.heureRappels);
      for (const reglage of reglages) res.push({ lot, type: 'reglage', reglage });
      for (const occ of aFaire(lot, this.maintenant, this.heureRappels)) res.push({ lot, type: 'controle', occ });
      const phases = lot.recette.phases ?? [];
      const suivante = phases[lot.phaseCourante + 1];
      // Phase suivante à commencer (jamais en Cave tant que le pH du saucisson ne le permet pas), sauf si son
      // réglage d'entrée est déjà affiché.
      if (
        suivante &&
        debutsDesPhases(lot).min[lot.phaseCourante + 1] <= ce &&
        passageSuivant(lot).possible &&
        !reglages.some((g) => g.entree && g.phase === lot.phaseCourante + 1)
      )
        res.push({ lot, type: 'phase', phase: suivante.nom });
      else if (!suivante) {
        const perte = lot.recette.fin.type === 'perte_poids' ? perteDePoids(lot) : undefined;
        if (perte?.atteinte || (!perte && finPrevue(lot).min <= ce)) res.push({ lot, type: 'fin' });
      }
    }
    return res;
  });

  /** Produits en stock à finir dans les 7 jours (ou dépassés). */
  stockAFinir = $derived(
    lots.stock
      .filter((a: ArticleStock) => a.statut === 'en-stock' && ['bientot', 'depasse'].includes(etatStock(a, this.maintenant)))
      .sort((a, b) => (a.limite ?? '').localeCompare(b.limite ?? '')),
  );

  /** Sauvegarde du mois : jamais faite, ou il y a plus de 30 jours (s'il y a des lots ou des bocaux à protéger). */
  sauvegardeDue = $derived.by(() => {
    const derniere = lireLocal<string | null>('derniere-sauvegarde', null);
    if (!lots.liste.length && !bocaux.liste.length) return false;
    return !derniere || joursCalendaires(derniere, this.maintenant) >= 30;
  });

  /** Nombre de choses à faire aujourd'hui dans la chambre (pastille de l'onglet et de l'icône). */
  get nombreAujourdhui(): number {
    return this.taches.filter((t) => t.due).length + (this.changementAFaire ? 1 : 0) + this.actionsLots.length + (this.sauvegardeDue ? 1 : 0);
  }

  constructor() {
    if (typeof document === 'undefined') return;
    $effect.root(() => {
      $effect(() => {
        pastilles.chambre = this.charge ? this.nombreAujourdhui : 0;
      });
    });
    setInterval(() => (this.maintenant = Date.now()), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.maintenant = Date.now();
    });
  }

  async charger() {
    const [m, s, t, h, c, e, a, f] = await db.reglages.bulkGet([
      CLES.mode,
      CLES.miseEnService,
      CLES.taches,
      CLES.heure,
      CLES.changement,
      CLES.etoiles,
      CLES.achats,
      CLES.materielFiches,
    ]);
    this.dernierChangement = (c?.valeur as ChangementFait | null) ?? null;
    this.etoiles = Array.isArray(e?.valeur) ? (e.valeur as string[]) : [];
    this.achats = Array.isArray(a?.valeur) ? (a.valeur as string[]) : [];
    this.materielFiches = (f?.valeur as Record<string, string[]>) ?? {};
    this.manuel = (m?.valeur as ModeManuel | null) ?? null;
    this.miseEnService = Array.isArray(s?.valeur) ? (s.valeur as string[]) : [];
    this.faites = (t?.valeur as DatesTaches) ?? {};
    if (typeof h?.valeur === 'number') this.heureRappels = h.valeur;
    this.maintenant = Date.now();
    this.charge = true;
  }

  async #ecrire(cle: string, valeur: unknown) {
    await db.reglages.put({ cle, valeur, modifieLe: Date.now() });
  }

  /** Nouveau mode (fin de l'assistant ou choix à la main) : s'il est celui du calendrier, on suit à nouveau le calendrier. */
  async changerDeMode(id: IdMode) {
    const de = this.actif.id;
    const le = new Date().toISOString();
    this.manuel = id === this.actif.prevu ? null : { mode: id, le };
    this.dernierChangement = { de, vers: id, le };
    await this.#ecrire(CLES.mode, this.manuel);
    await this.#ecrire(CLES.changement, this.dernierChangement);
  }

  /** Le calendrier vient de changer de mode et l'assistant n'a pas encore été suivi depuis. */
  changementAFaire = $derived.by(() => {
    const a = this.actif;
    if (a.manuel) return false;
    const fait = this.dernierChangement && new Date(this.dernierChangement.le) >= a.depuis;
    return !fait && joursCalendaires(a.depuis, this.maintenant) <= 3;
  });

  async suivreLeCalendrier() {
    this.manuel = null;
    await this.#ecrire(CLES.mode, null);
  }

  async cocherEtape(titre: string, faite: boolean) {
    this.miseEnService = faite ? [...new Set([...this.miseEnService, titre])] : this.miseEnService.filter((t) => t !== titre);
    await this.#ecrire(CLES.miseEnService, this.miseEnService);
    const tache = TACHE_DE_L_ETAPE[titre];
    if (tache && faite) await this.fait(tache);
  }

  /** Tâche faite (maintenant), ou annulée (date précédente). */
  async fait(tache: Tache, le: string | undefined = new Date().toISOString()) {
    const faites = { ...this.faites };
    if (le) faites[tache] = le;
    else delete faites[tache];
    this.faites = faites;
    await this.#ecrire(CLES.taches, faites);
  }

  estPrevue(id: string, mois: number): boolean {
    return this.etoiles.includes(`${id}@${mois}`);
  }

  /** Prévoir une recette pour un mois (ou l'enlever du programme). Renvoie vrai si elle vient d'être prévue. */
  async basculerEtoile(id: string, mois: number): Promise<boolean> {
    const cle = `${id}@${mois}`;
    const ajout = !this.etoiles.includes(cle);
    this.etoiles = ajout ? [...this.etoiles, cle] : this.etoiles.filter((x) => x !== cle);
    await this.#ecrire(CLES.etoiles, this.etoiles);
    return ajout;
  }

  async cocherAchat(article: string, coche: boolean) {
    this.achats = coche ? [...new Set([...this.achats, article])] : this.achats.filter((x) => x !== article);
    await this.#ecrire(CLES.achats, this.achats);
  }

  async cocherMaterielFiche(id: string, element: string, coche: boolean) {
    const avant = this.materielFiches[id] ?? [];
    const apres = coche ? [...new Set([...avant, element])] : avant.filter((x) => x !== element);
    this.materielFiches = { ...this.materielFiches, [id]: apres };
    await this.#ecrire(CLES.materielFiches, this.materielFiches);
  }

  async reglerHeure(h: number) {
    this.heureRappels = h;
    await this.#ecrire(CLES.heure, h);
  }
}

export const chambre = new Chambre();
