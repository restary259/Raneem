import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  collectAllPages,
  formatGbpAddress,
  GBP_LOCATION_READ_MASK,
  normalizeGbpLocation,
  pickActiveConnectionId,
  resourceId,
} from "@/lib/googleBusinessGateway";
import {
  addressesAgree,
  suggestLocationMatch,
} from "@/lib/googleLocationMatch";

describe("GBP_LOCATION_READ_MASK", () => {
  // Regression: a bare top-level `placeId` path makes Google reject the whole
  // accounts.locations.list call with INVALID_ARGUMENT. Place ID lives under
  // `metadata` (v1 Metadata.placeId), which normalizeGbpLocation already reads.
  const fields = GBP_LOCATION_READ_MASK.split(",").map((f) => f.trim());

  it("does not request the non-existent top-level `placeId` field", () => {
    expect(fields).not.toContain("placeId");
  });

  it("requests `metadata`, which carries placeId and mapsUri", () => {
    expect(fields).toContain("metadata");
  });

  it("never requests locationState (Google v1 rejects it with 400)", () => {
    expect(fields).not.toContain("locationState");
  });

  it("reads verification from metadata.hasVoiceOfMerchant", () => {
    const v = normalizeGbpLocation("accounts/1", {
      name: "accounts/1/locations/2",
      metadata: { hasVoiceOfMerchant: true },
    });
    expect(v!.verification_state).toBe("VERIFIED");
    expect(v!.location_state).toBe("OPEN");
    const p = normalizeGbpLocation("accounts/1", {
      name: "accounts/1/locations/2",
      metadata: { hasVoiceOfMerchant: false, isDisconnected: true },
    });
    expect(p!.verification_state).toBe("PENDING");
    expect(p!.location_state).toBe("DISCONNECTED");
  });
});

describe("pickActiveConnectionId", () => {
  // Regression: discovery used to pass p_connection_id = null, so cached
  // locations lost their connection ownership even when a connection existed.
  it("prefers the most recent connected connection", () => {
    expect(
      pickActiveConnectionId([
        { id: "c-new", connection_status: "connected" },
        { id: "c-old", connection_status: "revoked" },
      ]),
    ).toBe("c-new");
  });

  it("falls back to the first row when none is marked connected", () => {
    expect(
      pickActiveConnectionId([{ id: "only", connection_status: "pending" }]),
    ).toBe("only");
  });

  it("returns null when there is no connection row", () => {
    expect(pickActiveConnectionId([])).toBeNull();
    expect(pickActiveConnectionId(null)).toBeNull();
    expect(pickActiveConnectionId(undefined)).toBeNull();
  });
});

describe("resourceId", () => {
  it("takes the last path segment of a Google resource name", () => {
    expect(resourceId("accounts/123/locations/456")).toBe("456");
    expect(resourceId("accounts/123")).toBe("123");
  });
});

describe("normalizeGbpLocation", () => {
  const raw = {
    name: "accounts/123/locations/456",
    title: "DARB Berlin",
    storeCode: "BER-1",
    phoneNumbers: { primaryPhone: "+49 30 1234" },
    websiteUri: "https://darb.agency",
    categories: { primaryCategory: { displayName: "Education consultant" } },
    storefrontAddress: {
      addressLines: ["Example Strasse 10", "Second floor"],
      locality: "Berlin",
      postalCode: "10115",
      regionCode: "DE",
    },
    metadata: { placeId: "place-1", mapsUri: "https://maps.google.com/?cid=1" },
    locationState: { isVerified: true, isSuspended: false },
  };

  it("maps the fields DARB stores", () => {
    const row = normalizeGbpLocation("accounts/123", raw);
    expect(row).not.toBeNull();
    expect(row!.google_location_id).toBe("456");
    expect(row!.google_location_resource_name).toBe(
      "accounts/123/locations/456",
    );
    expect(row!.location_name).toBe("DARB Berlin");
    expect(row!.address_json).toEqual({
      address_line_1: "Example Strasse 10",
      address_line_2: "Second floor",
      city: "Berlin",
      postal_code: "10115",
      country: "DE",
    });
    expect(row!.phone).toBe("+49 30 1234");
    expect(row!.place_id).toBe("place-1");
    expect(row!.verification_state).toBe("VERIFIED");
  });

  it("files the location under the caller-verified account, not the payload", () => {
    const row = normalizeGbpLocation("accounts/verified", raw);
    expect(row!.google_account_id).toBe("accounts/verified");
  });

  it("rejects a location with no resource name", () => {
    expect(normalizeGbpLocation("accounts/1", { title: "No name" })).toBeNull();
  });

  it("marks a suspended location", () => {
    const row = normalizeGbpLocation("accounts/1", {
      name: "accounts/1/locations/9",
      locationState: { isSuspended: true },
    });
    expect(row!.verification_state).toBe("SUSPENDED");
    expect(row!.location_state).toBe("SUSPENDED");
  });
});

