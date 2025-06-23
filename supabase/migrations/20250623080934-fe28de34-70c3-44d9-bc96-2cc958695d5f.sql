
-- Create views table for recently viewed items
CREATE TABLE public.views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('university', 'program', 'partner', 'offer')),
  item_id text NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  item_data jsonb NULL -- Store title, image_url, description for quick access
);

-- Add Row Level Security
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own records
CREATE POLICY "Users can view their own views" 
  ON public.views 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own views
CREATE POLICY "Users can create their own views" 
  ON public.views 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own views  
CREATE POLICY "Users can update their own views" 
  ON public.views 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_views_user ON public.views(user_id);
CREATE INDEX idx_views_recent ON public.views(user_id, viewed_at DESC);
CREATE INDEX idx_views_item ON public.views(item_type, item_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_views_updated_at
  BEFORE UPDATE ON public.views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
