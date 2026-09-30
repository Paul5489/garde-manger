// Petites préférences gardées dans le navigateur (jamais indispensables : tout est protégé par try/catch).

const PREFIXE = 'garde-manger:';

export function lireLocal<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

export function ecrireLocal(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible (navigation privée…) : sans conséquence */
  }
}
