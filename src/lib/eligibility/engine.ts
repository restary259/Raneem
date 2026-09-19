/**
 * DARB Major Intelligence — pure eligibility rule engine.
 *
 * Non-negotiable rules encoded here:
 *  - A missing official requirement produces NOT_DETERMINABLE, never a pass.
 *  - A missing student value produces NOT_DETERMINABLE, never a fail.
 *  - A CALCULATED value (converted Bagrut grade) can rule a student OUT, but it
 *    can NEVER satisfy an official requirement: the university performs the
 *    official conversion itself.
 *  - Requirements are never transferred between universities.
 */
import type { MajorIntel, ProgramIntel, GermanLevel } from '@/data/intel/types';
import { GERMAN_LEVEL_ORDER } from '@/data/intel/types';
import type { VerifiedFact } from '@/data/intel/factTypes';
import { bagrutToGermanGrade } from '@/utils/gradeConverter';

export type CheckStatus = 'MEETS' | 'DOES_NOT_MEET' | 'NOT_DETERMINABLE';

export interface StudentIntake {
  bagrutYear?: string;
  fullBagrut?: boolean;
  bagrutAverage?: number;
  mathUnits?: number;
  mathGrade?: number;
  englishUnits?: number;
  englishGrade?: number;
  furtherSubject?: string;
  furtherUnits?: number;
  furtherGrade?: number;
  germanLevel?: GermanLevel;
  germanCertificate?: string;
  germanCertificateDate?: string;
}

export const EMPTY_INTAKE: StudentIntake = {};

export interface CheckRow {
  /** i18n key suffix under `intel.row.*`. */
  key: string;
  /** Official requirement as published, or `null` when none is published. */
  requirement: string | null;
  requirementAR?: string | null;
  /** What the student brings, or `null` when we have not asked yet. */
  studentValue: string | null;
  status: CheckStatus;
  /** Why a status is NOT_DETERMINABLE, or what must be checked. */
  note?: string;
  noteAR?: string;
  /** True when the row is driven by a DARB calculation, not an official value. */
  calculated?: boolean;
  sourceId?: string | null;
}

const num = (v: number | undefined) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function compareUnits(required: number | undefined, actual: number | undefined): CheckStatus {
  if (required === undefined || actual === undefined) return 'NOT_DETERMINABLE';
  return actual >= required ? 'MEETS' : 'DOES_NOT_MEET';
}

/** Nationwide Bagrut access rule (anabin), evaluated against the intake. */
export function evaluateBagrutAccess(major: MajorIntel, intake: StudentIntake): CheckRow[] {
  const access = major.bagrutAccess;
  if (!access || access.status !== 'verified' || !access.value) {
    return [
      {
        key: 'access',
        requirement: null,
        studentValue: null,
        status: 'NOT_DETERMINABLE',
        note: access?.note ?? 'No verified access rule on file for this major.',
        noteAR: access?.noteAR,
        sourceId: access?.sourceId ?? null,
      },
    ];
  }
  const v = access.value;
  return [
    {
      key: 'math',
      requirement: `${v.mathUnits} units`,
      requirementAR: `${v.mathUnits} وحدات`,
      studentValue: num(intake.mathUnits) !== undefined ? `${intake.mathUnits} units` : null,
      status: compareUnits(v.mathUnits, num(intake.mathUnits)),
      sourceId: access.sourceId,
    },
    {
      key: 'english',
      requirement: `${v.englishUnits} units`,
      requirementAR: `${v.englishUnits} وحدات`,
      studentValue: num(intake.englishUnits) !== undefined ? `${intake.englishUnits} units` : null,
      status: compareUnits(v.englishUnits, num(intake.englishUnits)),
      sourceId: access.sourceId,
    },
    {
      key: 'further',
      requirement: `${v.furtherUnits} units`,
      requirementAR: `${v.furtherUnits} وحدات`,
      studentValue:
        num(intake.furtherUnits) !== undefined
          ? `${intake.furtherSubject ? `${intake.furtherSubject} · ` : ''}${intake.furtherUnits} units`
          : null,
      status: compareUnits(v.furtherUnits, num(intake.furtherUnits)),
      sourceId: access.sourceId,
    },
    {
      key: 'fullBagrut',
      requirement: 'Full Bagrut certificate',
      requirementAR: 'شهادة بجروت كاملة',
      studentValue: intake.fullBagrut === undefined ? null : intake.fullBagrut ? 'Yes' : 'No',
      status:
        intake.fullBagrut === undefined
          ? 'NOT_DETERMINABLE'
          : intake.fullBagrut
            ? 'MEETS'
            : 'DOES_NOT_MEET',
      sourceId: access.sourceId,
    },
  ];
}

