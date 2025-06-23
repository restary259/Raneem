
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
      // Get conversations where user is a member
      const { data: conversationMembers, error: membersError } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          conversations!inner(
            id,
            title,
            type,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      // Get all members for each conversation
      const conversationIds = conversationMembers?.map(cm => cm.conversation_id) || [];
      
      const { data: allMembers, error: allMembersError } = await supabase
        .from('conversation_members')
        .select(`
          *,
          profiles!inner(id, full_name, avatar_url)
        `)
        .in('conversation_id', conversationIds);

      if (allMembersError) throw allMembersError;

      // Get last messages for each conversation
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!inner(id, full_name, avatar_url)
        `)
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Build conversations with members and last messages
      const formattedConversations: Conversation[] = conversationMembers?.map(cm => {
        const conversation = cm.conversations;
        const members = allMembers?.filter(m => m.conversation_id === conversation.id) || [];
        const lastMessage = lastMessages?.find(m => m.conversation_id === conversation.id);

        return {
          id: conversation.id,
          title: conversation.title,
          type: conversation.type as 'direct' | 'group',
          created_by: conversation.created_by,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          members: members.map(m => ({
            id: m.id,
            user_id: m.user_id,
            role: m.role as 'admin' | 'member',
            joined_at: m.joined_at,
            profile: {
              id: m.profiles.id,
              full_name: m.profiles.full_name,
              avatar_url: m.profiles.avatar_url
            }
          })),
          last_message: lastMessage ? {
            id: lastMessage.id,
            conversation_id: lastMessage.conversation_id,
            sender_id: lastMessage.sender_id,
            content: lastMessage.content,
            message_type: lastMessage.message_type as 'text' | 'image' | 'file',
            attachments: lastMessage.attachments,
            created_at: lastMessage.created_at,
            sender: {
              id: lastMessage.profiles.id,
              full_name: lastMessage.profiles.full_name,
              avatar_url: lastMessage.profiles.avatar_url
            }
          } : undefined,
          unread_count: 0 // TODO: Calculate unread count
        };
      }) || [];

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (memberIds: string[], title?: string, type: 'direct' | 'group' = 'direct') => {
    if (!user) return null;

    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          title,
          type,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add members (including creator)
      const allMemberIds = [user.id, ...memberIds];
      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(
          allMemberIds.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId,
            role: userId === user.id ? 'admin' : 'member'
          }))
        );

      if (membersError) throw membersError;

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
