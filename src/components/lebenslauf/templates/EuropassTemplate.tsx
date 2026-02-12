import React from 'react';
import { CVData } from '../types';

interface Props {
  data: CVData;
}

const EuropassTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, skills, certificates, volunteer, references, showPhoto, showBirthDate } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();

  const levelWidth = (level: string) => {
    const map: Record<string, number> = { A1: 16, A2: 33, B1: 50, B2: 66, C1: 83, C2: 100 };
    return map[level] || 50;
  };

  return (
    <div className="font-sans text-[10pt] leading-[1.4] text-black bg-white p-8 max-w-[210mm] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header - Europass style */}
      <div className="flex gap-6 mb-6 pb-4 border-b-4 border-blue-700">
        {showPhoto && personal.photo && (
          <img src={personal.photo} alt="Profile" className="w-24 h-28 object-cover border" />
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-blue-800">{fullName || 'Your Name'}</h1>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
            {personal.address && <div><strong>Address:</strong> {personal.address}</div>}
            {personal.phone && <div><strong>Phone:</strong> {personal.phone}</div>}
            {personal.email && <div><strong>Email:</strong> {personal.email}</div>}
            {showBirthDate && personal.birthDate && <div><strong>Date of Birth:</strong> {personal.birthDate}</div>}
            {personal.nationality && <div><strong>Nationality:</strong> {personal.nationality}</div>}
            {personal.linkedin && <div><strong>LinkedIn:</strong> {personal.linkedin}</div>}
          </div>
        </div>
      </div>

      {/* Education */}
      {education.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Education & Training</h2>
          {education.map(e => (
            <div key={e.id} className="mb-3 grid grid-cols-[120px_1fr] gap-2">
              <span className="text-xs text-gray-500">{e.from} — {e.current ? 'Present' : e.to}</span>
              <div>
                <strong className="text-sm">{e.degree}</strong>
                <p className="text-xs text-gray-700">{e.institution}{e.city ? `, ${e.city}` : ''}{e.country ? `, ${e.country}` : ''}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Work Experience</h2>
          {experience.map(e => (
            <div key={e.id} className="mb-3 grid grid-cols-[120px_1fr] gap-2">
              <span className="text-xs text-gray-500">{e.from} — {e.current ? 'Present' : e.to}</span>
              <div>
                <strong className="text-sm">{e.title}</strong>
                <p className="text-xs text-gray-700">{e.company}{e.city ? `, ${e.city}` : ''}</p>
                {e.bullets.filter(Boolean).length > 0 && (
                  <ul className="list-disc list-inside text-xs mt-1">{e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Languages with bars */}
      {skills.languages.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Language Skills</h2>
          <div className="space-y-2">
            {skills.languages.map(l => (
              <div key={l.id} className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <span className="text-xs font-medium">{l.name}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${levelWidth(l.level)}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-8">{l.level}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Technical & Other skills */}
      {(skills.technical.length > 0 || skills.other.length > 0) && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Digital & Other Skills</h2>
          {skills.technical.length > 0 && <p className="text-xs mb-1"><strong>Technical:</strong> {skills.technical.filter(Boolean).join(', ')}</p>}
          {skills.other.length > 0 && <p className="text-xs"><strong>Other:</strong> {skills.other.filter(Boolean).join(', ')}</p>}
        </section>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Certificates</h2>
          {certificates.map(c => (
            <p key={c.id} className="text-xs mb-1">{c.name} — {c.issuer} ({c.date})</p>
          ))}
        </section>
      )}

      {/* Volunteer */}
      {volunteer.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">Volunteering</h2>
          {volunteer.map(v => (
            <div key={v.id} className="mb-2 grid grid-cols-[120px_1fr] gap-2">
              <span className="text-xs text-gray-500">{v.from} — {v.current ? 'Present' : v.to}</span>
              <div><strong className="text-sm">{v.role}</strong> — {v.organization}</div>
            </div>
          ))}
        </section>
      )}

      {/* References */}
      {references.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-300 pb-1 mb-3">References</h2>
          {references.map(r => (
            <p key={r.id} className="text-xs mb-1">{r.name} — {r.position} ({r.contact})</p>
          ))}
        </section>
      )}
    </div>
  );
};

export default EuropassTemplate;
