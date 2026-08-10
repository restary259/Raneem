import { describe, it, expect } from "vitest";
import { bagrutToGermanGrade, bagrutBatchConvert, parseBatchInput } from "./gradeConverter";

describe("bagrutToGermanGrade", () => {
  it("applies the modified Bavarian formula", () => {
    expect(bagrutToGermanGrade(100).german).toBe(1);
    expect(bagrutToGermanGrade(90).german).toBe(1.67);
    expect(bagrutToGermanGrade(55).german).toBe(4);
  });

  it("maps the grade onto an interpretation band", () => {
    expect(bagrutToGermanGrade(100).interpretation).toBe("Very good");
    expect(bagrutToGermanGrade(90).interpretation).toBe("Good");
    expect(bagrutToGermanGrade(70).interpretation).toBe("Satisfactory");
    expect(bagrutToGermanGrade(55).interpretation).toBe("Pass");
    expect(bagrutToGermanGrade(54).interpretation).toBe("Fail");
  });

  it("reports the formula it used", () => {
    expect(bagrutToGermanGrade(90).formulaString).toBe("1 + 3 × (100 − 90) / (100 − 55) = 1.67");
  });

  it("honours custom score bounds", () => {
    expect(bagrutToGermanGrade(60, 100, 60).german).toBe(4);
  });

  it("rejects non-numeric and out-of-range scores", () => {
    expect(() => bagrutToGermanGrade(Number.NaN)).toThrow("Bagrut score must be a number");
    expect(() => bagrutToGermanGrade("90" as unknown as number)).toThrow("Bagrut score must be a number");
    expect(() => bagrutToGermanGrade(-1)).toThrow(/between 0 and 100/);
    expect(() => bagrutToGermanGrade(101)).toThrow(/between 0 and 100/);
  });

  it("rejects bounds that cannot produce a scale", () => {
    expect(() => bagrutToGermanGrade(80, 55, 55)).toThrow("N_max must be greater than N_min");
  });
});

describe("bagrutBatchConvert", () => {
  it("converts each score and marks invalid entries with -1", () => {
    expect(bagrutBatchConvert([100, 200])).toEqual([
      { input: 100, german: 1, interpretation: "Very good" },
      { input: 200, german: -1, interpretation: "Fail" },
    ]);
  });

  it("returns an empty list for no scores", () => {
    expect(bagrutBatchConvert([])).toEqual([]);
  });
});

describe("parseBatchInput", () => {
  it("splits on newlines, commas and semicolons", () => {
    expect(parseBatchInput("90\n80, 70; 60").scores).toEqual([90, 80, 70, 60]);
  });

  it("ignores blank segments", () => {
    expect(parseBatchInput("90,,\n\n 80 ").scores).toEqual([90, 80]);
  });

  it("collects a readable error per invalid line", () => {
    const { scores, errors } = parseBatchInput("90,abc,120");
    expect(scores).toEqual([90]);
    expect(errors).toEqual([
      '"abc" is not a valid Bagrut score (0–100)',
      '"120" is not a valid Bagrut score (0–100)',
    ]);
  });
});
