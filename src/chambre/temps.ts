// Dates de la chambre, en heure locale (Europe/Paris sur l'iPhone de Paul), changements d'heure compris :
// « j » jours après une date = même heure d'horloge j jours plus tard, la partie décimale en heures
// (0,75 = 18 h). Un contrôle prévu à 8 h reste à 8 h après le passage à l'heure d'hiver.

/** Date + j jours (décimales en heures d'horloge). */
export function apres(debut: Date | string | number, j: number): Date {
  const d = new Date(debut);
  const entiers = Math.trunc(j);
  d.setDate(d.getDate() + entiers);
  const minutes = Math.round((j - entiers) * 1440);
  if (minutes) d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** Même jour, à l'heure dite (8 h par défaut pour les contrôles sans heure précise). */
export function aHeure(d: Date, heure: number, minutes = 0): Date {
  const r = new Date(d);
  r.setHours(heure, minutes, 0, 0);
  return r;
}

export function minuit(d: Date | string | number): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Jours de calendrier entre deux dates (le 15 à 23 h → le 16 à 1 h = 1 jour). */
export function joursCalendaires(de: Date | string | number, a: Date | string | number): number {
  const x = minuit(de);
  const y = minuit(a);
  return Math.round((y.getTime() - x.getTime()) / 86_400_000);
}

export function memeJour(a: Date | string | number, b: Date | string | number): boolean {
  return joursCalendaires(a, b) === 0;
}

/** Heures écoulées (vraies heures). */
export function heuresEntre(de: Date | string | number, a: Date | string | number): number {
  return (new Date(a).getTime() - new Date(de).getTime()) / 3_600_000;
}

/** Valeur pour un champ <input type="datetime-local"> (heure locale). */
export function versChampDateHeure(d: Date | string | number): string {
  const x = new Date(d);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`;
}

/** « 2026-10-15T18:00 » (heure locale) → Date. */
export function depuisChampDateHeure(v: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}
