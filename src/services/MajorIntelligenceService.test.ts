import { describe, expect, test } from 'vitest';
import { intakeFromCase } from './MajorIntelligenceService';

describe('MajorIntelligenceService intake mapping', () => {
  test('prefers the validated intelligence snapshot over legacy case fields', () => {
    expect(intakeFromCase({
      intel_student_intake: {
        bagrutAverage: 91,
        mathUnits: 5,
        englishGrade: 88,
        germanLevel: 'B2',
      },
      bagrut_score: 80,
      math_units: 4,
      english_units: 5,
    })).toMatchObject({
      bagrutAverage: 91,
      mathUnits: 5,
      englishUnits: 5,
      englishGrade: 88,
      germanLevel: 'B2',
    });
  });

  test('prefills only compatible legacy student data when no snapshot exists', () => {
    expect(intakeFromCase({
      intel_student_intake: null,
      bagrut_score: 87,
      math_units: 5,
      english_units: 4,
    })).toEqual(expect.objectContaining({
      bagrutAverage: 87,
      mathUnits: 5,
      englishUnits: 4,
    }));
  });

  test('rejects unknown German levels from stored JSON', () => {
    expect(intakeFromCase({
      intel_student_intake: { germanLevel: 'native' },
      bagrut_score: null,
      math_units: null,
      english_units: null,
    }).germanLevel).toBeUndefined();
  });
});