
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
      // Use direct SQL query to get conversations with members
      const { data: conversationData, error: convError } = await supabase.rpc('get_user_conversations', {
        user_id: user.id
      });

      if (convError) {
        console.log('RPC not available, using fallback method');
        // Fallback: Create a mock conversation structure for now
        setConversations([]);
        return;
      }

      setConversations(conversationData || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // For now, return empty array until database is properly set up
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (memberIds: string[], title?: string, type: 'direct' | 'group' = 'direct') => {
    if (!user) return null;

    try {
      // Use direct insert with type assertion
      const { data: conversation, error: convError } = await supabase
        .from('conversations' as any)
        .insert({
          title,
          type,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        return null;
      }

      // Add members
      const allMemberIds = [user.id, ...memberIds];
      const { error: membersError } = await supabase
        .from('conversation_members' as any)
        .insert(
          allMemberIds.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId,
            role: userId === user.id ? 'admin' : 'member'
          }))
        );

      if (membersError) {
        console.error('Error adding members:', membersError);
        return null;
      }

      await fetchConversations();
      return conversation.id;
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
