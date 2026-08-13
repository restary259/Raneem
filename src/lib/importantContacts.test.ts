import { describe, it, expect } from "vitest";
import {
  matchContact,
  filterContactsByContext,
  type ImportantContact,
  type StudentContext,
} from "./importantContacts";

const FU = "school-fu";
const GO = "school-go";
const HEIDELBERG = "Heidelberg";
const BERLIN = "Berlin";

const student = (schoolId: string | null, city: string | null): StudentContext => ({
  schoolId,
  city,
});

const contact = (
  over: Partial<ImportantContact> & Pick<ImportantContact, "id">,
): ImportantContact => ({
  scope: "universal",
  is_universal: true,
  is_active: true,
  language_school_id: null,
  city: null,
  ...over,
});

const universal = (id: string): ImportantContact =>
  contact({ id, scope: "universal", is_universal: true });

const schoolOnly = (id: string, schoolId: string): ImportantContact =>
  contact({ id, scope: "school_only", is_universal: false, language_school_id: schoolId });

const cityOnly = (id: string, city: string): ImportantContact =>
  contact({ id, scope: "city_only", is_universal: false, city });

const schoolCity = (id: string, schoolId: string, city: string): ImportantContact =>
  contact({ id, scope: "school_city", is_universal: false, language_school_id: schoolId, city });

describe("matchContact — scope visibility rules", () => {
  it("Test 1 — FU Academy Heidelberg sees universal, FU, Heidelberg, FU+Heidelberg; not GO/KAPITO/other-city", () => {
    const ctx = student(FU, HEIDELBERG);
    expect(matchContact(universal("u"), ctx)).toBe("universal");
    expect(matchContact(schoolOnly("fu-so", FU), ctx)).toBe("school");
    expect(matchContact(cityOnly("hd-co", HEIDELBERG), ctx)).toBe("city");
    expect(matchContact(schoolCity("fu-hd", FU, HEIDELBERG), ctx)).toBe("school_city");

    // Leaks:
    expect(matchContact(schoolOnly("go-so", GO), ctx)).toBeNull();
    expect(matchContact(schoolCity("go-hd", GO, HEIDELBERG), ctx)).toBeNull();
    expect(matchContact(cityOnly("berlin-co", BERLIN), ctx)).toBeNull();
    expect(matchContact(schoolCity("fu-berlin", FU, BERLIN), ctx)).toBeNull();
  });

  it("Test 2 — GO Academy Heidelberg sees universal, Heidelberg, GO; not FU", () => {
    const ctx = student(GO, HEIDELBERG);
    expect(matchContact(universal("u"), ctx)).toBe("universal");
    expect(matchContact(cityOnly("hd-co", HEIDELBERG), ctx)).toBe("city");
    expect(matchContact(schoolOnly("go-so", GO), ctx)).toBe("school");
    expect(matchContact(schoolCity("go-hd", GO, HEIDELBERG), ctx)).toBe("school_city");

    expect(matchContact(schoolOnly("fu-so", FU), ctx)).toBeNull();
    expect(matchContact(schoolCity("fu-hd", FU, HEIDELBERG), ctx)).toBeNull();
  });

  it("Test 3 — FU Academy Other City sees universal + FU; not FU-Heidelberg-only", () => {
    const ctx = student(FU, BERLIN);
    expect(matchContact(universal("u"), ctx)).toBe("universal");
    expect(matchContact(schoolOnly("fu-so", FU), ctx)).toBe("school");
    // FU + Berlin would match, but FU + Heidelberg must not:
    expect(matchContact(schoolCity("fu-berlin", FU, BERLIN), ctx)).toBe("school_city");
    expect(matchContact(schoolCity("fu-hd", FU, HEIDELBERG), ctx)).toBeNull();
    expect(matchContact(schoolOnly("go-so", GO), ctx)).toBeNull();
  });

  it("Test 4 — No school selected sees only universal", () => {
    const ctx = student(null, HEIDELBERG);
    expect(matchContact(universal("u"), ctx)).toBe("universal");
    expect(matchContact(schoolOnly("fu-so", FU), ctx)).toBeNull();
    expect(matchContact(schoolCity("fu-hd", FU, HEIDELBERG), ctx)).toBeNull();
    // City-only still works without a school:
    expect(matchContact(cityOnly("hd-co", HEIDELBERG), ctx)).toBe("city");
  });

  it("Test 5 — disabled contact never matches", () => {
    const ctx = student(FU, HEIDELBERG);
    expect(matchContact({ ...universal("u"), is_active: false }, ctx)).toBeNull();
    expect(matchContact({ ...schoolOnly("fu", FU), is_active: false }, ctx)).toBeNull();
  });

  it("Test 6 — admin-created school+city contact only matches that school+city", () => {
    const newC = schoolCity("new-fu-hd", FU, HEIDELBERG);
    expect(matchContact(newC, student(FU, HEIDELBERG))).toBe("school_city");
    expect(matchContact(newC, student(GO, HEIDELBERG))).toBeNull();
    expect(matchContact(newC, student(FU, BERLIN))).toBeNull();
  });

  it("Test 7 — admin-created universal contact is visible to everyone", () => {
    const newU = universal("new-u");
    expect(matchContact(newU, student(FU, HEIDELBERG))).toBe("universal");
    expect(matchContact(newU, student(GO, BERLIN))).toBe("universal");
    expect(matchContact(newU, student(null, null))).toBe("universal");
  });

  it("Test 8 — a contact is rendered exactly once even if it could match multiple criteria", () => {
    // Same contact duplicated in the input list must appear once.
    const ctx = student(FU, HEIDELBERG);
    const dup = [schoolOnly("fu-so", FU), schoolOnly("fu-so", FU)];
    const groups = filterContactsByContext(dup, ctx);
    expect(groups).toHaveLength(1);
    expect(groups[0].contacts).toHaveLength(1);
    expect(groups[0].scope).toBe("school");
  });
});

describe("filterContactsByContext — grouping & ordering", () => {
  it("groups contacts and preserves input order within each group", () => {
    const ctx = student(FU, HEIDELBERG);
    const contacts = [
      schoolCity("fu-hd", FU, HEIDELBERG),
      universal("u1"),
      cityOnly("hd-co", HEIDELBERG),
      universal("u2"),
      schoolOnly("fu-so", FU),
      schoolOnly("go-so", GO), // excluded
    ];
    const groups = filterContactsByContext(contacts, ctx);
    expect(groups.map((g) => g.scope)).toEqual([
      "universal",
      "school_city",
      "school",
      "city",
    ]);
    expect(groups[0].contacts.map((c) => c.id)).toEqual(["u1", "u2"]);
  });

  it("returns no groups when nothing matches", () => {
    const ctx = student(null, null);
    const groups = filterContactsByContext(
      [schoolOnly("fu", FU), cityOnly("hd", HEIDELBERG), schoolCity("fu-hd", FU, HEIDELBERG)],
      ctx,
    );
    // cityOnly with no resolved city → null; nothing matches.
    expect(groups).toEqual([]);
  });
});
