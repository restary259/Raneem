
export interface ForumCategory {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ForumTopic {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  content?: string;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  category?: ForumCategory;
}

export interface ForumPost {
  id: string;
  topic_id: string;
  author_id: string;
  content: string;
  is_accepted: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface CommunityEvent {
  id: string;
  title: string;
  description?: string;
  host?: string;
  start_time: string;
  end_time?: string;
  registration_url?: string;
  max_attendees?: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  attendees_count?: number;
  user_rsvp?: boolean;
}

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  owner_id: string;
  member_count: number;
  max_members?: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  owner?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  user_membership?: {
    role: 'member' | 'moderator' | 'owner';
    joined_at: string;
  };
}

export interface GroupMessage {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}
