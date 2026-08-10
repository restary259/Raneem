import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildCsv, downloadCsv } from "./csv";

describe("buildCsv", () => {
  it("quotes every cell and separates rows with CRLF", () => {
    expect(buildCsv([{ name: "Sami", city: "Haifa" }])).toBe('"name","city"\r\n"Sami","Haifa"');
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(buildCsv([{ note: 'said "hi"' }])).toBe('"note"\r\n"said ""hi"""');
  });

  it("unions the keys of every row and blanks missing cells", () => {
    const csv = buildCsv([{ a: 1 }, { b: 2 }]);
    expect(csv).toBe('"a","b"\r\n"1",""\r\n"","2"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(buildCsv([{ a: null, b: undefined }])).toBe('"a","b"\r\n"",""');
  });

  it("returns an empty string for no rows", () => {
    expect(buildCsv([])).toBe("");
  });
});

describe("downloadCsv", () => {
  let blobs: Blob[];
  let clicks: HTMLAnchorElement[];

  beforeEach(() => {
    blobs = [];
    clicks = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a UTF-8 BOM'd file and releases the object url", async () => {
    expect(downloadCsv([{ name: "سامي" }], "students")).toBe(true);
    expect(clicks[0].download).toBe("students.csv");
    expect(clicks[0].href).toBe("blob:csv");
    expect(blobs[0].type).toBe("text/csv;charset=utf-8");
    // Excel needs the BOM to read Arabic; `Blob.text()` strips it, so check the bytes.
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blobs[0].text()).toBe('"name"\r\n"سامي"');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });

  it("keeps an explicit .csv extension instead of doubling it", () => {
    downloadCsv([{ a: 1 }], "report.csv");
    expect(clicks[0].download).toBe("report.csv");
  });

  it("does nothing when there is no data", () => {
    expect(downloadCsv([], "empty")).toBe(false);
    expect(clicks).toHaveLength(0);
  });
});
