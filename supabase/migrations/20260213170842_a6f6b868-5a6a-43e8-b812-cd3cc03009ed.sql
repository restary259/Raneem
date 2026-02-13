-- Allow anonymous users to check if a user is an influencer
-- This is needed for the /apply funnel page to verify referral codes
CREATE POLICY "Anonymous can check influencer status" 
ON public.user_roles 
FOR SELECT 
USING (role = 'influencer'::app_role);