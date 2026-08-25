import React from "react";
import { CVData } from "../types";
import { getCVLabels } from "../cvLabels";
import { Bullets, SectionHeading, SignatureBlock, clean, dateRange } from "../templateHelpers";

interface Props { data: CVData; }

const GermanStandardTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, projects, publications, awards, skills, certificates, volunteer, references, showPhoto, showBirthDate, summary, sectionOrder } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  const hasSkills = skills.languages.length > 0 || clean(skills.technical).length > 0 || clean(skills.other).length > 0 || clean(skills.interests).length > 0;

  // Render only sections present in sectionOrder and non-empty.
  const renderSection = (key: string): React.ReactNode => {
    switch (key) {
      case "summary":
        return summary?.trim() && (
          <section className="cv-section break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.profile}</SectionHeading>
            <p className="text-[10.5pt]" style={{ color: "var(--cv-body-color)" }}>{summary.trim()}</p>
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
                {e.institution && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.institution}{e.city ? `, ${e.city}` : ''}{e.country ? `, ${e.country}` : ''}</p>}
                {e.program && e.degree && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.program}{e.focus ? ` — ${e.focus}` : ''}</p>}
                {(e.grade || e.expectedGraduation) && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.grade ? `${L.grade}: ${e.grade}` : ''}{e.expectedGraduation ? `${e.grade ? ' · ' : ''}${L.expectedGraduation}: ${e.expectedGraduation}` : ''}</p>}
                {e.thesis && <p className="text-[9.5pt] italic" style={{ color: "var(--cv-muted)" }}>{L.thesis}: {e.thesis}</p>}
                <Bullets items={[...(e.achievements || []), ...e.details]} className="text-[9.5pt]" />
                {clean(e.coursework).length > 0 && <p className="text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>{clean(e.coursework).join(" · ")}</p>}
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
                {e.company && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.company}{e.city ? `, ${e.city}` : ''}</p>}
                <Bullets items={e.bullets} className="text-[9.5pt]" />
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
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{p.name}{p.role ? ` — ${p.role}` : ''}</strong>
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
                <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}><strong>{p.title}</strong></p>
                <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{p.publisher}{p.date ? `, ${p.date}` : ''}{p.doi ? ` · ${p.doi}` : ''}</p>
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
      case "skills":
        return hasSkills && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.skills}</SectionHeading>
            {skills.languages.length > 0 && <div className="mb-1"><strong className="text-[9.5pt]">{L.languages}: </strong><span className="text-[9.5pt]">{skills.languages.map(l => `${l.name} (${l.level}${l.exam ? ` — ${l.exam}` : ''})`).join(', ')}</span></div>}
            {clean(skills.technical).length > 0 && <div className="mb-1"><strong className="text-[9.5pt]">{L.technical}: </strong><span className="text-[9.5pt]">{clean(skills.technical).join(', ')}</span></div>}
            {clean(skills.other).length > 0 && <div className="mb-1"><strong className="text-[9.5pt]">{L.other}: </strong><span className="text-[9.5pt]">{clean(skills.other).join(', ')}</span></div>}
            {clean(skills.interests).length > 0 && <div><strong className="text-[9.5pt]">{L.interests}: </strong><span className="text-[9.5pt]">{clean(skills.interests).join(', ')}</span></div>}
          </section>
        );
      case "certificates":
        return certificates.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading>{L.certificates}</SectionHeading>
            {certificates.map(c => (
              <div key={c.id} className="cv-entry break-inside-avoid flex justify-between text-[10pt]" style={{ marginBottom: "2px" }}>
                <span>{c.name} — {c.issuer}</span>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{c.date}</span>
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
            {references.map(r => (
              <p key={r.id} className="cv-entry break-inside-avoid text-[10pt]" style={{ marginBottom: "2px" }}>{r.name} — {r.position} ({r.contact})</p>
            ))}
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="cv-main-flow text-[10.5pt] leading-[1.45] bg-white" style={{ fontFamily: "var(--cv-font)", color: "var(--cv-body-color)", padding: "var(--cv-spacing-root)" }}>
      <div className="flex justify-between items-start mb-5 pb-4" style={{ borderBottom: "2px solid var(--cv-accent)" }}>
        <div>
          <h1 className="text-[20pt] font-bold tracking-tight" style={{ fontFamily: "var(--cv-heading-font)" }}>{fullName || 'Ihr Name'}</h1>
          {personal.professionalTitle && <p className="text-[11pt] mt-0.5" style={{ color: "var(--cv-accent)" }}>{personal.professionalTitle}</p>}
          {personal.address && <p className="text-[9.5pt] mt-1" style={{ color: "var(--cv-muted)" }}>{personal.address}</p>}
          <div className="flex flex-wrap gap-x-4 text-[9.5pt] mt-1" style={{ color: "var(--cv-muted)" }}>
            {personal.email && <span>{personal.email}</span>}
            {personal.phone && <span>{personal.phone}</span>}
            {personal.website && <span>{personal.website}</span>}
          </div>
          {showBirthDate && personal.birthDate && <p className="text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>{L.dateOfBirth}: {personal.birthDate}{personal.birthPlace ? ` — ${personal.birthPlace}` : ''}</p>}
          <div className="flex flex-wrap gap-x-4 text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>
            {personal.nationality && <span>{personal.nationality}</span>}
            {personal.linkedin && <span>{personal.linkedin}</span>}
            {personal.github && <span>{personal.github}</span>}
          </div>
        </div>
        {showPhoto && personal.photo && <img src={personal.photo} alt="Profile" className="w-24 h-28 object-cover" style={{ border: "1px solid var(--cv-rule)" }} />}
      </div>

      {sectionOrder.map(key => renderSection(key))}
      <SignatureBlock data={data} L={L} />
    </div>
  );
};

export default GermanStandardTemplate;
