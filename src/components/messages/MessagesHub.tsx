
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Plus, MessageCircle, Users } from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  isGroup?: boolean;
}

interface Community {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  members: number;
}

const MessagesHub = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const chats: Chat[] = [
    {
      id: '1',
      name: 'University of Toronto Admissions',
      lastMessage: 'Thank you for your application. We\'ll review it shortly.',
      timestamp: '2m ago',
      unread: 2
    },
    {
      id: '2', 
      name: 'Computer Science Students 2024',
      lastMessage: 'Sarah: Has anyone heard back from MIT yet?',
      timestamp: '15m ago',
      unread: 5,
      isGroup: true
    }
  ];

  const communities: Community[] = [
    {
      id: '1',
      name: 'Scholarship Hunters Global',
      lastMessage: 'Ahmed: Found a great scholarship for engineering students!',
      timestamp: '1h ago',
      unread: 13,
      members: 156
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          <Button size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
          </Button>
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

      {/* Tabs */}
      <Tabs defaultValue="chats" className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chats" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chats
            </TabsTrigger>
            <TabsTrigger value="communities" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Communities
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="chats" className="m-0 h-full">
            <div className="space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50"
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={chat.avatar} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {chat.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {chat.unread > 0 && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.name}
                      </h3>
                      <span className="text-xs text-gray-500">{chat.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {chat.lastMessage}
                    </p>
                  </div>
                  
                  {chat.unread > 0 && (
                    <Badge className="bg-red-500 text-white min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {chat.unread}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="communities" className="m-0 h-full">
            <div className="space-y-1">
              {communities.map((community) => (
                <div
                  key={community.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-purple-100 text-purple-600">
                      {community.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {community.name}
                      </h3>
                      <span className="text-xs text-gray-500">{community.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {community.lastMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {community.members} members
                      </span>
                    </div>
                  </div>
                  
                  {community.unread > 0 && (
                    <Badge className="bg-red-500 text-white min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {community.unread}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default MessagesHub;
