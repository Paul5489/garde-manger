// Pastille de l'onglet Chambre et de l'icône de l'appli (Badging API) : le nombre de choses à faire aujourd'hui.
// Sur iPhone, la pastille de l'icône ne marche que dans l'appli installée, notifications autorisées (aucune n'est
// envoyée : il n'y a pas de serveur).

class Pastilles {
  /** Actions du jour de la chambre (tâches, contrôles des lots…), calculées par le module Chambre une fois chargé. */
  chambre = $state(0);
}

export const pastilles = new Pastilles();

export type EtatPastille = 'active' | 'a-demander' | 'refusee' | 'impossible';

type NavigateurPastille = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function etatPastille(): EtatPastille {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator) || typeof Notification === 'undefined') return 'impossible';
  if (Notification.permission === 'granted') return 'active';
  return Notification.permission === 'denied' ? 'refusee' : 'a-demander';
}

/** À appeler depuis un toucher : l'iPhone demande d'autoriser les notifications. */
export async function demanderPastille(): Promise<EtatPastille> {
  try {
    if (typeof Notification !== 'undefined') await Notification.requestPermission();
  } catch {
    /* refusé ou impossible : l'état le dit */
  }
  return etatPastille();
}

export function afficherSurIcone(n: number): void {
  const nav = (typeof navigator === 'undefined' ? undefined : navigator) as NavigateurPastille | undefined;
  try {
    if (n > 0) nav?.setAppBadge?.(n).catch(() => {});
    else nav?.clearAppBadge?.().catch(() => {});
  } catch {
    /* pas de pastille sur ce navigateur */
  }
}
