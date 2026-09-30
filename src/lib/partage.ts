// Menu Partager de l'iPhone (texte ou fichier), avec repli sur copier / télécharger.

export type ResultatPartage = 'partage' | 'copie' | 'telecharge' | 'annule';

function estAnnulation(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/** Partage un texte (Messages, Notes, Mail…) ; sinon le copie dans le presse-papiers. */
export async function partagerTexte(titre: string, texte: string): Promise<ResultatPartage> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte });
      return 'partage';
    } catch (e) {
      if (estAnnulation(e)) return 'annule';
    }
  }
  await navigator.clipboard.writeText(texte);
  return 'copie';
}

/**
 * Enregistre un fichier : menu Partager (« Enregistrer dans Fichiers », AirDrop…) sur l'iPhone,
 * téléchargement classique ailleurs. À appeler directement depuis un toucher (exigence d'iOS).
 */
export async function enregistrerFichier(fichier: File): Promise<ResultatPartage> {
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
      return 'partage';
    } catch (e) {
      if (estAnnulation(e)) return 'annule';
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = fichier.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'telecharge';
}

/**
 * Ouvre des rappels .ics : sur iPhone, iOS propose « Ajouter au calendrier ».
 * (Même principe qu'un lien vers un fichier .ics : le navigateur le passe au Calendrier.)
 */
export function ouvrirCalendrier(ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
