import { supabase } from '@/integrations/supabase/client';

/**
 * Records that the signed-in user viewed/downloaded a student document.
 * Fire-and-forget: never blocks or breaks the download flow.
 */
export const logDocumentAccess = (
  documentId: string | undefined | null,
  action: 'view' | 'download' | 'preview' = 'download',
): void => {
  if (!documentId) return;
  void supabase
    .rpc('log_document_access', { _document_id: documentId, _action: action })
    .then(({ error }) => {
      if (error) console.warn('[documentAccessLog]', error.message);
    });
};
