// Mes recettes : recettes ajoutées par Paul (copiées-collées depuis Internet ou tapées), au même format que
// les fiches de l'archive. Le texte collé est analysé dans le téléphone (hors ligne, sans service extérieur),
// puis présenté dans un formulaire pour vérifier et corriger avant d'enregistrer.

import { trouverDurees } from './durees';
import { estFormatPro, ligneIngredient, lireNombre, mentionneFacultatif } from './quantites';
import { majuscule, normaliser } from './texte';
import type { Duree, Etape, Fiche, GroupeIngredients, Ingredient } from './types';

/** Contenu du formulaire (tout en texte, facile à corriger sur l'iPhone). */
export interface Brouillon {
  titre: string;
  description: string;
  categorie: string;
  typeDePlat: string;
  cuisine: string;
  portions: string;
  unitePortions: string;
  rendement: string;
  preparation: string;
  cuisson: string;
  repos: string;
  /** Une ligne par ingrédient ; une ligne finissant par « : » ouvre un groupe (« Pour la sauce : »). */
  ingredients: string;
  /** Une étape par ligne ; « Titre : texte » donne un titre à l'étape. */
  etapes: string;
  notes: string;
  texteSource?: string;
}

export const brouillonVide = (): Brouillon => ({
  titre: '',
  description: '',
  categorie: '',
  typeDePlat: '',
  cuisine: '',
  portions: '',
  unitePortions: 'personnes',
  rendement: '',
  preparation: '',
  cuisson: '',
  repos: '',
  ingredients: '',
  etapes: '',
  notes: '',
});

export const TYPES_DE_PLAT = [
  'Entrée',
  'Plat principal',
  'Accompagnement',
  'Dessert',
  'Boisson',
  'Sauce',
  'Soupes et bouillons',
  'Salade',
  'Condiment',
  'Fermentation',
  'Pâtisserie',
] as const;

// ───── Lecture d'une ligne d'ingrédient ─────

const MOTS_NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12,
};