describe("formatGbpAddress", () => {
  it("joins the parts that exist", () => {
    expect(
      formatGbpAddress({
        address_line_1: "Example Strasse 10",
        address_line_2: null,
        city: "Berlin",
        postal_code: "10115",
        country: "DE",
      }),
    ).toBe("Example Strasse 10, 10115, Berlin, DE");
  });

  it("returns null when there is nothing to show", () => {
    expect(formatGbpAddress(null)).toBeNull();
    expect(
      formatGbpAddress({
        address_line_1: null,
        address_line_2: null,
        city: null,
        postal_code: null,
        country: null,
      }),
    ).toBeNull();
  });
});

describe("collectAllPages", () => {
  it("follows nextPageToken until exhausted and reports complete", async () => {
    const pages = [
      { items: ["a", "b"], nextPageToken: "t1" },
      { items: ["c"], nextPageToken: "t2" },
      { items: ["d"] },
    ];
    let call = 0;
    const { items, complete } = await collectAllPages(
      async () => pages[call++],
    );
    expect(items).toEqual(["a", "b", "c", "d"]);
    expect(complete).toBe(true);
    expect(call).toBe(3);
  });

  it("stops and reports incomplete if the provider repeats a page token", async () => {
    let call = 0;
    const { items, complete } = await collectAllPages(async () => {
      call++;
      return { items: [call], nextPageToken: "same" };
    });
    expect(items).toEqual([1, 2]);
    expect(complete).toBe(false);
  });

  it("reports incomplete when the page ceiling is hit with a token left", async () => {
    let call = 0;
    const { items, complete } = await collectAllPages(async () => {
      call++;
      return { items: [call], nextPageToken: `t${call}` };
    }, 3);
    expect(call).toBe(3);
    expect(items).toEqual([1, 2, 3]);
    expect(complete).toBe(false);
  });
});

describe("suggestLocationMatch", () => {
  const berlinOffice = {
    name: "DARB Berlin",
    city: "Berlin",
    addressLine1: "Example Strasse 10",
    postalCode: "10115",
    phone: "+49 30 1234",
    website: "https://darb.agency",
  };

  it("suggests the matching office location", () => {
    const match = suggestLocationMatch(berlinOffice, {
      title: "DARB Berlin",
      city: "Berlin",
      addressLine1: "Example Strasse 10",
      postalCode: "10115",
      phone: "+49 30 1234",
      website: "https://darb.agency",
    });
    expect(match.suggested).toBe(true);
    expect(match.score).toBe(100);
  });

  it("never lets a name-only match become decisive", () => {
    const match = suggestLocationMatch(berlinOffice, {
      title: "DARB Berlin",
      city: "Hamburg",
      postalCode: "20095",
      phone: "+49 40 9999",
      website: "https://other.example",
    });
    expect(match.suggested).toBe(false);
    expect(match.signals.find((s) => s.key === "name")!.matched).toBe(true);
    expect(match.signals.find((s) => s.key === "city")!.matched).toBe(false);
  });

  it("does not suggest an unrelated city", () => {
    const match = suggestLocationMatch(berlinOffice, {
      title: "DARB Hamburg",
      city: "Hamburg",
      postalCode: "20095",
    });
    expect(match.suggested).toBe(false);
  });

  it("treats differently formatted phone numbers as equal", () => {
    const match = suggestLocationMatch(berlinOffice, {
      city: "Berlin",
      phone: "+49301234",
    });
    expect(match.signals.find((s) => s.key === "phone")!.matched).toBe(true);
  });
});

describe("addressesAgree", () => {
  it("agrees when city and street match", () => {
    expect(
      addressesAgree(
        { city: "Berlin", addressLine1: "Example Strasse 10" },
        { city: "Berlin", addressLine1: "Example Strasse 10" },
      ),
    ).toBe(true);
  });

  it("does not agree on a city alone", () => {
    expect(addressesAgree({ city: "Berlin" }, { city: "Berlin" })).toBe(false);
  });
});

// Discovery must pass a real connection id to the cache RPC; passing null was
// the regression that stripped connection ownership from every cached location.
describe("location discovery wiring", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/googleBusinessLocation.functions.ts"),
    "utf8",
  );

  it("resolves the active connection before syncing", () => {
    expect(source).toContain("resolveConnectionId");
    expect(source).toContain("admin_get_google_business_connections");
    expect(source).toContain("pickActiveConnectionId");
  });

  it("never passes a null connection id to the sync RPC", () => {
    expect(source).not.toMatch(/p_connection_id:\s*null/);
    expect(source).toMatch(/p_connection_id:\s*connectionId/);
  });
});
