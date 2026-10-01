// « Mes bocaux » : calcul des jours de fermentation, étapes successives, rappels du Calendrier (.ics).
// Tout est calculé à partir des dates enregistrées : rien ne dépend d'un minuteur ni d'un serveur.

import { dateCourte, nombre } from './format';
import { majuscule } from './texte';
import type { Fermentation, Fiche } from './types';

export type UniteDuree = 'jours' | 'heures';

export interface EtapeBocal {
  nom: string;
  temperatureC?: number;
  /** Durée prévue (dans l'unité), absente si la recette n'en donne pas. */
  min?: number;
  max?: number;
  unite: UniteDuree;
  /** Début réel de l'étape (ISO), à partir de la 2e : posé quand on passe à l'étape suivante. */
  debut?: string;
}

export type StatutBocal = 'en-cours' | 'termine' | 'rate';

export interface Bocal {
  id: string;
  nom: string;
  /** Fiche d'origine (Noma), s'il y en a une. */
  ficheId?: string;
  type?: string;
  /** Mise en bocal (ISO). */
  debut: string;
  poidsG?: number;
  selPct?: number;
  temperatureC?: number;
  etapes: EtapeBocal[];
  etapeCourante: number;
  statut: StatutBocal;
  /** Fin (terminé ou raté), ISO. */
  finLe?: string;
  notes?: string;
  /** Dernière note du journal (ISO) : « goûté aujourd'hui ». */
  derniereNoteLe?: string;
  modifieLe: number;
}

export interface EntreeJournal {
  id: string;
  bocalId: string;
  /** ISO */
  date: string;
  texte: string;
  /** Photo compressée (data URL JPEG). */
  photo?: string;
  modifieLe: number;
}

/** Modèle réutilisable (« mon kimchi ») : les réglages d'un bocal, sans dates ni journal. */
export interface ModeleBocal {
  id: string;
  nom: string;
  type?: string;
  ficheId?: string;
  poidsG?: number;
  selPct?: number;
  temperatureC?: number;
  etapes: EtapeBocal[];
  notes?: string;
  modifieLe: number;
}

export type ReglagesBocal = Pick<Bocal, 'nom' | 'type' | 'ficheId' | 'poidsG' | 'selPct' | 'temperatureC' | 'etapes' | 'notes'>;

// ───── Dates ─────

const JOUR = 86_400_000;
const HEURE = 3_600_000;

function minuitLocal(d: Date | string | number): number {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
}

/** Jours de calendrier entre deux dates (heure locale, changements d'heure compris). */
export function joursEntre(a: Date | string | number, b: Date | string | number): number {
  return Math.round((minuitLocal(b) - minuitLocal(a)) / JOUR);
}

/** Ajoute des jours (de calendrier) ou des heures à une date. */
export function ajouter(d: Date | string | number, valeur: number, unite: UniteDuree): Date {
  const x = new Date(d);
  if (unite === 'heures') return new Date(x.getTime() + valeur * HEURE);
  const r = new Date(x);
  r.setDate(r.getDate() + Math.floor(valeur));
  // Fractions de jour (rares) : ajoutées en heures.
  if (valeur % 1) r.setTime(r.getTime() + (valeur % 1) * JOUR);
  return r;
}

// ───── Étapes et avancement ─────

export type Phase = 'sans-duree' | 'attente' | 'a-gouter' | 'pret' | 'depasse';

export interface EtatEtape {
  index: number;
  etape: EtapeBocal;
  debut: Date;
  /** Jours de calendrier (ou heures entières) écoulés depuis le début de l'étape. */
  ecoule: number;
  phase: Phase;
  /** À partir de quand goûter (dans l'unité de l'étape). */
  degustation?: number;
  /** 0 → 1 jusqu'à la durée maximale. */
  progression: number;
  finMin?: Date;
  finMax?: Date;
  derniere: boolean;
}

/** Jour (ou heure) à partir duquel on goûte : un peu avant la durée minimale. */
export function debutDegustation(e: EtapeBocal): number | undefined {
  if (e.min === undefined) return undefined;
  if (e.unite === 'heures') return e.min;
  return Math.max(1, e.min - Math.max(1, Math.round(e.min * 0.2)));
}

/** Début (réel ou prévu) de chaque étape. */
export function debutsDesEtapes(b: Pick<Bocal, 'debut' | 'etapes'>): Date[] {
  const debuts: Date[] = [];
  for (let i = 0; i < b.etapes.length; i++) {
    if (i === 0) debuts.push(new Date(b.debut));
    else {
      const reel = b.etapes[i].debut;
      const prec = b.etapes[i - 1];
      debuts.push(reel ? new Date(reel) : ajouter(debuts[i - 1], prec.min ?? 0, prec.unite));
    }
  }
  return debuts;
}

