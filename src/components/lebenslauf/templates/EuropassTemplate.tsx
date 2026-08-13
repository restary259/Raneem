import React from "react";
import { CVData } from "../types";
import { getCVLabels } from "../cvLabels";
import { Bullets, SectionHeading, SignatureBlock, clean, dateRange } from "../templateHelpers";

interface Props { data: CVData; }

const EuropassTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, projects, publications, awards, skills, certificates, volunteer, references, showPhoto, showBirthDate, summary, sectionOrder } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  const levelWidth = (level: string): number => {
    const map: Record<string, number> = { A1: 16, A2: 33, B1: 50, B2: 66, C1: 83, C2: 100 };
    return map[level] || 50;
  };

  const renderSection = (key: string): React.ReactNode => {
    switch (key) {
      case "summary":
        return summary?.trim() && (
          <section className="cv-section break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.profile}</SectionHeading>
            <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{summary.trim()}</p>
          </section>
        );
      case "education":
        return education.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.educationTraining}</SectionHeading>
            {education.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(e.from, e.to, e.current, L)}</span>
                <div>
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{e.degree || e.program}</strong>
                  {e.institution && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.institution}{e.city ? `, ${e.city}` : ""}{e.country ? `, ${e.country}` : ""}</p>}
                  {e.program && e.degree && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.program}{e.focus ? ` — ${e.focus}` : ""}</p>}
                  {(e.grade || e.expectedGraduation) && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{e.grade ? `${L.grade}: ${e.grade}` : ""}{e.expectedGraduation ? `${e.grade ? " · " : ""}${L.expectedGraduation}: ${e.expectedGraduation}` : ""}</p>}
                  {e.thesis && <p className="text-[9.5pt] italic" style={{ color: "var(--cv-muted)" }}>{L.thesis}: {e.thesis}</p>}
                  <Bullets items={[...(e.achievements || []), ...e.details]} className="text-[9.5pt]" />
                  {clean(e.coursework).length > 0 && <p className="text-[9.5pt] mt-0.5" style={{ color: "var(--cv-muted)" }}>{clean(e.coursework).join(" · ")}</p>}
                </div>
              </div>
            ))}
          </section>
        );
      case "experience":
        return experience.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.workExperience}</SectionHeading>
            {experience.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(e.from, e.to, e.current, L)}</span>
                <div>
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{e.title}</strong>
                  {e.company && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{e.company}{e.city ? `, ${e.city}` : ""}</p>}
                  <Bullets items={e.bullets} className="text-[9.5pt]" />
                </div>
              </div>
            ))}
          </section>
        );
      case "projects":
        return projects.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.projects}</SectionHeading>
            {projects.map(p => (
              <div key={p.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{p.date || ""}</span>
                <div>
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{p.name}{p.role ? ` — ${p.role}` : ""}</strong>
                  {p.description && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{p.description}</p>}
                  {p.url && <p className="text-[9pt]" style={{ color: "var(--cv-muted)" }}>{p.url}</p>}
                  <Bullets items={p.bullets} className="text-[9.5pt]" />
                </div>
              </div>
            ))}
          </section>
        );
      case "publications":
        return publications.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.publications}</SectionHeading>
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
            <SectionHeading variant="accent-text">{L.awards}</SectionHeading>
            {awards.map(a => (
              <div key={a.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{a.date || ""}</span>
                <div>
                  <strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{a.title}</strong>
                  {a.issuer && <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}>{a.issuer}</p>}
                  {a.description && <p className="text-[9.5pt]" style={{ color: "var(--cv-muted)" }}>{a.description}</p>}
                </div>
              </div>
            ))}
          </section>
        );
      case "skills":
        return (skills.languages.length > 0 || clean(skills.technical).length > 0 || clean(skills.other).length > 0 || clean(skills.interests).length > 0) && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.languageSkills}</SectionHeading>
            {skills.languages.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {skills.languages.map(l => (
                  <div key={l.id} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                    <span className="text-[9.5pt] font-medium">{l.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--cv-rule)" }}>
                        <div className="h-full rounded-full" style={{ width: `${levelWidth(l.level)}%`, background: "var(--cv-accent)" }} />
                      </div>
                      <span className="text-[9pt] w-7" style={{ color: "var(--cv-muted)" }}>{l.level}</span>
                      {l.exam && <span className="text-[8.5pt]" style={{ color: "var(--cv-muted)" }}>{l.exam}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <SectionHeading variant="sidebar">{L.digitalSkills}</SectionHeading>
            {clean(skills.technical).length > 0 && <p className="text-[9.5pt] mb-0.5"><strong>{L.technical}:</strong> {clean(skills.technical).join(", ")}</p>}
            {clean(skills.other).length > 0 && <p className="text-[9.5pt] mb-0.5"><strong>{L.other}:</strong> {clean(skills.other).join(", ")}</p>}
            {clean(skills.interests).length > 0 && <p className="text-[9.5pt]"><strong>{L.interests}:</strong> {clean(skills.interests).join(", ")}</p>}
          </section>
        );
      case "certificates":
        return certificates.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.certificates}</SectionHeading>
            {certificates.map(c => (
              <div key={c.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "2px" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{c.date}</span>
                <div><strong className="text-[10pt]">{c.name}</strong> — <span className="text-[9.5pt]">{c.issuer}</span></div>
              </div>
            ))}
          </section>
        );
      case "volunteer":
        return volunteer.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.volunteering}</SectionHeading>
            {volunteer.map(v => (
              <div key={v.id} className="cv-entry break-inside-avoid grid grid-cols-[110px_1fr] gap-2" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <span className="text-[9pt]" style={{ color: "var(--cv-muted)", fontFamily: "var(--cv-date-font)" }}>{dateRange(v.from, v.to, v.current, L)}</span>
                <div><strong className="text-[10.5pt]" style={{ fontFamily: "var(--cv-heading-font)" }}>{v.role}</strong> — <span className="text-[10pt]">{v.organization}</span></div>
              </div>
            ))}
          </section>
        );
      case "references":
        return references.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.references}</SectionHeading>
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
    <div className="bg-white" style={{ fontFamily: "var(--cv-font)", color: "var(--cv-body-color)", padding: "var(--cv-spacing-root)", fontSize: "10pt" }}>
      <div className="flex gap-5 mb-5 pb-4" style={{ borderBottom: `3px solid var(--cv-accent)` }}>
        {showPhoto && personal.photo && <img src={personal.photo} alt="Profile" className="w-24 h-28 object-cover" style={{ border: "1px solid var(--cv-rule)" }} />}
        <div className="flex-1">
          <h1 className="text-[20pt] font-bold" style={{ color: "var(--cv-accent)", fontFamily: "var(--cv-heading-font)" }}>{fullName || "Your Name"}</h1>
          {personal.professionalTitle && <p className="text-[11pt] mt-0.5" style={{ color: "var(--cv-body-color)" }}>{personal.professionalTitle}</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9.5pt] mt-2" style={{ color: "var(--cv-body-color)" }}>
            {personal.address && <div><strong>{L.address}:</strong> {personal.address}</div>}
            {personal.phone && <div><strong>{L.phone}:</strong> {personal.phone}</div>}
            {personal.email && <div><strong>{L.email}:</strong> {personal.email}</div>}
            {personal.website && <div><strong>{L.website}:</strong> {personal.website}</div>}
            {showBirthDate && personal.birthDate && <div><strong>{L.dateOfBirth}:</strong> {personal.birthDate}</div>}
            {personal.nationality && <div><strong>{L.nationality}:</strong> {personal.nationality}</div>}
            {personal.linkedin && <div><strong>{L.linkedin}:</strong> {personal.linkedin}</div>}
          </div>
        </div>
      </div>

      {sectionOrder.map(key => renderSection(key))}
      <SignatureBlock data={data} L={L} />
    </div>
  );
};

export default EuropassTemplate;
