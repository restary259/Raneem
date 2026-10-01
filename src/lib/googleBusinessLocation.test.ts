import { describe, it, expect } from "vitest";
import {
  collectAllPages,
  formatGbpAddress,
  normalizeGbpLocation,
  resourceId,
} from "@/lib/googleBusinessGateway";
import {
  addressesAgree,
  suggestLocationMatch,
} from "@/lib/googleLocationMatch";

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
  it("follows nextPageToken until exhausted", async () => {
    const pages = [
      { items: ["a", "b"], nextPageToken: "t1" },
      { items: ["c"], nextPageToken: "t2" },
      { items: ["d"] },
    ];
    let call = 0;
    const all = await collectAllPages(async () => pages[call++]);
    expect(all).toEqual(["a", "b", "c", "d"]);
    expect(call).toBe(3);
  });

  it("stops if the provider repeats a page token", async () => {
    let call = 0;
    const all = await collectAllPages(async () => {
      call++;
      return { items: [call], nextPageToken: "same" };
    });
    expect(all).toEqual([1, 2]);
  });

  it("honours the page ceiling", async () => {
    let call = 0;
    await collectAllPages(async () => {
      call++;
      return { items: [call], nextPageToken: `t${call}` };
    }, 3);
    expect(call).toBe(3);
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
