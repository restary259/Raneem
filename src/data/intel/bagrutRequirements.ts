import type { SubjectRequirement } from './types';

export const ISRAELI_BGRUT_SUBJECT_REQUIREMENTS: SubjectRequirement[] = [
  {
    subject: 'mathematics',
    units: 3,
    label: 'Mathematics: at least 3 study units (general Israeli Bagrut access rule)',
    labelAR: 'الرياضيات: 3 وحدات على الأقل (قاعدة القبول العامة للبجروت الإسرائيلي)',
  },
  {
    subject: 'english',
    units: 4,
    label: 'English: at least 4 study units (general Israeli Bagrut access rule)',
    labelAR: 'الإنجليزية: 4 وحدات على الأقل (قاعدة القبول العامة للبجروت الإسرائيلي)',
  },
  {
    subject: 'further_subject',
    units: 4,
    label: 'One further subject: at least 4 study units (general Israeli Bagrut access rule)',
    labelAR: 'مادة إضافية: 4 وحدات على الأقل (قاعدة القبول العامة للبجروت الإسرائيلي)',
  },
];
