// Mise en forme à la française : nombres (« 0,5 »), dates (« 30 sept. 2026 »), durées (« 1 h 20 »).

const formateurs = new Map<number, Intl.NumberFormat>();

/** 0.5 → « 0,5 » ; 1200 → « 1 200 ». */
export function nombre(valeur: number, decimalesMax = 2): string {
  let f = formateurs.get(decimalesMax);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimalesMax, useGrouping: true });
    formateurs.set(decimalesMax, f);
  }
  // Espace fine insécable → espace insécable classique (meilleur rendu iOS).
  return f.format(valeur).replace(/ /g, ' ');
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « 30 sept. 2026 » */
export function date(d: Date | string | number): string {
  return fmtDate.format(new Date(d));
}

/** « 30 sept. » */
export function dateCourte(d: Date | string | number): string {
  return fmtDateCourte.format(new Date(d));
}

/** « 14:05 » */
export function heure(d: Date | string | number): string {
  return fmtHeure.format(new Date(d));
}

/** 80 → « 1 h 20 » ; 45 → « 45 min » ; 1500 → « 1 j 1 h ». */
export function duree(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const jours = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const reste = m % 60;
  if (jours > 0) return h ? `${jours} j ${h} h` : `${jours} j`;
  return reste ? `${h} h ${String(reste).padStart(2, '0')}` : `${h} h`;
}

/** Durée de fermentation en jours : « 5 à 7 jours », « 1 jour », « 10 semaines ». */
export function dureeJours(min: number, max = min): string {
  const txt = (j: number) => nombre(j, 1);
  if (min === max) {
    if (min >= 14 && min % 7 === 0) return `${min / 7} semaines`;
    return `${txt(min)} ${min > 1 ? 'jours' : 'jour'}`;
  }
  return `${txt(min)} à ${txt(max)} jours`;
}

/** Accord simple : pluriel(3, 'fiche') → « 3 fiches ». */
export function pluriel(n: number, mot: string, motPluriel = mot + 's'): string {
  return `${nombre(n, 0)} ${Math.abs(n) >= 2 ? motPluriel : mot}`;
}
