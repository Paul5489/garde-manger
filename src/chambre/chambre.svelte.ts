// État de la chambre de fermentation, gardé dans le téléphone (table « reglages », clés « chambre:… » :
// incluses dans la sauvegarde, jamais effacées par un réimport des recettes).

import { db } from '../lib/db';
import { CONTENU, verifierContenu } from './donnees';
import { modeActif, tachesDuJour, type DatesTaches, type ModeManuel, type Tache } from './taches';
import { joursCalendaires } from './temps';
import type { IdMode } from './types';

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
  taches = $derived(
    tachesDuJour({ maintenant: this.maintenant, actif: this.actif, faites: this.faites, miseEnService: this.miseEnServiceFaite }),
  );

  constructor() {
    if (typeof document === 'undefined') return;
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

  async basculerEtoile(id: string, mois: number) {
    const cle = `${id}@${mois}`;
    this.etoiles = this.etoiles.includes(cle) ? this.etoiles.filter((x) => x !== cle) : [...this.etoiles, cle];
    await this.#ecrire(CLES.etoiles, this.etoiles);
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
