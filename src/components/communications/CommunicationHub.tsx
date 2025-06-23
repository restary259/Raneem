
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import { Conversation, Message } from '@/types/communications';
import { MessageSquare, Bell, Settings } from 'lucide-react';

interface CommunicationHubProps {
  userId: string;
}

const CommunicationHub: React.FC<CommunicationHubProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  // Mock data - replace with real hooks
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  
  const handleSendMessage = (content: string, attachments?: File[]) => {
    // Implement message sending logic
    console.log('Sending message:', { content, attachments });
  };

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            المحادثات
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            الإعلانات
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            الإعدادات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>المحادثات</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConversationList
                    conversations={conversations}
                    selectedId={selectedConversation?.id}
                    onSelect={setSelectedConversation}
                  />
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              {selectedConversation ? (
                <MessageThread
                  conversation={selectedConversation}
                  messages={messages}
                  currentUserId={userId}
                  onSendMessage={handleSendMessage}
                />
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <CardContent>
                    <div className="text-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                      <p>اختر محادثة لبدء المراسلة</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle>إعلانات النظام</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4" />
                <p>لا توجد إعلانات جديدة</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات التواصل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4" />
                <p>إعدادات التواصل قيد التطوير</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationHub;
