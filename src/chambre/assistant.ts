// Assistant « Changer de mode » : la suite des écrans, d'après changement_de_mode, transitions, guide_itc
// et guide_ihc (modes.json). Un écran par code de contrôleur, avec la touche à presser et la valeur à atteindre.

import { NOMS_PRISES, refroidirAvant, texteBranchement, valeurCode, VITESSES } from './affichage';
import { CONTENU } from './donnees';
import { CODES_IHC, CODES_ITC, PRISES, type CodeIhc, type CodeItc, type Mode } from './types';

export interface EtapeTexte {
  type: 'texte';
  titre: string;
  textes: string[];
  /** À cocher (branchements…). */
  cases?: string[];
  /** Encadré : pourquoi, mise en garde. */
  note?: string;
  pourquoi?: string[];
}

export interface EtapeCode {
  type: 'code';
  appareil: 'itc' | 'ihc';
  titre: string;
  code: CodeItc | CodeIhc;
  valeur: number | string;
  /** Valeur du mode précédent, si elle change. */
  avant?: number | string;
  /** Même valeur que dans le mode précédent. */
  inchange: boolean;
  /** Touches à presser. */
  consigne: string;
  note?: string;
}

export type EtapeAssistant = EtapeTexte | EtapeCode;

const M = CONTENU.modes;
const regle = (debut: string) => M.menager_le_materiel.find((r) => r.regle.startsWith(debut));

export function transition(de: string | undefined, vers: string) {
  return M.transitions.find((t) => t.de === de && t.vers === vers);
}

const NOMS_NETTOYAGE = { leger: 'Nettoyage léger', moyen: 'Nettoyage moyen', grand: 'Grand nettoyage' } as const;

