
export interface University {
  name: string;
  logoUrl: string;
  location: string;
  description: string;
  websiteUrl: string;
  keyFacts: string[];
}

export interface LanguageSchool {
  name: string;
  logoUrl: string;
  location: string;
  description: string;
  websiteUrl: string;
  programs: string[];
}

export interface LocalService {
  name: string;
  logoUrl: string;
  type: 'insurance' | 'transport' | 'telecom' | 'housing';
  description: string;
  websiteUrl: string;
  highlights: string[];
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}
