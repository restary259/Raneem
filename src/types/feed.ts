
export interface RecentView {
  id: string;
  user_id: string;
  item_type: 'university' | 'program' | 'partner' | 'offer';
  item_id: string;
  viewed_at: string;
  item_data?: {
    title: string;
    image_url?: string;
    description?: string;
  };
}

export interface Recommendation {
  id: string;
  type: 'university' | 'program' | 'scholarship';
  title: string;
  description: string;
  image_url?: string;
  partner_name?: string;
  score: number;
  tags: string[];
}

export interface Deadline {
  id: string;
  title: string;
  deadline_date: string;
  application_id?: string;
  urgency: 'high' | 'medium' | 'low';
  type: 'application' | 'document' | 'interview';
}

export interface CommunityHighlight {
  id: string;
  type: 'forum' | 'webinar' | 'event';
  title: string;
  description: string;
  participant_count?: number;
  date?: string;
  url: string;
}
