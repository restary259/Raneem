import React from 'react';
import { CVData } from '../types';
import { getCVLabels } from '../cvLabels';

interface Props { data: CVData; }

const AcademicTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, publications, skills, certificates, volunteer, references, showPhoto, showBirthDate } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  return (
    <div className="font-serif text-[11pt] leading-[1.4] text-black bg-white p-8 max-w-[210mm] mx-auto" style={{ fontFamily: 'Georgia, serif' }}>
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">{fullName || 'Your Name'}</h1>
        <div className="flex flex-wrap justify-center gap-x-4 text-sm mt-2 text-gray-600">
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.address && <span>{personal.address}</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 text-sm mt-1 text-gray-600">
          {personal.linkedin && <span>{personal.linkedin}</span>}
          {personal.github && <span>{personal.github}</span>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-5">
          {showPhoto && personal.photo && <img src={personal.photo} alt="Profile" className="w-full max-w-[120px] mx-auto object-cover border" />}
          {skills.languages.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.languages}</h2>{skills.languages.map(l => <p key={l.id} className="text-xs mb-1">{l.name}: {l.level}{l.exam ? ` (${l.exam})` : ''}</p>)}</section>)}
          {skills.technical.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.technicalSkills}</h2><p className="text-xs">{skills.technical.filter(Boolean).join(', ')}</p></section>)}
          {certificates.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.certificates}</h2>{certificates.map(c => <p key={c.id} className="text-xs mb-1">{c.name} ({c.date})</p>)}</section>)}
        </div>

        <div className="space-y-5">
          {education.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.education}</h2>{education.map(e => (<div key={e.id} className="mb-3"><div className="flex justify-between"><strong className="text-sm">{e.degree}</strong><span className="text-xs text-gray-500">{e.from} — {e.current ? L.present : e.to}</span></div><p className="text-xs text-gray-700">{e.institution}{e.city ? `, ${e.city}` : ''}</p></div>))}</section>)}
          {publications.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.publications}</h2>{publications.map(p => (<div key={p.id} className="mb-2"><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-gray-600">{p.publisher}, {p.date}</p>{p.doi && <p className="text-xs text-blue-600">{p.doi}</p>}</div>))}</section>)}
          {experience.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.experience}</h2>{experience.map(e => (<div key={e.id} className="mb-3"><div className="flex justify-between"><strong className="text-sm">{e.title}</strong><span className="text-xs text-gray-500">{e.from} — {e.current ? L.present : e.to}</span></div><p className="text-xs text-gray-700">{e.company}</p></div>))}</section>)}
          {volunteer.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.volunteer}</h2>{volunteer.map(v => (<div key={v.id} className="mb-2"><strong className="text-sm">{v.role}</strong> — {v.organization}<span className="text-xs text-gray-500 ml-2">{v.from} — {v.current ? L.present : v.to}</span></div>))}</section>)}
          {references.length > 0 && (<section><h2 className="text-xs font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-2">{L.references}</h2>{references.map(r => <p key={r.id} className="text-xs mb-1">{r.name} — {r.position} ({r.contact})</p>)}</section>)}
        </div>
      </div>
    </div>
  );
};

export default AcademicTemplate;
