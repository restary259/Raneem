import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StudentIntake } from '@/lib/eligibility/engine';
import { GERMAN_LEVEL_ORDER, type GermanLevel } from '@/data/intel/types';

interface Props {
  intake: StudentIntake;
  onChange: (next: StudentIntake) => void;
}

/**
 * The single intake surface. Every field here exists because a requirement in
 * the fact store reads it — nothing is collected "just in case".
 */
export default function IntakeForm({ intake, onChange }: Props) {
  const { t } = useTranslation('dashboard');
  const set = (patch: Partial<StudentIntake>) => onChange({ ...intake, ...patch });
  const numeric = (v: string) => (v === '' ? undefined : Number(v));

  const field = (
    id: keyof StudentIntake,
    labelKey: string,
    fallback: string,
    type: 'text' | 'number' = 'text',
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={String(id)} className="text-xs">
        {t(`intel.field.${labelKey}`, fallback)}
      </Label>
      <Input
        id={String(id)}
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={(intake[id] as string | number | undefined) ?? ''}
        onChange={(e) =>
          set({ [id]: type === 'number' ? numeric(e.target.value) : e.target.value } as Partial<StudentIntake>)
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {field('bagrutYear', 'bagrutYear', 'Graduation year')}
        {field('bagrutAverage', 'bagrutAverage', 'Overall Bagrut result', 'number')}
        {field('mathUnits', 'mathUnits', 'Maths units', 'number')}
        {field('mathGrade', 'mathGrade', 'Maths grade', 'number')}
        {field('englishUnits', 'englishUnits', 'English units', 'number')}
        {field('englishGrade', 'englishGrade', 'English grade', 'number')}
        {field('furtherSubject', 'furtherSubject', 'Further subject')}
        {field('furtherUnits', 'furtherUnits', 'Further subject units', 'number')}
        {field('furtherGrade', 'furtherGrade', 'Further subject grade', 'number')}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('intel.field.germanLevel', 'Current German level')}</Label>
          <Select
            value={intake.germanLevel ?? ''}
            onValueChange={(v) => set({ germanLevel: v as GermanLevel })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {GERMAN_LEVEL_ORDER.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field('germanCertificate', 'germanCertificate', 'Certificate held')}
        {field('germanCertificateDate', 'germanCertificateDate', 'Certificate date (expected)')}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
        <Switch
          id="fullBagrut"
          checked={intake.fullBagrut === true}
          onCheckedChange={(v) => set({ fullBagrut: v })}
        />
        <Label htmlFor="fullBagrut" className="text-sm">
          {t('intel.field.fullBagrut', 'Holds a full Bagrut certificate')}
        </Label>
      </div>
    </div>
  );
}
