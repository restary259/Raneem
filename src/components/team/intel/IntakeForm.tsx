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
  compact?: boolean;
}

/**
 * The single intake surface. Every field here exists because a requirement in
 * the fact store reads it — nothing is collected "just in case".
 */
export default function IntakeForm({ intake, onChange, compact = false }: Props) {
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

  const groups = [
    {
      key: 'bagrut',
      title: t('intel.group.bagrut', 'Bagrut'),
      fields: [
        field('bagrutYear', 'bagrutYear', 'Graduation year'),
        field('bagrutAverage', 'bagrutAverage', 'Overall Bagrut result', 'number'),
      ],
    },
    {
      key: 'subjects',
      title: t('intel.group.subjects', 'Subjects'),
      fields: [
        field('mathUnits', 'mathUnits', 'Maths units', 'number'),
        field('mathGrade', 'mathGrade', 'Maths grade', 'number'),
        field('englishUnits', 'englishUnits', 'English units', 'number'),
        field('englishGrade', 'englishGrade', 'English grade', 'number'),
        field('furtherSubject', 'furtherSubject', 'Further subject'),
        field('furtherUnits', 'furtherUnits', 'Further subject units', 'number'),
        field('furtherGrade', 'furtherGrade', 'Further subject grade', 'number'),
      ],
    },
    {
      key: 'german',
      title: t('intel.group.german', 'German'),
      fields: [
        <div className="space-y-1.5">
          <Label htmlFor="germanLevel" className="text-xs">{t('intel.field.germanLevel', 'Current German level')}</Label>
          <Select
            value={intake.germanLevel ?? 'all'}
            onValueChange={(v) => set({ germanLevel: v === 'all' ? undefined : (v as GermanLevel) })}
          >
            <SelectTrigger id="germanLevel">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {GERMAN_LEVEL_ORDER.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>,
        field('germanCertificate', 'germanCertificate', 'Certificate held'),
        field('germanCertificateDate', 'germanCertificateDate', 'Certificate date (expected)'),
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">{group.title}</h3>
          <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-3 md:grid-cols-4'}>
            {group.fields.map((item, index) => <React.Fragment key={`${group.key}-${index}`}>{item}</React.Fragment>)}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3 rounded-md border border-border/60 p-3">
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
