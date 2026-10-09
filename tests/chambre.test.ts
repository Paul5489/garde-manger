// Chambre de fermentation : données fournies par Paul, dates, calendrier, tâches, assistant de changement de mode.
import { describe, expect, it } from 'vitest';
import { pourquoiDuCode } from '../src/chambre/affichage';
import { etapesAssistant, type EtapeCode, type EtapeTexte } from '../src/chambre/assistant';
import {
  changementDuJour,
  debutPeriode,
  modeApresNettoyage,
  modeAvant,
  modePrevu,
  prochainsChangements,
} from '../src/chambre/calendrier';
import { compatibilite, conflits, modesDeLaRecette, raisons, usageThermoplongeur } from '../src/chambre/compatibilite';
import { CONTENU, mode, recette, verifierContenu, type Contenu } from '../src/chambre/donnees';
import { evenementsChambre, evenementsLot, evenementsStock, fichierIcsChambre, regleRepetition } from '../src/chambre/ics';
import {
  arrondiGrammes,
  calculer,
  cibleDuPh,
  controlesDeLaRecette,
  dureeLisible,
  fenetres,
  libelleJour,
  repereDuMois,
  saison,
} from '../src/chambre/recettes';
import {
  aFaire,
  dateLimite,
  debutsDesPhases,
  debutVagueCave,
  etatPh,
  etatStock,
  finPrevue,
  modeDuLot,
  nouveauLot,
  occurrences,
  passageSuivant,
  perteDePoids,
  poidsDemande,
  congelationDuStock,
  conservationCongelateur,
  indexEntreeReglage,
  reglagesAFaire,
  reglagesDuLot,
  type NouveauLot,
} from '../src/chambre/lots';
import { modeActif, rythmeReservoir, tachesDuJour, type DatesTaches } from '../src/chambre/taches';
import type { Lot, MesurePh } from '../src/chambre/types';
import { apres, joursCalendaires } from '../src/chambre/temps';

const d = (mois: number, jour: number, h = 12, min = 0, annee = mois >= 10 ? 2026 : 2027) => new Date(annee, mois - 1, jour, h, min);

describe('données de la chambre', () => {
  it('83 recettes, 7 modes, 8 techniques, sans erreur ni avertissement', () => {
    expect(CONTENU.recettes).toHaveLength(83);
    expect(CONTENU.modes.modes).toHaveLength(7);
    expect(Object.keys(CONTENU.techniques)).toHaveLength(8);
    expect(verifierContenu()).toEqual({ erreurs: [], avertissements: [] });
  });

  it('repère les incohérences, comme le script de Paul', () => {
    const c = structuredClone(CONTENU) as Contenu;
    c.modes.modes.find((m) => m.id === 'cave')!.itc!.PT = 5;
    c.recettes[0].liens = ['inconnue'];
    c.recettes[1].ingredients.push({ nom: 'Sel nitrité', qte: 1, unite: 'g' });
    c.calendrier.mois['11'].rendez_vous![0].recettes.push('fantome');
    const { erreurs } = verifierContenu(c);
    expect(erreurs).toContain('cave : PT vaut 5, il doit valoir 10');
    expect(erreurs.some((e) => e.includes('lien vers une recette inconnue (inconnue)'))).toBe(true);
    expect(erreurs.some((e) => e.includes('« nitrit » trouvé'))).toBe(true);
    expect(erreurs).toContain('calendrier 11 : recette inconnue fantome');
  });

  it('aucun nitrite, nitrate ni poudre de céleri dans les recettes', () => {
    for (const r of CONTENU.recettes) {
      const texte = JSON.stringify(r).toLowerCase().replace(/sans nitrit\w*|pas de sel nitrit\w*/g, '');
      expect(texte, r.id).not.toMatch(/nitrit|nitrat|poudre de céleri|céleri en poudre/);
    }
  });

  it('la mise en service passe l’ITC en °C avant tout autre réglage', () => {
    const titres = CONTENU.modes.mise_en_service.map((e) => e.titre);
    const i = titres.indexOf('Passer l’ITC en °C');
    expect(i).toBeGreaterThanOrEqual(0);
    for (const autre of ['Calibrer les sondes', 'Étalonner le pH-mètre', 'Test du déshumidificateur', 'Essai à vide'])
      expect(titres.indexOf(autre), autre).toBeGreaterThan(i);
    const deshu = CONTENU.modes.mise_en_service.find((e) => e.titre === 'Test du déshumidificateur')!;
    expect(deshu.si_echec).toMatch(/repart/);
  });
});

describe('dates en heure locale', () => {
  it('0,75 jour = 18 h ; koji démarré le 15 octobre à 18 h', () => {
    const debut = d(10, 15, 18);
    expect(apres(debut, 0.75)).toEqual(d(10, 16, 12));
    expect(apres(debut, 1.7)).toEqual(d(10, 17, 10, 48));
    expect(apres(debut, 2.1)).toEqual(d(10, 17, 20, 24));
  });

  it('un contrôle prévu à 8 h reste à 8 h après un changement d’heure', () => {
    const hiver = apres(d(10, 24, 8), 1); // 25 octobre 2026 : passage à l'heure d'hiver
    expect([hiver.getDate(), hiver.getHours()]).toEqual([25, 8]);
    expect((hiver.getTime() - d(10, 24, 8).getTime()) / 3_600_000).toBe(25);
    const ete = apres(d(3, 27, 8), 2); // 28 mars 2027 : passage à l'heure d'été
    expect([ete.getDate(), ete.getHours()]).toEqual([29, 8]);
    expect(joursCalendaires(d(10, 24, 23), d(10, 25, 1))).toBe(1);
  });
});

