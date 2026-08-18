import { describe, it, expect } from "vitest";
import {
  emptyBlock,
  newBlockId,
  nextVersion,
  resolveText,
  splitTokens,
  isUnresolvedToken,
  collectVariables,
  resolveBlocks,
  VARIABLE_KEYS,
  type DocBlock,
  type VariableMap,
} from "@/lib/documentBlocks";

/**
 * Guards the DocBlock[] shape invariant the editor relies on: every block
 * always has a unique `id` + the correct `type`-discriminated fields, and the
 * editor's map/insert/delete operations never produce a malformed array.
 * Mirrors the runtime ops in AdminDocumentEditorPage (updateBlock / insert /
 * remove / arrayMove) without pulling in React or Supabase.
 */

const updateBlock = (blocks: DocBlock[], id: string, patch: Partial<DocBlock>): DocBlock[] =>
  blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as DocBlock) : b));

const insertAfter = (blocks: DocBlock[], id: string | null, block: DocBlock): DocBlock[] => {
  const next = [...blocks];
  const idx = id ? next.findIndex((b) => b.id === id) : -1;
  if (idx >= 0) next.splice(idx + 1, 0, block);
  else next.push(block);
  return next;
};

const removeBlock = (blocks: DocBlock[], id: string): DocBlock[] =>
  blocks.filter((b) => b.id !== id);

const moveBlock = (blocks: DocBlock[], from: number, to: number): DocBlock[] => {
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const allHaveIdAndType = (blocks: DocBlock[]) =>
  blocks.every((b) => typeof b.id === "string" && b.id.length > 0 && typeof b.type === "string");

describe("documentBlocks editor operations", () => {
  it("emptyBlock produces a valid shape for every block type", () => {
    const types = ["cover", "heading", "paragraph", "list", "table", "callout", "flow", "signature", "disclaimer", "pagebreak"] as const;
    for (const type of types) {
      const b = emptyBlock(type);
      expect(b.id).toMatch(/^b_/);
      expect(b.type).toBe(type);
    }
  });

  it("newBlockId is unique across rapid successive calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newBlockId()));
    expect(ids.size).toBe(200);
  });

  it("updateBlock patches only the matching block and preserves shape", () => {
    const a = emptyBlock("paragraph");
    const b = emptyBlock("heading");
    const out = updateBlock([a, b], a.id, { text: "hello" });
    expect(out[0].type).toBe("paragraph");
    expect((out[0] as { text: string }).text).toBe("hello");
    expect(out[1]).toEqual(b);
    expect(allHaveIdAndType(out)).toBe(true);
  });

  it("insertAfter inserts after the anchor, or appends when no anchor", () => {
    const a = emptyBlock("paragraph");
    const b = emptyBlock("heading");
    const c = emptyBlock("list");
    const blocks = [a, b];
    const out1 = insertAfter(blocks, a.id, c);
    expect(out1.map((x) => x.id)).toEqual([a.id, c.id, b.id]);
    const out2 = insertAfter(blocks, null, c);
    expect(out2.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(allHaveIdAndType(out2)).toBe(true);
  });

  it("removeBlock drops only the matching id", () => {
    const a = emptyBlock("paragraph");
    const b = emptyBlock("heading");
    const out = removeBlock([a, b], a.id);
    expect(out.map((x) => x.id)).toEqual([b.id]);
  });

  it("moveBlock preserves the id set (reorder only)", () => {
    const a = emptyBlock("paragraph");
    const b = emptyBlock("heading");
    const c = emptyBlock("list");
    const out = moveBlock([a, b, c], 0, 2);
    expect(out.map((x) => x.id)).toEqual([b.id, c.id, a.id]);
    expect(allHaveIdAndType(out)).toBe(true);
  });

  it("nextVersion increments the minor segment and never regresses", () => {
    expect(nextVersion("1.0")).toBe("1.1");
    expect(nextVersion("1.9")).toBe("1.10");
    expect(nextVersion("2.3")).toBe("2.4");
    expect(nextVersion("")).toBe("1.1");
  });
});

describe("documentBlocks token resolution", () => {
  const vars: VariableMap = { partner_amount: "₪1000", lock_days: "20" };

  it("resolveText substitutes known tokens and leaves unknown intact", () => {
    expect(resolveText("Partner earns {{partner_amount}} here", vars)).toBe("Partner earns ₪1000 here");
    expect(resolveText("Unknown {{missing}} stays", vars)).toBe("Unknown {{missing}} stays");
    expect(resolveText("Locked {{lock_days}} days", vars)).toBe("Locked 20 days");
  });

  it("splitTokens separates plain runs from {{token}} fragments", () => {
    const parts = splitTokens("a {{x}} b");
    expect(parts).toEqual(["a ", "{{x}}", " b"]);
  });

  it("isUnresolvedToken matches a bare token fragment", () => {
    expect(isUnresolvedToken("{{x}}")).toBe(true);
    expect(isUnresolvedToken("not a token")).toBe(false);
  });

  it("collectVariables dedupes tokens across all block text", () => {
    const blocks: DocBlock[] = [
      { id: "1", type: "paragraph", text: "{{partner_amount}} and {{lock_days}}" },
      { id: "2", type: "paragraph", text: "{{partner_amount}} again" },
    ];
    expect(collectVariables(blocks).sort()).toEqual(["lock_days", "partner_amount"]);
  });

  it("resolveBlocks substitutes tokens in every text-bearing field", () => {
    const blocks: DocBlock[] = [
      { id: "1", type: "cover", title: "{{partner_amount}}", subtitle: "sub {{lock_days}}", note: "n" },
      { id: "2", type: "table", headers: ["{{partner_amount}}"], rows: [["{{lock_days}}"]] },
      { id: "3", type: "signature", parties: ["a", "{{lock_days}}"] },
      { id: "4", type: "pagebreak" },
    ];
    const out = resolveBlocks(blocks, vars);
    expect((out[0] as { title: string }).title).toBe("₪1000");
    expect((out[1] as { headers: string[] }).headers).toEqual(["₪1000"]);
    expect((out[2] as { parties: string[] }).parties[1]).toBe("20");
    expect(out[3].type).toBe("pagebreak");
  });

  it("VARIABLE_KEYS is the authoritative token list (no service_fee/commission_rate)", () => {
    expect(VARIABLE_KEYS).toContain("partner_amount");
    expect(VARIABLE_KEYS).toContain("ambassador_amount");
    expect(VARIABLE_KEYS).toContain("agent_recruitment_amount");
    expect(VARIABLE_KEYS).toContain("lock_days");
    expect(VARIABLE_KEYS).not.toContain("service_fee");
    expect(VARIABLE_KEYS).not.toContain("commission_rate");
  });
});
