import React from 'react';
import { CVData } from '../types';
import { getCVLabels } from '../cvLabels';

interface Props { data: CVData; }

const GermanStandardTemplate: React.FC<Props> = ({ data }) => {
  const { personal, education, experience, skills, certificates, volunteer, references, showPhoto, showBirthDate } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();
  const L = getCVLabels(data.contentLanguage);

  return (
    <div className="font-sans text-[11pt] leading-[1.4] text-black bg-white p-8 max-w-[210mm] mx-auto" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
      <div className="flex justify-between items-start mb-6 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName || 'Ihr Name'}</h1>
          {personal.address && <p className="text-sm mt-1">{personal.address}</p>}
          <div className="flex flex-wrap gap-x-4 text-sm mt-1 text-gray-600">
            {personal.email && <span>{personal.email}</span>}
            {personal.phone && <span>{personal.phone}</span>}
          </div>
          {showBirthDate && personal.birthDate && <p className="text-sm text-gray-600 mt-1">{personal.birthDate}{personal.birthPlace ? ` — ${personal.birthPlace}` : ''}</p>}
          <div className="flex flex-wrap gap-x-4 text-sm text-gray-600 mt-1">
            {personal.nationality && <span>{personal.nationality}</span>}
            {personal.linkedin && <span>{personal.linkedin}</span>}
            {personal.github && <span>{personal.github}</span>}
          </div>
        </div>
        {showPhoto && personal.photo && <img src={personal.photo} alt="Profile" className="w-24 h-28 object-cover border" />}
      </div>

      {education.length > 0 && (<section className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.education}</h2>
        {education.map(e => (<div key={e.id} className="mb-3"><div className="flex justify-between"><strong className="text-sm">{e.degree}</strong><span className="text-xs text-gray-500">{e.from} — {e.current ? L.present : e.to}</span></div><p className="text-sm text-gray-700">{e.institution}{e.city ? `, ${e.city}` : ''}{e.country ? `, ${e.country}` : ''}</p>{e.details.filter(Boolean).length > 0 && <ul className="list-disc list-inside text-xs mt-1 text-gray-600">{e.details.filter(Boolean).map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>))}
      </section>)}

      {experience.length > 0 && (<section className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.experience}</h2>
        {experience.map(e => (<div key={e.id} className="mb-3"><div className="flex justify-between"><strong className="text-sm">{e.title}</strong><span className="text-xs text-gray-500">{e.from} — {e.current ? L.present : e.to}</span></div><p className="text-sm text-gray-700">{e.company}{e.city ? `, ${e.city}` : ''}</p>{e.bullets.filter(Boolean).length > 0 && <ul className="list-disc list-inside text-xs mt-1 text-gray-600">{e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>}</div>))}
      </section>)}

      {(skills.languages.length > 0 || skills.technical.length > 0 || skills.other.length > 0) && (<section className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.skills}</h2>
        {skills.languages.length > 0 && <div className="mb-2"><strong className="text-xs">{L.languages}: </strong><span className="text-xs">{skills.languages.map(l => `${l.name} (${l.level}${l.exam ? ` — ${l.exam}` : ''})`).join(', ')}</span></div>}
        {skills.technical.length > 0 && <div className="mb-2"><strong className="text-xs">{L.technical}: </strong><span className="text-xs">{skills.technical.filter(Boolean).join(', ')}</span></div>}
        {skills.other.length > 0 && <div><strong className="text-xs">{L.other}: </strong><span className="text-xs">{skills.other.filter(Boolean).join(', ')}</span></div>}
      </section>)}

      {certificates.length > 0 && (<section className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.certificates}</h2>
        {certificates.map(c => <div key={c.id} className="flex justify-between text-sm mb-1"><span>{c.name} — {c.issuer}</span><span className="text-xs text-gray-500">{c.date}</span></div>)}
      </section>)}

      {volunteer.length > 0 && (<section className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.volunteer}</h2>
        {volunteer.map(v => (<div key={v.id} className="mb-2"><div className="flex justify-between"><strong className="text-sm">{v.role}</strong><span className="text-xs text-gray-500">{v.from} — {v.current ? L.present : v.to}</span></div><p className="text-sm text-gray-700">{v.organization}</p></div>))}
      </section>)}

      {references.length > 0 && (<section>
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-1 mb-3">{L.references}</h2>
        {references.map(r => <p key={r.id} className="text-sm mb-1">{r.name} — {r.position} ({r.contact})</p>)}
      </section>)}
    </div>
  );
};

export default GermanStandardTemplate;