describe('calendrier de la chambre', () => {
  it('mode prévu selon la date, cycle qui se répète chaque année', () => {
    expect(modePrevu(d(10, 7))).toBe('pause');
    expect(modePrevu(d(10, 15))).toBe('koji');
    expect(modePrevu(d(11, 9))).toBe('nettoyage');
    expect(modePrevu(d(11, 10))).toBe('froid');
    expect(modePrevu(d(12, 21))).toBe('cave');
    expect(modePrevu(new Date(2028, 1, 29, 12))).toBe('cave'); // 29 février : dernier segment du mois
    expect(modePrevu(new Date(2030, 9, 20, 12))).toBe('koji');
  });

  it('début de la période, prochain changement, mode d’avant et d’après', () => {
    expect(debutPeriode(d(11, 20))).toEqual(new Date(2026, 10, 10));
    expect(debutPeriode(d(1, 15))).toEqual(new Date(2026, 11, 21)); // la Cave commence le 21 décembre
    const [c] = prochainsChangements(d(10, 7));
    expect([c.le, c.vers]).toEqual([new Date(2026, 9, 15), 'koji']);
    expect(changementDuJour(d(10, 15))?.vers).toBe('koji');
    expect(changementDuJour(d(10, 16))).toBeUndefined();
    expect(modeAvant(d(11, 10))).toBe('sechage'); // le jour de nettoyage est sauté
    expect(modeApresNettoyage(d(11, 9))).toBe('froid');
  });
});

describe('mode actif et tâches du jour', () => {
  it('suit le calendrier, sauf choix à la main', () => {
    const a = modeActif(d(10, 20), null);
    expect([a.id, a.manuel, a.depuis]).toEqual(['koji', false, new Date(2026, 9, 15)]);
    const m = modeActif(d(10, 20), { mode: 'pause', le: d(10, 15, 9).toISOString() });
    expect([m.id, m.manuel, m.prevu]).toEqual(['pause', true, 'koji']);
    expect(modeActif(d(11, 9), null).apres).toBe('froid');
  });

  it('rythme du réservoir : chaque jour en Séchage, 3 jours puis 7 en Cave, rien en Froid', () => {
    expect(rythmeReservoir(mode('sechage'), d(11, 3))).toBe(1);
    expect(rythmeReservoir(mode('cave'), d(1, 5), d(12, 21))).toBe(3);
    expect(rythmeReservoir(mode('cave'), d(1, 20), d(12, 21))).toBe(7);
    expect(rythmeReservoir(mode('froid'), d(11, 20))).toBeNull();
  });

  const taches = (quand: Date, faites: DatesTaches, debutVague?: Date) =>
    tachesDuJour({ maintenant: quand, actif: modeActif(quand, null), faites, debutVague, miseEnService: true });
  const due = (quand: Date, faites: DatesTaches, debutVague?: Date) => taches(quand, faites, debutVague).find((t) => t.tache === 'reservoir')?.due;

  it('en Séchage, le réservoir est à vider chaque jour', () => {
    expect(due(d(11, 2, 9), {})).toBe(true); // mode commencé la veille
    expect(due(d(11, 3, 9), { reservoir: d(11, 2, 19).toISOString() })).toBe(true);
    expect(due(d(11, 3, 20), { reservoir: d(11, 3, 19).toISOString() })).toBe(false);
  });

  it('en Cave : tous les 3 jours après une entrée, puis chaque semaine ; rien en Froid', () => {
    expect(due(d(1, 10), { reservoir: d(1, 8).toISOString() }, d(12, 28))).toBe(false);
    expect(due(d(1, 11), { reservoir: d(1, 8).toISOString() }, d(12, 28))).toBe(true);
    expect(due(d(2, 1), { reservoir: d(1, 28).toISOString() }, d(12, 28))).toBe(false);
    expect(due(d(2, 4), { reservoir: d(1, 28).toISOString() }, d(12, 28))).toBe(true);
    expect(taches(d(11, 20), {}).map((t) => t.tache)).toEqual(['verification']);
  });

  it('vérification chaque semaine, calibrage chaque année, pH-mètre chaque mois', () => {
    const t = taches(d(11, 20), {
      verification: d(11, 12).toISOString(),
      calibrage: new Date(2025, 10, 1).toISOString(),
      'etalonnage-ph': d(10, 25).toISOString(),
    });
    expect(Object.fromEntries(t.map((x) => [x.tache, x.due]))).toEqual({ verification: true, calibrage: true, 'etalonnage-ph': false });
    expect(taches(d(10, 7), {}).length).toBe(0); // Pause : rien
  });
});

