import type { DocBlock } from "@/lib/documentBlocks";

/**
 * Returns a function that mints unique, human-readable block ids for a single
 * document build: `<prefix>_<lang>_<base36-counter>`. Each call to the factory
 * starts a fresh counter, so there is no module-level mutable state to reset
 * (the old per-file `let n = 0` + `n = 0` pattern was shared across calls and
 * order-dependent).
 *
 * Used by the seed-content builders in `src/content/documents/*.ts`.
 */
export function blockIdFactory(prefix: string, lang: string): () => string {
  let n = 0;
  return () => `${prefix}_${lang}_${(n++).toString(36)}`;
}

/** Convenience: mint a block with a fresh id from the given factory. */
export function block(
  id: string,
  b: Omit<DocBlock, "id">,
): DocBlock {
  return { id, ...b } as DocBlock;
}
