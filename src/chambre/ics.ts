// Rappels de la chambre pour Apple Calendrier (.ics) : contrôles, pesées, pH et fin de chaque lot ; changements de
// mode, réservoir, vérification de la semaine, calibrage, pH-mètre ; dates limites du stock. Une web app iPhone ne
// peut pas programmer de notification seule : c'est le Calendrier qui sonne, même appli fermée (alarme à l'heure).
// Les identifiants (UID) sont stables : réimporter un lot modifié remplace ses anciens rappels (SEQUENCE plus grand).

import { dateLocaleIcs, dateUtcIcs, plier, texteIcs } from '../lib/bocaux';
import { debutPeriode, modePrevu, type ModeOuNettoyage } from './calendrier';
import { mode as modeParId } from './donnees';
import { debutsDesPhases, etatPh, finPrevue, occurrences, reglagesDuLot, type Occurrence } from './lots';
import { transition } from './assistant';
import { VAGUE_CAVE_J, type DatesTaches } from './taches';
import { aHeure, apres, minuit } from './temps';
import type { ArticleStock, Lot } from './types';

export interface EvenementIcs {
  uid: string;
  titre: string;
  debut: Date;
  description?: string;
  /** Règle de répétition (« FREQ=DAILY;INTERVAL=1;COUNT=20 »). */
  rrule?: string;
}

/** Répétition tous les `pas` jours (décimales : en heures), `fois` fois en tout. */
export function regleRepetition(pas: number, fois: number): string {
  return pas < 1
    ? `FREQ=HOURLY;INTERVAL=${Math.round(pas * 24)};COUNT=${fois}`
    : `FREQ=DAILY;INTERVAL=${Math.round(pas)};COUNT=${fois}`;
}