describe('assistant « Changer de mode »', () => {
  const textes = (e: ReturnType<typeof etapesAssistant>) =>
    e.filter((x): x is EtapeTexte => x.type === 'texte').flatMap((x) => [x.titre, ...x.textes, ...(x.cases ?? []), x.note ?? '', ...(x.pourquoi ?? [])]);

  it('Cave : ITC puis IHC touche par touche, frigo débranché, thermostat, branchements, ventilateur, bac de sel', () => {
    const e = etapesAssistant(mode('froid'), mode('cave'));
    const codes = e.filter((x): x is EtapeCode => x.type === 'code');
    expect(codes.map((x) => `${x.appareil}:${x.code}=${x.valeur}`)).toEqual([
      'itc:TS=13',
      'itc:HD=1.5',
      'itc:CD=2',
      'itc:AH=16',
      'itc:AL=10',
      'itc:PT=10',
      'itc:CA=0',
      'itc:CF=C',
      'ihc:HS=80',
      'ihc:HD=10',
      'ihc:DD=4',
      'ihc:AH=90',
      'ihc:AL=65',
      'ihc:PT=3',
      'ihc:CA=0',
    ]);
    expect(codes[0].consigne).toMatch(/▲ ou ▼ jusqu’à 13 °C, puis un appui sur SET/);
    expect(codes[7].consigne).toMatch(/tiens SET 2 secondes pour sortir/);
    expect(codes[0].avant).toBe(1); // TS passe de 1 °C (Froid) à 13 °C
    const tout = textes(e).join('\n');
    expect(tout).toMatch(/Le frigo reste débranché pendant tout le réglage/);
    expect(tout).toMatch(/Thermostat du frigo : Au plus froid/);
    expect(tout).toMatch(/ITC · prise froid : Frigo/);
    expect(tout).toMatch(/IHC · WORK2 \(déshumidifier\) : Déshumidificateur/);
    expect(tout).toMatch(/Vitesse lente \(L\) · Vers la paroi du fond/);
    expect(tout).toMatch(/Bac de sel : /);
    expect(tout).toMatch(/Nettoyage léger|Léger/i);
    expect(pourquoiDuCode(mode('cave'), 'itc', 'PT').join(' ')).toMatch(/10 minutes avant de redémarrer/);
    expect(pourquoiDuCode(mode('cave'), 'ihc', 'PT').join(' ')).not.toMatch(/compresseur/);
  });

  it('Séchage : prise froid vide, déshumidificateur sur la prise chauffage, et pourquoi', () => {
    const tout = textes(etapesAssistant(mode('koji'), mode('sechage'))).join('\n');
    expect(tout).toMatch(/ITC · prise froid : Rien : laisser vide/);
    expect(tout).toMatch(/ITC · prise chauffage : Déshumidificateur/);
    expect(tout).toMatch(/Le déshumidificateur fait le chauffage/);
    expect(tout).not.toMatch(/Laisser refroidir/); // frigo débranché en Séchage
  });

  it('Froid : thermostat sur une position moyenne, à ajuster la première semaine ; refroidir après le Séchage', () => {
    const e = etapesAssistant(mode('sechage'), mode('froid'));
    const tout = textes(e).join('\n');
    expect(tout).toMatch(/Thermostat du frigo : Position moyenne, à ajuster la première semaine/);
    expect(tout).toMatch(/Laisser refroidir/);
    expect(tout).toMatch(/Grand nettoyage/);
  });

  it('avant la mise en service, rappelle de passer CF sur C en premier', () => {
    const intro = etapesAssistant(mode('pause'), mode('koji'), false).find((x) => x.titre === 'Régler l’ITC (température)') as EtapeTexte;
    expect(intro.note).toMatch(/CF = C/);
  });

  it('Pause : tout débrancher, sans code à régler', () => {
    const e = etapesAssistant(mode('biltong'), mode('pause'));
    expect(e.some((x) => x.type === 'code')).toBe(false);
    expect(textes(e).join('\n')).toMatch(/Inkbird compris/);
  });
});

describe('fiches des recettes', () => {
  const r = (id: string) => recette(id)!;

  it('calculateur : koji de riz pour 1 000 g, puis 1 500 g', () => {
    expect(calculer(r('kojiriz'), 1000).map((l) => l.quantite)).toEqual(['1 000 g', '1 g', '5 g']);
    expect(calculer(r('kojiriz'), 1500).map((l) => l.quantite)).toEqual(['1 500 g', '1,5 g', '7,5 g']);
  });

  it('arrondi au gramme, au dixième sous 10 g ; unités comptées à la demi-unité, « environ »', () => {
    expect(arrondiGrammes(40.5)).toBe(41);
    expect(arrondiGrammes(6.75)).toBe(6.8);
    const l = calculer(r('guanciale'), 1350);
    expect(l.find((x) => x.nom === 'Ail écrasé')?.quantite).toBe('environ 2,5 gousses');
    expect(calculer(r('pissenlit'), 200).find((x) => x.nom === 'Ail')?.quantite).toBe('1 gousse');
    expect(calculer(r('pissenlit'), 50).find((x) => x.nom === 'Ail')?.quantite).toBe('environ 0,5 gousse');
  });

  it('saison : le cycle est circulaire, [9, 10] est une seule fenêtre', () => {
    expect(fenetres([9, 10])).toEqual([[9, 10]]);
    expect(fenetres([10, 4])).toEqual([[10], [4]]);
    expect(fenetres([11, 12, 1, 2])).toEqual([[11, 12, 1, 2]]);
    const vin = CONTENU.recettes.find((x) => x.mois?.join() === '9,10' || x.mois?.join() === '10,9');
    if (vin) {
      expect(repereDuMois(vin, 10)).toBe('dernier-mois');
      expect(repereDuMois(vin, 9)).toBeUndefined();
    }
    expect(repereDuMois(r('kojipoudre'), 11)).toBe('ce-mois');
    expect(repereDuMois(r('cepes'), 11)).toBe('dernier-mois');
    expect(saison(r('kojiriz'))).toBe('Octobre et avril');
    expect(saison(r('suancai'))).toBe('Octobre à février');
  });

  it('contrôles : la coppa pèse depuis l’entrée en Cave, le saucisson mesure le pH depuis le début', () => {
    const coppa = controlesDeLaRecette(r('coppa'));
    expect(coppa.filter((c) => c.ancre === 'cave').map((c) => c.controle.titre)).toEqual(['Pesée d’entrée', 'Pesée', 'Surface']);
    expect(coppa.find((c) => c.controle.titre === 'Fin du salage')?.ancre).toBe('debut');
    const sauc = controlesDeLaRecette(r('saucisson'));
    expect(sauc.filter((c) => c.ancre === 'debut').map((c) => c.controle.j)).toEqual([0, 1, 2, 3]);
    expect(sauc.filter((c) => c.ancre === 'cave').map((c) => c.controle.titre)).toEqual(['Pesée', 'Surface']);
    expect(controlesDeLaRecette(r('kojiriz')).map((c) => c.controle.j)).toEqual([0, 0.75, 1.15, 1.5, 1.75]);
    expect(libelleJour(0.75)).toBe('18 h');
    expect(libelleJour(1.75)).toBe('jour 1 + 18 h');
  });

  it('durées lisibles et cible de pH', () => {
    expect(dureeLisible(1.7, 2.1)).toBe('41 à 50 h');
    expect(dureeLisible(0.05)).toBe('72 min');
    expect(dureeLisible(70)).toBe('10 semaines');
    expect(dureeLisible(180, 365)).toBe('6 à 12 mois');
    expect(cibleDuPh(r('cepes'))?.valeur).toBe(4.2);
    expect(cibleDuPh(r('kimchi'))).toMatchObject({ valeur: 4.6, pret: '4,2 à 4,5' });
    expect(cibleDuPh(r('kosho'))?.valeur).toBeNull(); // protégé par le sel
    expect(cibleDuPh(r('saucisson'))?.valeur).toBe(5.3);
    expect(cibleDuPh(r('vinriz'))).toBeUndefined();
  });
});

