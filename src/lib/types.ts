
export interface University {
  type: 'university' | 'school';
  name: string;
  country: string;
  location: string;
  logoUrl: string;
  partnershipSince: number;
  specializations: string[];
  websiteUrl: string;
}

export interface Service {
  type: 'service';
  name: string;
  country: string;
  logoUrl: string;
  description: string;
  supported_countries: string[];
  languages: string[];
  darb_benefit?: string;
}

export interface Influencer {
  type: 'influencer';
  name: string;
  username: string;
  avatarUrl: string;
  country: string;
  followers: string;
  quote: string;
  specialization: string;
  socials: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
}

export type Partner = University | Service | Influencer;
