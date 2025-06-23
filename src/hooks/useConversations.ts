
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Conversation {
  id: string;
  title?: string;
  type: 'direct' | 'group';
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message?: Message;
  unread_count: number;
}

export interface ConversationMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile: {
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
  message_type: 'text' | 'image' | 'file';
  attachments: any[];
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Since the tables don't exist yet, return empty array for now
      console.log('Conversations feature will be available after database migration');
      setConversations([]);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (memberIds: string[], title?: string, type: 'direct' | 'group' = 'direct') => {
    if (!user) return null;

    try {
      console.log('Create conversation will be available after database migration');
      return null;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  return {
    conversations,
    loading,
    refetch: fetchConversations,
    createConversation
  };
};