export function etatEtape(b: Pick<Bocal, 'debut' | 'etapes' | 'etapeCourante'>, maintenant: Date | number = Date.now()): EtatEtape {
  const index = Math.min(Math.max(0, b.etapeCourante), b.etapes.length - 1);
  const etape = b.etapes[index] ?? { nom: 'Fermentation', unite: 'jours' as const };
  const debut = debutsDesEtapes(b)[index] ?? new Date(b.debut);
  const ecoule =
    etape.unite === 'heures'
      ? Math.max(0, Math.floor((new Date(maintenant).getTime() - debut.getTime()) / HEURE))
      : Math.max(0, joursEntre(debut, maintenant));
  const derniere = index >= b.etapes.length - 1;
  if (etape.min === undefined) return { index, etape, debut, ecoule, phase: 'sans-duree', progression: 0, derniere };
  const max = etape.max ?? etape.min;
  const degustation = debutDegustation(etape)!;
  const phase: Phase = ecoule < degustation ? 'attente' : ecoule < etape.min ? 'a-gouter' : ecoule <= max ? 'pret' : 'depasse';
  return {
    index,
    etape,
    debut,
    ecoule,
    phase,
    degustation,
    progression: max > 0 ? Math.min(1, ecoule / max) : 1,
    finMin: ajouter(debut, etape.min, etape.unite),
    finMax: ajouter(debut, max, etape.unite),
    derniere,
  };
}

/** « 5 à 7 jours », « 14 jours », « 8 h ». */
export function libelleDuree(e: Pick<EtapeBocal, 'min' | 'max' | 'unite'>): string {
  if (e.min === undefined) return 'durée libre';
  const max = e.max ?? e.min;
  if (e.unite === 'heures') return e.min === max ? `${nombre(e.min)} h` : `${nombre(e.min)} à ${nombre(max)} h`;
  if (e.min === max) return `${nombre(e.min)} ${e.min > 1 ? 'jours' : 'jour'}`;
  return `${nombre(e.min)} à ${nombre(max)} jours`;
}

/** « Jour 4 sur 5 à 7 », « 3 h sur 8 h », « Mis en bocal aujourd'hui ». */
export function libelleAvancement(e: EtatEtape): string {
  const { etape, ecoule } = e;
  if (etape.unite === 'heures') {
    const max = etape.max ?? etape.min;
    return etape.min === undefined ? `${nombre(ecoule)} h` : `${nombre(ecoule)} h sur ${libelleDuree({ ...etape, max })}`;
  }
  if (ecoule === 0) return e.index === 0 ? "Mis en bocal aujourd'hui" : "Commencée aujourd'hui";
  if (etape.min === undefined) return `Jour ${ecoule}`;
  const max = etape.max ?? etape.min;
  return `Jour ${ecoule} sur ${etape.min === max ? nombre(max) : `${nombre(etape.min)} à ${nombre(max)}`}`;
}

/** Goûté (une note au journal) aujourd'hui ? */
export function gouteAujourdhui(b: Pick<Bocal, 'derniereNoteLe'>, maintenant: Date | number = Date.now()): boolean {
  return !!b.derniereNoteLe && joursEntre(b.derniereNoteLe, maintenant) === 0;
}

export type Rubrique = 'a-gouter' | 'prets' | 'en-cours' | 'finis';

/** Où ranger un bocal : à goûter aujourd'hui, prêt (ou dépassé), en cours, ou fini. */
export function rubrique(b: Bocal, maintenant: Date | number = Date.now()): Rubrique {
  if (b.statut !== 'en-cours') return 'finis';
  const e = etatEtape(b, maintenant);
  if (e.phase === 'pret' || e.phase === 'depasse') return 'prets';
  if (e.phase === 'a-gouter' && !gouteAujourdhui(b, maintenant)) return 'a-gouter';
  return 'en-cours';
}

/** Sel à peser : « 20 g » pour 1 kg à 2 %. */
export function selEnGrammes(b: Pick<Bocal, 'poidsG' | 'selPct'>): number | undefined {
  if (!(b.poidsG && b.selPct)) return undefined;
  return Math.round(b.poidsG * b.selPct) / 100;
}

// ───── Création ─────

function etapeDe(nom: string, f: Fermentation | NonNullable<Fermentation['etapes']>[number]): EtapeBocal {
  const heures = f.duree_min_heures !== undefined;
  const min = heures ? f.duree_min_heures : f.duree_min_jours;
  const max = heures ? (f.duree_max_heures ?? min) : (f.duree_max_jours ?? min);
  const e: EtapeBocal = { nom, unite: heures ? 'heures' : 'jours' };
  if (min !== undefined) Object.assign(e, { min, max });
  if (f.temperature_c !== undefined) e.temperatureC = f.temperature_c;
  return e;
}

/** Réglages d'un bocal tirés d'une fiche de fermentation (Noma). */
export function reglagesDepuisFiche(fiche: Pick<Fiche, 'id' | 'titre' | 'fermentation'>): ReglagesBocal {
  const f = fiche.fermentation ?? {};
  const etapes = f.etapes?.length
    ? f.etapes.map((e, i) => etapeDe(majuscule(e.nom?.trim() || `Étape ${i + 1}`), e))
    : [etapeDe(majuscule(f.type?.trim() || 'Fermentation'), f)];
  const r: ReglagesBocal = { nom: fiche.titre, ficheId: fiche.id, etapes };
  if (f.type) r.type = f.type;
  if (f.sel_pct !== undefined) r.selPct = f.sel_pct;
  if (f.temperature_c !== undefined) r.temperatureC = f.temperature_c;
  return r;
}

