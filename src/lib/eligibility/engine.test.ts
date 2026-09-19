import { describe, it, expect } from 'vitest';
import { COMPUTER_SCIENCE_INTEL } from '@/data/intel/computerScience';
import { searchMajors, getMajorIntel } from '@/data/intel/majorIntel';
import {
  evaluateBagrutAccess,
  evaluateProgram,
  calculateGermanGrade,
  missingIntakeFields,
  type StudentIntake,
} from './engine';

const cs = COMPUTER_SCIENCE_INTEL;
const rwth = cs.programs.find((p) => p.id === 'rwth-informatik-bsc')!;
const tum = cs.programs.find((p) => p.id === 'tum-informatik-bsc')!;

const strong: StudentIntake = {
  bagrutYear: '2025',
  fullBagrut: true,
  bagrutAverage: 95,
  mathUnits: 5,
  mathGrade: 92,
  englishUnits: 5,
  englishGrade: 90,
  furtherSubject: 'Physics',
  furtherUnits: 5,
  furtherGrade: 88,
  germanLevel: 'C1',
  germanCertificate: 'telc C1 Hochschule',
};

describe('alias search', () => {
  it('resolves Arabic, Hebrew, English and German onto one canonical major', () => {
    for (const q of ['علوم الحاسوب', 'מדעי המחשב', 'Computer Science', 'Informatik']) {
      expect(searchMajors(q)[0].id).toBe('computer-science');
    }
  });

  it('returns unverified majors as honest stubs', () => {
    const stub = getMajorIntel('architecture');
    if (stub) {
      expect(stub.status).toBe('not_verified');
      expect(stub.programs).toHaveLength(0);
    }
  });
});

describe('bagrut access', () => {
  it('passes a student meeting the anabin units', () => {
    const rows = evaluateBagrutAccess(cs, strong);
    expect(rows.filter((r) => r.status === 'MEETS')).toHaveLength(4);
  });

  it('is NOT_DETERMINABLE when the student value is unknown', () => {
    const rows = evaluateBagrutAccess(cs, {});
    expect(rows.every((r) => r.status === 'NOT_DETERMINABLE')).toBe(true);
  });

  it('fails an insufficient unit count', () => {
    const rows = evaluateBagrutAccess(cs, { ...strong, mathUnits: 2 });
    expect(rows.find((r) => r.key === 'math')!.status).toBe('DOES_NOT_MEET');
  });
});

describe('calculated grade never satisfies an official requirement', () => {
  it('stays NOT_DETERMINABLE even when the calculated grade beats the threshold', () => {
    const calc = calculateGermanGrade(strong)!;
    expect(calc.german).toBeLessThan(2.5);
    const row = evaluateProgram(cs, rwth, strong).rows.find((r) => r.key === 'grade')!;
    expect(row.calculated).toBe(true);
    expect(row.status).toBe('NOT_DETERMINABLE');
  });

  it('can rule a student out when the calculated grade is worse than the threshold', () => {
    const row = evaluateProgram(cs, rwth, { ...strong, bagrutAverage: 60 }).rows.find(
      (r) => r.key === 'grade',
    )!;
    expect(row.status).toBe('DOES_NOT_MEET');
  });
});

describe('unverified requirements never pass', () => {
  it('reports an unverified programme language requirement as NOT_DETERMINABLE', () => {
    const row = evaluateProgram(cs, tum, strong).rows.find((r) => r.key === 'language')!;
    expect(row.status).toBe('NOT_DETERMINABLE');
    expect(row.requirement).toBeNull();
  });

  it('never returns MEETS overall while facts are missing', () => {
    expect(evaluateProgram(cs, tum, strong).overall).toBe('NOT_DETERMINABLE');
  });
});

describe('intake completeness', () => {
  it('lists every unanswered question', () => {
    expect(missingIntakeFields({}).length).toBeGreaterThan(8);
    expect(missingIntakeFields(strong)).toHaveLength(0);
  });
});

describe('conflicting official sources are never resolved automatically', () => {
  it('keeps both values and produces no deadline', () => {
    const tud = cs.programs.find((p) => p.id === 'tud-informatik-bsc')!;
    expect(tud.deadline.status).toBe('conflicting');
    expect(tud.deadline.value).toBeNull();
    expect(tud.deadline.conflict).toHaveLength(2);
    const row = evaluateProgram(cs, tud, strong).rows.find((r) => r.key === 'deadline')!;
    expect(row.status).toBe('NOT_DETERMINABLE');
  });
});
