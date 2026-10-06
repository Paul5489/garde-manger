// Format d'une fiche de l'archive (voir archive-recettes/schema/fiche.schema.json).
// Les champs vides sont omis dans l'archive : tout est optionnel sauf l'essentiel.

export type TypeFiche = 'recette' | 'technique' | 'chapitre' | 'annexe';
export type SourceId = 'marc-winer' | 'afpa' | 'cuisine-de-reference' | 'noma' | 'notes-perso' | 'perso';

export interface Duree {
  texte: string;
  minutes?: number;
  minutes_min?: number;
  minutes_max?: number;
}

export interface Ingredient {
  nom: string;
  quantite?: number;
  quantite_min?: number;
  quantite_max?: number;
  unite?: string;
  texte_original?: string;
  pour_memoire?: boolean;
  optionnel?: boolean;
  alternative_du_precedent?: boolean;
  remarque?: string;
}

export interface GroupeIngredients {
  groupe?: string;
  items?: Ingredient[];
}

export interface TableauDenrees {
  titre?: string;
  ingredients?: GroupeIngredients[];
}

export interface Etape {
  numero?: number;
  texte: string;
  texte_original?: string;
  phase?: string;
  duree?: Duree;
  details?: string[];
  renvois_pages?: string[];
  type?: string;
}

export interface TitreTexte {
  titre?: string;
  texte?: string;
}

export interface EtapeFermentation {
  nom?: string;
  temperature_c?: number;
  duree_min_jours?: number;
  duree_max_jours?: number;
  duree_min_heures?: number;
  duree_max_heures?: number;
}

export interface Fermentation {
  type?: string;
  sel_pct?: number;
  sel_texte?: string;
  temperature_c?: number;
  humidite_pct?: string;
  duree_min_jours?: number;
  duree_max_jours?: number;
  duree_min_heures?: number;
  duree_max_heures?: number;
  duree_texte?: string;
  controle?: string;
  conservation?: string;
  ensemencement?: string;
  brix_depart?: number;
  etapes?: EtapeFermentation[];
}

export interface GroupeMateriel {
  type?: string;
  elements?: string[];
}

export interface Fiche {
  id: string;
  type: TypeFiche;
  titre: string;
  titre_original?: string;
  langue?: string;
  source: {
    id: SourceId;
    nom: string;
    auteur?: string;
    editeur?: string;
    type?: string;
    fichier?: string;
    url?: string;
    pages?: number[];
    fiche_n?: string;
    licence?: string;
  };
  classement?: {
    categorie?: string;
    sous_categorie?: string;
    cuisine?: string[];
    type_de_plat?: string[];
    famille?: string;
    famille_technique?: string;
    poste?: string;
    partie?: string;
    chemin?: string[];
  };
  description?: string;
  portions?: { nombre?: number; unite?: string; texte?: string };
  rendement?: string;
  calories?: string;
  temps?: Record<string, Duree>;
  ingredients?: GroupeIngredients[];
  ingredients_supplementaires?: TableauDenrees[];
  etapes?: Etape[];
  techniques_mises_en_oeuvre?: string[];
  materiel?: (string | GroupeMateriel)[];
  notes?: string[];
  variantes?: TitreTexte[];
  utilisations?: TitreTexte[];
  preparations_de_base?: TableauDenrees[];
  sections?: TitreTexte[];
  recettes_du_chapitre?: string[];
  texte_complet?: string;
  fermentation?: Fermentation;
  tableau_brix_alcool?: { baisse_brix: number; alcool_pct: number }[];
  extraction?: { methode?: string; avertissements?: string[]; remarque?: string };
  /** Présent dans l'archive mais jamais conservé dans l'application (texte anglais). */
  version_originale?: unknown;
  // ───── Mes recettes (source « perso ») ─────
  /** Texte collé à l'origine, gardé pour référence. */
  texte_source?: string;
  creeLe?: number;
  modifieLe?: number;
  /** Fiche AFPA complétée par La Cuisine de référence (calculé à l'ouverture, voir methode-livre.ts). */
  methode_livre?: MethodeLivre;
}

export interface MethodeLivre {
  /** Fiche du livre d'où viennent les explications. */
  id: string;
  titre: string;
  /** même plat, plat proche, ou préparation de base expliquée dans une fiche technique (simple lien). */
  lien: 'meme' | 'proche' | 'technique';
  /** Nombre de couverts du livre (« 8 couverts ») : les quantités citées dans le détail sont les siennes. */
  portions?: string;
  /** Étapes AFPA d'origine. */
  plan?: Etape[];
}

export type Univers = 'asiatique' | 'francaise' | 'techniques' | 'fermentation' | 'perso';

/** Version légère d'une fiche, gardée en mémoire pour les listes et les filtres. */
export interface Resume {
  id: string;
  type: TypeFiche;
  titre: string;
  source: SourceId;
  categorie?: string;
  cuisines: string[];
  typesDePlat: string[];
  univers: Univers[];
  /** Temps total estimé (minutes), hors fermentation. */
  minutes?: number;
  /** Fermentation : durée en jours (min / max). */
  fermentationJours?: [number, number];
  portions?: string;
  rendement?: string;
  nbIngredients: number;
  /** Pages du livre (Cuisine de référence, fiches non-recettes) pour résoudre les renvois. */
  pages?: number[];
}

export interface InfosArchive {
  genereLe?: string;
  nbFiches: number;
  importeLe: string;
  nomFichier?: string;
  ignorees: number;
  /** Pages « hors cuisine » écartées (auteurs, hygiène, diplômes…), voir exclusions.ts. */
  ecartees?: number;
}
