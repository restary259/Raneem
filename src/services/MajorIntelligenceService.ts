import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { GermanLevel } from '@/data/intel/types';
import type { StudentIntake } from '@/lib/eligibility/engine';

export interface IntelCaseContext {
  id: string;
  fullName: string;
  caseReference: string | null;
  degreeInterest: string | null;
  intake: StudentIntake;
  updatedAt: string | null;
}

const GERMAN_LEVELS = new Set<GermanLevel>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function record(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function number(value: Json | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boolean(value: Json | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function intakeFromCase(row: {
  intel_student_intake: Json | null;
  bagrut_score: number | null;
  math_units: number | null;
  english_units: number | null;
}): StudentIntake {
  const saved = record(row.intel_student_intake);
  const level = text(saved.germanLevel);
  return {
    bagrutYear: text(saved.bagrutYear),
    fullBagrut: boolean(saved.fullBagrut),
    bagrutAverage: number(saved.bagrutAverage) ?? row.bagrut_score ?? undefined,
    mathUnits: number(saved.mathUnits) ?? row.math_units ?? undefined,
    mathGrade: number(saved.mathGrade),
    englishUnits: number(saved.englishUnits) ?? row.english_units ?? undefined,
    englishGrade: number(saved.englishGrade),
    furtherSubject: text(saved.furtherSubject),
    furtherUnits: number(saved.furtherUnits),
    furtherGrade: number(saved.furtherGrade),
    germanLevel: level && GERMAN_LEVELS.has(level as GermanLevel) ? (level as GermanLevel) : undefined,
    germanCertificate: text(saved.germanCertificate),
    germanCertificateDate: text(saved.germanCertificateDate),
  };
}

export const MajorIntelligenceService = {
  async loadCase(caseId: string): Promise<IntelCaseContext> {
    const { data, error } = await supabase
      .from('cases')
      .select('id,full_name,case_reference,degree_interest,bagrut_score,math_units,english_units,intel_student_intake,intel_intake_updated_at')
      .eq('id', caseId)
      .single();
    if (error) throw error;
    return {
      id: data.id,
      fullName: data.full_name,
      caseReference: data.case_reference,
      degreeInterest: data.degree_interest,
      intake: intakeFromCase(data),
      updatedAt: data.intel_intake_updated_at,
    };
  },

  async saveCaseIntake(caseId: string, intake: StudentIntake): Promise<string> {
    const clean = Object.fromEntries(
      Object.entries(intake).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ) as Json;
    const { data, error } = await supabase.rpc('save_case_intel_intake', {
      p_case_id: caseId,
      p_intake: clean,
    });
    if (error) throw error;
    const saved = data?.[0];
    if (!saved) throw new Error('INTEL_INTAKE_SAVE_EMPTY');
    return saved.intel_intake_updated_at;
  },
};