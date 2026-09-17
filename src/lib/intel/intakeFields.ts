/**
 * Maps each intake field onto the input that collects it, so the "still
 * missing" list can jump the team straight to the empty box.
 */
export const INTAKE_FIELD_INPUT_ID: Record<string, string> = {
  bagrutYear: 'bagrutYear',
  bagrutAverage: 'bagrutAverage',
  mathUnits: 'mathUnits',
  mathGrade: 'mathGrade',
  englishUnits: 'englishUnits',
  englishGrade: 'englishGrade',
  furtherSubject: 'furtherSubject',
  furtherUnits: 'furtherUnits',
  furtherGrade: 'furtherGrade',
  germanLevel: 'germanLevel',
  germanCertificate: 'germanCertificate',
};

export const INTAKE_FIELD_FALLBACK: Record<string, string> = {
  bagrutYear: 'Graduation year',
  bagrutAverage: 'Overall Bagrut result',
  mathUnits: 'Maths units',
  mathGrade: 'Maths grade',
  englishUnits: 'English units',
  englishGrade: 'English grade',
  furtherSubject: 'Further subject',
  furtherUnits: 'Further subject units',
  furtherGrade: 'Further subject grade',
  germanLevel: 'Current German level',
  germanCertificate: 'Certificate held',
};

export function focusIntakeField(field: string): void {
  const id = INTAKE_FIELD_INPUT_ID[field];
  if (!id) return;
  const el = document.getElementById(id) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}
