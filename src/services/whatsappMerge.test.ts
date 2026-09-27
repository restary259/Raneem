import { describe, it, expect, vi } from "vitest";
// WhatsAppService registers a module-level supabase.auth.onAuthStateChange
// listener, so the mock must expose `auth` (the sibling supabase mocks do too).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}));
import { mergeWhatsAppMessages } from "./WhatsAppService";
const m = (id: string, t: string, p: string | null = null) => ({ id, created_at: t, provider_message_id: p } as any);
describe("mergeWhatsAppMessages", () => {
  it("orders, dedupes and replaces by id", () => {
    const r = mergeWhatsAppMessages([m("b", "2"), m("a", "1")], [m("b", "2"), m("c", "3")]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("drops optimistic row when real row arrives", () => {
    const r = mergeWhatsAppMessages([m("tmp-1", "5", "wamid")], [m("real", "5", "wamid")]);
    expect(r.map((x) => x.id)).toEqual(["real"]);
  });
  it("prepends older pages", () => {
    expect(mergeWhatsAppMessages([m("z", "9")], [m("y", "1")]).map((x) => x.id)).toEqual(["y", "z"]);
  });
});