/** Unités reconnues (formes écrites → unité de la fiche). L'ordre compte : les plus longues d'abord. */
const UNITES: [RegExp, string, number?][] = [
  [/^cuill[eè]res?\s+(?:à|a)\s+soupe|^c\.?\s*(?:à|a)\s*soupe|^c\.?\s*(?:à|a)\s*s\.?|^c\.?\s*s\.?(?=\s)|^càs/i, 'cuillère à soupe'],
  [/^cuill[eè]res?\s+(?:à|a)\s+caf[ée]|^c\.?\s*(?:à|a)\s*caf[ée]|^c\.?\s*(?:à|a)\s*c\.?|^c\.?\s*c\.?(?=\s)|^càc/i, 'cuillère à café'],
  [/^kilogrammes?|^kgs?/i, 'kg'],
  [/^grammes?|^gr?\.?(?=\s|$|['’])/i, 'g'],
  [/^millilitres?|^ml/i, 'ml'],
  [/^centilitres?|^cl/i, 'cl'],
  [/^d[ée]cilitres?|^dl/i, 'cl', 10],
  [/^litres?|^l(?=\s|$|['’])/i, 'l'],
  [/^pinc[ée]es?/i, 'pincée'],
  [/^gousses?/i, 'gousse'],
  [/^feuilles?/i, 'feuille'],
  [/^b[aâ]tons?/i, 'bâton'],
  [/^branches?/i, 'branche'],
  [/^brins?/i, 'brin'],
  [/^tiges?/i, 'tige'],
  [/^tranches?/i, 'tranche'],
  [/^sachets?/i, 'sachet'],
  [/^bo[iî]tes?/i, 'boîte'],
  [/^pots?(?=\s|$)/i, 'pot'],
  [/^verres?/i, 'verre'],
  [/^tasses?/i, 'tasse'],
  [/^bols?(?=\s|$)/i, 'bol'],
  [/^poign[ée]es?/i, 'poignée'],
  [/^morceaux?/i, 'morceau'],
  [/^pi[eè]ces?/i, 'pièce'],
  [/^bottes?/i, 'botte'],
  [/^bouquets?/i, 'bouquet'],
  [/^zestes?/i, 'zeste'],
  [/^traits?/i, 'trait'],
  [/^gouttes?/i, 'goutte'],
  [/^cubes?/i, 'cube'],
  [/^t[eê]tes?/i, 'tête'],
  [/^cm(?=\s|$)/i, 'cm'],
];

const MOTS = Object.keys(MOTS_NOMBRES).sort((x, y) => y.length - x.length).join('|');
const QUANTITE = String.raw`(\d+(?:[.,]\d+)?(?:\s+\d+\s*/\s*\d+)?|\d+\s*/\s*\d+|[½¼¾⅓⅔]|(?:${MOTS})(?=\s))`;
const DEBUT = new RegExp(String.raw`^${QUANTITE}(?:\s*(?:à|a|-|–|ou)\s*${QUANTITE})?\s*`, 'i');

function valeur(t: string): number | undefined {
  const mot = MOTS_NOMBRES[t.toLowerCase()];
  if (mot !== undefined) return mot;
  const mixte = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixte) return Number(mixte[1]) + Number(mixte[2]) / Number(mixte[3]);
  return lireNombre(t.replace(/\s+/g, ''));
}

/** « 50 g de fleurs d'hibiscus séchées » → quantité 50, unité g, nom « fleurs d'hibiscus séchées ». */
export function lireLigneIngredient(ligne: string): Ingredient {
  const texte = ligne.replace(/\s+/g, ' ').trim();
  const item: Ingredient = { nom: texte, texte_original: texte };
  if (/facultati|optionnel/i.test(texte)) item.optionnel = true;
  const pourMemoire = /\(\s*pm\s*\)|\bpm$|pour m[ée]moire/i.test(texte);
  const m = texte.match(DEBUT);
  let reste = texte;
  if (m) {
    const v1 = valeur(m[1]);
    const v2 = m[2] ? valeur(m[2]) : undefined;
    // « Une pincée », « deux oignons » : le mot-nombre doit être suivi d'une espace.
    const motNombre = /^\p{L}/u.test(m[1]);
    if (v1 !== undefined && (!motNombre || /\s/.test(texte.charAt(m[1].length)))) {
      reste = texte.slice(m[0].length);
      if (v2 !== undefined) {
        item.quantite_min = v1;
        item.quantite_max = v2;
      }
      item.quantite = v1;
      for (const [motif, unite, facteur] of UNITES) {
        const u = reste.match(motif);
        if (u) {
          item.unite = unite;
          if (facteur) {
            item.quantite = v1 * facteur;
            if (item.quantite_min !== undefined) item.quantite_min *= facteur;
            if (item.quantite_max !== undefined) item.quantite_max *= facteur;
          }
          reste = reste.slice(u[0].length).replace(/^\s*\.\s*/, ' ').trim();
          break;
        }
      }
    }
  }
  const nom = reste
    .replace(/^(de |d['’]|des )/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  item.nom = nom.replace(/\s+pm$/i, '') || texte;
  if (pourMemoire && item.quantite === undefined) item.pour_memoire = true;
  return item;
}

// ───── Analyse d'un texte collé ─────

const PUCES = /^[•·▪▫◦●○■□☐▢✓✔➤►\-–—*]+\s*/;
const TITRE_INGREDIENTS = /^(liste des )?ingr[ée]dients?\b|^il (vous )?faut\b|^pour (\d+|la recette)/i;
const TITRE_ETAPES = /^(pr[ée]paration|[ée]tapes?|instructions?|m[ée]thode|d[ée]roulement|r[ée]alisation|recette|la recette|proc[ée]d[ée])\b/i;
const TITRE_NOTES = /^(notes?|astuces?|conseils?|remarques?|variantes?|bon à savoir|le conseil|à savoir)\b/i;
const LIGNE_TEMPS = /^(temps (de |d['’])?)?(pr[ée]paration|cuisson|repos|r[ée]frig[ée]ration|marinade)\s*:?\s*(.*)$/i;

function estTitreDeSection(l: string, motif: RegExp): boolean {
  return l.length <= 70 && motif.test(l);
}

/** Une ligne ressemble-t-elle à un ingrédient (« 2 oignons », « sel », « Le jus d'un citron ») ? */
export function ressembleIngredient(l: string): boolean {
  if (l.length > 90) return false;
  if (DEBUT.test(l) && !/^\d+\s*[.)]\s/.test(l)) return true;
  if (/^(le |la |les |l['’]|du |de la |des |un peu de |quelques )?(jus|zeste|sel|poivre|huile|sucre|beurre|farine|eau|lait|crème|oeuf|œuf|herbes?|épices?)\b/i.test(l))
    return true;
  return l.length <= 45 && !/[.!?]$/.test(l) && l.split(' ').length <= 7;
}

function nettoyerEtape(l: string): string {
  return l.replace(/^(étape\s*)?\d+\s*[.):–-]\s*/i, '').trim();
}

export function analyserTexte(texte: string): Brouillon {
  const b = brouillonVide();
  b.texteSource = texte.trim();
  const lignes = texte
    .replace(/ /g, ' ')
    .split(/\r?\n/)
    .map((l) => l.replace(PUCES, '').replace(/\s+/g, ' ').trim());

  const ingredients: string[] = [];
  const etapes: string[] = [];
  const notes: string[] = [];
  const description: string[] = [];
  let mode: 'debut' | 'ingredients' | 'etapes' | 'notes' = 'debut';

  for (const l of lignes) {
    if (!l) continue;

    // Temps (« Préparation : 20 min ») et portions (« Pour 4 personnes »)
    const t = l.match(LIGNE_TEMPS);
    if (t && l.length <= 60 && trouverDurees(t[4] || l).length) {
      const quoi = normaliser(t[3]);
      const valeurTemps = t[4] || l;
      if (quoi.startsWith('prep')) b.preparation = valeurTemps;
      else if (quoi.startsWith('cuis')) b.cuisson = valeurTemps;
      else b.repos = valeurTemps;
      continue;
    }
    const p = l.match(/\bpour\s+(\d+)\s*(personnes?|pers\.?|portions?|parts?|couverts?|verres?|bocaux|pots?)\b/i);
    if (p && l.length <= 60 && !b.portions) {
      b.portions = p[1];
      b.unitePortions = p[2].replace(/^pers\.?$/i, 'personnes').toLowerCase();
      if (TITRE_INGREDIENTS.test(l)) mode = 'ingredients';
      continue;
    }

    if (estTitreDeSection(l, TITRE_INGREDIENTS)) {
      mode = 'ingredients';
      continue;
    }
    if (estTitreDeSection(l, TITRE_NOTES)) {
      mode = 'notes';
      continue;
    }
    if (estTitreDeSection(l, TITRE_ETAPES) && !(mode === 'etapes' && l.length > 40)) {
      // « Recette du bissap à l'ananas : préparation simple » → titre si on n'en a pas encore.
      const r = l.match(/^(?:la )?recette (?:du |de la |des |de l['’]|d['’]|de )?(.+?)(?:\s*:.*)?$/i);
      if (r && !b.titre) b.titre = majuscule(r[1].trim());
      mode = 'etapes';
      continue;
    }

    if (mode === 'debut') {
      if (ressembleIngredient(l) && DEBUT.test(l)) {
        mode = 'ingredients';
        ingredients.push(l);
      } else if (!b.titre && l.length <= 80 && !/[.!?:]$/.test(l)) b.titre = l;
      else description.push(l);
    } else if (mode === 'ingredients') {
      if (/:$/.test(l) && l.length <= 50) ingredients.push(l);
      else if (ressembleIngredient(l)) ingredients.push(l);
      else if (/^(voici|cette|ce |c['’]est)\b/i.test(l) || /:$/.test(l)) description.push(l);
      else {
        mode = 'etapes';
        etapes.push(nettoyerEtape(l));
      }
    } else if (mode === 'etapes') {
      if (/^(voici|cette recette|ce plat)\b/i.test(l) && /:$/.test(l)) description.push(l.replace(/\s*:$/, '.'));
      else etapes.push(nettoyerEtape(l));
    } else notes.push(l);
  }

  b.description = description.join(' ').replace(/\s*:$/, '.');
  b.ingredients = ingredients.join('\n');
  b.etapes = etapes.filter(Boolean).join('\n');
  b.notes = notes.join('\n');
  return b;
}

// ───── Brouillon ↔ fiche ─────

function duree(texte: string): Duree | undefined {
  const t = texte.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return { texte: `${t} min`, minutes: Number(t) };
  const d = trouverDurees(t)[0];
  if (!d) return { texte: t };
  const min = Math.round(d.min / 60);
  const max = Math.round(d.max / 60);
  return min === max ? { texte: t, minutes: min } : { texte: t, minutes_min: min, minutes_max: max };
}

function slug(t: string): string {
  return (
    normaliser(t)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'recette'
  );
}

export function nouvelIdRecette(titre: string): string {
  return `perso-${slug(titre)}-${Math.random().toString(36).slice(2, 7)}`;
}

function lignes(t: string): string[] {
  return t
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Phase d'étape utile (les en-têtes de colonne du livre, « DURÉE MOYENNE… », n'en sont pas). */
function phaseUtile(p?: string): string | null {
  const t = p?.trim();
  return t && !/^DUR[ÉE]E/i.test(t) ? t : null;
}

/** Ligne d'ingrédient lisible et modifiable (« 40 g beurre », « Sel fin (PM) », ligne d'origine pour les blogs). */
function ligneEditable(item: Ingredient, source: string): string {
  let ligne: string;
  if (estFormatPro(source)) {
    const l = ligneIngredient(item, source);
    const nom = (item.nom ?? '').replace(/\s*:\s*$/, '').trim();
    ligne = l.pm ? `${nom} (PM)` : l.quantite ? `${l.quantite} ${nom}` : nom;
  } else ligne = (item.texte_original ?? item.nom ?? '').replace(/\s*:\s*$/, '').trim();
  if (item.optionnel && !mentionneFacultatif(ligne)) ligne += ' (facultatif)';
  return `${item.alternative_du_precedent ? 'ou ' : ''}${ligne.replace(/\s+/g, ' ')}`;
}

/** Remet une fiche (perso ou de l'archive) dans le formulaire, pour la modifier. */
export function ficheVersBrouillon(f: Fiche): Brouillon {
  const b = brouillonVide();
  b.titre = f.titre;
  b.description = f.description ?? '';
  b.categorie = f.classement?.categorie ?? '';
  b.typeDePlat = f.classement?.type_de_plat?.[0] ?? '';
  b.cuisine = (f.classement?.cuisine ?? []).join(', ');
  b.portions = f.portions?.nombre ? String(f.portions.nombre).replace('.', ',') : '';
  b.unitePortions = f.portions?.unite ?? 'personnes';
  b.rendement = f.rendement ?? '';
  b.preparation = f.temps?.preparation?.texte ?? '';
  b.cuisson = f.temps?.cuisson?.texte ?? '';
  b.repos = f.temps?.repos?.texte ?? '';
  b.ingredients = (f.ingredients ?? [])
    .flatMap((g) => [...(g.groupe?.trim() ? [`${g.groupe.trim()} :`] : []), ...(g.items ?? []).map((i) => ligneEditable(i, f.source.id))])
    .join('\n');
  b.etapes = (f.etapes ?? [])
    .flatMap((e) => {
      const phase = phaseUtile(e.phase);
      return [phase ? `${phase} : ${e.texte}` : e.texte, ...(e.details ?? []).map((d) => `- ${d}`)];
    })
    .join('\n');
  b.notes = (f.notes ?? []).join('\n');
  b.texteSource = f.texte_source;
  return b;
}

function lireIngredients(texte: string): GroupeIngredients[] {
  const groupes: GroupeIngredients[] = [];
  let courant: GroupeIngredients = { items: [] };
  for (const l of lignes(texte)) {
    if (/:$/.test(l)) {
      if (courant.items!.length || courant.groupe) groupes.push(courant);
      courant = { groupe: majuscule(l.replace(/\s*:$/, '').replace(/^pour (le |la |les |l['’])?/i, '')), items: [] };
      continue;
    }
    const alternative = /^ou\s+/i.test(l);
    const item = lireLigneIngredient(l.replace(/^ou\s+/i, ''));
    if (alternative && courant.items!.length) item.alternative_du_precedent = true;
    courant.items!.push(item);
  }
  if (courant.items!.length || courant.groupe) groupes.push(courant);
  return groupes;
}

/**
 * Étapes : une par ligne ; « Titre : texte » donne un titre ; une ligne commençant par « - » est un détail de
 * l'étape précédente. Durée et renvois de pages d'une étape dont le texte n'a pas changé sont gardés.
 */
function lireEtapes(texte: string, anciennes: Etape[] = []): Etape[] {
  const parTexte = new Map(anciennes.map((e) => [normaliser(e.texte).trim(), e]));
  const etapes: Etape[] = [];
  for (const l of lignes(texte)) {
    const detail = l.match(/^[-–•]\s*(.+)$/);
    if (detail && etapes.length) {
      (etapes[etapes.length - 1].details ??= []).push(detail[1].trim());
      continue;
    }
    const e: Etape = { numero: etapes.length + 1, texte: l };
    const m = l.match(/^([^:]{3,45})\s*:\s+(.{20,})$/);
    if (m && !/\d$/.test(m[1])) {
      e.phase = majuscule(m[1].trim());
      e.texte = majuscule(m[2].trim());
    }
    const ancienne = parTexte.get(normaliser(e.texte).trim());
    if (ancienne?.duree) e.duree = ancienne.duree;
    if (ancienne?.renvois_pages) e.renvois_pages = ancienne.renvois_pages;
    etapes.push(e);
  }
  return etapes;
}

/**
 * Construit la fiche à enregistrer à partir du formulaire. Avec une fiche de base (modification d'une recette
 * perso ou de l'archive, recette lue par Claude), tout ce que le formulaire ne montre pas est gardé (source,
 * classement, fermentation, matériel, texte du livre…) et seuls les champs retouchés changent : les ingrédients
 * et les étapes non retouchés sont repris tels quels.
 */
export function construireFiche(b: Brouillon, existante?: Fiche): Fiche {
  const maintenant = Date.now();
  const depart = existante ? ficheVersBrouillon(existante) : brouillonVide();
  const change = (champ: keyof Brouillon) => !existante || (b[champ] ?? '') !== (depart[champ] ?? '');
  const titre = b.titre.trim() || 'Recette sans titre';

  const f: Fiche = existante
    ? (JSON.parse(JSON.stringify(existante)) as Fiche)
    : {
        id: nouvelIdRecette(titre),
        type: 'recette',
        titre,
        langue: 'fr',
        source: { id: 'perso', nom: 'Mes recettes' },
        creeLe: maintenant,
      };
  f.titre = titre;
  f.modifieLe = maintenant;
  if (!existante?.source || existante.source.id === 'perso') f.creeLe ??= maintenant;

  const c = (f.classement = { ...(f.classement ?? {}) });
  if (change('categorie')) {
    if (b.categorie.trim()) c.categorie = majuscule(b.categorie.trim());
    else delete c.categorie;
  }
  if (change('typeDePlat')) {
    if (b.typeDePlat.trim()) c.type_de_plat = [majuscule(b.typeDePlat.trim())];
    else delete c.type_de_plat;
  }
  if (change('cuisine')) {
    const liste = b.cuisine.split(',').map((x) => majuscule(x.trim())).filter(Boolean);
    if (liste.length) c.cuisine = liste;
    else delete c.cuisine;
  }
  if (!Object.keys(c).length) delete f.classement;

  if (change('description')) {
    if (b.description.trim()) f.description = b.description.trim();
    else delete f.description;
  }
  if (change('portions') || change('unitePortions')) {
    const n = lireNombre(b.portions.trim());
    if (n && n > 0) {
      const unite = b.unitePortions.trim() || 'personnes';
      f.portions = { nombre: n, unite, texte: `${b.portions.trim()} ${unite}` };
    } else delete f.portions;
  }
  if (change('rendement')) {
    if (b.rendement.trim()) f.rendement = b.rendement.trim();
    else delete f.rendement;
  }

  const temps: Record<string, Duree> = { ...(f.temps ?? {}) };
  let tempsChange = false;
  for (const [cle, champ] of [
    ['preparation', 'preparation'],
    ['cuisson', 'cuisson'],
    ['repos', 'repos'],
  ] as const) {
    if (!change(champ)) continue;
    tempsChange = true;
    const d = duree(b[champ]);
    if (d) temps[cle] = d;
    else delete temps[cle];
  }
  // Le temps total imprimé ne correspond plus si on change la préparation ou la cuisson.
  if (tempsChange && existante) delete temps.total;
  if (Object.keys(temps).length) f.temps = temps;
  else delete f.temps;

  if (change('ingredients')) {
    const groupes = lireIngredients(b.ingredients);
    if (groupes.length) f.ingredients = groupes;
    else delete f.ingredients;
  }
  if (change('etapes')) {
    const etapes = lireEtapes(b.etapes, existante?.etapes);
    if (etapes.length) f.etapes = etapes;
    else delete f.etapes;
  }
  if (change('notes')) {
    const notes = lignes(b.notes);
    if (notes.length) f.notes = notes;
    else delete f.notes;
  }
  if (b.texteSource?.trim()) f.texte_source = b.texteSource.trim();
  return f;
}
