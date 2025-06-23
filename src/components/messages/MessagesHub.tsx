
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, Conversation } from '@/hooks/useConversations';
import { useMessages } from '@/hooks/useMessages';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import { Search, Plus, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MessagesHub = () => {
  const { user } = useAuth();
  const { conversations, loading: conversationsLoading, createConversation } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { messages, loading: messagesLoading, sendMessage } = useMessages(selectedConversation?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationEmail, setNewConversationEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateConversation = async () => {
    if (!newConversationEmail.trim() || !user) return;

    setIsCreating(true);
    try {
      // Find user by email
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newConversationEmail.trim())
        .single();

      if (error || !profiles) {
        toast({
          variant: "destructive",
          title: "User not found",
          description: "No user found with this email address",
        });
        return;
      }

      if (profiles.id === user.id) {
        toast({
          variant: "destructive",
          title: "Invalid action",
          description: "You cannot start a conversation with yourself",
        });
        return;
      }

      const conversationId = await createConversation([profiles.id]);
      
      if (conversationId) {
        setShowNewConversation(false);
        setNewConversationEmail('');
        toast({
          title: "Conversation created",
          description: "Successfully started a new conversation",
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create conversation. Make sure the database tables are set up correctly.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    
    const title = conv.title || conv.members.find(m => m.user_id !== user?.id)?.profile.full_name || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (conversationsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">User Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter user's email address"
                    value={newConversationEmail}
                    onChange={(e) => setNewConversationEmail(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewConversation(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateConversation}
                    disabled={isCreating || !newConversationEmail.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Start Chat'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full p-4">
          {/* Conversations List */}
          <div className="lg:col-span-1 h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversations ({filteredConversations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start a new conversation to begin messaging</p>
                  </div>
                ) : (
                  <ConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversation?.id}
                    onSelect={setSelectedConversation}
                  />
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Message Thread */}
          <div className="lg:col-span-2 h-full">
            {selectedConversation ? (
              <MessageThread
                conversation={selectedConversation}
                messages={messages}
                currentUserId={user?.id || ''}
                onSendMessage={sendMessage}
                isLoading={messagesLoading}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent>
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>Select a conversation to start messaging</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Or create a new conversation using the "New Chat" button
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesHub;
