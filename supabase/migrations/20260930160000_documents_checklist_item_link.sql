-- Link an uploaded document back to the checklist item it satisfies.
--
-- The checklist popup now collects the requested document, so the row it
-- creates must be attributable to the item. Nullable and ON DELETE SET NULL:
-- existing documents have no checklist item, and deleting a checklist item must
-- never delete the student's file — it only unlinks it.
--
-- An index on the non-null values keeps the checklist's "which items already
-- have a file?" lookup cheap.
--
-- MANUAL DEPLOY: apply via `supabase db push` or the dashboard SQL editor.
-- The Vercel build and ci.yml never apply DDL.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS checklist_item_id uuid
  REFERENCES public.checklist_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_checklist_item_id
  ON public.documents (checklist_item_id)
  WHERE checklist_item_id IS NOT NULL;

COMMENT ON COLUMN public.documents.checklist_item_id IS
  'The checklist item this upload satisfies. NULL for ad-hoc documents. ON DELETE SET NULL so removing a checklist item never removes the student''s file.';
