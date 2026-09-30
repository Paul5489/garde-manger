import { describe, expect, it } from 'vitest';
import { date, duree, dureeJours, nombre, pluriel } from '../src/lib/format';

const esp = (s: string) => s.replace(/[  ]/g, ' ');

describe('format français', () => {
  it('nombres avec virgule', () => {
    expect(nombre(0.5)).toBe('0,5');
    expect(nombre(0.04, 3)).toBe('0,04');
    expect(esp(nombre(1200))).toBe('1 200');
    expect(nombre(2)).toBe('2');
  });

  it('dates « 30 sept. 2026 »', () => {
    expect(date('2026-09-30T12:00:00')).toBe('30 sept. 2026');
    expect(date('2026-01-05T12:00:00')).toBe('5 janv. 2026');
  });

  it('durées', () => {
    expect(duree(45)).toBe('45 min');
    expect(duree(60)).toBe('1 h');
    expect(duree(80)).toBe('1 h 20');
    expect(duree(125)).toBe('2 h 05');
    expect(duree(1500)).toBe('1 j 1 h');
    expect(dureeJours(5, 7)).toBe('5 à 7 jours');
    expect(dureeJours(1)).toBe('1 jour');
    expect(dureeJours(70)).toBe('10 semaines');
  });

  it('pluriels', () => {
    expect(pluriel(1, 'fiche')).toBe('1 fiche');
    expect(pluriel(821, 'fiche')).toBe('821 fiches');
    expect(pluriel(0, 'fiche')).toBe('0 fiche');
  });
});
