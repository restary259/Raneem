
-- Create forum categories table
CREATE TABLE forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create forum topics (threads) table
CREATE TABLE forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  title text NOT NULL,
  content text,
  tags text[] DEFAULT '{}',
  is_pinned boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  view_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create forum posts (replies) table
CREATE TABLE forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_accepted boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create post likes table
CREATE TABLE forum_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create community events table
CREATE TABLE community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  host text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  registration_url text,
  max_attendees integer,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create event RSVPs table
CREATE TABLE event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES community_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  rsvp_time timestamptz DEFAULT now(),
  reminder_sent boolean DEFAULT false,
  UNIQUE(event_id, user_id)
);

-- Create study groups table
CREATE TABLE study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_private boolean DEFAULT false,
  owner_id uuid REFERENCES profiles(id),
  member_count integer DEFAULT 1,
  max_members integer,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create group memberships table
CREATE TABLE group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  role text DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'owner')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group messages table for chat
CREATE TABLE group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES study_groups(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  created_at timestamptz DEFAULT now()
);

-- Create forum subscriptions table
CREATE TABLE forum_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  topic_id uuid REFERENCES forum_topics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- Create indexes for performance
CREATE INDEX idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX idx_forum_topics_created ON forum_topics(created_at DESC);
CREATE INDEX idx_forum_posts_topic ON forum_posts(topic_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_created ON forum_posts(created_at);
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX idx_group_memberships_user ON group_memberships(user_id);
CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created ON group_messages(created_at);

-- Enable Row Level Security
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum categories (public read)
CREATE POLICY "Anyone can view forum categories" 
  ON forum_categories 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- RLS Policies for forum topics (public read, authenticated write)
CREATE POLICY "Anyone can view forum topics" 
  ON forum_topics 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can create topics" 
  ON forum_topics 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their topics" 
  ON forum_topics 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = author_id);

-- RLS Policies for forum posts (public read, authenticated write)
CREATE POLICY "Anyone can view forum posts" 
  ON forum_posts 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can create posts" 
  ON forum_posts 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their posts" 
  ON forum_posts 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = author_id);

-- RLS Policies for post likes
CREATE POLICY "Users can view post likes" 
  ON forum_post_likes 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own likes" 
  ON forum_post_likes 
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for events (public read, authenticated RSVP)
CREATE POLICY "Anyone can view events" 
  ON community_events 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can view RSVPs" 
  ON event_rsvps 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own RSVPs" 
  ON event_rsvps 
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for study groups
CREATE POLICY "Users can view public groups" 
  ON study_groups 
  FOR SELECT 
  TO authenticated
  USING (NOT is_private OR owner_id = auth.uid() OR 
         EXISTS (SELECT 1 FROM group_memberships WHERE group_id = study_groups.id AND user_id = auth.uid()));

CREATE POLICY "Authenticated users can create groups" 
  ON study_groups 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Group owners can update their groups" 
  ON study_groups 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for group memberships
CREATE POLICY "Users can view memberships of accessible groups" 
  ON group_memberships 
  FOR SELECT 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM study_groups WHERE id = group_id AND 
                (NOT is_private OR owner_id = auth.uid() OR 
                 EXISTS (SELECT 1 FROM group_memberships gm WHERE gm.group_id = study_groups.id AND gm.user_id = auth.uid()))));

CREATE POLICY "Users can manage their own memberships" 
  ON group_memberships 
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id OR 
         EXISTS (SELECT 1 FROM study_groups WHERE id = group_id AND owner_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR 
              EXISTS (SELECT 1 FROM study_groups WHERE id = group_id AND owner_id = auth.uid()));

-- RLS Policies for group messages
CREATE POLICY "Group members can view messages" 
  ON group_messages 
  FOR SELECT 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid()));

CREATE POLICY "Group members can send messages" 
  ON group_messages 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND 
              EXISTS (SELECT 1 FROM group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid()));

-- RLS Policies for forum subscriptions
CREATE POLICY "Users can manage their own subscriptions" 
  ON forum_subscriptions 
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_forum_topics_updated_at
  BEFORE UPDATE ON forum_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_events_updated_at
  BEFORE UPDATE ON community_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON study_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default forum categories
INSERT INTO forum_categories (name, description) VALUES 
  ('الوجهات الدراسية', 'مناقشات حول البلدان والجامعات المختلفة'),
  ('التحضير للامتحانات', 'نصائح وموارد للتحضير لامتحانات التوفل والآيلتس وغيرها'),
  ('المنح الدراسية', 'معلومات ونصائح حول المنح الدراسية والتمويل'),
  ('الحياة الطلابية', 'تجارب ونصائح حول الحياة الطلابية في الخارج'),
  ('الأسئلة العامة', 'أسئلة عامة ومساعدة متنوعة');

-- Enable realtime for real-time features
ALTER TABLE forum_posts REPLICA IDENTITY FULL;
ALTER TABLE group_messages REPLICA IDENTITY FULL;
ALTER TABLE event_rsvps REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE event_rsvps;
