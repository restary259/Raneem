
-- Create enum types for our platform
CREATE TYPE public.post_type AS ENUM ('announcement', 'scholarship', 'program', 'success_story', 'event', 'deadline');
CREATE TYPE public.application_status AS ENUM ('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted');
CREATE TYPE public.community_role AS ENUM ('admin', 'moderator', 'member');

-- Posts table for unified feed
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type public.post_type NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Applications table for student applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID,
  partner_id UUID,
  status public.application_status DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  documents JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Communities table for group chats
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  is_private BOOLEAN DEFAULT false,
  member_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Community memberships
CREATE TABLE public.community_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.community_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Real-time chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User saved items (majors, posts, etc.)
CREATE TABLE public.user_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saves ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts (authenticated users can view, only authors/admins can modify)
CREATE POLICY "Users can view all posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- RLS Policies for applications (users can only see their own)
CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for communities (public communities visible to all, private only to members)
CREATE POLICY "Users can view public communities" ON public.communities FOR SELECT TO authenticated USING (NOT is_private);
CREATE POLICY "Members can view private communities" ON public.communities FOR SELECT TO authenticated USING (
  is_private AND EXISTS (
    SELECT 1 FROM public.community_memberships 
    WHERE community_id = communities.id AND user_id = auth.uid()
  )
);

-- RLS Policies for community memberships
CREATE POLICY "Users can view memberships of communities they're in" ON public.community_memberships FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.community_memberships cm2 
    WHERE cm2.community_id = community_memberships.community_id AND cm2.user_id = auth.uid()
  )
);

-- RLS Policies for chat messages (only community members can see messages)
CREATE POLICY "Community members can view messages" ON public.chat_messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.community_memberships 
    WHERE community_id = chat_messages.community_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Community members can create messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_memberships 
    WHERE community_id = chat_messages.community_id AND user_id = auth.uid()
  )
);

-- RLS Policies for user saves
CREATE POLICY "Users can manage own saves" ON public.user_saves FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_type ON public.posts(post_type);
CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_chat_messages_community_created ON public.chat_messages(community_id, created_at DESC);
CREATE INDEX idx_community_memberships_user ON public.community_memberships(user_id);

-- Enable realtime for all tables
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.communities REPLICA IDENTITY FULL;
ALTER TABLE public.community_memberships REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_saves REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_saves;

-- Create trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
