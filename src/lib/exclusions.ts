// Pages de l'archive sans rapport direct avec la cuisine, écartées à la demande de Paul (06/10/2026) :
// auteurs, préfaces et remerciements, hygiène et sécurité, diplômes (BEP/CAP), bibliographie, fournisseurs,
// sommaires du livre. On garde les recettes, les techniques et les explications sur les produits
// (légumes, poissons, viandes, matériel de fermentation, vocabulaire de cuisine).
//
// L'appli publiée ne doit contenir aucun identifiant de fiche en clair (vérification anti-recettes) :
// on garde une empreinte courte de chacun (FNV-1a 32 bits), l'identifiant étant noté en commentaire.

const EXCLUES = new Set([
  '84b2ece1', // cr-preface-et-remerciements-de-l-auteur
  '2a494c9c', // cr-generalites (hygiène, sécurité, tenue professionnelle, organisation du poste)
  '7a56f745', // cr-documents-d-evaluations-bep-et-cap
  'f279bf7c', // cr-referentiel-des-techniques-et-preparations-de-base (sommaire pour le diplôme)
  '2e22bfa3', // cr-repertoire-des-fiches-techniques-de-fabrication (sommaire)
  '17ae89be', // cr-bibliographie
  'fda8caa0', // cr-categorie-hygiene-et-securite-des-aliments
  // Les 6 pages hors cuisine du Noma (pages de garde, introduction, à propos, fournisseurs, remerciements,
  // auteurs) sont écartées avec tout le Noma de l'archive : voir estAncienneFermentation.
]);

/** Empreinte FNV-1a 32 bits d'un identifiant, en hexadécimal (8 caractères). */
export function empreinte(id: string): string {
  let h = 0x811c9dc5;
  for (const octet of new TextEncoder().encode(id)) {
    h ^= octet;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Cette fiche fait-elle partie des pages « hors cuisine » écartées ? */
export function estExclue(id: string): boolean {
  return EXCLUES.has(empreinte(id));
}

export const NOMBRE_EXCLUES = EXCLUES.size;

/**
 * Fiches Noma de l'archive (70, ids « noma-… ») : remplacées à la demande de Paul (06/10/2026) par les fiches
 * de fermentation Noma + Koji Alchemy résumées en français, ajoutées par fichier dans « mesRecettes » (ids « ferm-… »).
 */
export function estAncienneFermentation(id: string): boolean {
  return id.startsWith('noma-');
}

/** Fiche de l'archive à ne pas montrer : page hors cuisine ou ancienne fiche Noma. */
export function estRetiree(id: string): boolean {
  return estAncienneFermentation(id) || estExclue(id);
}