describe('lots', () => {
  const r = (id: string) => structuredClone(recette(id)!);
  const lot = (id: string, entree: Date, n: Partial<NouveauLot> = {}) => {
    const rec = r(id);
    return nouveauLot(rec, rec.technique ? CONTENU.techniques[rec.technique] : undefined, { entree, quantiteBase: rec.base.quantite, ...n }, 'essai');
  };

  it('koji démarré le 15 octobre à 18 h : émiettage le 16 vers 12 h, récolte le 17 entre le matin et le soir', () => {
    const l = lot('kojiriz', d(10, 15, 18));
    const occ = occurrences(l);
    expect(occ.find((o) => o.controle.titre === 'Émiettage')?.quand).toEqual(d(10, 16, 12));
    expect(occ.find((o) => o.controle.titre === 'Récolte')?.quand).toEqual(d(10, 17, 12));
    expect(occ.every((o) => o.exacte)).toBe(true);
    const fin = finPrevue(l);
    expect([fin.min, fin.max]).toEqual([d(10, 17, 10, 48), d(10, 17, 20, 24)]);
  });

  it('le lot garde sa copie de la recette', () => {
    const rec = r('kojiriz');
    const l = nouveauLot(rec, undefined, { entree: d(10, 15, 18), quantiteBase: 1000 }, 'x');
    rec.controles.push({ j: 1, titre: 'Ajout', observer: '', normal: '', probleme: '', action: '' });
    rec.duree.max_j = 9;
    expect(l.recette.controles).toHaveLength(5);
    expect(finPrevue(l).max).toEqual(d(10, 17, 20, 24));
  });

  it('répétitions : jusqu’à fin_j, toutes les 12 h pour le gravlax, à 8 h même après le changement d’heure', () => {
    const citrons = occurrences(lot('citrons', d(10, 20, 18))).filter((o) => o.controle.titre === 'Retourner le bocal');
    expect(citrons.map((o) => o.quand.getDate())).toEqual([21, 22, 23, 24, 25, 26, 27]);
    expect(citrons.every((o) => o.quand.getHours() === 8)).toBe(true); // 25 octobre : heure d'hiver
    const gravlax = occurrences(lot('gravlax', d(10, 20, 9))).filter((o) => o.controle.titre === 'Retourner');
    expect(gravlax.map((o) => o.quand.getHours())).toEqual([21, 9, 21, 9]);
    expect(occurrences(lot('citrons', d(10, 20, 18)), 7)[0].quand.getHours()).toBe(7); // heure des rappels choisie
  });

  it('coppa démarrée le 28 novembre : 21 jours de salage en Froid, puis pesée chaque semaine en Cave, cible 35 %', () => {
    let l = lot('coppa', d(11, 28, 10));
    const debuts = debutsDesPhases(l);
    expect(debuts.min[1]).toEqual(d(12, 19, 10));
    expect(modeDuLot(l)).toBe('froid');
    // Avant l'entrée en Cave : pas de pesée à faire, même si sa date estimée est passée.
    expect(aFaire(l, d(12, 20, 12)).map((o) => o.controle.titre)).toEqual(['Fin du salage']);
    // Entrée en Cave le 19 décembre, 1 400 g ; pesées les 26 décembre et 2 janvier.
    l = { ...l, phaseCourante: 1, phases: [{}, { debut: d(12, 19, 10).toISOString(), poids: 1400 }] };
    expect(modeDuLot(l)).toBe('cave');
    const pesees = occurrences(l).filter((o) => o.controle.titre === 'Pesée');
    expect(pesees.slice(0, 3).map((o) => [o.quand.getMonth() + 1, o.quand.getDate(), o.quand.getHours()])).toEqual([
      [12, 26, 8],
      [1, 2, 8],
      [1, 9, 8],
    ]);
    l = { ...l, pesees: [{ le: d(12, 26, 9).toISOString(), g: 1330 }, { le: d(1, 2, 9).toISOString(), g: 1260 }] };
    const p = perteDePoids(l)!;
    expect(p.reference.g).toBe(1400);
    expect(Math.round(p.pct)).toBe(10);
    expect(p.cible).toBe(35);
    expect(p.atteinte).toBe(false);
    expect(Math.abs(p.finEstimee!.getTime() - d(2, 6, 10).getTime())).toBeLessThan(86_400_000);
    l = { ...l, pesees: [...l.pesees, { le: d(2, 6, 9).toISOString(), g: 900 }] };
    expect(perteDePoids(l)!.atteinte).toBe(true);
  });

  it('saucisson : pH 5,6 à 72 h → « Ne pas sécher », pas de passage en Cave', () => {
    const l = lot('saucisson', d(1, 10, 18));
    expect(passageSuivant(l).possible).toBe(false); // aucun pH noté
    const ph = (valeur: number, moment: MesurePh['moment'], h: number) => ({ le: new Date(d(1, 10, 18).getTime() + h * 3_600_000).toISOString(), valeur, moment });
    const bon = { ...l, ph: [ph(5.9, 'depart', 0), ph(5.2, '48h', 48)] };
    expect(passageSuivant(bon).possible).toBe(true);
    const lent = { ...l, ph: [ph(5.9, 'depart', 0), ph(5.5, '48h', 48)] };
    expect(passageSuivant(lent)).toEqual({ possible: false, raison: 'pH encore au-dessus de 5,3 : prolonge l’étuvage et remesure à 72 h.' });
    const rate = { ...lent, ph: [...lent.ph, ph(5.6, '72h', 72)] };
    expect(etatPh(rate).bloque).toBe(true);
    expect(passageSuivant(rate)).toEqual({ possible: false, raison: 'Ne pas sécher : cuire en saucisses fraîches dans les 24 h, ou jeter.' });
    // Les pH de 48 et 72 h tombent à l'heure exacte.
    const occ = occurrences(l).filter((o) => o.type === 'ph');
    expect(occ.map((o) => o.quand)).toEqual([d(1, 10, 18), d(1, 12, 18), d(1, 13, 18)]);
    expect(poidsDemande(l.recette, 1)).toBe(true);
  });

  it('pH des lacto : seuil de la recette, « Jeter, sans goûter » au-dessus de 4,6 après le délai (5 jours pour le kimchi)', () => {
    const mesure = (l: Lot, valeur: number, jours: number) => ({
      ...l,
      ph: [{ le: apres(l.entree, jours).toISOString(), valeur, moment: 'libre' as const }],
    });
    const k = lot('kimchi', d(10, 20, 18));
    expect(etatPh(k)).toMatchObject({ bloque: false, jeter: false, cible: { valeur: 4.6 } });
    expect(etatPh(mesure(k, 4.4, 2))).toMatchObject({ atteinte: true, jeter: false });
    expect(etatPh(mesure(k, 4.8, 3))).toMatchObject({ atteinte: false, jeter: false });
    expect(etatPh(mesure(k, 4.8, 5))).toMatchObject({ jeter: true });
    const c = lot('choucroute', d(10, 20, 18));
    expect(etatPh(mesure(c, 4.4, 5)).atteinte).toBe(false); // seuil 4,2 avant le frigo
    expect(etatPh(mesure(c, 4.8, 6)).jeter).toBe(false);
    expect(etatPh(mesure(c, 4.8, 7)).jeter).toBe(true);
    expect(etatPh(mesure(lot('kosho', d(10, 20, 18)), 5.5, 20)).jeter).toBe(false); // le sel protège
  });

  it('début de la vague de Cave : dernière entrée d’un lot en Cave', () => {
    const coppa = { ...lot('coppa', d(11, 28, 10)), phaseCourante: 1, phases: [{}, { debut: d(12, 19, 10).toISOString(), poids: 1400 }] };
    const sauc = { ...lot('saucisson', d(1, 10, 18)), id: 's' };
    expect(debutVagueCave([coppa, sauc])).toEqual(d(12, 19, 10));
  });

  it('stock : date limite = fin + jours, alerte 7 jours avant', () => {
    const c = { mode: 'Frigo', comment: 'sous vide', duree: '1 mois', jours: 30 };
    expect(dateLimite(d(1, 1, 12), c)).toBe(d(1, 31, 12).toISOString());
    expect(dateLimite(d(1, 1, 12), { ...c, jours: 0 })).toBeUndefined();
    const a = { id: 'a', recetteId: 'coppa', nom: 'Coppa', conservation: c, depuis: d(1, 1, 12).toISOString(), limite: d(1, 31, 12).toISOString(), statut: 'en-stock' as const, modifieLe: 0 };
    expect(etatStock(a, d(1, 20))).toBe('ok');
    expect(etatStock(a, d(1, 25))).toBe('bientot');
    expect(etatStock(a, d(2, 1))).toBe('depasse');
    expect(etatStock({ ...a, limite: undefined }, d(2, 1))).toBe('sans-date');
  });
});

