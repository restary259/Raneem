DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_leads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_internal_notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_internal_notes;
  END IF;
END $$;
ALTER TABLE public.whatsapp_leads REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_internal_notes REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;