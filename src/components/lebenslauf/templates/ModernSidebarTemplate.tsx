import React from "react";
import { CVData } from "../types";
import { getCVLabels } from "../cvLabels";
import { Bullets, SectionHeading, SignatureBlock, clean, dateRange, fmtDate } from "../templateHelpers";

interface Props { data: CVData; }

/**
 * Modern sidebar (tabellarischer) template: dark sidebar with contact,
 * languages, skills, interests + light main column with profile, education,
 * experience and a mono-font ledger timeline. Print-safe (no position: fixed,
 * break-inside: avoid per entry).
 */
const ModernSidebarTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, projects, publications, awards, skills, certificates, volunteer, references, showPhoto, showBirthDate, summary, sectionOrder } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  // Sidebar contents — always together; main column respects sectionOrder.
  const hasSkills = skills.languages.length > 0 || clean(skills.technical).length > 0 || clean(skills.other).length > 0 || clean(skills.interests).length > 0 || certificates.length > 0;

  const sidebarSections: React.ReactNode = (
    <aside
      className="cv-sidebar break-inside-avoid"
      style={{
        background: "var(--cv-accent)",
        color: "#ffffff",
        padding: "var(--cv-spacing-root)",
        fontSize: "9.5pt",
      }}
    >
      {showPhoto && personal.photo && (
        <img
          src={personal.photo}
          alt="Profile"
          className="w-full max-w-[120px] mx-auto mb-4 object-cover rounded"
          style={{ aspectRatio: "4 / 5", border: "2px solid rgba(255,255,255,0.25)" }}
        />
      )}

      {/* Contact */}
      <div className="mb-4">
        <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.address}</h3>
        <div className="space-y-0.5 break-inside-avoid">
          {personal.address && <p style={{ color: "rgba(255,255,255,0.92)" }}>{personal.address}</p>}
          {personal.phone && <p style={{ color: "rgba(255,255,255,0.92)" }}>{personal.phone}</p>}
          {personal.email && <p style={{ color: "rgba(255,255,255,0.92)", wordBreak: "break-word" }}>{personal.email}</p>}
          {personal.website && <p style={{ color: "rgba(255,255,255,0.92)", wordBreak: "break-word" }}>{personal.website}</p>}
          {showBirthDate && personal.birthDate && <p style={{ color: "rgba(255,255,255,0.92)" }}>{L.dateOfBirth}: {personal.birthDate}</p>}
          {personal.nationality && <p style={{ color: "rgba(255,255,255,0.92)" }}>{L.nationality}: {personal.nationality}</p>}
          {personal.linkedin && <p style={{ color: "rgba(255,255,255,0.92)", wordBreak: "break-word" }}>{personal.linkedin}</p>}
          {personal.github && <p style={{ color: "rgba(255,255,255,0.92)", wordBreak: "break-word" }}>{personal.github}</p>}
        </div>
      </div>

      {skills.languages.length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.languageSkills}</h3>
          {skills.languages.map(l => (
            <div key={l.id} className="mb-1 flex justify-between">
              <span>{l.name}</span>
              <span style={{ color: "rgba(255,255,255,0.78)" }}>{l.level}{l.exam ? ` · ${l.exam}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {clean(skills.technical).length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.technicalSkills}</h3>
          <p>{clean(skills.technical).join(", ")}</p>
        </div>
      )}

      {clean(skills.other).length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.other}</h3>
          <p>{clean(skills.other).join(", ")}</p>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.certificates}</h3>
          {certificates.map(c => (
            <div key={c.id} className="mb-1">
              <p>{c.name}</p>
              <p style={{ color: "rgba(255,255,255,0.78)" }}>{c.issuer}{c.date ? ` · ${c.date}` : ""}</p>
            </div>
          ))}
        </div>
      )}

      {clean(skills.interests).length > 0 && (
        <div className="break-inside-avoid">
          <h3 className="uppercase tracking-widest text-[9pt] font-bold pb-1 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>{L.interests}</h3>
          <p>{clean(skills.interests).join(", ")}</p>
        </div>
      )}
    </aside>
  );

  const renderMainSection = (key: string): React.ReactNode => {
    switch (key) {
      case "summary":
        return summary?.trim() && (
          <section className="cv-section break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.profile}</SectionHeading>
            <p className="text-[10.5pt]" style={{ color: "var(--cv-body-color)" }}>{summary.trim()}</p>
          </section>
        );
      case "education":
        return education.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.education}</SectionHeading>
            {education.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid cv-timeline-entry" style={{ marginBottom: "var(--cv-spacing-entry)", position: "relative", paddingInlineStart: "18px" }}>
                <span className="cv-timeline-dot" style={{ position: "absolute", insetInlineStart: "0px", top: "5px", width: "8px", height: "8px", borderRadius: "50%", background: "var(--cv-accent)" }} />
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
      case "experience":
        return experience.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.experience}</SectionHeading>
            {experience.map(e => (
              <div key={e.id} className="cv-entry break-inside-avoid cv-timeline-entry" style={{ marginBottom: "var(--cv-spacing-entry)", position: "relative", paddingInlineStart: "18px" }}>
                <span className="cv-timeline-dot" style={{ position: "absolute", insetInlineStart: "0px", top: "5px", width: "8px", height: "8px", borderRadius: "50%", background: "var(--cv-accent)" }} />
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
      case "projects":
        return projects.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.projects}</SectionHeading>
            {projects.map(p => (
              <div key={p.id} className="cv-entry break-inside-avoid cv-timeline-entry" style={{ marginBottom: "var(--cv-spacing-entry)", position: "relative", paddingInlineStart: "18px" }}>
                <span className="cv-timeline-dot" style={{ position: "absolute", insetInlineStart: "0px", top: "5px", width: "8px", height: "8px", borderRadius: "50%", background: "var(--cv-accent)" }} />
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
            <SectionHeading variant="accent-text">{L.publications}</SectionHeading>
            {publications.map(p => (
              <div key={p.id} className="cv-entry break-inside-avoid" style={{ marginBottom: "var(--cv-spacing-entry)" }}>
                <p className="text-[10pt]" style={{ color: "var(--cv-body-color)" }}><strong>{p.title}</strong></p>
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
      case "volunteer":
        return volunteer.length > 0 && (
          <section className="cv-section" style={{ marginBottom: "var(--cv-spacing-section)" }}>
            <SectionHeading variant="accent-text">{L.volunteer}</SectionHeading>
            {volunteer.map(v => (
              <div key={v.id} className="cv-entry break-inside-avoid cv-timeline-entry" style={{ marginBottom: "var(--cv-spacing-entry)", position: "relative", paddingInlineStart: "18px" }}>
                <span className="cv-timeline-dot" style={{ position: "absolute", insetInlineStart: "0px", top: "5px", width: "8px", height: "8px", borderRadius: "50%", background: "var(--cv-accent)" }} />
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
            <SectionHeading variant="accent-text">{L.references}</SectionHeading>
            {references.map(r => (
              <p key={r.id} className="cv-entry break-inside-avoid text-[10pt]" style={{ marginBottom: "2px" }}>{r.name} — {r.position} ({r.contact})</p>
            ))}
          </section>
        );
      case "skills":
      case "certificates":
        // These live in the sidebar for this template.
        return null;
      default:
        return null;
    }
  };

  const mainKeys = sectionOrder.filter(k => k !== "skills" && k !== "certificates");

  return (
    <div
      className="bg-white"
      style={{ fontFamily: "var(--cv-font)", color: "var(--cv-body-color)", fontSize: "10.5pt", lineHeight: 1.45 }}
    >
      {/* On screen: two columns. On print: the grid flows naturally across pages. */}
      <div className="grid grid-cols-[34%_1fr] gap-0" style={{ minHeight: "100%" }}>
        {sidebarSections}
        <main style={{ padding: "var(--cv-spacing-root)" }}>
          <div className="mb-5 pb-3" style={{ borderBottom: "1.5px solid var(--cv-accent)" }}>
            <h1 className="text-[22pt] font-bold tracking-tight" style={{ fontFamily: "var(--cv-heading-font)" }}>{fullName || "Ihr Name"}</h1>
            {personal.professionalTitle && <p className="text-[11pt] mt-0.5" style={{ color: "var(--cv-accent)" }}>{personal.professionalTitle}</p>}
          </div>
          {mainKeys.map(key => renderMainSection(key))}
          <SignatureBlock data={data} L={L} />
        </main>
      </div>
    </div>
  );
};

export default ModernSidebarTemplate;
