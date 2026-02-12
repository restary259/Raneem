import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CVData, EducationEntry, ExperienceEntry, PublicationEntry, CertificateEntry, VolunteerEntry, ReferenceEntry, LanguageSkill } from './types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  data: CVData;
  setData: React.Dispatch<React.SetStateAction<CVData>>;
  updatePersonal: (partial: Partial<CVData['personal']>) => void;
  updateData: (partial: Partial<CVData>) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const CVForm: React.FC<Props> = ({ data, setData, updatePersonal, updateData }) => {
  const { t } = useTranslation('resources');
  const f = (key: string) => t(`lebenslaufBuilder.fields.${key}`);
  const s = (key: string) => t(`lebenslaufBuilder.sections.${key}`);
  const a = (key: string) => t(`lebenslaufBuilder.actions.${key}`);

  // Generic list helpers
  const addItem = <T,>(key: keyof CVData, factory: () => T) => {
    setData(prev => ({ ...prev, [key]: [...(prev[key] as unknown as T[]), factory()] }));
  };
  const removeItem = (key: keyof CVData, id: string) => {
    setData(prev => ({ ...prev, [key]: (prev[key] as unknown as any[]).filter((x: any) => x.id !== id) }));
  };
  const updateItem = <T extends { id: string }>(key: keyof CVData, id: string, partial: Partial<T>) => {
    setData(prev => ({
      ...prev,
      [key]: (prev[key] as unknown as T[]).map(x => x.id === id ? { ...x, ...partial } : x),
    }));
  };
  const moveItem = (key: keyof CVData, idx: number, dir: -1 | 1) => {
    setData(prev => {
      const arr = [...(prev[key] as unknown as any[])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, [key]: arr };
    });
  };

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePersonal({ photo: reader.result as string });
    reader.readAsDataURL(file);
  }, [updatePersonal]);

  return (
    <div className="space-y-4">
      {/* Template & Language */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{t('lebenslaufBuilder.chooseTemplate')}</Label>
          <Select value={data.template} onValueChange={v => updateData({ template: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="german-standard">{t('lebenslaufBuilder.templates.germanStandard')}</SelectItem>
              <SelectItem value="academic">{t('lebenslaufBuilder.templates.academic')}</SelectItem>
              <SelectItem value="europass">{t('lebenslaufBuilder.templates.europass')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t('lebenslaufBuilder.contentLanguage')}</Label>
          <Select value={data.contentLanguage} onValueChange={v => updateData({ contentLanguage: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="de">{t('lebenslaufBuilder.german')}</SelectItem>
              <SelectItem value="en">{t('lebenslaufBuilder.english')}</SelectItem>
              <SelectItem value="ar">{t('lebenslaufBuilder.arabic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['personal']} className="w-full">
        {/* Personal */}
        <AccordionItem value="personal">
          <AccordionTrigger>{s('personal')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{f('firstName')}</Label><Input value={data.personal.firstName} onChange={e => updatePersonal({ firstName: e.target.value })} /></div>
              <div><Label>{f('lastName')}</Label><Input value={data.personal.lastName} onChange={e => updatePersonal({ lastName: e.target.value })} /></div>
            </div>
            <div><Label>{f('email')}</Label><Input type="email" value={data.personal.email} onChange={e => updatePersonal({ email: e.target.value })} /></div>
            <div><Label>{f('phone')}</Label><Input value={data.personal.phone} onChange={e => updatePersonal({ phone: e.target.value })} /></div>
            <div><Label>{f('address')}</Label><Input value={data.personal.address} onChange={e => updatePersonal({ address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{f('birthDate')}</Label><Input type="date" value={data.personal.birthDate || ''} onChange={e => updatePersonal({ birthDate: e.target.value })} /></div>
              <div><Label>{f('birthPlace')}</Label><Input value={data.personal.birthPlace || ''} onChange={e => updatePersonal({ birthPlace: e.target.value })} /></div>
            </div>
            <div><Label>{f('nationality')}</Label><Input value={data.personal.nationality || ''} onChange={e => updatePersonal({ nationality: e.target.value })} /></div>
            <div><Label>LinkedIn</Label><Input value={data.personal.linkedin || ''} onChange={e => updatePersonal({ linkedin: e.target.value })} /></div>
            <div><Label>GitHub</Label><Input value={data.personal.github || ''} onChange={e => updatePersonal({ github: e.target.value })} /></div>
            <div><Label>{f('photo')}</Label><Input type="file" accept="image/*" onChange={handlePhotoUpload} /></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={data.showPhoto} onCheckedChange={v => updateData({ showPhoto: v })} /><Label>{t('lebenslaufBuilder.showPhoto')}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={data.showBirthDate} onCheckedChange={v => updateData({ showBirthDate: v })} /><Label>{t('lebenslaufBuilder.showBirthDate')}</Label></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Education */}
        <AccordionItem value="education">
          <AccordionTrigger>{s('education')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.education.map((e, idx) => (
              <div key={e.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{e.degree || `#${idx + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveItem('education', idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveItem('education', idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem('education', e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <Input placeholder={f('degree')} value={e.degree} onChange={ev => updateItem<EducationEntry>('education', e.id, { degree: ev.target.value })} />
                <Input placeholder={f('institution')} value={e.institution} onChange={ev => updateItem<EducationEntry>('education', e.id, { institution: ev.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={f('city')} value={e.city} onChange={ev => updateItem<EducationEntry>('education', e.id, { city: ev.target.value })} />
                  <Input placeholder={f('country')} value={e.country} onChange={ev => updateItem<EducationEntry>('education', e.id, { country: ev.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" placeholder={f('from')} value={e.from} onChange={ev => updateItem<EducationEntry>('education', e.id, { from: ev.target.value })} />
                  <Input type="month" placeholder={f('to')} value={e.to} disabled={e.current} onChange={ev => updateItem<EducationEntry>('education', e.id, { to: ev.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={e.current} onCheckedChange={v => updateItem<EducationEntry>('education', e.id, { current: v })} />
                  <Label className="text-xs">{f('current')}</Label>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<EducationEntry>('education', () => ({ id: uid(), degree: '', institution: '', city: '', country: '', from: '', to: '', current: false, details: [] }))}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Experience */}
        <AccordionItem value="experience">
          <AccordionTrigger>{s('experience')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.experience.map((e, idx) => (
              <div key={e.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{e.title || `#${idx + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveItem('experience', idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveItem('experience', idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem('experience', e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <Input placeholder={f('title')} value={e.title} onChange={ev => updateItem<ExperienceEntry>('experience', e.id, { title: ev.target.value })} />
                <Input placeholder={f('company')} value={e.company} onChange={ev => updateItem<ExperienceEntry>('experience', e.id, { company: ev.target.value })} />
                <Input placeholder={f('city')} value={e.city} onChange={ev => updateItem<ExperienceEntry>('experience', e.id, { city: ev.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" value={e.from} onChange={ev => updateItem<ExperienceEntry>('experience', e.id, { from: ev.target.value })} />
                  <Input type="month" value={e.to} disabled={e.current} onChange={ev => updateItem<ExperienceEntry>('experience', e.id, { to: ev.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={e.current} onCheckedChange={v => updateItem<ExperienceEntry>('experience', e.id, { current: v })} />
                  <Label className="text-xs">{f('current')}</Label>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<ExperienceEntry>('experience', () => ({ id: uid(), title: '', company: '', city: '', from: '', to: '', current: false, bullets: [] }))}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Skills & Languages */}
        <AccordionItem value="skills">
          <AccordionTrigger>{s('skills')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Label className="font-medium">{f('language')}</Label>
            {data.skills.languages.map((l, idx) => (
              <div key={l.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f('language')} value={l.name} onChange={e => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], name: e.target.value };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }} />
                <Select value={l.level} onValueChange={v => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], level: v };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['A1','A2','B1','B2','C1','C2'].map(lv => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="w-24" placeholder={f('exam')} value={l.exam || ''} onChange={e => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], exam: e.target.value };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }} />
                <Button size="icon" variant="ghost" onClick={() => {
                  updateData({ skills: { ...data.skills, languages: data.skills.languages.filter(x => x.id !== l.id) } });
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateData({ skills: { ...data.skills, languages: [...data.skills.languages, { id: uid(), name: '', level: 'A1', exam: '' }] } })}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>

            <div>
              <Label>{f('technical')}</Label>
              <Input placeholder="Python, Git, MS Office..." value={data.skills.technical.join(', ')} onChange={e => updateData({ skills: { ...data.skills, technical: e.target.value.split(',').map(s => s.trim()) } })} />
            </div>
            <div>
              <Label>{f('other')}</Label>
              <Input placeholder="Teamwork, Leadership..." value={data.skills.other.join(', ')} onChange={e => updateData({ skills: { ...data.skills, other: e.target.value.split(',').map(s => s.trim()) } })} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Certificates */}
        <AccordionItem value="certificates">
          <AccordionTrigger>{s('certificates')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.certificates.map((c, idx) => (
              <div key={c.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f('certName')} value={c.name} onChange={e => updateItem<CertificateEntry>('certificates', c.id, { name: e.target.value })} />
                <Input className="flex-1" placeholder={f('issuer')} value={c.issuer} onChange={e => updateItem<CertificateEntry>('certificates', c.id, { issuer: e.target.value })} />
                <Input className="w-28" type="month" value={c.date} onChange={e => updateItem<CertificateEntry>('certificates', c.id, { date: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeItem('certificates', c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<CertificateEntry>('certificates', () => ({ id: uid(), name: '', issuer: '', date: '' }))}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Publications (Academic template) */}
        {data.template === 'academic' && (
          <AccordionItem value="publications">
            <AccordionTrigger>{s('publications')}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {data.publications.map((p, idx) => (
                <div key={p.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex justify-end"><Button size="icon" variant="ghost" onClick={() => removeItem('publications', p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  <Input placeholder={f('pubTitle')} value={p.title} onChange={e => updateItem<PublicationEntry>('publications', p.id, { title: e.target.value })} />
                  <Input placeholder={f('publisher')} value={p.publisher} onChange={e => updateItem<PublicationEntry>('publications', p.id, { publisher: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="month" value={p.date} onChange={e => updateItem<PublicationEntry>('publications', p.id, { date: e.target.value })} />
                    <Input placeholder={f('doi')} value={p.doi || ''} onChange={e => updateItem<PublicationEntry>('publications', p.id, { doi: e.target.value })} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addItem<PublicationEntry>('publications', () => ({ id: uid(), title: '', publisher: '', date: '', doi: '' }))}>
                <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
              </Button>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Volunteer */}
        <AccordionItem value="volunteer">
          <AccordionTrigger>{s('volunteer')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.volunteer.map((v, idx) => (
              <div key={v.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{v.role || `#${idx + 1}`}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeItem('volunteer', v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <Input placeholder={f('organization')} value={v.organization} onChange={e => updateItem<VolunteerEntry>('volunteer', v.id, { organization: e.target.value })} />
                <Input placeholder={f('role')} value={v.role} onChange={e => updateItem<VolunteerEntry>('volunteer', v.id, { role: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" value={v.from} onChange={e => updateItem<VolunteerEntry>('volunteer', v.id, { from: e.target.value })} />
                  <Input type="month" value={v.to} disabled={v.current} onChange={e => updateItem<VolunteerEntry>('volunteer', v.id, { to: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={v.current} onCheckedChange={val => updateItem<VolunteerEntry>('volunteer', v.id, { current: val })} />
                  <Label className="text-xs">{f('current')}</Label>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<VolunteerEntry>('volunteer', () => ({ id: uid(), organization: '', role: '', from: '', to: '', current: false }))}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* References */}
        <AccordionItem value="references">
          <AccordionTrigger>{s('references')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.references.map((r, idx) => (
              <div key={r.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f('refName')} value={r.name} onChange={e => updateItem<ReferenceEntry>('references', r.id, { name: e.target.value })} />
                <Input className="flex-1" placeholder={f('refPosition')} value={r.position} onChange={e => updateItem<ReferenceEntry>('references', r.id, { position: e.target.value })} />
                <Input className="flex-1" placeholder={f('refContact')} value={r.contact} onChange={e => updateItem<ReferenceEntry>('references', r.id, { contact: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeItem('references', r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<ReferenceEntry>('references', () => ({ id: uid(), name: '', position: '', contact: '' }))}>
              <Plus className="h-4 w-4 mr-1" />{a('addEntry')}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default CVForm;