/** Un bocal tout neuf, mis en bocal à la date donnée. */
export function nouveauBocal(reglages: ReglagesBocal, debut: Date | string, id: string): Bocal {
  return {
    ...reglages,
    id,
    etapes: reglages.etapes.map(({ debut: _d, ...e }) => e),
    debut: new Date(debut).toISOString(),
    etapeCourante: 0,
    statut: 'en-cours',
    modifieLe: Date.now(),
  };
}

// ───── Calendrier ─────

export interface Evenement {
  uid: string;
  titre: string;
  date: Date;
  description: string;
}

/** Heure des rappels pour les étapes en jours. */
export const HEURE_RAPPEL = 18;

function aHeureDeRappel(d: Date, unite: UniteDuree): Date {
  if (unite === 'heures') return d;
  const r = new Date(d);
  r.setHours(HEURE_RAPPEL, 0, 0, 0);
  return r;
}

/** Rappels à venir : dégustation, fin de chaque étape, prêt et dernier délai. */
export function evenementsCalendrier(b: Bocal, maintenant: Date | number = Date.now()): Evenement[] {
  const res: Evenement[] = [];
  const debuts = debutsDesEtapes(b);
  const plusieurs = b.etapes.length > 1;
  for (let i = Math.max(0, b.etapeCourante); i < b.etapes.length; i++) {
    const e = b.etapes[i];
    if (e.min === undefined) break;
    const debut = debuts[i];
    const max = e.max ?? e.min;
    const nomEtape = plusieurs ? ` (${e.nom.toLowerCase()})` : '';
    const derniere = i === b.etapes.length - 1;
    const ajout = (cle: string, titre: string, valeur: number, description: string) =>
      res.push({ uid: `${b.id}-${i}-${cle}`, titre, date: aHeureDeRappel(ajouter(debut, valeur, e.unite), e.unite), description });
    const deg = debutDegustation(e);
    if (i === b.etapeCourante && deg !== undefined && deg < e.min)
      ajout('gouter', `🫙 Goûter : ${b.nom}`, deg, `${b.nom}${nomEtape} : commencer à goûter (prévu ${libelleDuree(e)}).`);
    if (derniere) {
      ajout('pret', `🫙 Prêt : ${b.nom}`, e.min, `${b.nom} : durée minimale atteinte (${libelleDuree(e)}). Goûter et décider.`);
      if (max > e.min) ajout('fin', `🫙 Dernier délai : ${b.nom}`, max, `${b.nom} : durée maximale prévue (${libelleDuree(e)}).`);
    } else {
      ajout('etape', `🫙 ${b.nom} : fin de l'étape ${i + 1}`, e.min, `${b.nom} : fin prévue de « ${e.nom} » (${libelleDuree(e)}), passer à « ${b.etapes[i + 1].nom} ».`);
    }
  }
  const seuil = new Date(maintenant).getTime();
  return res.filter((ev) => ev.date.getTime() > seuil);
}

function texteIcs(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Coupe les lignes à 75 octets (norme iCalendar), sans couper un caractère. */
function plier(ligne: string): string {
  const enc = new TextEncoder();
  const morceaux: string[] = [];
  let courant = '';
  for (const c of ligne) {
    const limite = morceaux.length ? 74 : 75;
    if (enc.encode(courant + c).length > limite) {
      morceaux.push(courant);
      courant = c;
    } else courant += c;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

const deux = (n: number) => String(n).padStart(2, '0');
/** Heure locale « flottante » : le Calendrier l'affiche à l'heure du téléphone. */
function dateLocaleIcs(d: Date): string {
  return `${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}T${deux(d.getHours())}${deux(d.getMinutes())}00`;
}
function dateUtcIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Fichier .ics : un événement de 15 min par rappel, avec une alarme à l'heure dite. */
export function fichierIcs(evenements: Evenement[], maintenant: Date = new Date()): string {
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Garde-manger//Bocaux//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const ev of evenements) {
    const fin = new Date(ev.date.getTime() + 15 * 60_000);
    l.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@garde-manger`,
      `DTSTAMP:${dateUtcIcs(maintenant)}`,
      `DTSTART:${dateLocaleIcs(ev.date)}`,
      `DTEND:${dateLocaleIcs(fin)}`,
      `SUMMARY:${texteIcs(ev.titre)}`,
      `DESCRIPTION:${texteIcs(ev.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${texteIcs(ev.titre)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  l.push('END:VCALENDAR');
  return l.map(plier).join('\r\n') + '\r\n';
}

/** « le 4 oct. à 18 h » pour résumer les rappels. */
export function quandRappel(d: Date): string {
  return `le ${dateCourte(d)} à ${d.getHours()} h${d.getMinutes() ? deux(d.getMinutes()) : ''}`;
}