describe('rappels pour le Calendrier (.ics)', () => {
  const coppa = () => {
    const rec = structuredClone(recette('coppa')!);
    return nouveauLot(rec, CONTENU.techniques.salaison_entiere, { entree: d(11, 28, 10), quantiteBase: 1500 }, 'lot1');
  };

  it('un lot : contrôles (répétés en une seule entrée), réglages, fin ; UID stables', () => {
    const ev = evenementsLot(coppa(), d(11, 28, 11));
    const uids = ev.map((e) => e.uid);
    expect(uids).toContain('lot1-reglage:1'); // entrée en Cave
    expect(uids).toContain('lot1-fin');
    const pesee = ev.find((e) => e.titre === '⚖️ Coppa : Pesée')!;
    expect(pesee.debut).toEqual(d(12, 26, 8));
    expect(pesee.rrule).toMatch(/^FREQ=DAILY;INTERVAL=7;COUNT=\d+$/);
    expect(new Set(uids).size).toBe(uids.length);
    expect(evenementsLot(coppa(), d(11, 28, 11)).map((e) => e.uid)).toEqual(uids); // mêmes UID à chaque export
  });

  it('les contrôles déjà cochés ou passés ne sont plus proposés', () => {
    const l = coppa();
    const avant = evenementsLot(l, d(11, 28, 11)).length;
    const cle = occurrences(l).find((o) => o.controle.titre === 'Fin du salage')!.cle;
    expect(evenementsLot({ ...l, controles: { [cle]: { etat: 'ok', le: '' } } }, d(11, 28, 11)).length).toBe(avant - 1);
    expect(evenementsLot(l, d(4, 1, 12))).toEqual([]);
  });

  it('fichier valide : alarme, répétition, version, lignes de 75 octets au plus', () => {
    expect(regleRepetition(0.5, 4)).toBe('FREQ=HOURLY;INTERVAL=12;COUNT=4');
    const ics = fichierIcsChambre(evenementsLot(coppa(), d(11, 28, 11)), 42, new Date(Date.UTC(2026, 10, 28)));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:lot1-reglage:1@garde-manger-chambre');
    expect(ics).toContain('SEQUENCE:42');
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=7;COUNT=');
    expect(ics).toContain('DTSTART:20261226T080000');
    expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(ics.match(/BEGIN:VEVENT/g)?.length);
    for (const ligne of ics.split('\r\n')) expect(new TextEncoder().encode(ligne).length).toBeLessThanOrEqual(75);
  });

  it('la chambre : changements de mode, réservoir au rythme du mode, vérification, calibrage, pH-mètre', () => {
    const ev = evenementsChambre(d(10, 7, 9), 8, {});
    const koji = ev.find((e) => e.titre.includes('passer en mode Chaud · koji'))!;
    expect(koji.debut).toEqual(d(10, 15, 8));
    expect(ev.find((e) => e.titre.startsWith('🧽'))?.debut).toEqual(d(11, 9, 8));
    const sechage = ev.find((e) => e.uid === 'reservoir-20261101-1')!;
    expect([sechage.debut, sechage.rrule]).toEqual([d(11, 2, 8), 'FREQ=DAILY;INTERVAL=1;COUNT=7']);
    const cave = ev.filter((e) => e.uid.startsWith('reservoir-20261221'));
    expect(cave.map((e) => [e.debut.getDate(), e.rrule])).toEqual([
      [24, 'FREQ=DAILY;INTERVAL=3;COUNT=6'],
      [11, expect.stringMatching(/^FREQ=DAILY;INTERVAL=7;COUNT=/)],
    ]);
    expect(ev.some((e) => e.uid.startsWith('verification-'))).toBe(true);
    expect(ev.filter((e) => e.uid === 'calibrage' || e.uid === 'etalonnage-ph')).toHaveLength(2);
    expect(new Set(ev.map((e) => e.uid)).size).toBe(ev.length);
  });

  it('le stock : 7 jours avant la date limite, et le jour même', () => {
    const a = { id: 's1', recetteId: 'coppa', nom: 'Coppa', conservation: { mode: 'Frigo', comment: 'sous vide', duree: '4 mois', jours: 120 }, depuis: d(3, 1, 10).toISOString(), limite: d(6, 29, 10).toISOString(), statut: 'en-stock' as const, modifieLe: 0 };
    expect(evenementsStock([a], d(3, 1, 12), 8).map((e) => [e.titre, e.debut])).toEqual([
      ['📦 À finir dans 7 jours : Coppa', d(6, 22, 8)],
      ['📦 Date limite : Coppa', d(6, 29, 8)],
    ]);
  });
});

