import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errorMessage";
import type { DocBlock } from "@/lib/documentBlocks";

export interface SaveState {
  /** True while a debounced write is queued or in flight. */
  saving: boolean;
  /** True when local blocks differ from the last persisted snapshot. */
  dirty: boolean;
  /** Last error message, cleared on a successful save. */
  error: string | null;
}

interface Options {
  documentId: string;
  versionId: string;
  version: string;
  /** Inline-edited document title (kept in sync on the library row). */
  title?: string;
  /** Debounce window in ms. */
  delayMs?: number;
}

/**
 * Debounced Supabase autosave for the document block editor. Every edit to
 * `blocks` (or `title`) schedules a 500ms write of `document_versions.content`
 * (+ the inline `documents_library.title`/`updated_by`). The manual `flush`
 * fires immediately and resolves when the write completes.
 *
 * Local state is the single source of truth: the hook keeps a snapshot of the
 * last persisted blocks so `dirty` reflects real divergence, not just "an edit
 * happened" (drag-reorder to the same order won't mark dirty).
 */
export function useDebouncedDocumentSave(
  blocks: DocBlock[],
  { documentId, versionId, version, title, delayMs = 500 }: Options,
) {
  const [state, setState] = useState<SaveState>({ saving: false, dirty: false, error: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  // Initialize the baseline lazily so the mount comparison does not mark a
  // freshly-loaded document as dirty (it equals its own persisted snapshot).
  const lastPersisted = useRef<DocBlock[] | null>(null);
  const initialised = useRef(false);
  const lastTitle = useRef<string | undefined>(title);

  const serialize = (b: DocBlock[]) => JSON.stringify(b);

  const persist = useCallback(async (snapshot: DocBlock[], t?: string) => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    const payload: Record<string, unknown> = {
      content: snapshot as unknown,
      updated_at: new Date().toISOString(),
    };
    if (uid) payload.updated_by = uid;
    const { error } = await supabase
      .from("document_versions")
      .update(payload)
      .eq("id", versionId);
    if (error) throw error;
    // Keep the library row's title + updated_at in step (the current_version
    // sync trigger handles the version string).
    if (t !== undefined) {
      const lib: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (uid) lib.updated_by = uid;
      if (t !== lastTitle.current) {
        lib.title = t;
        lastTitle.current = t;
      }
      const { error: libErr } = await supabase
        .from("documents_library")
        .update(lib)
        .eq("id", documentId);
      if (libErr) throw libErr;
    }
    lastPersisted.current = snapshot;
  }, [documentId, versionId]);

  // Schedule a debounced write whenever blocks/title change.
  useEffect(() => {
    const snap = blocks;
    if (!initialised.current) {
      // First run: adopt the initial snapshot as the baseline so loading a
      // document does not immediately mark it dirty.
      lastPersisted.current = snap;
      lastTitle.current = title;
      initialised.current = true;
      return;
    }
    const persisted = lastPersisted.current;
    const same = persisted !== null && serialize(snap) === serialize(persisted) && (title ?? undefined) === lastTitle.current;
    if (same) {
      setState((s) => (s.dirty ? { ...s, dirty: false } : s));
      return;
    }
    setState((s) => ({ ...s, dirty: true }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      setState((s) => ({ ...s, saving: true, error: null }));
      try {
        await inFlight.current;
        const p = persist(snap, title);
        inFlight.current = p;
        await p;
        setState((s) => ({ ...s, saving: false, dirty: false, error: null }));
      } catch (err: unknown) {
        const msg = errorMessage(err);
        setState((s) => ({ ...s, saving: false, error: msg }));
      }
    }, delayMs);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [blocks, title, delayMs, persist]);

  /** Flush pending changes immediately (manual "Save draft"). Resolves on done. */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await inFlight.current;
    const snap = blocks;
    const same =
      lastPersisted.current !== null &&
      serialize(snap) === serialize(lastPersisted.current) &&
      (title ?? undefined) === lastTitle.current;
    if (same) {
      setState((s) => ({ ...s, dirty: false }));
      return;
    }
    setState((s) => ({ ...s, saving: true, error: null }));
    try {
      await persist(snap, title);
      setState((s) => ({ ...s, saving: false, dirty: false, error: null }));
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setState((s) => ({ ...s, saving: false, error: msg }));
      throw err;
    }
  }, [blocks, title, persist]);

  /** Mark the current blocks as the persisted baseline (after loading). */
  const reset = useCallback((snapshot: DocBlock[]) => {
    lastPersisted.current = snapshot;
    lastTitle.current = title;
    setState({ saving: false, dirty: false, error: null });
  }, [title]);

  // Flush on unmount so a fast back-click within the debounce window never loses
  // edits. Errors are swallowed (the debounced path already surfaced them).
  useEffect(() => {
    return () => {
      const snap = blocksRef.current;
      const persisted = lastPersisted.current;
      const same = persisted !== null && serialize(snap) === serialize(persisted);
      // Best-effort flush on unmount — surface a failed write to the console
      // so a back-click never silently loses edits (the explicit flush() path
      // already toasts). A full re-mount toast would need a module-level flag.
      if (!same)
        void persist(snap, titleRef.current).catch((err) => {
          console.warn("[Darb] document autosave failed on unmount:", errorMessage(err));
        });
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs of the latest blocks/title for the unmount handler.
  const blocksRef = useRef(blocks);
  const titleRef = useRef(title);
  useEffect(() => { blocksRef.current = blocks; titleRef.current = title; });

  return { ...state, flush, reset };
}

export default useDebouncedDocumentSave;