/** Fichier .ics : événements de 15 min, alarme à l'heure, heure locale « flottante » (celle du téléphone). */
export function fichierIcsChambre(evenements: EvenementIcs[], sequence = 0, maintenant = new Date()): string {
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Garde-manger//Chambre//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of evenements) {
    l.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@garde-manger-chambre`,
      `SEQUENCE:${sequence}`,
      `DTSTAMP:${dateUtcIcs(maintenant)}`,
      `DTSTART:${dateLocaleIcs(e.debut)}`,
      `DTEND:${dateLocaleIcs(new Date(e.debut.getTime() + 15 * 60_000))}`,
      ...(e.rrule ? [`RRULE:${e.rrule}`] : []),
      `SUMMARY:${texteIcs(e.titre)}`,
      ...(e.description ? [`DESCRIPTION:${texteIcs(e.description)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${texteIcs(e.titre)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  l.push('END:VCALENDAR');
  return l.map(plier).join('\r\n') + '\r\n';
}

/** Version des rappels d'un lot : augmente à chaque modification (secondes). */
export const sequenceDuLot = (lot: Lot) => Math.floor(lot.modifieLe / 1000);

const PICTOS: Record<Occurrence['type'], string> = { controle: '👀', pesee: '⚖️', ph: '🧪' };

function descriptionControle(o: Occurrence): string {
  const c = o.controle;
  return [`Observer : ${c.observer}`, `Normal : ${c.normal}`, c.probleme ? `Problème : ${c.probleme}` : '', `Que faire : ${c.action}`]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rappels d'un lot à partir de maintenant : un événement par contrôle, pesée et mesure de pH (une seule entrée avec
 * répétition pour un contrôle qui revient), le début de la phase suivante et la fin.
 */
export function evenementsLot(lot: Lot, maintenant: Date | number = Date.now(), heureRappels = 8): EvenementIcs[] {
  // Lot terminé, saucisson à ne pas sécher (pH trop haut à 72 h) ou lacto à jeter : plus de rappels.
  const ph = etatPh(lot);
  if (lot.statut !== 'en-cours' || ph.bloque || ph.jeter) return [];
  const seuil = new Date(maintenant).getTime();
  const res: EvenementIcs[] = [];
  const parSerie = new Map<string, Occurrence[]>();
  for (const o of occurrences(lot, heureRappels)) {
    if (o.coche || o.quand.getTime() <= seuil) continue;
    parSerie.set(o.serie, [...(parSerie.get(o.serie) ?? []), o]);
  }
  for (const [serie, occ] of parSerie) {
    const o = occ[0];
    const pas = o.controle.repeter_j;
    res.push({
      uid: `${lot.id}-${serie}`,
      titre: `${PICTOS[o.type]} ${lot.nom} : ${o.controle.titre}`,
      debut: o.quand,
      description: descriptionControle(o),
      rrule: pas && occ.length > 1 ? regleRepetition(pas, occ.length) : undefined,
    });
  }
  // Réglages de la chambre à changer (dans un mode de la chambre, après le démarrage).
  const entreesReglees = new Set<number>();
  for (const g of reglagesDuLot(lot, heureRappels)) {
    if (g.coche || !g.quand || !g.etape.mode || g.etape.j === 0 || g.quand.getTime() <= seuil) continue;
    if (g.entree) entreesReglees.add(g.phase);
    const m = modeParId(g.etape.mode);
    const ph = g.etape.ihc_phase !== null ? m.ihc_phases[g.etape.ihc_phase] : undefined;
    res.push({
      uid: `${lot.id}-${g.cle}`,
      titre: `⚙️ ${lot.nom} : ${g.etape.titre}`,
      debut: g.quand,
      description: [
        `Mode ${m.nom}${ph ? ` · IHC : HS ${ph.HS} %, DD ${ph.DD} %, AH ${ph.AH} %, AL ${ph.AL} %` : ''}.`,
        ...g.etape.actions,
      ].join('\n'),
    });
  }
  const courte = lot.recette.duree.max_j <= 3;
  const phases = lot.recette.phases ?? [];
  const i = lot.phaseCourante + 1;
  if (phases[i] && !entreesReglees.has(i)) {
    const debut = debutsDesPhases(lot).min[i];
    const quand = courte ? debut : aHeure(debut, heureRappels);
    if (quand.getTime() > seuil)
      res.push({
        uid: `${lot.id}-phase-${i}`,
        titre: `➡️ ${lot.nom} : commencer « ${phases[i].nom} »`,
        debut: quand,
        description: phases[i].mode ? `Passage en mode ${modeParId(phases[i].mode!).nom}.` : undefined,
      });
  }
  const fin = finPrevue(lot).min;
  const quandFin = courte ? fin : aHeure(fin, heureRappels);
  if (quandFin.getTime() > seuil)
    res.push({ uid: `${lot.id}-fin`, titre: `🏁 ${lot.nom} : fin prévue`, debut: quandFin, description: lot.recette.fin.texte });
  return res.sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

// ───── Chambre ─────

interface Periode {
  mode: ModeOuNettoyage;
  debut: Date;
  /** Dernier jour (minuit). */
  fin: Date;
}

/** Périodes du calendrier sur les `jours` prochains jours (la première avec son vrai début, passé). */
export function periodes(maintenant: Date | number, jours = 365): Periode[] {
  const res: Periode[] = [{ mode: modePrevu(maintenant), debut: debutPeriode(maintenant), fin: minuit(maintenant) }];
  let jour = apres(minuit(maintenant), 1);
  for (let k = 0; k < jours; k++) {
    const m = modePrevu(jour);
    const derniere = res.at(-1);
    if (derniere && derniere.mode === m) derniere.fin = jour;
    else res.push({ mode: m, debut: jour, fin: jour });
    jour = apres(jour, 1);
  }
  return res;
}

const joursEntre = (a: Date, b: Date) => Math.round((minuit(b).getTime() - minuit(a).getTime()) / 86_400_000);
const cleJour = (d: Date) => dateLocaleIcs(d).slice(0, 8);

/**
 * Rappels de la chambre sur un an, selon le calendrier : changements de mode, vidages du réservoir au rythme de
 * chaque mode, vérification de la semaine (hors Pause), calibrage annuel, étalonnage mensuel du pH-mètre.
 */
export function evenementsChambre(maintenant: Date | number, heureRappels: number, faites: DatesTaches): EvenementIcs[] {
  const res: EvenementIcs[] = [];
  const auj = minuit(maintenant);
  const ps = periodes(maintenant);
  ps.forEach((p, i) => {
    const debut = aHeure(p.debut, heureRappels);
    const nbJours = joursEntre(p.debut, p.fin) + 1;
    if (i > 0) {
      const precedent = ps[i - 1].mode;
      if (p.mode === 'nettoyage') {
        const suivant = ps[i + 1]?.mode;
        res.push({
          uid: `mode-${cleJour(p.debut)}`,
          titre: `🧽 Chambre : jour de nettoyage${suivant && suivant !== 'nettoyage' ? `, puis mode ${modeParId(suivant).nom}` : ''}`,
          debut,
          description: suivant && suivant !== 'nettoyage' ? transition(precedent === 'nettoyage' ? undefined : precedent, suivant)?.note : undefined,
        });
      } else {
        const avant = precedent === 'nettoyage' ? ps[i - 2]?.mode : precedent;
        res.push({
          uid: `mode-${cleJour(p.debut)}`,
          titre: `🔁 Chambre : passer en mode ${modeParId(p.mode).nom}`,
          debut,
          description: [transition(avant === 'nettoyage' ? undefined : avant, p.mode)?.note, 'Garde-manger › Chambre › Changer de mode : l’assistant te guide.']
            .filter(Boolean)
            .join('\n'),
        });
      }
    }
    if (p.mode === 'nettoyage' || p.mode === 'pause') return;
    const m = modeParId(p.mode);
    // Réservoir : au rythme du mode (Cave : tous les 3 jours pendant 3 semaines, puis chaque semaine).
    const rythme = m.reservoir.tous_les_j;
    if (rythme) {
      const series: [number, number, number][] =
        m.id === 'cave' ? [[rythme, 0, Math.min(nbJours, VAGUE_CAVE_J)], [7, Math.min(nbJours, VAGUE_CAVE_J), nbJours]] : [[rythme, 0, nbJours]];
      for (const [pas, de, a] of series) {
        // Série suivante (Cave, chaque semaine) : dès la fin des 3 premières semaines.
        let premier = apres(debut, de > 0 ? de : pas);
        while (premier < auj) premier = apres(premier, pas);
        const reste = joursEntre(p.debut, premier);
        const fois = Math.floor((a - 1 - reste) / pas) + 1;
        if (fois > 0)
          res.push({
            uid: `reservoir-${cleJour(p.debut)}-${pas}`,
            titre: '💧 Chambre : vider le réservoir du déshumidificateur',
            debut: premier,
            description: m.reservoir.texte,
            rrule: regleRepetition(pas, fois),
          });
      }
    }
    // Vérification de la semaine.
    let premier = apres(debut, 7);
    while (premier < auj) premier = apres(premier, 7);
    const fois = Math.floor((nbJours - 1 - joursEntre(p.debut, premier)) / 7) + 1;
    if (fois > 0)
      res.push({
        uid: `verification-${cleJour(p.debut)}`,
        titre: '🔎 Chambre : vérification de la semaine',
        debut: premier,
        description: 'Courbes dans l’appli INKBIRD, réservoir, glace sur la plaque, ventilateur, bruit du frigo.',
        rrule: regleRepetition(7, fois),
      });
  });
  // Calibrage annuel et étalonnage mensuel du pH-mètre, à partir de la dernière fois.
  const prochain = (derniere: string | undefined, mois: number) => {
    let d = aHeure(derniere ? new Date(derniere) : auj, heureRappels);
    d.setMonth(d.getMonth() + mois);
    while (d < auj) d = new Date(d.setMonth(d.getMonth() + mois));
    return d;
  };
  res.push({
    uid: 'calibrage',
    titre: '🌡️ Chambre : calibrage annuel des sondes',
    debut: prochain(faites.calibrage, 12),
    description: 'ITC : verre de glace pilée, 0 °C. IHC : 24 h avec du gros sel humide, 75 %. Corriger avec CA.',
    rrule: 'FREQ=YEARLY;COUNT=5',
  });
  res.push({
    uid: 'etalonnage-ph',
    titre: '🧪 Chambre : étalonner le pH-mètre',
    debut: prochain(faites['etalonnage-ph'], 1),
    description: 'Tampon 6,86 (ou 7,00), puis 4,00. Sonde rangée humide, avec la solution de conservation.',
    rrule: 'FREQ=MONTHLY;COUNT=12',
  });
  return res.filter((e) => e.debut >= auj).sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

/** Dates limites du stock : 7 jours avant, et le jour même. */
export function evenementsStock(stock: ArticleStock[], maintenant: Date | number, heureRappels: number): EvenementIcs[] {
  const seuil = new Date(maintenant).getTime();
  const res: EvenementIcs[] = [];
  for (const a of stock) {
    if (a.statut !== 'en-stock' || !a.limite) continue;
    const limite = aHeure(new Date(a.limite), heureRappels);
    const avant = apres(limite, -7);
    const conservation = `${a.conservation.mode} ${a.conservation.comment}`;
    if (avant.getTime() > seuil) res.push({ uid: `stock-${a.id}-7j`, titre: `📦 À finir dans 7 jours : ${a.nom}`, debut: avant, description: conservation });
    if (limite.getTime() > seuil) res.push({ uid: `stock-${a.id}`, titre: `📦 Date limite : ${a.nom}`, debut: limite, description: conservation });
  }
  return res.sort((a, b) => a.debut.getTime() - b.debut.getTime());
}