describe('compatibilité', () => {
  const r = (id: string) => recette(id)!;
  const ids = (l: { id: string }[]) => l.map((x) => x.id);
  const nouveau = (id: string, entree: Date, maj: Partial<Lot> = {}) => ({
    ...nouveauLot(structuredClone(r(id)), undefined, { entree, quantiteBase: r(id).base.quantite }, `lot-${id}`),
    ...maj,
  });

  it('côte de bœuf : la liste de partage, quel que soit le mois, avec la précaution des magrets', () => {
    const c = compatibilite(r('cote'), 11);
    expect(c.modes).toEqual(['froid']);
    expect(ids(c.partage).sort()).toEqual(['agneau', 'bacon', 'coppa', 'fauxfilet', 'filetmignon', 'guanciale', 'jambon', 'magretsmatures', 'petitsale']);
    expect(c.precautions.join(' ')).toMatch(/[Mm]agrets sur la grille du bas|grille du bas/);
    // En novembre : la séance choux et les pleurotes en parallèle, le séchage écarté.
    for (const id of ['choucroute', 'kimchi', 'suancai', 'cepes', 'pleurotes']) expect(ids(c.parallele), id).toContain(id);
    for (const id of ['kojipoudre', 'champseches', 'pimentsflocons'])
      expect(c.incompatibles.find((i) => i.recette.id === id)?.raisons, id).toEqual(['mode différent']);
    // Le mois ne change rien à la liste de partage.
    expect(ids(compatibilite(r('cote'), 4).partage).sort()).toEqual(ids(c.partage).sort());
  });

  it('chaque incompatibilité a sa raison, et les listes suivent la règle de cohabitation', () => {
    for (const x of CONTENU.recettes.filter((y) => modesDeLaRecette(y).length)) {
      const c = compatibilite(x, 11);
      for (const i of c.incompatibles) expect(i.raisons.length, `${x.id} / ${i.recette.id}`).toBeGreaterThan(0);
      for (const y of c.partage) expect(raisons(x, y), `${x.id} / ${y.id}`).toEqual([]);
    }
    const viande = { ...r('cote'), etiquettes: ['sensible_odeur', 'sensible_spores'] };
    expect(conflits(viande, { ...r('cote'), etiquettes: ['odeur_forte'] })).toEqual(['odeur forte et viande']);
    expect(conflits({ ...r('cote'), etiquettes: ['spores'] }, viande)).toEqual(['spores et charcuterie']);
    expect(raisons(r('biltong'), r('cote'))).toEqual(['mode différent']);
  });

  it('déjà dans la chambre : lots présents, leur mode du moment, la place', () => {
    const jambon = nouveau('jambon', d(11, 12, 10));
    const saucisson = nouveau('saucisson', d(11, 1, 10), { phaseCourante: 1, phases: [{}, { debut: d(11, 3, 10).toISOString(), poids: 2000 }] });
    const c = compatibilite(r('cote'), 11, [jambon, saucisson], d(11, 15));
    expect(c.presents.map((p) => [p.lot.recetteId, p.mode, p.raisons])).toEqual([
      ['jambon', 'froid', []],
      ['saucisson', 'cave', ['mode différent (Cave · charcuterie)']],
    ]);
    expect(c.occupation).toBe(0.3);
    expect(c.avertissements).toEqual([]);
    const grosse = { ...r('cote'), place: 0.8 };
    expect(compatibilite(grosse, 11, [jambon], d(11, 15)).avertissements).toEqual(['Chambre pleine : les lots présents en prennent déjà 30 %.']);
  });

  it('prévu au même moment : calendrier du mois et étoiles', () => {
    const c = compatibilite(r('kojipoudre'), 11, [], d(11, 2), ['saucisson@11']);
    const cote = c.prevus.find((p) => p.recette.id === 'cote')!;
    expect([cote.source, cote.raisons]).toEqual(['calendrier', ['mode différent']]);
    expect(c.prevus.find((p) => p.recette.id === 'saucisson')?.source).toBe('programme');
    expect(c.prevus.find((p) => p.recette.id === 'pimentsflocons')?.raisons).toEqual([]);
  });

  it('thermoplongeur : une seule chose à la fois', () => {
    expect(usageThermoplongeur(r('garum'))).toBe(70);
    expect(usageThermoplongeur(r('jambon'))).toBe(0.5);
    expect(usageThermoplongeur(r('ketchup'))).toBeUndefined(); // pasteurisation en option
    const garum = nouveau('garum', d(10, 20, 10));
    const c = compatibilite(r('kimchi'), 11, [garum], d(11, 15));
    expect(c.thermoPris?.recetteId).toBe('garum');
    const amazake = recette('amazake')!;
    if (amazake.mois?.includes(11)) expect(c.incompatibles.find((i) => i.recette.id === 'amazake')?.raisons).toEqual(['thermoplongeur déjà pris']);
  });

  it('une recette hors de la chambre laisse la chambre à ce qui y est prévu ce mois-là', () => {
    const c = compatibilite(r('choucroute'), 11);
    expect(c.modes).toEqual([]);
    expect(ids(c.partage)).toContain('cote');
    expect(ids(c.partage)).toContain('kojipoudre');
    expect(ids(c.parallele)).toContain('kimchi');
  });

  it('modes d’une recette à phases', () => {
    expect(modesDeLaRecette(r('coppa'))).toEqual(['froid', 'cave']);
    expect(modesDeLaRecette(r('saucisson'))).toEqual(['cave']);
    expect(modesDeLaRecette(r('kimchi'))).toEqual([]);
  });
});