export interface CalculatedGrade {
  german: number;
  formula: string;
  /** Always CALCULATED_VALUE — the engine never treats it as official. */
  factType: 'CALCULATED_VALUE';
}

export function calculateGermanGrade(intake: StudentIntake): CalculatedGrade | null {
  const avg = num(intake.bagrutAverage);
  if (avg === undefined || avg < 0 || avg > 100) return null;
  const r = bagrutToGermanGrade(avg);
  return { german: r.german, formula: r.formulaString, factType: 'CALCULATED_VALUE' };
}

function factRow(
  key: string,
  f: VerifiedFact<unknown> | undefined,
  requirement: string | null,
  studentValue: string | null,
  status: CheckStatus,
): CheckRow {
  return {
    key,
    requirement,
    studentValue,
    status,
    note: f?.note,
    noteAR: f?.noteAR,
    sourceId: f?.sourceId ?? null,
  };
}

export interface ProgramAssessment {
  programId: string;
  rows: CheckRow[];
  /** i18n keys of rows that block an application right now. */
  missing: string[];
  /** Rows the team must verify before advising. */
  toVerify: string[];
  overall: CheckStatus;
}

export function evaluateProgram(
  major: MajorIntel,
  program: ProgramIntel,
  intake: StudentIntake,
): ProgramAssessment {
  const rows: CheckRow[] = [...evaluateBagrutAccess(major, intake)];

  // Programme-specific subject requirements.
  const subj = program.subjectRequirements;
  if (subj.status === 'verified' && subj.value) {
    for (const s of subj.value) {
      const actual =
        s.subject === 'mathematics'
          ? num(intake.mathUnits)
          : s.subject === 'english'
            ? num(intake.englishUnits)
            : num(intake.furtherUnits);
      rows.push({
        key: `subject.${s.subject}`,
        requirement: s.label,
        requirementAR: s.labelAR,
        studentValue: actual !== undefined ? `${actual} units` : null,
        status: compareUnits(s.units, actual),
        sourceId: subj.sourceId,
      });
    }
  } else {
    rows.push(factRow('subject.programme', subj, null, null, 'NOT_DETERMINABLE'));
  }

  // Language.
  const lang = program.languageRequirement;
  if (lang.status === 'verified' && lang.value) {
    const required = lang.value.minimumLevel;
    const isEnglish = lang.value.language === 'English';
    if (isEnglish) {
      rows.push({
        key: 'language',
        requirement: `English ${required} · ${lang.value.certificates.join(' / ')}`,
        studentValue: null,
        status: 'NOT_DETERMINABLE',
        note: 'This programme requires English. The current saved intake schema captures German evidence only, so English eligibility must be checked from the student certificate manually.',
        noteAR: 'هذا البرنامج يتطلب الإنجليزية. نموذج بيانات الطالب الحالي يحفظ إثبات الألمانية فقط، لذلك يجب التحقق من أهلية الإنجليزية يدوياً من شهادة الطالب.',
        sourceId: lang.sourceId,
      });
    } else {
      const have = intake.germanLevel;
      const status: CheckStatus = !have
        ? 'NOT_DETERMINABLE'
        : GERMAN_LEVEL_ORDER.indexOf(have) >= GERMAN_LEVEL_ORDER.indexOf(required)
          ? intake.germanCertificate
            ? 'MEETS'
            : 'NOT_DETERMINABLE'
          : 'DOES_NOT_MEET';
      rows.push({
        key: 'language',
        requirement: `German ${required} · ${lang.value.certificates.join(' / ')}`,
        studentValue: have ? `${have}${intake.germanCertificate ? ` · ${intake.germanCertificate}` : ''}` : null,
        status,
        note:
          status === 'NOT_DETERMINABLE' && have
            ? 'Level reported but no certificate recorded. Only an accepted certificate proves the level.'
            : lang.note,
        noteAR:
          status === 'NOT_DETERMINABLE' && have
            ? 'المستوى مذكور دون شهادة مسجّلة. الشهادة المقبولة وحدها تثبت المستوى.'
            : lang.noteAR,
        sourceId: lang.sourceId,
      });
    }
  } else {
    rows.push(factRow('language', lang, null, intake.germanLevel ?? null, 'NOT_DETERMINABLE'));
  }
  // Grade — CALCULATED can only rule out, never rule in.
  const grade = program.gradeRequirement;
  const calc = calculateGermanGrade(intake);
  if (grade.status === 'verified' && grade.value?.maximumGermanGrade !== undefined) {
    const max = grade.value.maximumGermanGrade;
    let status: CheckStatus = 'NOT_DETERMINABLE';
    let note =
      'The university performs the official conversion. A calculated grade never confirms admission.';
    let noteAR = 'الجامعة هي من تُجري التحويل الرسمي. المعدل المحسوب لا يؤكد القبول أبداً.';
    if (calc) {
      if (calc.german > max) {
        status = 'DOES_NOT_MEET';
        note = grade.value.compensation ?? note;
        noteAR = grade.value.compensationAR ?? noteAR;
      }
    }
    rows.push({
      key: 'grade',
      requirement: `≤ ${max.toFixed(2)}`,
      studentValue: calc ? calc.german.toFixed(2) : null,
      status,
      note,
      noteAR,
      calculated: true,
      sourceId: grade.sourceId,
    });
  } else {
    rows.push({
      ...factRow('grade', grade, null, calc ? calc.german.toFixed(2) : null, 'NOT_DETERMINABLE'),
      calculated: true,
    });
  }

  // Application route + deadline are procedural rows: verified or not.
  rows.push(
    factRow(
      'channel',
      program.applicationChannel,
      program.applicationChannel.value ? String(program.applicationChannel.value) : null,
      null,
      program.applicationChannel.status === 'verified' ? 'MEETS' : 'NOT_DETERMINABLE',
    ),
  );
  rows.push(
    factRow(
      'deadline',
      program.deadline,
      program.deadline.status === 'verified' && program.deadline.value
        ? program.deadline.value.deadline
        : null,
      null,
      program.deadline.status === 'verified' ? 'MEETS' : 'NOT_DETERMINABLE',
    ),
  );

  const missing = rows.filter((r) => r.status === 'DOES_NOT_MEET').map((r) => r.key);
  const toVerify = rows.filter((r) => r.status === 'NOT_DETERMINABLE').map((r) => r.key);
  const overall: CheckStatus = missing.length
    ? 'DOES_NOT_MEET'
    : toVerify.length
      ? 'NOT_DETERMINABLE'
      : 'MEETS';

  return { programId: program.id, rows, missing, toVerify, overall };
}

/** Intake fields the team must still collect before advising. */
export function missingIntakeFields(intake: StudentIntake): string[] {
  const required: (keyof StudentIntake)[] = [
    'bagrutYear',
    'bagrutAverage',
    'mathUnits',
    'mathGrade',
    'englishUnits',
    'englishGrade',
    'furtherSubject',
    'furtherUnits',
    'furtherGrade',
    'germanLevel',
    'germanCertificate',
  ];
  return required.filter((k) => {
    const v = intake[k];
    return v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));
  }) as string[];
}
