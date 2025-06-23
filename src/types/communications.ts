
export interface Conversation {
  id: string;
  type: 'chat' | 'group' | 'system';
  created_at: string;
  updated_at?: string;
  last_message?: Message;
  unread_count?: number;
  members?: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  role: 'member' | 'admin';
  profile?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments?: MessageAttachment[];
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface MessageAttachment {
  id: string;
  url: string;
  type: string;
  name: string;
  size?: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  last_active: string;
}