describe('réglages de la chambre, étape par étape', () => {
  const lotDe = (id: string, entree: Date) => {
    const rec = structuredClone(recette(id)!);
    return nouveauLot(rec, rec.technique ? CONTENU.techniques[rec.technique] : undefined, { entree, quantiteBase: rec.base.quantite }, 'lot');
  };
  const resume = (l: Lot) => reglagesDuLot(l).map((g) => [g.etape.j, g.etape.mode, g.etape.ihc_phase, g.quand]);

  it('coppa démarrée le 28 novembre : jour 0 Froid, jour 21 entrée en Cave à 80 %, jour 42 à 76 %', () => {
    const l = lotDe('coppa', d(11, 28, 10));
    expect(resume(l)).toEqual([
      [0, 'froid', 0, d(11, 28, 10)],
      [21, 'cave', 0, d(12, 19, 8)],
      [42, 'cave', 1, d(1, 9, 8)],
      [77, null, null, d(2, 13, 8)],
    ]);
    // Le 19 décembre : l'entrée en Cave est à faire (le salage se termine) ; rien d'autre.
    expect(reglagesAFaire(l, d(12, 19, 12)).map((g) => g.etape.titre)).toEqual(['Entrée en mode Cave']);
    // Salage prolongé : entrée réelle le 22 décembre à 15 h ; les 76 % suivent, 3 semaines plus tard.
    const enCave = { ...l, phaseCourante: 1, phases: [{}, { debut: d(12, 22, 15).toISOString(), poids: 1400 }], controles: { 'reglage:1': { etat: 'ok' as const, le: '' } } };
    expect(resume(enCave).slice(1, 3)).toEqual([
      [21, 'cave', 0, d(12, 22, 15)],
      [42, 'cave', 1, d(1, 12, 8)],
    ]);
    expect(reglagesAFaire(enCave, d(1, 11, 12))).toEqual([]);
    expect(reglagesAFaire(enCave, d(1, 12, 9)).map((g) => g.etape.titre)).toEqual(['Humidité à 76 %']);
    expect(indexEntreeReglage(l.recette, 1)).toBe(1);
  });

  it('koji de riz : passage de l’IHC en phase 2 vers 18–20 h, à l’heure exacte', () => {
    const l = lotDe('kojiriz', d(10, 15, 18));
    const p2 = reglagesDuLot(l).find((g) => g.etape.ihc_phase === 1)!;
    expect(p2.quand).toEqual(new Date(d(10, 15, 18).getTime() + Math.round(0.79 * 1440) * 60_000));
    expect(p2.exacte).toBe(true);
    expect(reglagesAFaire(l, d(10, 16, 13)).map((g) => g.etape.titre)).toEqual(['Phase 2 de l’IHC']);
  });

  it('saucisson : l’entrée en Cave attend le pH', () => {
    const l = lotDe('saucisson', d(1, 10, 18));
    expect(reglagesAFaire(l, d(1, 12, 20))).toEqual([]);
    const bon = { ...l, ph: [{ le: d(1, 12, 18).toISOString(), valeur: 5.2, moment: '48h' as const }] };
    expect(reglagesAFaire(bon, d(1, 12, 20)).map((g) => g.etape.titre)).toEqual(['Entrée en mode Cave']);
  });

  it('les réglages des lots vont aussi dans le Calendrier', () => {
    const titres = evenementsLot(lotDe('coppa', d(11, 28, 10)), d(11, 28, 11)).map((e) => e.titre);
    expect(titres).toContain('⚙️ Coppa : Entrée en mode Cave');
    expect(titres).toContain('⚙️ Coppa : Humidité à 76 %');
    expect(titres).not.toContain('➡️ Coppa : commencer « Séchage »'); // remplacé par le réglage d'entrée
  });
});

