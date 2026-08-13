import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CVData, CVSectionKey, EducationEntry, ExperienceEntry, ProjectEntry, AwardEntry,
  PublicationEntry, CertificateEntry, VolunteerEntry, ReferenceEntry,
  CVFontKey, CVTemplate, CVContentLanguage, CVSignatureMode,
} from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ImagePlus, X,
} from "lucide-react";
import {
  COLOR_PRESETS, DESIGN_PRESETS, FONTS, TYPOGRAPHY_PRESETS, applyPreset,
  applyTypographyPreset, isHex, safeAccentOnWhite, contrastRatio,
} from "./cvDesign";

interface Props {
  data: CVData;
  setData: React.Dispatch<React.SetStateAction<CVData>>;
  updatePersonal: (partial: Partial<CVData["personal"]>) => void;
  updateData: (partial: Partial<CVData>) => void;
  updateDesign: (partial: Partial<CVData["design"]>) => void;
  updateSignature: (partial: Partial<CVData["signature"]>) => void;
  errors: Record<string, string>;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const CVForm: React.FC<Props> = ({ data, setData, updatePersonal, updateData, updateDesign, updateSignature, errors }) => {
  const { t } = useTranslation("resources");
  const f = (key: string, fb?: string) => t(`lebenslaufBuilder.fields.${key}`, fb ?? key);
  const s = (key: string, fb?: string) => t(`lebenslaufBuilder.sections.${key}`, fb ?? key);
  const a = (key: string, fb?: string) => t(`lebenslaufBuilder.actions.${key}`, fb ?? key);
  const h = (key: string, fb?: string) => t(`lebenslaufBuilder.hints.${key}`, fb ?? "");

  // ── Generic list helpers ────────────────────────────────────────────────
  const addItem = <T,>(key: keyof CVData, factory: () => T) => {
    setData((prev) => ({ ...prev, [key]: [...(prev[key] as unknown as T[]), factory()] }));
  };
  const removeItem = (key: keyof CVData, id: string) => {
    setData((prev) => ({ ...prev, [key]: ((prev[key] as unknown as { id: string }[])).filter((x) => x.id !== id) }));
  };
  const updateItem = <T extends { id: string }>(key: keyof CVData, id: string, partial: Partial<T>) => {
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...partial } : x)),
    }));
  };
  const moveItem = (key: keyof CVData, idx: number, dir: -1 | 1) => {
    setData((prev) => {
      const arr = [...(prev[key] as unknown as { id: string }[])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, [key]: arr };
    });
  };

  /** Bullet list editor (add / remove / reorder / edit) shared by experience + projects. */
  const BulletEditor = ({ items, onChange }: { items: string[]; onChange: (b: string[]) => void }) => {
    const list = items.length > 0 ? items : [""];
    const set = (i: number, v: string) => {
      const next = [...list];
      next[i] = v;
      onChange(next);
    };
    return (
      <div className="space-y-1.5">
        {list.map((b, i) => (
          <div key={i} className="flex gap-1 items-start">
            <span className="text-xs text-muted-foreground mt-2">•</span>
            <Textarea
              rows={1}
              className="flex-1 text-sm"
              placeholder={h("bulletHint", "Responsibility or achievement…")}
              value={b}
              onChange={(e) => set(i, e.target.value)}
            />
            <Button size="icon" variant="ghost" aria-label={a("moveUp")} onClick={() => i > 0 && onChange([...list.slice(0, i), list[i + 1], list[i], ...list.slice(i + 2)])}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" aria-label={a("moveDown")} onClick={() => i < list.length - 1 && onChange([...list.slice(0, i), list[i + 1], list[i], ...list.slice(i + 2)])}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" aria-label={a("removeEntry")} onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...list, ""])}><Plus className="h-3.5 w-3.5 mr-1" />{a("addBullet")}</Button>
      </div>
    );
  };

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePersonal({ photo: reader.result as string });
    reader.readAsDataURL(file);
  }, [updatePersonal]);

  const handleSignatureUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSignature({ image: reader.result as string });
    reader.readAsDataURL(file);
  }, [updateSignature]);

  // ── Section enable/disable + reorder ────────────────────────────────────
  const sectionLabel = (k: CVSectionKey): string => {
    const map: Record<CVSectionKey, string> = {
      summary: s("summary"), education: s("education"), experience: s("experience"),
      projects: s("projects"), publications: s("publications"), awards: s("awards"),
      skills: s("skills"), certificates: s("certificates"), volunteer: s("volunteer"),
      references: s("references"),
    };
    return map[k];
  };
  const moveSection = (idx: number, dir: -1 | 1) => {
    setData((prev) => {
      const arr = [...prev.sectionOrder];
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return prev;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return { ...prev, sectionOrder: arr };
    });
  };

  // ── Validation helpers ──────────────────────────────────────────────────
  const errStyle = (key: string): string => (errors[key] ? "border-destructive" : "");

  // ── Design panel ────────────────────────────────────────────────────────
  const accentContrast = contrastRatio(safeAccentOnWhite(data.design.accent), "#FFFFFF");
  const lowContrast = accentContrast < 4.5;

  return (
    <div className="space-y-4">
      {/* Template & Language */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{t("lebenslaufBuilder.chooseTemplate")}</Label>
          <Select value={data.template} onValueChange={(v) => updateData({ template: v as CVTemplate })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="german-standard">{t("lebenslaufBuilder.templates.germanStandard")}</SelectItem>
              <SelectItem value="academic">{t("lebenslaufBuilder.templates.academic")}</SelectItem>
              <SelectItem value="europass">{t("lebenslaufBuilder.templates.europass")}</SelectItem>
              <SelectItem value="modern-sidebar">{t("lebenslaufBuilder.templates.modernSidebar", "Modern Sidebar")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("lebenslaufBuilder.contentLanguage")}</Label>
          <Select value={data.contentLanguage} onValueChange={(v) => updateData({ contentLanguage: v as CVContentLanguage })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="de">{t("lebenslaufBuilder.german")}</SelectItem>
              <SelectItem value="en">{t("lebenslaufBuilder.english")}</SelectItem>
              <SelectItem value="ar">{t("lebenslaufBuilder.arabic")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["personal"]} className="w-full">
        {/* ── Personal ───────────────────────────────────────────────────── */}
        <AccordionItem value="personal">
          <AccordionTrigger>{s("personal")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{f("firstName")} *</Label><Input className={errStyle("firstName")} value={data.personal.firstName} onChange={(e) => updatePersonal({ firstName: e.target.value })} />{errors.firstName && <p className="text-xs text-destructive mt-0.5">{errors.firstName}</p>}</div>
              <div><Label>{f("lastName")} *</Label><Input className={errStyle("lastName")} value={data.personal.lastName} onChange={(e) => updatePersonal({ lastName: e.target.value })} />{errors.lastName && <p className="text-xs text-destructive mt-0.5">{errors.lastName}</p>}</div>
            </div>
            <div><Label>{f("professionalTitle", "Professional title")}</Label><Input value={data.personal.professionalTitle || ""} onChange={(e) => updatePersonal({ professionalTitle: e.target.value })} placeholder={h("titleHint", "e.g. Informatik (B.Sc.)")} /></div>
            <div><Label>{f("email")} *</Label><Input type="email" className={errStyle("email")} value={data.personal.email} onChange={(e) => updatePersonal({ email: e.target.value })} />{errors.email && <p className="text-xs text-destructive mt-0.5">{errors.email}</p>}</div>
            <div><Label>{f("phone")}</Label><Input value={data.personal.phone} onChange={(e) => updatePersonal({ phone: e.target.value })} /></div>
            <div><Label>{f("address")}</Label><Input value={data.personal.address} onChange={(e) => updatePersonal({ address: e.target.value })} /></div>
            <div><Label>{f("website", "Website")}</Label><Input value={data.personal.website || ""} onChange={(e) => updatePersonal({ website: e.target.value })} placeholder="https://" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{f("birthDate")}</Label><Input type="date" value={data.personal.birthDate || ""} onChange={(e) => updatePersonal({ birthDate: e.target.value })} /></div>
              <div><Label>{f("birthPlace")}</Label><Input value={data.personal.birthPlace || ""} onChange={(e) => updatePersonal({ birthPlace: e.target.value })} /></div>
            </div>
            <div><Label>{f("nationality")}</Label><Input value={data.personal.nationality || ""} onChange={(e) => updatePersonal({ nationality: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>LinkedIn</Label><Input value={data.personal.linkedin || ""} onChange={(e) => updatePersonal({ linkedin: e.target.value })} /></div>
              <div><Label>GitHub</Label><Input value={data.personal.github || ""} onChange={(e) => updatePersonal({ github: e.target.value })} /></div>
            </div>
            <div>
              <Label>{f("photo")}</Label>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-md cursor-pointer hover:bg-accent/10">
                  <ImagePlus className="h-4 w-4" /> {t("lebenslaufBuilder.actions.upload", "Upload")}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                {data.personal.photo && (
                  <Button size="sm" variant="ghost" onClick={() => updatePersonal({ photo: undefined })}><X className="h-4 w-4 mr-1" />{t("lebenslaufBuilder.actions.remove", "Remove")}</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{h("photoHint", "Optional — modern German applications do not require a photo.")}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={data.showPhoto} onCheckedChange={(v) => updateData({ showPhoto: v })} /><Label>{t("lebenslaufBuilder.showPhoto")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={data.showBirthDate} onCheckedChange={(v) => updateData({ showBirthDate: v })} /><Label>{t("lebenslaufBuilder.showBirthDate")}</Label></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Profile / Summary ──────────────────────────────────────────── */}
        <AccordionItem value="summary">
          <AccordionTrigger>{s("summary", "Profile")}</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <Textarea rows={3} value={data.summary || ""} onChange={(e) => updateData({ summary: e.target.value })} placeholder={h("summaryHint", "2–3 sentences summarizing your background and goals. Optional.")} />
          </AccordionContent>
        </AccordionItem>

        {/* ── Education (progressive disclosure) ──────────────────────────── */}
        <AccordionItem value="education">
          <AccordionTrigger>{s("education")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.education.map((e, idx) => (
              <EducationEntryEditor key={e.id} entry={e} idx={idx}
                onChange={(p) => updateItem<EducationEntry>("education", e.id, p)}
                onRemove={() => removeItem("education", e.id)}
                onMove={(d) => moveItem("education", idx, d)}
                errors={errors}
              />
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<EducationEntry>("education", () => ({ id: uid(), degree: "", institution: "", city: "", country: "", from: "", to: "", current: false, details: [] }))}>
              <Plus className="h-4 w-4 mr-1" />{a("addEntry")}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Experience (with bullets) ──────────────────────────────────── */}
        <AccordionItem value="experience">
          <AccordionTrigger>{s("experience")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.experience.map((e, idx) => (
              <div key={e.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{e.title || `#${idx + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => moveItem("experience", idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => moveItem("experience", idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Remove entry" onClick={() => removeItem("experience", e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <Input placeholder={f("title")} value={e.title} onChange={(ev) => updateItem<ExperienceEntry>("experience", e.id, { title: ev.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={f("company")} value={e.company} onChange={(ev) => updateItem<ExperienceEntry>("experience", e.id, { company: ev.target.value })} />
                  <Input placeholder={f("city")} value={e.city} onChange={(ev) => updateItem<ExperienceEntry>("experience", e.id, { city: ev.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" placeholder={f("from")} value={e.from} onChange={(ev) => updateItem<ExperienceEntry>("experience", e.id, { from: ev.target.value })} />
                  <Input type="month" placeholder={f("to")} value={e.to} disabled={e.current} onChange={(ev) => updateItem<ExperienceEntry>("experience", e.id, { to: ev.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={e.current} onCheckedChange={(v) => updateItem<ExperienceEntry>("experience", e.id, { current: v })} />
                  <Label className="text-xs">{f("current")}</Label>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("lebenslaufBuilder.fields.bullets", "Description (bullets)")}</Label>
                  <BulletEditor items={e.bullets} onChange={(b) => updateItem<ExperienceEntry>("experience", e.id, { bullets: b })} />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<ExperienceEntry>("experience", () => ({ id: uid(), title: "", company: "", city: "", from: "", to: "", current: false, bullets: [] }))}>
              <Plus className="h-4 w-4 mr-1" />{a("addEntry")}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Projects ───────────────────────────────────────────────────── */}
        <AccordionItem value="projects">
          <AccordionTrigger>{s("projects", "Projects")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.projects.map((p, idx) => (
              <div key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{p.name || `#${idx + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveItem("projects", idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveItem("projects", idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem("projects", p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <Input placeholder={f("projectName", "Project name")} value={p.name} onChange={(e) => updateItem<ProjectEntry>("projects", p.id, { name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={f("role")} value={p.role || ""} onChange={(e) => updateItem<ProjectEntry>("projects", p.id, { role: e.target.value })} />
                  <Input placeholder={f("date")} value={p.date || ""} onChange={(e) => updateItem<ProjectEntry>("projects", p.id, { date: e.target.value })} />
                </div>
                <Input placeholder={f("url", "URL")} value={p.url || ""} onChange={(e) => updateItem<ProjectEntry>("projects", p.id, { url: e.target.value })} />
                <Textarea rows={2} placeholder={f("description", "Description")} value={p.description || ""} onChange={(e) => updateItem<ProjectEntry>("projects", p.id, { description: e.target.value })} />
                <BulletEditor items={p.bullets} onChange={(b) => updateItem<ProjectEntry>("projects", p.id, { bullets: b })} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<ProjectEntry>("projects", () => ({ id: uid(), name: "", bullets: [] }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Publications ───────────────────────────────────────────────── */}
        <AccordionItem value="publications">
          <AccordionTrigger>{s("publications")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.publications.map((p) => (
              <div key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-end"><Button size="icon" variant="ghost" onClick={() => removeItem("publications", p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                <Input placeholder={f("pubTitle")} value={p.title} onChange={(e) => updateItem<PublicationEntry>("publications", p.id, { title: e.target.value })} />
                <Input placeholder={f("publisher")} value={p.publisher} onChange={(e) => updateItem<PublicationEntry>("publications", p.id, { publisher: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" value={p.date} onChange={(e) => updateItem<PublicationEntry>("publications", p.id, { date: e.target.value })} />
                  <Input placeholder={f("doi")} value={p.doi || ""} onChange={(e) => updateItem<PublicationEntry>("publications", p.id, { doi: e.target.value })} />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<PublicationEntry>("publications", () => ({ id: uid(), title: "", publisher: "", date: "", doi: "" }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Awards ─────────────────────────────────────────────────────── */}
        <AccordionItem value="awards">
          <AccordionTrigger>{s("awards", "Awards")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.awards.map((aw, idx) => (
              <div key={aw.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{aw.title || `#${idx + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveItem("awards", idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveItem("awards", idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem("awards", aw.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <Input placeholder={f("awardTitle", "Title")} value={aw.title} onChange={(e) => updateItem<AwardEntry>("awards", aw.id, { title: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={f("issuer", "Issuer")} value={aw.issuer || ""} onChange={(e) => updateItem<AwardEntry>("awards", aw.id, { issuer: e.target.value })} />
                  <Input placeholder={f("date")} value={aw.date || ""} onChange={(e) => updateItem<AwardEntry>("awards", aw.id, { date: e.target.value })} />
                </div>
                <Textarea rows={2} placeholder={f("description", "Description")} value={aw.description || ""} onChange={(e) => updateItem<AwardEntry>("awards", aw.id, { description: e.target.value })} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<AwardEntry>("awards", () => ({ id: uid(), title: "" }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Skills & Languages ─────────────────────────────────────────── */}
        <AccordionItem value="skills">
          <AccordionTrigger>{s("skills")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Label className="font-medium">{f("language")}</Label>
            <p className="text-xs text-muted-foreground -mt-2">{h("languageHint", "Use CEFR levels: A1–C2.")}</p>
            {data.skills.languages.map((l, idx) => (
              <div key={l.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f("language")} value={l.name} onChange={(e) => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], name: e.target.value };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }} />
                <Select value={l.level} onValueChange={(v) => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], level: v };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A1", "A2", "B1", "B2", "C1", "C2"].map((lv) => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="w-24" placeholder={f("exam")} value={l.exam || ""} onChange={(e) => {
                  const langs = [...data.skills.languages];
                  langs[idx] = { ...langs[idx], exam: e.target.value };
                  updateData({ skills: { ...data.skills, languages: langs } });
                }} />
                <Button size="icon" variant="ghost" onClick={() => updateData({ skills: { ...data.skills, languages: data.skills.languages.filter((x) => x.id !== l.id) } })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateData({ skills: { ...data.skills, languages: [...data.skills.languages, { id: uid(), name: "", level: "A1", exam: "" }] } })}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>

            <div><Label>{f("technical")}</Label><Input placeholder="Python, Git, MS Office…" value={data.skills.technical.join(", ")} onChange={(e) => updateData({ skills: { ...data.skills, technical: e.target.value.split(",").map((x) => x.trim()) } })} /></div>
            <div><Label>{f("other")}</Label><Input placeholder="Teamwork, Leadership…" value={data.skills.other.join(", ")} onChange={(e) => updateData({ skills: { ...data.skills, other: e.target.value.split(",").map((x) => x.trim()) } })} /></div>
            <div><Label>{f("interests", "Interests")}</Label><Input placeholder={h("interestsHint", "Reading, Hiking…")} value={data.skills.interests.join(", ")} onChange={(e) => updateData({ skills: { ...data.skills, interests: e.target.value.split(",").map((x) => x.trim()) } })} /></div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Certificates ──────────────────────────────────────────────── */}
        <AccordionItem value="certificates">
          <AccordionTrigger>{s("certificates")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.certificates.map((c, idx) => (
              <div key={c.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f("certName")} value={c.name} onChange={(e) => updateItem<CertificateEntry>("certificates", c.id, { name: e.target.value })} />
                <Input className="flex-1" placeholder={f("issuer")} value={c.issuer} onChange={(e) => updateItem<CertificateEntry>("certificates", c.id, { issuer: e.target.value })} />
                <Input className="w-28" type="month" value={c.date} onChange={(e) => updateItem<CertificateEntry>("certificates", c.id, { date: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeItem("certificates", c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<CertificateEntry>("certificates", () => ({ id: uid(), name: "", issuer: "", date: "" }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Volunteer ─────────────────────────────────────────────────── */}
        <AccordionItem value="volunteer">
          <AccordionTrigger>{s("volunteer")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.volunteer.map((v, idx) => (
              <div key={v.id} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{v.role || `#${idx + 1}`}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeItem("volunteer", v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <Input placeholder={f("organization")} value={v.organization} onChange={(e) => updateItem<VolunteerEntry>("volunteer", v.id, { organization: e.target.value })} />
                <Input placeholder={f("role")} value={v.role} onChange={(e) => updateItem<VolunteerEntry>("volunteer", v.id, { role: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="month" value={v.from} onChange={(e) => updateItem<VolunteerEntry>("volunteer", v.id, { from: e.target.value })} />
                  <Input type="month" value={v.to} disabled={v.current} onChange={(e) => updateItem<VolunteerEntry>("volunteer", v.id, { to: e.target.value })} />
                </div>
                <div className="flex items-center gap-2"><Switch checked={v.current} onCheckedChange={(val) => updateItem<VolunteerEntry>("volunteer", v.id, { current: val })} /><Label className="text-xs">{f("current")}</Label></div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<VolunteerEntry>("volunteer", () => ({ id: uid(), organization: "", role: "", from: "", to: "", current: false }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── References ────────────────────────────────────────────────── */}
        <AccordionItem value="references">
          <AccordionTrigger>{s("references")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {data.references.map((r) => (
              <div key={r.id} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder={f("refName")} value={r.name} onChange={(e) => updateItem<ReferenceEntry>("references", r.id, { name: e.target.value })} />
                <Input className="flex-1" placeholder={f("refPosition")} value={r.position} onChange={(e) => updateItem<ReferenceEntry>("references", r.id, { position: e.target.value })} />
                <Input className="flex-1" placeholder={f("refContact")} value={r.contact} onChange={(e) => updateItem<ReferenceEntry>("references", r.id, { contact: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeItem("references", r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addItem<ReferenceEntry>("references", () => ({ id: uid(), name: "", position: "", contact: "" }))}><Plus className="h-4 w-4 mr-1" />{a("addEntry")}</Button>
          </AccordionContent>
        </AccordionItem>

        {/* ── Signature / Unterschrift ──────────────────────────────────── */}
        <AccordionItem value="signature">
          <AccordionTrigger>{t("lebenslaufBuilder.sections.signature", "Signature")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{h("signatureHint", "Optional. For formal German applications you may add Ort, Datum and a signature.")}</p>
            <Select value={data.signature.mode} onValueChange={(v) => updateSignature({ mode: v as CVSignatureMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("lebenslaufBuilder.sigNone", "No signature")}</SelectItem>
                <SelectItem value="line">{t("lebenslaufBuilder.sigLine", "Signature line (Ort, Datum)")}</SelectItem>
                <SelectItem value="image">{t("lebenslaufBuilder.sigImage", "Upload signature image")}</SelectItem>
              </SelectContent>
            </Select>
            {data.signature.mode !== "none" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{f("place", "Ort")}</Label><Input value={data.signature.place || ""} onChange={(e) => updateSignature({ place: e.target.value })} /></div>
                  <div><Label>{f("date")}</Label><Input type="date" value={data.signature.date || ""} onChange={(e) => updateSignature({ date: e.target.value })} /></div>
                </div>
                {data.signature.mode === "image" && (
                  <div>
                    <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-md cursor-pointer hover:bg-accent/10">
                      <ImagePlus className="h-4 w-4" /> {t("lebenslaufBuilder.actions.upload", "Upload")}
                      <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                    </label>
                    {data.signature.image && (
                      <Button size="sm" variant="ghost" className="ml-2" onClick={() => updateSignature({ image: undefined })}><X className="h-4 w-4 mr-1" />{t("lebenslaufBuilder.actions.remove", "Remove")}</Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{h("signatureImgHint", "Upload a scanned handwritten signature on a transparent/white background.")}</p>
                  </div>
                )}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Sections (enable/disable + reorder) ───────────────────────── */}
        <AccordionItem value="sections">
          <AccordionTrigger>{t("lebenslaufBuilder.sections.sectionsOrder", "Sections")}</AccordionTrigger>
          <AccordionContent className="space-y-1 pt-2">
            <p className="text-xs text-muted-foreground mb-2">{h("sectionsHint", "Reorder or hide sections. Empty sections never render.")}</p>
            {data.sectionOrder.map((k, idx) => (
              <div key={k} className="flex items-center gap-2 py-1">
                <Button size="icon" variant="ghost" onClick={() => moveSection(idx, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => moveSection(idx, 1)} disabled={idx === data.sectionOrder.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <span className="flex-1 text-sm">{sectionLabel(k)}</span>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* ── Design / Customize ────────────────────────────────────────── */}
        <AccordionItem value="design">
          <AccordionTrigger>{t("lebenslaufBuilder.sections.design", "Design")}</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Presets */}
            <div>
              <Label className="text-sm font-medium">{t("lebenslaufBuilder.designPresets", "Presets")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {DESIGN_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateDesign(applyPreset(p.id))}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 border rounded-md hover:bg-accent/10 ${data.design.preset === p.id ? "border-primary bg-accent/10" : ""}`}
                  >
                    <span className="w-3 h-3 rounded-full border" style={{ background: p.accent }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div>
              <Label className="text-sm font-medium">{t("lebenslaufBuilder.accentColor", "Accent color")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => updateDesign({ accent: c.accent, preset: "custom" })}
                    className={`w-6 h-6 rounded-full border-2 ${data.design.accent.toLowerCase() === c.accent.toLowerCase() ? "border-primary" : "border-transparent"}`}
                    style={{ background: c.accent }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={isHex(data.design.accent) ? data.design.accent : "#1B2430"}
                  onChange={(e) => updateDesign({ accent: e.target.value, preset: "custom" })}
                  className="h-7 w-10 rounded border cursor-pointer"
                  aria-label={t("lebenslaufBuilder.customColor", "Custom color")}
                />
                <Input className="w-28" value={data.design.accent} onChange={(e) => isHex(e.target.value) && updateDesign({ accent: e.target.value, preset: "custom" })} />
              </div>
              {lowContrast && (
                <p className="text-xs text-amber-600 mt-1">{h("contrastWarn", "This color is light — headings will be auto-darkened for readability.")}</p>
              )}
            </div>

            {/* Typography */}
            <div>
              <Label className="text-sm font-medium">{t("lebenslaufBuilder.typography", "Typography")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {TYPOGRAPHY_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => updateDesign(applyTypographyPreset(p.id))} className="text-xs px-2 py-1.5 border rounded-md hover:bg-accent/10">{p.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">{t("lebenslaufBuilder.bodyFont", "Body font")}</Label>
                  <Select value={data.design.font} onValueChange={(v) => updateDesign({ font: v as CVFontKey, preset: "custom" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTS.map((fo) => <SelectItem key={fo.id} value={fo.id}>{fo.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("lebenslaufBuilder.headingFont", "Heading font")}</Label>
                  <Select value={data.design.headingFont} onValueChange={(v) => updateDesign({ headingFont: v as CVFontKey, preset: "custom" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTS.map((fo) => <SelectItem key={fo.id} value={fo.id}>{fo.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Spacing */}
            <div>
              <Label className="text-sm font-medium">{t("lebenslaufBuilder.spacing", "Spacing")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["compact", "normal", "relaxed"] as const).map((sp) => (
                  <button key={sp} type="button" onClick={() => updateDesign({ spacing: sp, preset: "custom" })} className={`text-xs px-2 py-1.5 border rounded-md hover:bg-accent/10 ${data.design.spacing === sp ? "border-primary bg-accent/10" : ""}`}>{t(`lebenslaufBuilder.spacing_${sp}`, sp)}</button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

// ── Education entry editor with progressive disclosure ──────────────────────
const EducationEntryEditor: React.FC<{
  entry: EducationEntry;
  idx: number;
  onChange: (p: Partial<EducationEntry>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  errors: Record<string, string>;
}> = ({ entry, idx, onChange, onRemove, onMove, errors }) => {
  const { t } = useTranslation("resources");
  const f = (key: string, fb?: string) => t(`lebenslaufBuilder.fields.${key}`, fb ?? key);
  const [advanced, setAdvanced] = React.useState(false);

  const dateErr = errors[`edu_${entry.id}`];

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-sm">{entry.degree || entry.institution || `#${idx + 1}`}</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      <Input placeholder={f("degree")} value={entry.degree} onChange={(e) => onChange({ degree: e.target.value })} />
      <Input placeholder={f("institution")} value={entry.institution} onChange={(e) => onChange({ institution: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={f("city")} value={entry.city} onChange={(e) => onChange({ city: e.target.value })} />
        <Input placeholder={f("country")} value={entry.country} onChange={(e) => onChange({ country: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="month" placeholder={f("from")} value={entry.from} onChange={(e) => onChange({ from: e.target.value })} />
        <Input type="month" placeholder={f("to")} value={entry.to} disabled={entry.current} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
      {dateErr && <p className="text-xs text-destructive">{dateErr}</p>}
      <div className="flex items-center gap-2">
        <Switch checked={entry.current} onCheckedChange={(v) => onChange({ current: v })} />
        <Label className="text-xs">{f("current")}</Label>
      </div>

      <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAdvanced((x) => !x)}>
        {advanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {t("lebenslaufBuilder.advancedFields", "Advanced fields")}
      </button>
      {advanced && (
        <div className="space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={f("program", "Program / major")} value={entry.program || ""} onChange={(e) => onChange({ program: e.target.value })} />
            <Input placeholder={f("focus", "Focus / specialization")} value={entry.focus || ""} onChange={(e) => onChange({ focus: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={f("grade", "Grade / GPA")} value={entry.grade || ""} onChange={(e) => onChange({ grade: e.target.value })} />
            {entry.current && <Input placeholder={f("expectedGraduation", "Expected graduation")} value={entry.expectedGraduation || ""} onChange={(e) => onChange({ expectedGraduation: e.target.value })} />}
          </div>
          <Input placeholder={f("thesis", "Thesis / final project")} value={entry.thesis || ""} onChange={(e) => onChange({ thesis: e.target.value })} />
          <Input placeholder={f("coursework", "Relevant coursework (comma-separated)")} value={(entry.coursework || []).join(", ")} onChange={(e) => onChange({ coursework: e.target.value.split(",").map((x) => x.trim()) })} />
          <Input placeholder={f("achievements", "Achievements (comma-separated)")} value={(entry.achievements || []).join(", ")} onChange={(e) => onChange({ achievements: e.target.value.split(",").map((x) => x.trim()) })} />
        </div>
      )}
    </div>
  );
};

export default CVForm;
