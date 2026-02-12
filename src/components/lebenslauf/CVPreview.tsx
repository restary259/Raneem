import React from 'react';
import { CVData } from './types';
import GermanStandardTemplate from './templates/GermanStandardTemplate';
import AcademicTemplate from './templates/AcademicTemplate';
import EuropassTemplate from './templates/EuropassTemplate';

interface Props {
  data: CVData;
}

const CVPreview: React.FC<Props> = ({ data }) => {
  const dir = data.contentLanguage === 'ar' ? 'rtl' : 'ltr';

  return (
    <div id="cv-preview" dir={dir} className="cv-preview-container bg-white shadow-lg border rounded-lg overflow-auto">
      {data.template === 'academic' && <AcademicTemplate data={data} />}
      {data.template === 'german-standard' && <GermanStandardTemplate data={data} />}
      {data.template === 'europass' && <EuropassTemplate data={data} />}
    </div>
  );
};

export default CVPreview;