describe('congélation', () => {
  it('chaque recette dit si on peut congeler, et le stock en garde la ligne', () => {
    for (const x of CONTENU.recettes) {
      expect(['oui', 'non', 'inutile'], x.id).toContain(x.congelation.possible);
      const ligne = x.conservation.find((c) => c.mode === 'Congélateur');
      if (x.congelation.possible === 'oui') expect(ligne?.jours, x.id).toBe(x.congelation.jours);
      else expect(ligne, x.id).toBeUndefined();
    }
    const coppa = recette('coppa')!;
    const a = { id: 's', recetteId: 'coppa', nom: 'Coppa', conservation: coppa.conservation[0], congelation: coppa.congelation, depuis: '', statut: 'en-stock' as const, modifieLe: 0 };
    expect(conservationCongelateur(a, coppa)).toMatchObject({ mode: 'Congélateur', jours: 180 });
    const poudre = recette('kojipoudre')!;
    expect(conservationCongelateur({ ...a, recetteId: 'kojipoudre', congelation: undefined }, poudre)).toBeUndefined();
    expect(congelationDuStock({ ...a, congelation: undefined }, poudre)?.possible).toBe('inutile');
  });
});

describe('nouvelles vérifications des données', () => {
  it('partage réciproque, congélation, réglages, seuil de pH', () => {
    const c = structuredClone(CONTENU) as Contenu;
    const cote = c.recettes.find((x) => x.id === 'cote')!;
    const coppa = c.recettes.find((x) => x.id === 'coppa')!;
    const kimchi = c.recettes.find((x) => x.id === 'kimchi')!;
    c.recettes.find((x) => x.id === 'fauxfilet')!.partage!.avec = c.recettes.find((x) => x.id === 'fauxfilet')!.partage!.avec.filter((y) => y !== 'cote');
    coppa.congelation = { ...coppa.congelation, jours: 90 };
    cote.reglages.etapes[0].ihc_phase = 5;
    kimchi.ph!.securite = 5;
    const { erreurs } = verifierContenu(c);
    expect(erreurs).toContain('cote : partage non réciproque avec fauxfilet');
    expect(erreurs).toContain('coppa : congélation possible mais absente ou différente dans conservation');
    expect(erreurs).toContain('cote : phase IHC invalide (5)');
    expect(erreurs).toContain('kimchi : seuil de pH hors de 2,5 à 4,6 (5)');
  });
});
