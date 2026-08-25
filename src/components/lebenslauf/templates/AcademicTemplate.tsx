import React from "react";
import { CVData } from "../types";
import { getCVLabels } from "../cvLabels";
import { Bullets, SectionHeading, SignatureBlock, clean, dateRange } from "../templateHelpers";

interface Props { data: CVData; }

/**
 * Academic / research-focused template: two-column with a left rail for
 * languages/skills/certificates and a main column for education, projects,
 * publications, experience. Consumes design tokens (no hardcoded colors).
 */
const AcademicTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, projects, publications, awards, skills, certificates, volunteer, references, showPhoto, showBirthDate, summary, sectionOrder } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  const hasSkills = skills.languages.length > 0 || clean(skills.technical).length > 0 || clean(skills.other).length > 0 || clean(skills.interests).length > 0 || certificates.length > 0;

  // Left rail sections (fixed for academic layout): photo, languages, skills, certificates, interests.
  const rail = (
    <div className="space-y-4 break-inside-avoid">
      {showPhoto && personal.photo && <img src={personal.photo} alt="Profile" className="w-full max-w-[120px] mx-auto object-cover" style={{ border: "1px solid var(--cv-rule)" }} />}
      {skills.languages.length > 0 && (
        <section className="cv-section break-inside-avoid">
          <SectionHeading variant="sidebar">{L.languageSkills}</SectionHeading>
          {skills.languages.map(l => <p key={l.id} className="text-[9.5pt] mb-0.5">{l.name}: {l.level}{l.exam ? ` (${l.exam})` : ""}</p>)}
        </section>
      )}
      {clean(skills.technical).length > 0 && (
        <section className="cv-section break-inside-avoid">
          <SectionHeading variant="sidebar">{L.technicalSkills}</SectionHeading>
          <p className="text-[9.5pt]">{clean(skills.technical).join(", ")}</p>
        </section>
      )}
      {clean(skills.other).length > 0 && (
        <section className="cv-section break-inside-avoid">
          <SectionHeading variant="sidebar">{L.other}</SectionHeading>
          <p className="text-[9.5pt]">{clean(skills.other).join(", ")}</p>
        </section>
      )}
      {certificates.length > 0 && (
        <section className="cv-section break-inside-avoid">
          <SectionHeading variant="sidebar">{L.certificates}</SectionHeading>
          {certificates.map(c => <p key={c.id} className="text-[9.5pt] mb-0.5">{c.name} ({c.date})</p>)}
        </section>
      )}
      {clean(skills.interests).length > 0 && (
        <section className="cv-section break-inside-avoid">
          <SectionHeading variant="sidebar">{L.interests}</SectionHeading>
          <p className="text-[9.5pt]">{clean(skills.interests).join(", ")}</p>
        </section>
      )}
    </div>
  );

  const renderMainSection = (key: string): React.ReactNode => {
    switch (key) {
      case "summary":
        return summary?.trim() && (
          <section className="cv-section break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.profile}</SectionHeading>
            <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{summary.trim()}</p>
          </section>
        );
      case "education":
        return education.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.education}</SectionHeading>
            {education.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <div className="flex justify-between gap-2">
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{e.degree || e.program}</strong>
                  <span className="text-[9pt] whitespace-nowrap" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(e.from, e.to, e.current, L)}</span>
                </div>
                {e.institution && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.institution}{e.city ? `, ${e.city}` : ""}</p>}
                {e.program && e.degree && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.program}{e.focus ? ` — ${e.focus}` : ""}</p>}
                {(e.grade || e.expectedGraduation) && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.grade ? `${L.grade}: ${e.grade}` : ""}{e.expectedGraduation ? `${e.grade ? " · " : ""}${L.expectedGraduation}: ${e.expectedGraduation}` : ""}</p>}
                {e.thesis && <p className="text-[9.5pt] italic" style={{ color: "var(--cv-muted)" }}>{L.thesis}: {e.thesis}</p>}
                <Bullets items={[...(e.achievements || []), ...e.details]} className="text-[9.5pt]" />
                {clean(e.coursework).length > 0 && <p className="text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>{clean(e.coursework).join(" · ")}</p>}
              </div>
            ))}
          </section>
        );
      case "projects":
        return projects.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.projects}</SectionHeading>
            {projects.map(p => (
              <div key={p.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <div className="flex justify-between gap-2">
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{p.name}{p.role ? ` — ${p.role}` : ""}</strong>
                  {p.date && <span className="text-[9pt] whitespace-nowrap" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{p.date}</span>}
                </div>
                {p.description && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{p.description}</p>}
                {p.url && <p className="text-[9pt]" style={{ color: "var(--cv-muted)" }}>{p.url}</p>}
                <Bullets items={p.bullets} className="text-[9.5pt]" />
              </div>
            ))}
          </section>
        );
      case "publications":
        return publications.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.publications}</SectionHeading>
            {publications.map(p => (
              <div key={p.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <p className="text-[10pt] font-medium" style={{ color: "var(--cv-body-color)" }}>{p.title}</p>
                <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{p.publisher}{p.date ? `, ${p.date}` : ""}{p.doi ? ` · ${p.doi}` : ""}</p>
              </div>
            ))}
          </section>
        );
      case "awards":
        return awards.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.awards}</SectionHeading>
            {awards.map(a => (
              <div key={a.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <div className="flex justify-between gap-2">
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{a.title}</strong>
                  {a.date && <span className="text-[9pt] whitespace-nowrap" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{a.date}</span>}
                </div>
                {a.issuer && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{a.issuer}</p>}
                {a.description && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{a.description}</p>}
              </div>
            ))}
          </section>
        );
      case "experience":
        return experience.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.experience}</SectionHeading>
            {experience.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <div className="flex justify-between gap-2">
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{e.title}</strong>
                  <span className="text-[9pt] whitespace-nowrap" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(e.from, e.to, e.current, L)}</span>
                </div>
                {e.company && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.company}{e.city ? `, ${e.city}` : ""}</p>}
                <Bullets items={e.bullets} className="text-[9.5pt]" />
              </div>
            ))}
          </section>
        );
      case "volunteer":
        return volunteer.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.volunteer}</SectionHeading>
            {volunteer.map(v => (
              <div key={v.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <div className="flex justify-between gap-2">
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{v.role}</strong>
                  <span className="text-[9pt] whitespace-nowrap" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(v.from, v.to, v.current, L)}</span>
                </div>
                <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{v.organization}</p>
              </div>
            ))}
          </section>
        );
      case "references":
        return references.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.references}</SectionHeading>
            {references.map(r => <p key={r.id} className="cv-entry break-inside-avoid text-[10pt]" style={{ marginBottom: "2px" }}>{r.name} — {r.position} ({r.contact})</p>)}
          </section>
        );
      // Skills/certificates live in the rail for the academic layout.
      case "skills":
      case "certificates":
        return null;
      default:
        return null;
    }
  };

  const mainKeys = sectionOrder.filter(k => k !== "skills" && k !== "certificates");

  return (
    <div className="bg-white" style={{ fontFamily: "var(--cv-font)", color: "var(--cv-body-color)", padding: "var(--cv-spacing-root)" }}>
      <div className="text-center mb-5 pb-4" style={{ borderBottom: "2px solid var(--cv-accent)" }}>
        <h1 className="text-[22pt] font-bold" style={{ fontFamily: "var(--cv-heading-font)" }}>{fullName || "Your Name"}</h1>
        {personal.professionalTitle && <p className="text-[11pt] mt-0.5" style={{ color: "var(--cv-accent)" }}>{personal.professionalTitle}</p>}
        <div className="flex flex-wrap justify-center gap-x-4 text-[9.5pt] mt-2" style={{ color: "var(--cv-muted)" }}>
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.address && <span>{personal.address}</span>}
          {personal.website && <span>{personal.website}</span>}
        </div>
        {showBirthDate && personal.birthDate && <p className="text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>{L.dateOfBirth}: {personal.birthDate}{personal.birthPlace ? ` — ${personal.birthPlace}` : ""} · {L.nationality}: {personal.nationality || "-"}</p>}
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-6">
        {rail}
        <div>
          {mainKeys.map(key => renderMainSection(key))}
          <SignatureBlock data={data} L={L} />
        </div>
      </div>
    </div>
  );
};

export default AcademicTemplate;