export function etapesAssistant(de: Mode | undefined, vers: Mode, miseEnServiceFaite = true): EtapeAssistant[] {
  const e: EtapeAssistant[] = [];
  const cm = M.changement_de_mode;

  e.push({ type: 'texte', titre: 'Débrancher et vider la chambre', textes: [cm[0]] });

  // Nettoyage prévu pour ce passage.
  const tr = transition(de?.id, vers.id);
  if (tr) {
    e.push({
      type: 'texte',
      titre: tr.nettoyage ? NOMS_NETTOYAGE[tr.nettoyage] : 'Pas de nettoyage',
      textes: tr.nettoyage ? [M.nettoyage[tr.nettoyage]] : ['Pas de nettoyage pour ce passage.'],
      note: tr.note,
    });
  } else {
    e.push({
      type: 'texte',
      titre: 'Nettoyage',
      textes: [
        `Ce passage${de ? ` de ${de.nom} à ${vers.nom}` : ''} n'est pas prévu au calendrier : choisis le nettoyage selon ce qui sort de la chambre.`,
        ...(['leger', 'moyen', 'grand'] as const).map((n) => `${NOMS_NETTOYAGE[n]} : ${M.nettoyage[n]}`),
      ],
    });
  }

  if (refroidirAvant(de, vers)) {
    const r = regle('Après un mode chaud');
    e.push({ type: 'texte', titre: 'Laisser refroidir', textes: [cm[2]], pourquoi: r ? [r.pourquoi] : undefined });
  }

  // ITC, code par code.
  if (vers.itc) {
    const r = regle('Régler l’ITC frigo débranché');
    e.push({
      type: 'texte',
      titre: 'Régler l’ITC (température)',
      textes: [M.guide_itc.appli, 'Le frigo reste débranché pendant tout le réglage.', M.guide_itc.entrer],
      note: miseEnServiceFaite ? M.guide_itc.apres_un_reglage : `${M.guide_itc.premier_reglage} ${M.guide_itc.apres_un_reglage}`,
      pourquoi: r ? [r.pourquoi] : undefined,
    });
    CODES_ITC.forEach((code, i) => {
      const valeur = vers.itc![code];
      const precedent = de?.itc?.[code];
      const dernier = i === CODES_ITC.length - 1;
      const suivant = CODES_ITC[i + 1];
      e.push({
        type: 'code',
        appareil: 'itc',
        titre: `ITC · ${code}`,
        code,
        valeur,
        avant: precedent !== undefined && precedent !== valeur ? precedent : undefined,
        inchange: precedent === valeur,
        consigne: dernier
          ? `▲ ou ▼ jusqu’à ${valeurCode('itc', code, valeur)}, puis tiens SET 2 secondes pour sortir : il enregistre.`
          : `▲ ou ▼ jusqu’à ${valeurCode('itc', code, valeur)}, puis un appui sur SET : il enregistre et passe à ${suivant}.`,
        note: dernier ? M.guide_itc.voyant_froid_clignote : undefined,
      });
    });
  } else {
    e.push({
      type: 'texte',
      titre: 'Contrôleurs',
      textes: ['Débranche l’ITC et l’IHC du mur : en Pause, tout se débranche, Inkbird compris.'],
      pourquoi: vers.pourquoi,
    });
  }

  // IHC, code par code (première phase ; la suivante se règle plus tard).
  const phases = vers.ihc_phases;
  if (phases.length) {
    const p = phases[0];
    e.push({
      type: 'texte',
      titre: 'Régler l’IHC (humidité)',
      textes: [M.guide_ihc.appli, M.guide_ihc.entrer],
      note:
        phases.length > 1
          ? `Règle maintenant « ${p.nom} ». Le passage à « ${phases[1].nom} » (HS ${valeurCode('ihc', 'HS', phases[1].HS)}) se fera plus tard. ${M.guide_ihc.reglage_rapide}`
          : undefined,
    });
    CODES_IHC.forEach((code, i) => {
      const valeur = p[code];
      const precedent = de?.ihc_phases[0]?.[code];
      const dernier = i === CODES_IHC.length - 1;
      e.push({
        type: 'code',
        appareil: 'ihc',
        titre: `IHC · ${code}`,
        code,
        valeur,
        avant: precedent !== undefined && precedent !== valeur ? precedent : undefined,
        inchange: precedent === valeur,
        consigne: dernier
          ? `▲ ou ▼ jusqu’à ${valeurCode('ihc', code, valeur)}, puis tiens SET 2 secondes pour sortir.`
          : `▲ ou ▼ jusqu’à ${valeurCode('ihc', code, valeur)}, puis un appui sur SET : il passe à ${CODES_IHC[i + 1]}.`,
        note: dernier ? M.guide_ihc.apres_un_reglage : p.note && i === 0 ? p.note : undefined,
      });
    });
  }

  // Thermostat du frigo.
  if (vers.branchements.itc_froid === 'Frigo') {
    const r = vers.id === 'froid' ? regle('En Froid, le frigo règle seul') : regle('Dans les autres modes, thermostat');
    e.push({
      type: 'texte',
      titre: 'Thermostat du frigo',
      textes: [],
      cases: [`Thermostat du frigo : ${vers.thermostat_frigo}`],
      pourquoi: r ? [r.pourquoi] : undefined,
    });
  }

  // Branchements, ventilateur, bac de sel.
  const pourquoiBranchements = vers.pourquoi.filter((t) => /frigo|déshumidificateur|tapis/i.test(t));
  const r10 = regle('Régler l’ITC frigo débranché');
  e.push({
    type: 'texte',
    titre: 'Branchements',
    textes: vers.deshumidificateur ? [`Déshumidificateur : ${vers.deshumidificateur}`] : [],
    cases: [
      ...PRISES.map((p) => `${NOMS_PRISES[p]} : ${texteBranchement(vers.branchements[p])}`),
      ...(vers.bac_de_sel ? [`Bac de sel : ${vers.bac_de_sel}`] : []),
    ],
    note: vers.branchements.itc_froid === 'Frigo' && r10 ? `Le frigo en dernier, arrêté depuis au moins 10 minutes : ${r10.pourquoi}` : undefined,
    pourquoi: pourquoiBranchements.length ? pourquoiBranchements : undefined,
  });
  e.push({
    type: 'texte',
    titre: 'Ventilateur',
    textes: [],
    cases: [vers.ventilateur.orientation ? `${VITESSES[vers.ventilateur.vitesse]} · ${vers.ventilateur.orientation}` : VITESSES[vers.ventilateur.vitesse]],
    pourquoi: vers.pourquoi.filter((t) => /ventilateur/i.test(t)),
  });

  if (vers.id !== 'pause') {
    // « Mode Koji : sonde plantée au cœur du riz » : seulement pour ce mode.
    const sondes = M.installation.sondes.filter((s) => !/^Mode /.test(s) || s.toLowerCase().startsWith(`mode ${vers.id}`));
    e.push({ type: 'texte', titre: 'Sondes', textes: [...(vers.sonde_itc ? [`Sonde de l’ITC : ${vers.sonde_itc}`] : []), ...sondes] });
    e.push({ type: 'texte', titre: 'À vide, puis les produits', textes: [cm[8], cm[9]] });
  } else {
    e.push({ type: 'texte', titre: 'Chambre au repos', textes: [vers.reservoir.texte, ...vers.notes] });
  }
  return e;
}
