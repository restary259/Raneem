
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('offer', 'deadline', 'message', 'system', 'custom')),
  category text NOT NULL,
  reference_id uuid NULL,
  title text NOT NULL,
  message text NOT NULL,
  url text NULL,
  data jsonb NULL,
  is_read boolean DEFAULT false,
  channel jsonb NOT NULL DEFAULT '{"inApp": true, "push": false, "email": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  delivered_at jsonb NULL
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  channels jsonb DEFAULT '{"inApp": true, "push": true, "email": false}'::jsonb,
  frequency jsonb DEFAULT '{"offer": "instant", "deadline": "reminder", "digest": "daily"}'::jsonb,
  custom_rules jsonb DEFAULT '[]'::jsonb,
  push_token text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON notifications 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
  ON notifications 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can create notifications" 
  ON notifications 
  FOR INSERT 
  WITH CHECK (true);

-- Enable RLS on notification_settings table
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_settings
CREATE POLICY "Users can view their own notification settings" 
  ON notification_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification settings" 
  ON notification_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings" 
  ON notification_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type_category ON notifications(type, category);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create trigger for updated_at on notification_settings
CREATE TRIGGER update_notification_settings_updated_at 
  BEFORE UPDATE ON notification_settings 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable realtime for notifications table
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
